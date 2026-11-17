import type {
  Budget,
  BudgetAlert,
  BudgetAlertStatus,
  BudgetDetail,
  BudgetInput,
  BudgetMutationResult,
  BudgetScope,
  SpendSnapshotInput,
} from '@/types/budgets';
import { apiRequest } from './client';

export interface BudgetQuery {
  scope?: BudgetScope;
}

export interface BudgetAlertQuery {
  status?: BudgetAlertStatus;
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

export const budgetsApi = {
  list: (businessId: string, params: BudgetQuery = {}) =>
    apiRequest<Budget[]>(`/businesses/${businessId}/budgets${toQuery(params)}`),

  get: (businessId: string, budgetId: string) =>
    apiRequest<BudgetDetail>(`/businesses/${businessId}/budgets/${budgetId}`),

  create: (businessId: string, payload: BudgetInput) =>
    apiRequest<BudgetMutationResult>(`/businesses/${businessId}/budgets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (businessId: string, budgetId: string, payload: Partial<BudgetInput>) =>
    apiRequest<BudgetMutationResult>(`/businesses/${businessId}/budgets/${budgetId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  remove: (businessId: string, budgetId: string) =>
    apiRequest<BudgetMutationResult>(`/businesses/${businessId}/budgets/${budgetId}`, {
      method: 'DELETE',
    }),

  recordSnapshot: (businessId: string, budgetId: string, payload: SpendSnapshotInput) =>
    apiRequest<BudgetDetail>(`/businesses/${businessId}/budgets/${budgetId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listAlerts: (businessId: string, params: BudgetAlertQuery = {}) =>
    apiRequest<BudgetAlert[]>(`/businesses/${businessId}/budgets/alerts${toQuery(params)}`),

  acknowledgeAlert: (businessId: string, alertId: string) =>
    apiRequest<BudgetAlert>(
      `/businesses/${businessId}/budgets/alerts/${alertId}/acknowledge`,
      { method: 'PATCH', body: '{}' },
    ),
};
