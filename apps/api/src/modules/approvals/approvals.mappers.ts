import type { ApprovalDecisionRecord } from '../../database/entities/approval-decision.entity';
import type { ApprovalPolicy } from '../../database/entities/approval-policy.entity';
import type { ApprovalRequest } from '../../database/entities/approval-request.entity';
import type { ApprovalVersion } from '../../database/entities/approval-version.entity';
import type { User } from '../../database/entities/user.entity';
import type { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';

export interface ApprovalUserView {
  id: string;
  name: string;
  email: string;
}

export interface ApprovalDecisionView {
  id: string;
  decision: string;
  reason: string | null;
  approvalVersionId: string;
  decidedBy: ApprovalUserView | null;
  createdAt: string;
}

export interface ApprovalVersionView {
  id: string;
  version: number;
  payload: Record<string, unknown>;
  payloadHash: string;
  note: string | null;
  createdBy: ApprovalUserView | null;
  createdAt: string;
}

export interface ApprovalRequestView {
  id: string;
  businessId: string;
  targetType: ApprovalTargetType;
  targetId: string | null;
  targetLabel: string | null;
  status: string;
  currentVersion: number;
  currentPayloadHash: string;
  requestedBy: ApprovalUserView | null;
  approver: ApprovalUserView | null;
  approvedVersionId: string | null;
  decidedBy: ApprovalUserView | null;
  decidedAt: string | null;
  decisionReason: string | null;
  executionStatus: string;
  executedAt: string | null;
  executionError: string | null;
  expiresAt: string;
  requesterNote: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: ApprovalVersionView[];
  decisions?: ApprovalDecisionView[];
}

export interface ApprovalPolicyView {
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

export const toApprovalUser = (user: User | null | undefined): ApprovalUserView | null =>
  user
    ? {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
        email: user.email,
      }
    : null;

export const toApprovalRequestView = (
  request: ApprovalRequest,
  extras: {
    versions?: ApprovalVersion[];
    decisions?: Array<ApprovalDecisionRecord & { decidedByUser?: User | null }>;
  } = {},
): ApprovalRequestView => ({
  id: request.id,
  businessId: request.businessId,
  targetType: request.targetType,
  targetId: request.targetId,
  targetLabel: request.targetLabel,
  status: request.status,
  currentVersion: request.currentVersion,
  currentPayloadHash: request.currentPayloadHash,
  requestedBy: toApprovalUser(request.requestedByUser),
  approver: toApprovalUser(request.approverUser),
  approvedVersionId: request.approvedVersionId,
  decidedBy: toApprovalUser(request.decidedByUser),
  decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
  decisionReason: request.decisionReason,
  executionStatus: request.executionStatus,
  executedAt: request.executedAt ? request.executedAt.toISOString() : null,
  executionError: request.executionError,
  expiresAt: request.expiresAt.toISOString(),
  requesterNote: request.requesterNote,
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
  versions: extras.versions
    ? extras.versions.map((version) => ({
        id: version.id,
        version: version.version,
        payload: version.payload,
        payloadHash: version.payloadHash,
        note: version.note,
        createdBy: toApprovalUser(version.createdByUser),
        createdAt: version.createdAt.toISOString(),
      }))
    : undefined,
  decisions: extras.decisions
    ? extras.decisions.map((decision) => ({
        id: decision.id,
        decision: decision.decision,
        reason: decision.reason,
        approvalVersionId: decision.approvalVersionId,
        decidedBy: toApprovalUser(decision.decidedByUser),
        createdAt: decision.createdAt.toISOString(),
      }))
    : undefined,
});

export const toApprovalPolicyView = (
  targetType: ApprovalTargetType,
  policy: ApprovalPolicy | null,
): ApprovalPolicyView => ({
  targetType,
  isEnabled: policy?.isEnabled ?? false,
  updatedAt: policy ? policy.updatedAt.toISOString() : null,
});
