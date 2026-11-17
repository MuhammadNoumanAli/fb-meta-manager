import type {
  AutomationExecution,
  AutomationExecutionStatus,
  AutomationRule,
  AutomationRuleInput,
  BulkOperation,
  BulkOperationDetail,
  BulkOperationInput,
  BulkOperationMutationResult,
  BulkOperationStatus,
  BulkOperationType,
  DispatchResult,
  PagedAutomationResult,
  ScheduledAction,
  ScheduledActionInput,
  ScheduledActionStatus,
} from '@/types/automation';
import { apiRequest } from './client';

export interface RuleQuery {
  triggerType?: string;
  isActive?: boolean;
}

export interface ExecutionQuery {
  status?: AutomationExecutionStatus;
  ruleId?: string;
  scheduledActionId?: string;
  page?: number;
  pageSize?: number;
}

export interface BulkQuery {
  status?: BulkOperationStatus;
  page?: number;
  pageSize?: number;
}

const toQuery = (params: object): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
};

const base = (businessId: string) => `/businesses/${businessId}`;

export const automationApi = {
  listRules: (businessId: string, params: RuleQuery = {}) =>
    apiRequest<AutomationRule[]>(`${base(businessId)}/automation/rules${toQuery(params)}`),

  createRule: (businessId: string, payload: AutomationRuleInput) =>
    apiRequest<AutomationRule>(`${base(businessId)}/automation/rules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRule: (businessId: string, ruleId: string, payload: Partial<AutomationRuleInput>) =>
    apiRequest<AutomationRule>(`${base(businessId)}/automation/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteRule: (businessId: string, ruleId: string) =>
    apiRequest<void>(`${base(businessId)}/automation/rules/${ruleId}`, { method: 'DELETE' }),

  runRule: (businessId: string, ruleId: string) =>
    apiRequest<{ executionId: string; queued: boolean }>(
      `${base(businessId)}/automation/rules/${ruleId}/run`,
      { method: 'POST', body: '{}' },
    ),

  listScheduledActions: (businessId: string, status?: ScheduledActionStatus) =>
    apiRequest<ScheduledAction[]>(
      `${base(businessId)}/automation/scheduled-actions${toQuery({ status })}`,
    ),

  createScheduledAction: (businessId: string, payload: ScheduledActionInput) =>
    apiRequest<ScheduledAction>(`${base(businessId)}/automation/scheduled-actions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelScheduledAction: (businessId: string, actionId: string) =>
    apiRequest<ScheduledAction>(
      `${base(businessId)}/automation/scheduled-actions/${actionId}/cancel`,
      { method: 'POST', body: '{}' },
    ),

  listExecutions: (businessId: string, params: ExecutionQuery = {}) =>
    apiRequest<PagedAutomationResult<AutomationExecution>>(
      `${base(businessId)}/automation/executions${toQuery(params)}`,
    ),

  retryExecution: (businessId: string, executionId: string) =>
    apiRequest<AutomationExecution>(
      `${base(businessId)}/automation/executions/${executionId}/retry`,
      { method: 'POST', body: '{}' },
    ),

  dispatch: (businessId: string) =>
    apiRequest<DispatchResult>(`${base(businessId)}/automation/dispatch`, {
      method: 'POST',
      body: '{}',
    }),

  listBulkOperations: (businessId: string, params: BulkQuery = {}) =>
    apiRequest<PagedAutomationResult<BulkOperation>>(
      `${base(businessId)}/bulk-operations${toQuery(params)}`,
    ),

  createBulkOperation: (businessId: string, payload: BulkOperationInput) =>
    apiRequest<BulkOperationMutationResult>(`${base(businessId)}/bulk-operations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBulkOperation: (businessId: string, operationId: string) =>
    apiRequest<BulkOperationDetail>(`${base(businessId)}/bulk-operations/${operationId}`),

  retryBulkOperation: (businessId: string, operationId: string) =>
    apiRequest<BulkOperationDetail>(
      `${base(businessId)}/bulk-operations/${operationId}/retry`,
      { method: 'POST', body: '{}' },
    ),
};

export const BULK_OPERATION_TYPES: BulkOperationType[] = [
  'pause_campaigns',
  'resume_campaigns',
  'archive_campaigns',
  'sync_campaigns',
];
