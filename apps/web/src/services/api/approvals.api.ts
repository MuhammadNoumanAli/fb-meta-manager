import type {
  ApprovalDecision,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalTargetType,
  PagedApprovalResult,
} from '@/types/approvals';
import { apiRequest } from './client';

export interface ApprovalQuery {
  status?: ApprovalStatus;
  targetType?: ApprovalTargetType;
  targetId?: string;
  mine?: boolean;
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

export const approvalsApi = {
  list: (businessId: string, params: ApprovalQuery = {}) =>
    apiRequest<PagedApprovalResult<ApprovalRequest>>(
      `/businesses/${businessId}/approvals${toQuery(params)}`,
    ),

  get: (businessId: string, approvalId: string) =>
    apiRequest<ApprovalRequest>(`/businesses/${businessId}/approvals/${approvalId}`),

  listPolicies: (businessId: string) =>
    apiRequest<ApprovalPolicy[]>(`/businesses/${businessId}/approvals/policies`),

  setPolicy: (businessId: string, targetType: ApprovalTargetType, isEnabled: boolean) =>
    apiRequest<ApprovalPolicy>(
      `/businesses/${businessId}/approvals/policies/${targetType}`,
      { method: 'PATCH', body: JSON.stringify({ isEnabled }) },
    ),

  decide: (
    businessId: string,
    approvalId: string,
    decision: ApprovalDecision,
    reason?: string,
    version?: number,
  ) =>
    apiRequest<ApprovalRequest>(`/businesses/${businessId}/approvals/${approvalId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason, version }),
    }),

  retryExecution: (businessId: string, approvalId: string) =>
    apiRequest<ApprovalRequest>(`/businesses/${businessId}/approvals/${approvalId}/execute`, {
      method: 'POST',
      body: '{}',
    }),

  cancel: (businessId: string, approvalId: string) =>
    apiRequest<ApprovalRequest>(`/businesses/${businessId}/approvals/${approvalId}/cancel`, {
      method: 'POST',
      body: '{}',
    }),
};
