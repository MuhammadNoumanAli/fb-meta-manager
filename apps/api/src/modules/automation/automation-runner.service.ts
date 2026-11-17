import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AutomationActionType } from '../../common/enums/automation-action-type.enum';
import { AutomationExecutionStatus } from '../../common/enums/automation-execution-status.enum';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { ScheduledActionStatus } from '../../common/enums/scheduled-action-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import {
  classifyFailure,
  failureMessage,
  jitteredDelay,
  DEFAULT_RETRY_POLICY,
} from '../../common/utilities/retry-policy';
import { AutomationExecution } from '../../database/entities/automation-execution.entity';
import { ScheduledAction } from '../../database/entities/scheduled-action.entity';
import { AdvertisingService } from '../advertising/advertising.service';
import { CampaignPublishingService } from '../advertising/campaign-publishing.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { AutomationQueueService } from './automation-queue.service';
import { ExecutionLockService } from './execution-lock.service';

export interface AutomationExecutionOutcome {
  executionId: string;
  status: AutomationExecutionStatus | 'missing';
  retry: boolean;
  error?: string;
}

export interface AutomationExecutionSummary {
  executionId: string;
  status: AutomationExecutionStatus;
  summary: string;
}

const LOCK_TTL_MS = 5 * 60 * 1000;
const AUTOMATION_CONTEXT: RequestContext = {
  ipAddress: null,
  userAgent: 'adpilot-automation',
};

/**
 * Executes one automation attempt. The runner is deliberately idempotent: a
 * database lock plus a conditional status update mean a duplicated queue job
 * observes the work as already claimed and exits without a second side effect.
 */
