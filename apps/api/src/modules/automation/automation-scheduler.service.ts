import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AutomationExecutionStatus } from '../../common/enums/automation-execution-status.enum';
import { AutomationExecutionTrigger } from '../../common/enums/automation-execution-trigger.enum';
import { AutomationTriggerType } from '../../common/enums/automation-trigger-type.enum';
import { BudgetAlertStatus } from '../../common/enums/budget-alert-status.enum';
import { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';
import { ScheduledActionStatus } from '../../common/enums/scheduled-action-status.enum';
import { BudgetAlert } from '../../database/entities/budget-alert.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { AutomationExecution } from '../../database/entities/automation-execution.entity';
import { AutomationRule } from '../../database/entities/automation-rule.entity';
import { ScheduledAction } from '../../database/entities/scheduled-action.entity';
import { AutomationQueueService } from './automation-queue.service';
import type { DispatchResult } from './automation.mappers';

const DISPATCH_LIMIT = 100;

/**
 * Finds due scheduled actions and rules and turns each into a single
 * automation execution. Every execution carries a deterministic idempotency
 * key, so overlapping dispatchers can never create duplicate work.
 */
@Injectable()
export class AutomationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AutomationSchedulerService.name);

  constructor(
    @InjectRepository(AutomationRule)
    private readonly rules: Repository<AutomationRule>,
    @InjectRepository(ScheduledAction)
    private readonly scheduledActions: Repository<ScheduledAction>,
    @InjectRepository(AutomationExecution)
    private readonly executions: Repository<AutomationExecution>,
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    @InjectRepository(BudgetAlert)
    private readonly alerts: Repository<BudgetAlert>,
    private readonly queue: AutomationQueueService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('nodeEnv') === 'test') {
      return;
    }

    try {
      await this.queue.registerDispatchRepeatable();
    } catch (error) {
      this.logger.warn(
        `Could not register the automation dispatcher: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async dispatchDue(businessId?: string): Promise<DispatchResult> {
    const now = new Date();
    const result: DispatchResult = {
      scheduledActions: 0,
      scheduledRules: 0,
      eventRules: 0,
      executions: 0,
    };

    result.scheduledActions = await this.dispatchScheduledActions(businessId, now, result);
    result.scheduledRules = await this.dispatchScheduledRules(businessId, now, result);
    result.eventRules = await this.dispatchEventRules(businessId, now, result);

    return result;
  }

  private async dispatchScheduledActions(
    businessId: string | undefined,
    now: Date,
    result: DispatchResult,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      status: ScheduledActionStatus.SCHEDULED,
      runAt: LessThanOrEqual(now),
    };

    if (businessId) {
      where.businessId = businessId;
    }

    const due = await this.scheduledActions.find({
      where,
      order: { runAt: 'ASC' },
      take: DISPATCH_LIMIT,
    });

    let dispatched = 0;

    for (const action of due) {
      const claim = await this.scheduledActions.update(
        { id: action.id, status: ScheduledActionStatus.SCHEDULED },
        { status: ScheduledActionStatus.QUEUED, dispatchedAt: now },
      );

      if (!claim.affected) {
        continue;
      }

      const execution = await this.createExecution({
        businessId: action.businessId,
        ruleId: null,
        scheduledActionId: action.id,
        actorUserId: action.createdByUserId,
        trigger: AutomationExecutionTrigger.SCHEDULE,
        idempotencyKey: `action:${action.id}`,
      });

      if (execution) {
        await this.queue.enqueueExecution(execution.id);
        dispatched += 1;
        result.executions += 1;
      }
    }

    return dispatched;
  }

  private async dispatchScheduledRules(
    businessId: string | undefined,
    now: Date,
    result: DispatchResult,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      isActive: true,
      triggerType: AutomationTriggerType.SCHEDULE,
      nextRunAt: LessThanOrEqual(now),
    };

    if (businessId) {
      where.businessId = businessId;
    }

    const due = await this.rules.find({
      where,
      order: { nextRunAt: 'ASC' },
      take: DISPATCH_LIMIT,
    });

    let dispatched = 0;

    for (const rule of due) {
      const occurrence = rule.nextRunAt ?? now;
      const execution = await this.createExecution({
        businessId: rule.businessId,
        ruleId: rule.id,
        actorUserId: rule.createdByUserId,
        trigger: AutomationExecutionTrigger.SCHEDULE,
        idempotencyKey: `rule:${rule.id}:${occurrence.toISOString()}`,
      });

      await this.rules.update(rule.id, {
        lastRunAt: now,
        nextRunAt: this.nextRunAt(rule.runAt, rule.intervalMinutes, now),
      });

      if (execution) {
        await this.queue.enqueueExecution(execution.id);
        dispatched += 1;
        result.executions += 1;
      }
    }

    return dispatched;
  }

  private async dispatchEventRules(
    businessId: string | undefined,
    now: Date,
    result: DispatchResult,
  ): Promise<number> {
    const where: Record<string, unknown> = { isActive: true };

    if (businessId) {
      where.businessId = businessId;
    }

    const rules = await this.rules.find({ where });

    if (rules.length === 0) {
      return 0;
    }

    const rejectedRules = rules.filter(
      (rule) =>
        rule.triggerType === AutomationTriggerType.CAMPAIGN_REJECTED && rule.campaignId,
    );
    const thresholdRules = rules.filter(
      (rule) => rule.triggerType === AutomationTriggerType.BUDGET_THRESHOLD,
    );
    let dispatched = 0;

    for (const rule of rejectedRules) {
      const campaign = await this.campaigns.findOne({
        where: { id: rule.campaignId as string, businessId: rule.businessId },
      });

      if (!campaign || campaign.metaReviewStatus !== MetaReviewStatus.REJECTED) {
        continue;
      }

      const execution = await this.createExecution({
        businessId: rule.businessId,
        ruleId: rule.id,
        actorUserId: rule.createdByUserId,
        trigger: AutomationExecutionTrigger.EVENT,
        idempotencyKey: `rule:${rule.id}:rejected:${campaign.id}:${this.dateKey(now)}`,
      });

      if (execution) {
        await this.queue.enqueueExecution(execution.id);
        await this.rules.update(rule.id, { lastRunAt: now });
        dispatched += 1;
        result.executions += 1;
      }
    }

    if (thresholdRules.length === 0) {
      return dispatched;
    }

    const alertWhere: Record<string, unknown> = { status: BudgetAlertStatus.OPEN };

    if (businessId) {
      alertWhere.businessId = businessId;
    }

    const openAlerts = await this.alerts.find({
      where: alertWhere,
      order: { createdAt: 'DESC' },
      take: DISPATCH_LIMIT * 2,
    });

    for (const rule of thresholdRules) {
      const matching = openAlerts.filter(
        (alert) =>
          alert.businessId === rule.businessId &&
          (rule.campaignId === null || alert.campaignId === rule.campaignId),
      );

      for (const alert of matching) {
        const execution = await this.createExecution({
          businessId: rule.businessId,
          ruleId: rule.id,
          actorUserId: rule.createdByUserId,
          trigger: AutomationExecutionTrigger.EVENT,
          idempotencyKey: `rule:${rule.id}:alert:${alert.id}`,
        });

        if (execution) {
          await this.queue.enqueueExecution(execution.id);
          await this.rules.update(rule.id, { lastRunAt: now });
          dispatched += 1;
          result.executions += 1;
        }
      }
    }

    return dispatched;
  }

  private async createExecution(input: {
    businessId: string;
    ruleId: string | null;
    scheduledActionId?: string | null;
    actorUserId: string | null;
    trigger: AutomationExecutionTrigger;
    idempotencyKey: string;
  }): Promise<AutomationExecution | null> {
    try {
      return await this.executions.save(
        this.executions.create({
          businessId: input.businessId,
          ruleId: input.ruleId,
          scheduledActionId: input.scheduledActionId ?? null,
          actorUserId: input.actorUserId,
          trigger: input.trigger,
          status: AutomationExecutionStatus.PENDING,
          idempotencyKey: input.idempotencyKey,
          maxAttempts: 3,
        }),
      );
    } catch (error) {
      if (this.isDuplicate(error)) {
        this.logger.debug(`Skipping duplicate automation key ${input.idempotencyKey}`);
        return null;
      }

      throw error;
    }
  }

  /** Next occurrence for an interval rule; one-off rules never fire twice. */
  nextRunAt(runAt: Date | null, intervalMinutes: number | null, now: Date): Date | null {
    if (!intervalMinutes || intervalMinutes < 1) {
      return null;
    }

    const stepMs = intervalMinutes * 60 * 1000;
    const base = runAt ? new Date(runAt).getTime() : now.getTime();

    if (base > now.getTime()) {
      return new Date(base);
    }

    const steps = Math.floor((now.getTime() - base) / stepMs) + 1;

    return new Date(base + steps * stepMs);
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private isDuplicate(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string; errno?: number }).code === 'ER_DUP_ENTRY'
    );
  }
}
