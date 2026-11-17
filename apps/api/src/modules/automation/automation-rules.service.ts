import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { AutomationActionType } from '../../common/enums/automation-action-type.enum';
import { AutomationExecutionStatus } from '../../common/enums/automation-execution-status.enum';
import { AutomationExecutionTrigger } from '../../common/enums/automation-execution-trigger.enum';
import { AutomationTriggerType } from '../../common/enums/automation-trigger-type.enum';
import { ScheduledActionStatus } from '../../common/enums/scheduled-action-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { AutomationExecution } from '../../database/entities/automation-execution.entity';
import { AutomationRule } from '../../database/entities/automation-rule.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { ScheduledAction } from '../../database/entities/scheduled-action.entity';
import { AdvertisingService } from '../advertising/advertising.service';
import { AuditService } from '../audit/audit.service';
import { AutomationQueueService } from './automation-queue.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import {
  toAutomationExecutionView,
  toAutomationRuleView,
  toScheduledActionView,
  type AutomationExecutionView,
  type AutomationRuleView,
  type PagedAutomationResult,
  type ScheduledActionView,
} from './automation.mappers';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { CreateScheduledActionDto } from './dto/create-scheduled-action.dto';
import { ListAutomationRulesQueryDto } from './dto/list-automation-rules-query.dto';
import { ListExecutionsQueryDto } from './dto/list-executions-query.dto';
import { ListScheduledActionsQueryDto } from './dto/list-scheduled-actions-query.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

export interface ManualRunResult {
  executionId: string;
  queued: boolean;
}

const RETRYABLE_STATUSES = [
  AutomationExecutionStatus.FAILED,
  AutomationExecutionStatus.DEAD_LETTER,
  AutomationExecutionStatus.SKIPPED,
];

@Injectable()
export class AutomationRulesService {
  constructor(
    @InjectRepository(AutomationRule)
    private readonly rules: Repository<AutomationRule>,
    @InjectRepository(AutomationExecution)
    private readonly executions: Repository<AutomationExecution>,
    @InjectRepository(ScheduledAction)
    private readonly scheduledActions: Repository<ScheduledAction>,
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    private readonly advertising: AdvertisingService,
    private readonly audit: AuditService,
    private readonly queue: AutomationQueueService,
    private readonly scheduler: AutomationSchedulerService,
  ) {}

  async listRules(
    businessId: string,
    query: ListAutomationRulesQueryDto,
  ): Promise<AutomationRuleView[]> {
    const builder = this.rules
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.campaign', 'campaign')
      .leftJoinAndSelect('rule.createdByUser', 'createdBy')
      .where('rule.businessId = :businessId', { businessId })
      .orderBy('rule.createdAt', 'DESC');

    if (query.triggerType) {
      builder.andWhere('rule.triggerType = :triggerType', { triggerType: query.triggerType });
    }

    if (query.isActive !== undefined) {
      builder.andWhere('rule.isActive = :isActive', { isActive: query.isActive });
    }

    const rules = await builder.getMany();

    return rules.map(toAutomationRuleView);
  }

  async getRule(businessId: string, ruleId: string): Promise<AutomationRuleView> {
    return toAutomationRuleView(await this.requireRule(businessId, ruleId));
  }

  async createRule(
    actorUserId: string,
    businessId: string,
    dto: CreateAutomationRuleDto,
    context: RequestContext,
  ): Promise<AutomationRuleView> {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Automation rules need a name');
    }

    await this.assertValidShape(businessId, {
      triggerType: dto.triggerType,
      actionType: dto.actionType,
      campaignId: dto.campaignId ?? null,
      notifyMessage: dto.notifyMessage ?? null,
      runAt: dto.runAt ? new Date(dto.runAt) : null,
      intervalMinutes: dto.intervalMinutes ?? null,
    });

    const now = new Date();
    const runAt = dto.runAt ? new Date(dto.runAt) : null;
    const intervalMinutes = dto.intervalMinutes ?? null;
    const isActive = dto.isActive ?? true;