@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);

  constructor(
    @InjectRepository(AutomationExecution)
    private readonly executions: Repository<AutomationExecution>,
    @InjectRepository(ScheduledAction)
    private readonly scheduledActions: Repository<ScheduledAction>,
    private readonly advertising: AdvertisingService,
    private readonly publishing: CampaignPublishingService,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
    private readonly locks: ExecutionLockService,
    private readonly queue: AutomationQueueService,
  ) {}

  /** Queue-worker entry point. Handles gating, retries and dead-lettering. */
  async runPending(executionId: string): Promise<AutomationExecutionOutcome> {
    const execution = await this.load(executionId);

    if (!execution) {
      return { executionId, status: 'missing', retry: false };
    }

    if (
      execution.status === AutomationExecutionStatus.SUCCEEDED ||
      execution.status === AutomationExecutionStatus.FAILED ||
      execution.status === AutomationExecutionStatus.SKIPPED ||
      execution.status === AutomationExecutionStatus.DEAD_LETTER ||
      execution.status === AutomationExecutionStatus.PENDING_APPROVAL
    ) {
      return { executionId, status: execution.status, retry: false };
    }

    const owner = randomUUID();
    const lockKey = `automation-execution:${execution.id}`;

    if (!(await this.locks.acquire(lockKey, LOCK_TTL_MS, owner))) {
      return { executionId, status: execution.status, retry: false };
    }

    try {
      const claim = await this.executions
        .createQueryBuilder()
        .update(AutomationExecution)
        .set({
          status: AutomationExecutionStatus.RUNNING,
          startedAt: new Date(),
          finishedAt: null,
          error: null,
          attempts: () => 'attempts + 1',
        })
        .where('id = :id', { id: execution.id })
        .andWhere('status = :pending', { pending: AutomationExecutionStatus.PENDING })
        .execute();

      if (!claim.affected) {
        return { executionId, status: execution.status, retry: false };
      }

      const attempts = execution.attempts + 1;
      const actorUserId = this.resolveActor(execution);

      if (!actorUserId) {
        return await this.finishSkipped(
          execution,
          'The rule creator is no longer available, so the action was not executed',
        );
      }

      const gate = await this.approvals.getGate(
        actorUserId,
        execution.businessId,
        ApprovalTargetType.AUTOMATION_ACTION,
      );

      if (gate.required) {
        return await this.requestApproval(execution, actorUserId);
      }

      try {
        const result = await this.performAction(execution, actorUserId, AUTOMATION_CONTEXT);

        await this.executions.update(execution.id, {
          status: AutomationExecutionStatus.SUCCEEDED,
          finishedAt: new Date(),
          result: result as never,
          error: null,
        });
        await this.markScheduledAction(execution, ScheduledActionStatus.EXECUTED, null);
        await this.audit.record({
          action: 'automation.executed',
          actorUserId,
          businessId: execution.businessId,
          entityType: 'automation_execution',
          entityId: execution.id,
          metadata: { ...result, attempts },
          context: AUTOMATION_CONTEXT,
        });

        return {
          executionId: execution.id,
          status: AutomationExecutionStatus.SUCCEEDED,
          retry: false,
        };
      } catch (error) {
        return await this.handleFailure(execution, actorUserId, error, attempts);
      }
    } finally {
      await this.locks.release(lockKey, owner);
    }
  }

  /**
   * Used by the approval handler. The gate has already been satisfied by an
   * approver, so this path executes directly and records the outcome.
   */
  async executeApproved(
    executionId: string,
    actorUserId: string,
    context: RequestContext,
  ): Promise<AutomationExecutionSummary> {
    const execution = await this.load(executionId);

    if (!execution) {
      throw new NotFoundException('Automation execution not found');
    }

    if (execution.status === AutomationExecutionStatus.SUCCEEDED) {
      return {
        executionId,
        status: execution.status,
        summary: 'Automation execution was already completed',
      };
    }

    const owner = randomUUID();
    const lockKey = `automation-execution:${execution.id}`;

    if (!(await this.locks.acquire(lockKey, LOCK_TTL_MS, owner))) {
      throw new NotFoundException('Automation execution is currently running');
    }

    try {
      await this.executions.update(execution.id, {
        status: AutomationExecutionStatus.RUNNING,
        approvalStatus: ApprovalStatus.APPROVED,
        startedAt: execution.startedAt ?? new Date(),
        error: null,
      });

      try {
        const result = await this.performAction(execution, actorUserId, context);

        await this.executions.update(execution.id, {
          status: AutomationExecutionStatus.SUCCEEDED,
          finishedAt: new Date(),
          result: result as never,
          error: null,
        });
        await this.markScheduledAction(execution, ScheduledActionStatus.EXECUTED, null);

        return {
          executionId: execution.id,
          status: AutomationExecutionStatus.SUCCEEDED,
          summary: String(result.summary ?? 'Automation executed'),
        };
      } catch (error) {
        const message = failureMessage(error).slice(0, 500);

        await this.executions.update(execution.id, {
          status: AutomationExecutionStatus.FAILED,
          finishedAt: new Date(),
          error: message,
        });
        await this.markScheduledAction(execution, ScheduledActionStatus.FAILED, message);
        throw error;
      }
    } finally {
      await this.locks.release(lockKey, owner);
    }
  }

  private async performAction(
    execution: AutomationExecution,
    actorUserId: string,
    context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const actionType = execution.rule?.actionType ?? execution.scheduledAction?.actionType;
    const campaignId = execution.rule?.campaignId ?? execution.scheduledAction?.campaignId ?? null;
    const notifyMessage =
      execution.rule?.notifyMessage ?? execution.scheduledAction?.notifyMessage ?? null;

    if (!actionType) {
      throw new Error('The automation execution has no action configured');
    }

    if (actionType === AutomationActionType.NOTIFY) {
      return {
        action: actionType,
        message: notifyMessage ?? 'Automation notification',
        summary: notifyMessage ?? 'Automation notification recorded',
      };
    }

    if (!campaignId) {
      throw new Error('This automation action needs a target campaign');
    }

    if (actionType === AutomationActionType.SYNC_CAMPAIGN) {
      await this.publishing.syncCampaign(
        actorUserId,
        execution.businessId,
        campaignId,
        context,
      );

      return {
        action: actionType,
        campaignId,
        summary: 'Campaign synchronised with Meta',
      };
    }

    const status =
      actionType === AutomationActionType.PAUSE_CAMPAIGN
        ? AdvertisingStatus.PAUSED
        : actionType === AutomationActionType.ARCHIVE_CAMPAIGN
          ? AdvertisingStatus.ARCHIVED
          : AdvertisingStatus.ACTIVE;
    const campaign = await this.advertising.applyStatusChange(
      actorUserId,
      execution.businessId,
      campaignId,
      status,
      context,
    );

    return {
      action: actionType,
      campaignId,
      campaignStatus: campaign.status,
      summary: `${campaign.name} is now ${campaign.status}`,
    };
  }

  private async requestApproval(
    execution: AutomationExecution,
    actorUserId: string,
  ): Promise<AutomationExecutionOutcome> {
    const label =
      execution.rule?.name ??
      (execution.scheduledAction
        ? `Scheduled ${execution.scheduledAction.actionType}`
        : 'Automation action');

    const approval = await this.approvals.createRequest({
      actorUserId,
      businessId: execution.businessId,
      targetType: ApprovalTargetType.AUTOMATION_ACTION,
      targetId: execution.id,
      targetLabel: label,
      payload: { executionId: execution.id },
      note: `Automation execution requires approval: ${label}`,
      context: AUTOMATION_CONTEXT,
    });

    await this.executions.update(execution.id, {
      status: AutomationExecutionStatus.PENDING_APPROVAL,
      approvalRequestId: approval.id,
      approvalStatus: ApprovalStatus.PENDING,
      finishedAt: null,
    });
    await this.markScheduledAction(execution, ScheduledActionStatus.PENDING_APPROVAL, null);
    await this.audit.record({
      action: 'automation.approval_requested',
      actorUserId,
      businessId: execution.businessId,
      entityType: 'automation_execution',
      entityId: execution.id,
      metadata: { approvalRequestId: approval.id },
      context: AUTOMATION_CONTEXT,
    });

    return {
      executionId: execution.id,
      status: AutomationExecutionStatus.PENDING_APPROVAL,
      retry: false,
    };
  }

  private async handleFailure(
    execution: AutomationExecution,
    actorUserId: string,
    error: unknown,
    attempts: number,
  ): Promise<AutomationExecutionOutcome> {
    const message = failureMessage(error).slice(0, 500);
    const failureClass = classifyFailure(error);
    const maxAttempts = execution.maxAttempts || DEFAULT_RETRY_POLICY.attempts;
    const exhausted = attempts >= maxAttempts;

    if (failureClass === 'transient' && !exhausted) {
      // Leave the row retryable; BullMQ schedules the next attempt with jitter.
      await this.executions.update(execution.id, {
        status: AutomationExecutionStatus.PENDING,
        error: message,
        startedAt: null,
        finishedAt: null,
      });
      await this.audit.record({
        action: 'automation.retry_scheduled',
        actorUserId,
        businessId: execution.businessId,
        entityType: 'automation_execution',
        entityId: execution.id,
        metadata: { attempts, message, nextDelayMs: jitteredDelay(attempts + 1) },
        context: AUTOMATION_CONTEXT,
      });

      return {
        executionId: execution.id,
        status: AutomationExecutionStatus.PENDING,
        retry: true,
        error: message,
      };
    }

    const status =
      failureClass === 'transient'
        ? AutomationExecutionStatus.DEAD_LETTER
        : AutomationExecutionStatus.FAILED;

    await this.executions.update(execution.id, {
      status,
      finishedAt: new Date(),
      error: message,
    });
    await this.markScheduledAction(execution, ScheduledActionStatus.FAILED, message);

    if (status === AutomationExecutionStatus.DEAD_LETTER) {
      await this.queue.moveToDeadLetter({
        sourceQueue: 'automation-execution',
        jobName: 'execute',
        payload: { executionId: execution.id },
        error: message,
        failedAt: new Date().toISOString(),
      });
    }

    await this.audit.record({
      action:
        status === AutomationExecutionStatus.DEAD_LETTER
          ? 'automation.dead_letter'
          : 'automation.failed',
      actorUserId,
      businessId: execution.businessId,
      entityType: 'automation_execution',
      entityId: execution.id,
      metadata: { message, attempts },
      context: AUTOMATION_CONTEXT,
    });
    this.logger.warn(`Automation execution ${execution.id} ended as ${status}: ${message}`);

    return { executionId: execution.id, status, retry: false, error: message };
  }

  private async finishSkipped(
    execution: AutomationExecution,
    reason: string,
  ): Promise<AutomationExecutionOutcome> {
    await this.executions.update(execution.id, {
      status: AutomationExecutionStatus.SKIPPED,
      finishedAt: new Date(),
      error: reason.slice(0, 500),
    });
    await this.markScheduledAction(execution, ScheduledActionStatus.SKIPPED, reason);

    return {
      executionId: execution.id,
      status: AutomationExecutionStatus.SKIPPED,
      retry: false,
      error: reason,
    };
  }

  private async markScheduledAction(
    execution: AutomationExecution,
    status: ScheduledActionStatus,
    error: string | null,
  ): Promise<void> {
    if (!execution.scheduledActionId) {
      return;
    }

    await this.scheduledActions.update(execution.scheduledActionId, {
      status,
      error,
      ...(status === ScheduledActionStatus.EXECUTED ? { executedAt: new Date() } : {}),
    });
  }

  private resolveActor(execution: AutomationExecution): string | null {
    return (
      execution.actorUserId ??
      execution.rule?.createdByUserId ??
      execution.scheduledAction?.createdByUserId ??
      null
    );
  }

  private async load(executionId: string): Promise<AutomationExecution | null> {
    return this.executions.findOne({
      where: { id: executionId },
      relations: { rule: true, scheduledAction: true },
    });
  }
}
