import type { BudgetAlert } from '../../database/entities/budget-alert.entity';
import type { BudgetTransaction } from '../../database/entities/budget-transaction.entity';
import type { Budget } from '../../database/entities/budget.entity';
import type { SpendSnapshot } from '../../database/entities/spend-snapshot.entity';

export interface BudgetView {
  id: string;
  businessId: string;
  campaignId: string | null;
  campaignName: string | null;
  scope: string;
  name: string;
  amount: string;
  currency: string;
  period: string;
  alertThresholdPercent: number;
  isActive: boolean;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  spentAmount: string;
  usagePercent: number;
  latestSnapshotAt: string | null;
  openAlerts: number;
}

export interface SpendSnapshotView {
  id: string;
  source: string;
  amount: string;
  currency: string;
  periodKey: string;
  periodStart: string | null;
  periodEnd: string | null;
  capturedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface BudgetAlertView {
  id: string;
  budgetId: string;
  budgetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  periodKey: string;
  thresholdPercent: number;
  spendAmount: string;
  budgetAmount: string;
  currency: string;
  message: string;
  status: string;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface BudgetTransactionView {
  id: string;
  type: string;
  amount: string | null;
  previousAmount: string | null;
  currency: string;
  actorUserId: string | null;
  approvalRequestId: string | null;
  note: string | null;
  createdAt: string;
}

export interface BudgetDetailView extends BudgetView {
  snapshots: SpendSnapshotView[];
  alerts: BudgetAlertView[];
  transactions: BudgetTransactionView[];
}

export const toSpendSnapshotView = (snapshot: SpendSnapshot): SpendSnapshotView => ({
  id: snapshot.id,
  source: snapshot.source,
  amount: snapshot.amount,
  currency: snapshot.currency,
  periodKey: snapshot.periodKey,
  periodStart: snapshot.periodStart ? snapshot.periodStart.toISOString() : null,
  periodEnd: snapshot.periodEnd ? snapshot.periodEnd.toISOString() : null,
  capturedAt: snapshot.capturedAt.toISOString(),
  metadata: snapshot.metadata,
});

export const toBudgetAlertView = (alert: BudgetAlert): BudgetAlertView => ({
  id: alert.id,
  budgetId: alert.budgetId,
  budgetName: alert.budget?.name ?? null,
  campaignId: alert.campaignId,
  campaignName: alert.campaign?.name ?? null,
  periodKey: alert.periodKey,
  thresholdPercent: alert.thresholdPercent,
  spendAmount: alert.spendAmount,
  budgetAmount: alert.budgetAmount,
  currency: alert.currency,
  message: alert.message,
  status: alert.status,
  acknowledgedByUserId: alert.acknowledgedByUserId,
  acknowledgedAt: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : null,
  createdAt: alert.createdAt.toISOString(),
});

export const toBudgetTransactionView = (
  transaction: BudgetTransaction,
): BudgetTransactionView => ({
  id: transaction.id,
  type: transaction.type,
  amount: transaction.amount,
  previousAmount: transaction.previousAmount,
  currency: transaction.currency,
  actorUserId: transaction.actorUserId,
  approvalRequestId: transaction.approvalRequestId,
  note: transaction.note,
  createdAt: transaction.createdAt.toISOString(),
});

export interface BudgetSpendSummary {
  amount: number;
  currency: string;
  snapshotId: string | null;
  capturedAt: Date | null;
}

export const toBudgetView = (
  budget: Budget,
  spend: BudgetSpendSummary | null,
  openAlerts: number,
): BudgetView => {
  const amount = Number(budget.amount);
  const spent = spend?.amount ?? 0;

  return {
    id: budget.id,
    businessId: budget.businessId,
    campaignId: budget.campaignId,
    campaignName: budget.campaign?.name ?? null,
    scope: budget.scope,
    name: budget.name,
    amount: budget.amount,
    currency: budget.currency,
    period: budget.period,
    alertThresholdPercent: budget.alertThresholdPercent,
    isActive: budget.isActive,
    notes: budget.notes,
    createdByUserId: budget.createdByUserId,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    spentAmount: spent.toFixed(2),
    usagePercent: amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0,
    latestSnapshotAt: spend?.capturedAt ? spend.capturedAt.toISOString() : null,
    openAlerts,
  };
};
