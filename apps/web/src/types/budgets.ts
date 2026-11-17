import type { ApprovalRequest } from './approvals';

export type BudgetScope = 'business' | 'campaign';

export type BudgetPeriod = 'monthly' | 'total';

export type BudgetAlertStatus = 'open' | 'acknowledged';

export type SpendSnapshotSource = 'meta_sync' | 'manual';

export interface Budget {
  id: string;
  businessId: string;
  campaignId: string | null;
  campaignName: string | null;
  scope: BudgetScope;
  name: string;
  amount: string;
  currency: string;
  period: BudgetPeriod;
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

export interface SpendSnapshot {
  id: string;
  source: SpendSnapshotSource;
  amount: string;
  currency: string;
  periodKey: string;
  periodStart: string | null;
  periodEnd: string | null;
  capturedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface BudgetAlert {
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
  status: BudgetAlertStatus;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface BudgetTransaction {
  id: string;
  type: 'created' | 'updated' | 'deleted';
  amount: string | null;
  previousAmount: string | null;
  currency: string;
  actorUserId: string | null;
  approvalRequestId: string | null;
  note: string | null;
  createdAt: string;
}

export interface BudgetDetail extends Budget {
  snapshots: SpendSnapshot[];
  alerts: BudgetAlert[];
  transactions: BudgetTransaction[];
}

export interface BudgetMutationResult {
  approvalRequired: boolean;
  approval: ApprovalRequest | null;
  budget: Budget | null;
}

export interface BudgetInput {
  scope: BudgetScope;
  campaignId?: string;
  name: string;
  amount: number;
  currency?: string;
  period?: BudgetPeriod;
  alertThresholdPercent?: number;
  isActive?: boolean;
  notes?: string;
}

export interface SpendSnapshotInput {
  amount: number;
  currency?: string;
  note?: string;
}
