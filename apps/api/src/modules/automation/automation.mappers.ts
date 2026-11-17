import type { AutomationActionType } from '../../common/enums/automation-action-type.enum';
import type { AutomationExecutionStatus } from '../../common/enums/automation-execution-status.enum';
import type { AutomationExecutionTrigger } from '../../common/enums/automation-execution-trigger.enum';
import type { AutomationTriggerType } from '../../common/enums/automation-trigger-type.enum';
import type { ApprovalStatus } from '../../common/enums/approval-status.enum';
import type { ScheduledActionStatus } from '../../common/enums/scheduled-action-status.enum';
import type { AutomationExecution } from '../../database/entities/automation-execution.entity';
import type { AutomationRule } from '../../database/entities/automation-rule.entity';
import type { ScheduledAction } from '../../database/entities/scheduled-action.entity';

export interface AutomationUserView {
  id: string;
  name: string;
  email: string;
}

export interface AutomationRuleView {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  campaignId: string | null;
  campaignName: string | null;
  runAt: Date | null;
  intervalMinutes: number | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  notifyMessage: string | null;
  isActive: boolean;
  createdBy: AutomationUserView | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecutionView {
  id: string;
  businessId: string;
  ruleId: string | null;
  ruleName: string | null;
  scheduledActionId: string | null;
  trigger: AutomationExecutionTrigger;
  status: AutomationExecutionStatus;
  idempotencyKey: string;
  approvalRequestId: string | null;
  approvalStatus: ApprovalStatus | null;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  result: Record<string, unknown> | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface ScheduledActionView {
  id: string;
  businessId: string;
  campaignId: string | null;
  campaignName: string | null;
  actionType: AutomationActionType;
  notifyMessage: string | null;
  runAt: Date;
  status: ScheduledActionStatus;
  createdBy: AutomationUserView | null;
  dispatchedAt: Date | null;
  executedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

export interface DispatchResult {
  scheduledActions: number;
  scheduledRules: number;
  eventRules: number;
  executions: number;
}

export interface PagedAutomationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const toUser = (
  user: { id: string; firstName: string; lastName: string; email: string } | null | undefined,
): AutomationUserView | null =>
  user
    ? {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
      }
    : null;

export const toAutomationRuleView = (rule: AutomationRule): AutomationRuleView => ({
  id: rule.id,
  businessId: rule.businessId,
  name: rule.name,
  description: rule.description,
  triggerType: rule.triggerType,
  actionType: rule.actionType,
  campaignId: rule.campaignId,
  campaignName: rule.campaign?.name ?? null,
  runAt: rule.runAt,
  intervalMinutes: rule.intervalMinutes,
  nextRunAt: rule.nextRunAt,
  lastRunAt: rule.lastRunAt,
  notifyMessage: rule.notifyMessage,
  isActive: rule.isActive,
  createdBy: toUser(rule.createdByUser),
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt,
});

export const toAutomationExecutionView = (
  execution: AutomationExecution,
): AutomationExecutionView => ({
  id: execution.id,
  businessId: execution.businessId,
  ruleId: execution.ruleId,
  ruleName: execution.rule?.name ?? null,
  scheduledActionId: execution.scheduledActionId,
  trigger: execution.trigger,
  status: execution.status,
  idempotencyKey: execution.idempotencyKey,
  approvalRequestId: execution.approvalRequestId,
  approvalStatus: execution.approvalStatus,
  attempts: execution.attempts,
  maxAttempts: execution.maxAttempts,
  error: execution.error,
  result: execution.result,
  startedAt: execution.startedAt,
  finishedAt: execution.finishedAt,
  createdAt: execution.createdAt,
});

export const toScheduledActionView = (action: ScheduledAction): ScheduledActionView => ({
  id: action.id,
  businessId: action.businessId,
  campaignId: action.campaignId,
  campaignName: action.campaign?.name ?? null,
  actionType: action.actionType,
  notifyMessage: action.notifyMessage,
  runAt: action.runAt,
  status: action.status,
  createdBy: toUser(action.createdByUser),
  dispatchedAt: action.dispatchedAt,
  executedAt: action.executedAt,
  error: action.error,
  createdAt: action.createdAt,
});
