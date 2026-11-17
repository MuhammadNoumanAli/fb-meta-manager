import type { ApprovalRequest, ApprovalStatus } from './approvals';

export type AutomationTriggerType = 'schedule' | 'campaign_rejected' | 'budget_threshold';

export type AutomationActionType =
  | 'pause_campaign'
  | 'resume_campaign'
  | 'archive_campaign'
  | 'sync_campaign'
  | 'notify';

export type AutomationExecutionStatus =
  | 'pending'
  | 'running'
  | 'pending_approval'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'dead_letter';

export type AutomationExecutionTrigger = 'schedule' | 'event' | 'manual' | 'approval';

export type ScheduledActionStatus =
  | 'scheduled'
  | 'queued'
  | 'pending_approval'
  | 'executed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export type BulkOperationType =
  | 'pause_campaigns'
  | 'resume_campaigns'
  | 'archive_campaigns'
  | 'sync_campaigns';

export type BulkOperationStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type BulkOperationItemStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface AutomationUser {
  id: string;
  name: string;
  email: string;
}

export interface AutomationRule {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  campaignId: string | null;
  campaignName: string | null;
  runAt: string | null;
  intervalMinutes: number | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  notifyMessage: string | null;
  isActive: boolean;
  createdBy: AutomationUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleInput {
  name: string;
  description?: string | null;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  campaignId?: string | null;
  runAt?: string | null;
  intervalMinutes?: number | null;
  notifyMessage?: string | null;
  isActive?: boolean;
}

export interface AutomationExecution {
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
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface ScheduledAction {
  id: string;
  businessId: string;
  campaignId: string | null;
  campaignName: string | null;
  actionType: AutomationActionType;
  notifyMessage: string | null;
  runAt: string;
  status: ScheduledActionStatus;
  createdBy: AutomationUser | null;
  dispatchedAt: string | null;
  executedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface ScheduledActionInput {
  campaignId: string;
  actionType: AutomationActionType;
  notifyMessage?: string | null;
  runAt: string;
}

export interface DispatchResult {
  scheduledActions: number;
  scheduledRules: number;
  eventRules: number;
  executions: number;
}

export interface BulkOperation {
  id: string;
  businessId: string;
  operation: BulkOperationType;
  status: BulkOperationStatus;
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  reason: string | null;
  approvalRequestId: string | null;
  requestedBy: AutomationUser | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulkOperationItem {
  id: string;
  campaignId: string;
  campaignLabel: string;
  status: BulkOperationItemStatus;
  attempts: number;
  error: string | null;
  result: Record<string, unknown> | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BulkOperationDetail extends BulkOperation {
  items: BulkOperationItem[];
}

export interface BulkOperationInput {
  operation: BulkOperationType;
  campaignIds: string[];
  reason?: string | null;
}

export interface BulkOperationMutationResult {
  approvalRequired: boolean;
  approval: ApprovalRequest | null;
  operation: BulkOperationDetail;
}

export interface PagedAutomationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  schedule: 'Schedule',
  campaign_rejected: 'Campaign rejected',
  budget_threshold: 'Budget threshold',
};

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  pause_campaign: 'Pause campaign',
  resume_campaign: 'Resume campaign',
  archive_campaign: 'Archive campaign',
  sync_campaign: 'Sync campaign',
  notify: 'Send notification',
};

export const BULK_LABELS: Record<BulkOperationType, string> = {
  pause_campaigns: 'Pause campaigns',
  resume_campaigns: 'Resume campaigns',
  archive_campaigns: 'Archive campaigns',
  sync_campaigns: 'Sync campaigns',
};