    const rule = await this.rules.save(
      this.rules.create({
        businessId,
        name,
        description: dto.description?.trim() || null,
        triggerType: dto.triggerType,
        actionType: dto.actionType,
        campaignId: dto.campaignId ?? null,
        runAt,
        intervalMinutes,
        nextRunAt:
          dto.triggerType === AutomationTriggerType.SCHEDULE && isActive
            ? this.firstRunAt(runAt, intervalMinutes, now)
            : null,
        notifyMessage: dto.notifyMessage?.trim() || null,
        isActive,
        createdByUserId: actorUserId,
      }),
    );

    await this.audit.record({
      action: 'automation_rule.created',
      actorUserId,
      businessId,
      entityType: 'automation_rule',
      entityId: rule.id,
      metadata: {
        triggerType: rule.triggerType,
        actionType: rule.actionType,
        nextRunAt: rule.nextRunAt,
      },
      context,
    });

    return this.getRule(businessId, rule.id);
  }

  async updateRule(
    actorUserId: string,
    businessId: string,
    ruleId: string,
    dto: UpdateAutomationRuleDto,
    context: RequestContext,
  ): Promise<AutomationRuleView> {
    const rule = await this.requireRule(businessId, ruleId);
    const triggerType = dto.triggerType ?? rule.triggerType;
    const actionType = dto.actionType ?? rule.actionType;
    const campaignId = dto.campaignId !== undefined ? dto.campaignId : rule.campaignId;
    const notifyMessage =
      dto.notifyMessage !== undefined ? dto.notifyMessage : rule.notifyMessage;
    const runAt = dto.runAt !== undefined ? new Date(dto.runAt) : rule.runAt;
    const intervalMinutes =
      dto.intervalMinutes !== undefined ? dto.intervalMinutes : rule.intervalMinutes;
    const isActive = dto.isActive !== undefined ? dto.isActive : rule.isActive;
    const name = dto.name !== undefined ? dto.name.trim() : rule.name;

    if (!name) {
      throw new BadRequestException('Automation rules need a name');
    }

    await this.assertValidShape(businessId, {
      triggerType,
      actionType,
      campaignId,
      notifyMessage,
      runAt,
      intervalMinutes,
    });

    const scheduleChanged =
      dto.triggerType !== undefined ||
      dto.runAt !== undefined ||
      dto.intervalMinutes !== undefined ||
      dto.isActive === true;

    rule.name = name;
    rule.description =
      dto.description !== undefined ? dto.description.trim() || null : rule.description;
    rule.triggerType = triggerType;
    rule.actionType = actionType;
    rule.campaignId = campaignId;
    rule.notifyMessage = notifyMessage?.trim() || null;
    rule.runAt = runAt;
    rule.intervalMinutes = intervalMinutes;
    rule.isActive = isActive;

    if (triggerType !== AutomationTriggerType.SCHEDULE || !isActive) {
      rule.nextRunAt = null;
    } else if (scheduleChanged) {
      rule.nextRunAt = this.firstRunAt(runAt, intervalMinutes, new Date());
    }

    const saved = await this.rules.save(rule);

    await this.audit.record({
      action: 'automation_rule.updated',
      actorUserId,
      businessId,
      entityType: 'automation_rule',
      entityId: saved.id,
      metadata: { triggerType, actionType, isActive, nextRunAt: saved.nextRunAt },
      context,
    });

    return this.getRule(businessId, ruleId);
  }

  async deleteRule(
    actorUserId: string,
    businessId: string,
    ruleId: string,
    context: RequestContext,
  ): Promise<void> {
    const rule = await this.requireRule(businessId, ruleId);
    await this.rules.remove(rule);
    await this.audit.record({
      action: 'automation_rule.deleted',
      actorUserId,
      businessId,
      entityType: 'automation_rule',
      entityId: ruleId,
      context,
    });
  }

  /** Manual run bypasses the schedule but still respects the approval gate. */
  async runRuleNow(
    actorUserId: string,
    businessId: string,
    ruleId: string,
    context: RequestContext,
  ): Promise<ManualRunResult> {
    const rule = await this.requireRule(businessId, ruleId);
    const execution = await this.executions.save(
      this.executions.create({
        businessId,
        ruleId: rule.id,
        actorUserId,
        trigger: AutomationExecutionTrigger.MANUAL,
        status: AutomationExecutionStatus.PENDING,
        idempotencyKey: `rule:${rule.id}:manual:${randomUUID()}`,
        maxAttempts: 3,
      }),
    );

    await this.queue.enqueueExecution(execution.id);
    await this.audit.record({
      action: 'automation.manual_run',
      actorUserId,
      businessId,
      entityType: 'automation_rule',
      entityId: rule.id,
      metadata: { executionId: execution.id },
      context,
    });

    return { executionId: execution.id, queued: true };
  }

  async listScheduledActions(
    businessId: string,
    query: ListScheduledActionsQueryDto,
  ): Promise<ScheduledActionView[]> {
    const builder = this.scheduledActions
      .createQueryBuilder('action')
      .leftJoinAndSelect('action.campaign', 'campaign')
      .leftJoinAndSelect('action.createdByUser', 'createdBy')
      .where('action.businessId = :businessId', { businessId })
      .orderBy('action.runAt', 'ASC');

    if (query.status) {
      builder.andWhere('action.status = :status', { status: query.status });
    }

    const actions = await builder.getMany();

    return actions.map(toScheduledActionView);
  }

  async createScheduledAction(
    actorUserId: string,
    businessId: string,
    dto: CreateScheduledActionDto,
    context: RequestContext,
  ): Promise<ScheduledActionView> {
    const campaign = await this.advertising.requireCampaign(businessId, dto.campaignId);
    const runAt = new Date(dto.runAt);

    if (runAt.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled actions must run in the future');
    }

    const action = await this.scheduledActions.save(
      this.scheduledActions.create({
        businessId,
        campaignId: campaign.id,
        actionType: dto.actionType,
        notifyMessage: dto.notifyMessage?.trim() || null,
        runAt,
        status: ScheduledActionStatus.SCHEDULED,
        createdByUserId: actorUserId,
      }),
    );

    await this.audit.record({
      action: 'scheduled_action.created',
      actorUserId,
      businessId,
      entityType: 'scheduled_action',
      entityId: action.id,
      metadata: { actionType: action.actionType, runAt: action.runAt },
      context,
    });

    return this.getScheduledAction(businessId, action.id);
  }

  async cancelScheduledAction(
    actorUserId: string,
    businessId: string,
    actionId: string,
    context: RequestContext,
  ): Promise<ScheduledActionView> {
    const action = await this.requireScheduledAction(businessId, actionId);

    if (
      action.status === ScheduledActionStatus.EXECUTED ||
      action.status === ScheduledActionStatus.FAILED ||
      action.status === ScheduledActionStatus.CANCELLED ||
      action.status === ScheduledActionStatus.SKIPPED
    ) {
      throw new BadRequestException('This scheduled action can no longer be cancelled');
    }

    action.status = ScheduledActionStatus.CANCELLED;
    await this.scheduledActions.save(action);

    await this.executions.update(
      {
        scheduledActionId: action.id,
        status: In([
          AutomationExecutionStatus.PENDING,
          AutomationExecutionStatus.PENDING_APPROVAL,
        ]),
      },
      {
        status: AutomationExecutionStatus.SKIPPED,
        error: 'Scheduled action was cancelled',
        finishedAt: new Date(),
      },
    );

    await this.audit.record({
      action: 'scheduled_action.cancelled',
      actorUserId,
      businessId,
      entityType: 'scheduled_action',
      entityId: action.id,
      context,
    });

    return this.getScheduledAction(businessId, actionId);
  }

  async listExecutions(
    businessId: string,
    query: ListExecutionsQueryDto,
  ): Promise<PagedAutomationResult<AutomationExecutionView>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
    const builder = this.executions
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.rule', 'rule')
      .where('execution.businessId = :businessId', { businessId })
      .orderBy('execution.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      builder.andWhere('execution.status = :status', { status: query.status });
    }

    if (query.ruleId) {
      builder.andWhere('execution.ruleId = :ruleId', { ruleId: query.ruleId });
    }

    if (query.scheduledActionId) {
      builder.andWhere('execution.scheduledActionId = :scheduledActionId', {
        scheduledActionId: query.scheduledActionId,
      });
    }

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map(toAutomationExecutionView),
      total,
      page,
      pageSize,
    };
  }

  async getExecution(businessId: string, executionId: string): Promise<AutomationExecutionView> {
    const execution = await this.executions.findOne({
      where: { id: executionId, businessId },
      relations: { rule: true },
    });

    if (!execution) {
      throw new NotFoundException('Automation execution not found');
    }

    return toAutomationExecutionView(execution);
  }

  async retryExecution(
    actorUserId: string,
    businessId: string,
    executionId: string,
    context: RequestContext,
  ): Promise<AutomationExecutionView> {
    const execution = await this.executions.findOne({
      where: { id: executionId, businessId },
      relations: { rule: true },
    });

    if (!execution) {
      throw new NotFoundException('Automation execution not found');
    }

    if (!RETRYABLE_STATUSES.includes(execution.status)) {
      throw new BadRequestException('Only failed, skipped or dead-lettered executions can retry');
    }

    if (execution.scheduledActionId) {
      await this.scheduledActions.update(execution.scheduledActionId, {
        status: ScheduledActionStatus.QUEUED,
        error: null,
      });
    }

    await this.executions.update(execution.id, {
      status: AutomationExecutionStatus.PENDING,
      approvalRequestId: null,
      approvalStatus: null,
      attempts: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
    await this.queue.enqueueExecution(execution.id, Date.now());
    await this.audit.record({
      action: 'automation.retry_requested',
      actorUserId,
      businessId,
      entityType: 'automation_execution',
      entityId: execution.id,
      context,
    });

    return this.getExecution(businessId, executionId);
  }

  private async requireRule(businessId: string, ruleId: string): Promise<AutomationRule> {
    const rule = await this.rules.findOne({
      where: { id: ruleId, businessId },
      relations: { campaign: true, createdByUser: true },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return rule;
  }

  private async getScheduledAction(
    businessId: string,
    actionId: string,
  ): Promise<ScheduledActionView> {
    return toScheduledActionView(await this.requireScheduledAction(businessId, actionId));
  }

  private async requireScheduledAction(
    businessId: string,
    actionId: string,
  ): Promise<ScheduledAction> {
    const action = await this.scheduledActions.findOne({
      where: { id: actionId, businessId },
      relations: { campaign: true, createdByUser: true },
    });

    if (!action) {
      throw new NotFoundException('Scheduled action not found');
    }

    return action;
  }

  private async assertValidShape(
    businessId: string,
    input: {
      triggerType: AutomationTriggerType;
      actionType: AutomationActionType;
      campaignId: string | null;
      notifyMessage: string | null;
      runAt: Date | null;
      intervalMinutes: number | null;
    },
  ): Promise<void> {
    const isCampaignAction = input.actionType !== AutomationActionType.NOTIFY;

    if (isCampaignAction && !input.campaignId) {
      throw new BadRequestException('Campaign actions need a target campaign');
    }

    if (input.actionType === AutomationActionType.NOTIFY && !input.notifyMessage?.trim()) {
      throw new BadRequestException('Notify actions need a message');
    }

    if (
      input.triggerType === AutomationTriggerType.CAMPAIGN_REJECTED &&
      !input.campaignId
    ) {
      throw new BadRequestException('Rejected-campaign rules need a target campaign');
    }

    if (
      input.triggerType === AutomationTriggerType.SCHEDULE &&
      !input.runAt &&
      !input.intervalMinutes
    ) {
      throw new BadRequestException('Scheduled rules need a run time or an interval');
    }

    if (input.runAt && Number.isNaN(input.runAt.getTime())) {
      throw new BadRequestException('Invalid run time');
    }

    if (input.campaignId) {
      const campaign = await this.campaigns.findOne({
        where: { id: input.campaignId, businessId },
      });

      if (!campaign) {
        throw new BadRequestException('The target campaign does not belong to this business');
      }
    }
  }

  private firstRunAt(
    runAt: Date | null,
    intervalMinutes: number | null,
    now: Date,
  ): Date | null {
    if (runAt && runAt.getTime() > now.getTime()) {
      return runAt;
    }

    if (intervalMinutes) {
      return this.scheduler.nextRunAt(runAt, intervalMinutes, now);
    }

    return runAt;
  }
}
