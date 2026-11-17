import type { BulkOperationItemStatus } from '../../common/enums/bulk-operation-item-status.enum';
import type { BulkOperationStatus } from '../../common/enums/bulk-operation-status.enum';
import type { BulkOperationType } from '../../common/enums/bulk-operation-type.enum';
import type { BulkOperationItem } from '../../database/entities/bulk-operation-item.entity';
import type { BulkOperation } from '../../database/entities/bulk-operation.entity';

export interface BulkRequesterView {
  id: string;
  name: string;
  email: string;
}

export interface BulkOperationView {
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
  requestedBy: BulkRequesterView | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkOperationItemView {
  id: string;
  campaignId: string;
  campaignLabel: string;
  status: BulkOperationItemStatus;
  attempts: number;
  error: string | null;
  result: Record<string, unknown> | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface BulkOperationDetailView extends BulkOperationView {
  items: BulkOperationItemView[];
}

const toRequester = (
  user: { id: string; firstName: string; lastName: string; email: string } | null | undefined,
): BulkRequesterView | null =>
  user
    ? { id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email }
    : null;

export const toBulkOperationView = (operation: BulkOperation): BulkOperationView => ({
  id: operation.id,
  businessId: operation.businessId,
  operation: operation.operation,
  status: operation.status,
  total: operation.total,
  succeeded: operation.succeeded,
  failed: operation.failed,
  pending: operation.pending,
  reason: operation.reason,
  approvalRequestId: operation.approvalRequestId,
  requestedBy: toRequester(operation.requestedByUser),
  completedAt: operation.completedAt,
  createdAt: operation.createdAt,
  updatedAt: operation.updatedAt,
});

export const toBulkOperationItemView = (item: BulkOperationItem): BulkOperationItemView => ({
  id: item.id,
  campaignId: item.campaignId,
  campaignLabel: item.campaignLabel,
  status: item.status,
  attempts: item.attempts,
  error: item.error,
  result: item.result,
  startedAt: item.startedAt,
  finishedAt: item.finishedAt,
});

export const toBulkOperationDetailView = (
  operation: BulkOperation,
): BulkOperationDetailView => ({
  ...toBulkOperationView(operation),
  items: (operation.items ?? [])
    .slice()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map(toBulkOperationItemView),
});
