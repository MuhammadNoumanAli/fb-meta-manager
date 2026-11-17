export type ApprovalTargetType =
  | 'campaign.publish'
  | 'campaign.status'
  | 'budget.change'
  | 'automation.execute'
  | 'bulk.execute';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export type ApprovalDecision = 'approved' | 'rejected';

export type ApprovalExecutionStatus = 'not_started' | 'executing' | 'executed' | 'failed';

export interface ApprovalUser {
  id: string;
  name: string;
  email: string;
}

export interface ApprovalVersion {
  id: string;
  version: number;
  payload: Record<string, unknown>;
  payloadHash: string;
  note: string | null;
  createdBy: ApprovalUser | null;
  createdAt: string;
}

export interface ApprovalDecisionEntry {
  id: string;
  decision: ApprovalDecision;
  reason: string | null;
  approvalVersionId: string;
  decidedBy: ApprovalUser | null;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  businessId: string;
  targetType: ApprovalTargetType;
  targetId: string | null;
  targetLabel: string | null;
  status: ApprovalStatus;
  currentVersion: number;
  currentPayloadHash: string;
  requestedBy: ApprovalUser | null;
  approver: ApprovalUser | null;
  approvedVersionId: string | null;
  decidedBy: ApprovalUser | null;
  decidedAt: string | null;
  decisionReason: string | null;
  executionStatus: ApprovalExecutionStatus;
  executedAt: string | null;
  executionError: string | null;
  expiresAt: string;
  requesterNote: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: ApprovalVersion[];
  decisions?: ApprovalDecisionEntry[];
}

export interface ApprovalPolicy {
  targetType: ApprovalTargetType;
  isEnabled: boolean;
  updatedAt: string | null;
}

export interface PagedApprovalResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Shape returned by campaign actions that require approval before applying. */
export interface CampaignApprovalPending {
  approvalRequired: true;
  approval: ApprovalRequest;
  campaign: null;
}
