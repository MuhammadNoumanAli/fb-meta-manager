<template>
  <v-card-text>
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
      <div>
        <div class="text-subtitle-1 font-weight-medium">Budgets and spend</div>
        <div class="text-body-2 text-medium-emphasis">
          Set client and campaign limits, capture spend and alert when a threshold is reached.
        </div>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip size="small" variant="tonal" color="primary">
          {{ budgets.length }} {{ budgets.length === 1 ? 'budget' : 'budgets' }}
        </v-chip>
        <v-chip v-if="openAlerts.length > 0" size="small" variant="tonal" color="warning">
          {{ openAlerts.length }} open {{ openAlerts.length === 1 ? 'alert' : 'alerts' }}
        </v-chip>
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="load"
        >
          Refresh
        </v-btn>
        <v-btn
          v-if="canManage"
          color="primary"
          size="small"
          prepend-icon="mdi-plus"
          @click="openCreate"
        >
          New budget
        </v-btn>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-card v-if="openAlerts.length > 0" border flat class="mb-5">
      <v-card-text>
        <div class="text-subtitle-2 font-weight-medium mb-2">Spending alerts</div>
        <v-list density="compact" lines="two">
          <v-list-item v-for="alert in openAlerts" :key="alert.id">
            <template #prepend>
              <v-icon color="warning" icon="mdi-alert-outline" class="mr-2" />
            </template>
            <v-list-item-title class="text-body-2">{{ alert.message }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ alert.periodKey }} · raised {{ formatDateTime(alert.createdAt) }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                v-if="canManage"
                size="small"
                variant="tonal"
                color="primary"
                :loading="acknowledging === alert.id"
                @click="acknowledge(alert)"
              >
                Acknowledge
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <v-table density="comfortable">
      <thead>
        <tr>
          <th>Budget</th>
          <th>Limit</th>
          <th>Spent</th>
          <th style="min-width: 160px">Usage</th>
          <th>Alerts</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="budget in budgets" :key="budget.id">
          <td style="min-width: 200px">
            <div class="font-weight-medium">{{ budget.name }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ budget.scope === 'business' ? 'Client budget' : budget.campaignName ?? 'Campaign' }}
              · {{ budget.period === 'monthly' ? 'Monthly' : 'Lifetime' }}
              <span v-if="!budget.isActive"> · inactive</span>
            </div>
          </td>
          <td class="text-body-2">
            {{ formatMoney(Number(budget.amount), budget.currency) }}
          </td>
          <td class="text-body-2">
            {{ formatMoney(Number(budget.spentAmount), budget.currency) }}
            <div v-if="budget.latestSnapshotAt" class="text-caption text-medium-emphasis">
              {{ formatDateTime(budget.latestSnapshotAt) }}
            </div>
          </td>
          <td>
            <v-progress-linear
              :model-value="Math.min(100, budget.usagePercent)"
              :color="usageColor(budget.usagePercent, budget.alertThresholdPercent)"
              height="8"
              rounded
            />
            <div class="text-caption text-medium-emphasis mt-1">
              {{ budget.usagePercent }}% · alert at {{ budget.alertThresholdPercent }}%
            </div>
          </td>
          <td>
            <v-chip
              v-if="budget.openAlerts > 0"
              size="x-small"
              color="warning"
              variant="tonal"
            >
              {{ budget.openAlerts }} open
            </v-chip>
            <span v-else class="text-caption text-medium-emphasis">—</span>
          </td>
          <td class="text-right" style="white-space: nowrap">
            <v-menu v-if="canManage">
              <template #activator="{ props: menuProps }">
                <v-btn size="small" variant="text" icon="mdi-dots-vertical" v-bind="menuProps" />
              </template>
              <v-list density="compact">
                <v-list-item @click="openDetail(budget)">
                  <v-list-item-title>View activity</v-list-item-title>
                </v-list-item>
                <v-list-item @click="openEdit(budget)">
                  <v-list-item-title>Edit budget</v-list-item-title>
                </v-list-item>
                <v-list-item @click="openSnapshot(budget)">
                  <v-list-item-title>Record spend</v-list-item-title>
                </v-list-item>
                <v-divider />
                <v-list-item @click="confirmDelete(budget)">
                  <v-list-item-title class="text-error">Delete budget</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
            <v-btn
              v-else
              size="small"
              variant="text"
              prepend-icon="mdi-eye-outline"
              @click="openDetail(budget)"
            >
              View
            </v-btn>
          </td>
        </tr>
        <tr v-if="budgets.length === 0 && !loading">
          <td colspan="6" class="text-center text-medium-emphasis py-8">
            No budgets yet. Create a client-level or campaign-level budget to track spend.
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="formDialog" max-width="620" persistent>
      <v-card>
        <v-card-title class="pt-5">{{ editingBudget ? 'Edit budget' : 'New budget' }}</v-card-title>
        <v-card-subtitle>
          Budgets are AdPilot controls for spend monitoring. They do not change the Meta budget.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.scope"
                :items="scopeOptions"
                label="Scope"
                :disabled="Boolean(editingBudget)"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.period"
                :items="periodOptions"
                label="Period"
              />
            </v-col>
          </v-row>

          <v-select
            v-if="form.scope === 'campaign'"
            v-model="form.campaignId"
            :items="campaignItems"
            item-title="title"
            item-value="value"
            label="Campaign"
            :disabled="Boolean(editingBudget)"
            class="mb-2"
          />

          <v-text-field v-model="form.name" label="Budget name" class="mb-2" />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.amount"
                label="Limit"
                type="number"
                min="0"
                step="0.01"
                :prefix="form.currency"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.currency" label="Currency" maxlength="3" />
            </v-col>
          </v-row>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.alertThresholdPercent"
                label="Alert threshold (%)"
                type="number"
                min="1"
                max="100"
              />
            </v-col>
            <v-col cols="12" sm="6" class="d-flex align-center">
              <v-switch
                v-model="form.isActive"
                label="Active"
                color="primary"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>

          <v-textarea
            v-model="form.notes"
            label="Notes (optional)"
            rows="2"
            auto-grow
            density="compact"
            variant="outlined"
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="formDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">
            {{ editingBudget ? 'Save changes' : 'Create budget' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="snapshotDialog" max-width="460">
      <v-card>
        <v-card-title class="pt-5">Record spend</v-card-title>
        <v-card-subtitle>{{ snapshotTarget?.name }}</v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-text-field
            v-model.number="snapshotForm.amount"
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            :prefix="snapshotTarget?.currency ?? ''"
            class="mb-2"
          />
          <v-text-field v-model="snapshotForm.note" label="Note (optional)" />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="snapshotDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveSnapshot">Save snapshot</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailDialog" max-width="760" scrollable>
      <v-card v-if="detail">
        <v-card-title class="pt-5">{{ detail.name }}</v-card-title>
        <v-card-subtitle>
          {{ formatMoney(Number(detail.spentAmount), detail.currency) }} of
          {{ formatMoney(Number(detail.amount), detail.currency) }} consumed
        </v-card-subtitle>
        <v-card-text>
          <div class="text-subtitle-2 font-weight-medium mb-2">Spend snapshots</div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Captured</th>
                <th>Source</th>
                <th>Period</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="snapshot in detail.snapshots" :key="snapshot.id">
                <td class="text-caption">{{ formatDateTime(snapshot.capturedAt) }}</td>
                <td class="text-caption">{{ snapshot.source === 'meta_sync' ? 'Meta sync' : 'Manual' }}</td>
                <td class="text-caption">{{ snapshot.periodKey }}</td>
                <td class="text-body-2">{{ formatMoney(Number(snapshot.amount), snapshot.currency) }}</td>
              </tr>
              <tr v-if="detail.snapshots.length === 0">
                <td colspan="4" class="text-center text-medium-emphasis py-4">
                  No spend captured yet.
                </td>
              </tr>
            </tbody>
          </v-table>

          <div class="text-subtitle-2 font-weight-medium mb-2 mt-5">Change history</div>
          <v-list density="compact" lines="two">
            <v-list-item v-for="entry in detail.transactions" :key="entry.id">
              <v-list-item-title class="text-body-2">
                {{ formatTransaction(entry.type) }}
                <span v-if="entry.amount">
                  · {{ formatMoney(Number(entry.amount), entry.currency) }}
                  <span v-if="entry.previousAmount" class="text-medium-emphasis">
                    (from {{ formatMoney(Number(entry.previousAmount), entry.currency) }})
                  </span>
                </span>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ formatDateTime(entry.createdAt) }}
                <span v-if="entry.approvalRequestId"> · via approval</span>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="detail.transactions.length === 0">
              <v-list-item-title class="text-medium-emphasis">No changes recorded yet.</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="detailDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card>
        <v-card-title class="pt-5">Delete {{ deleteTarget?.name }}?</v-card-title>
        <v-card-text>
          Spend history is kept with the deleted budget in the audit trail. This cannot be undone.
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="saving" @click="remove">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3500">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card-text>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { advertisingApi } from '@/services/api/advertising.api';
import { budgetsApi } from '@/services/api/budgets.api';
import { ApiError } from '@/services/api/client';
import type {
  Budget,
  BudgetAlert,
  BudgetDetail,
  BudgetInput,
  BudgetMutationResult,
  BudgetPeriod,
  BudgetScope,
} from '@/types/budgets';
import type { Campaign } from '@/types/advertising';
import { formatDateTime, formatMoney } from '@/utils/format';

const props = defineProps<{
  businessId: string;
  canManage: boolean;
  defaultCurrency: string;
}>();

const budgets = ref<Budget[]>([]);
const openAlerts = ref<BudgetAlert[]>([]);
const campaigns = ref<Campaign[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const formDialog = ref(false);
const editingBudget = ref<Budget | null>(null);
const saving = ref(false);
const dialogError = ref<string | null>(null);
const form = ref({
  scope: 'business' as BudgetScope,
  campaignId: null as string | null,
  name: '',
  amount: 0,
  currency: 'MYR',
  period: 'monthly' as BudgetPeriod,
  alertThresholdPercent: 80,
  isActive: true,
  notes: '',
});

const snapshotDialog = ref(false);
const snapshotTarget = ref<Budget | null>(null);
const snapshotForm = ref({ amount: 0, note: '' });

const detailDialog = ref(false);
const detail = ref<BudgetDetail | null>(null);

const deleteDialog = ref(false);
const deleteTarget = ref<Budget | null>(null);

const acknowledging = ref<string | null>(null);

const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const scopeOptions = [
  { title: 'Client level', value: 'business' },
  { title: 'Campaign level', value: 'campaign' },
];

const periodOptions = [
  { title: 'Monthly', value: 'monthly' },
  { title: 'Lifetime', value: 'total' },
];

const campaignItems = computed(() =>
  campaigns.value.map((campaign) => ({ title: campaign.name, value: campaign.id })),
);

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

function usageColor(usage: number, threshold: number): string {
  if (usage >= 100) {
    return 'error';
  }

  if (usage >= threshold) {
    return 'warning';
  }

  return 'primary';
}

function formatTransaction(type: string): string {
  switch (type) {
    case 'created':
      return 'Budget created';
    case 'updated':
      return 'Budget updated';
    case 'deleted':
      return 'Budget deleted';
    default:
      return type;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const [list, alerts] = await Promise.all([
      budgetsApi.list(props.businessId),
      budgetsApi.listAlerts(props.businessId, { status: 'open' }),
    ]);
    budgets.value = list;
    openAlerts.value = alerts;
  } catch (caught) {
    error.value = describeError(caught, 'Unable to load budgets.');
  } finally {
    loading.value = false;
  }
}

async function loadCampaigns(): Promise<void> {
  if (campaigns.value.length > 0) {
    return;
  }

  try {
    const result = await advertisingApi.listCampaigns(props.businessId, { pageSize: 100 });
    campaigns.value = result.items;
  } catch {
    campaigns.value = [];
  }
}

function resetForm(): void {
  form.value = {
    scope: 'business',
    campaignId: null,
    name: '',
    amount: 0,
    currency: props.defaultCurrency || 'MYR',
    period: 'monthly',
    alertThresholdPercent: 80,
    isActive: true,
    notes: '',
  };
  dialogError.value = null;
}

async function openCreate(): Promise<void> {
  editingBudget.value = null;
  resetForm();
  formDialog.value = true;
  await loadCampaigns();
}

async function openEdit(budget: Budget): Promise<void> {
  editingBudget.value = budget;
  await loadCampaigns();
  form.value = {
    scope: budget.scope,
    campaignId: budget.campaignId,
    name: budget.name,
    amount: Number(budget.amount),
    currency: budget.currency,
    period: budget.period,
    alertThresholdPercent: budget.alertThresholdPercent,
    isActive: budget.isActive,
    notes: budget.notes ?? '',
  };
  dialogError.value = null;
  formDialog.value = true;
}

function buildPayload(): BudgetInput | null {
  if (!form.value.name.trim()) {
    dialogError.value = 'Give the budget a name.';
    return null;
  }

  if (!Number.isFinite(form.value.amount) || form.value.amount <= 0) {
    dialogError.value = 'The limit must be greater than zero.';
    return null;
  }

  if (form.value.scope === 'campaign' && !form.value.campaignId) {
    dialogError.value = 'Choose a campaign for this budget.';
    return null;
  }

  return {
    scope: form.value.scope,
    campaignId: form.value.scope === 'campaign' ? form.value.campaignId ?? undefined : undefined,
    name: form.value.name.trim(),
    amount: form.value.amount,
    currency: form.value.currency.trim().toUpperCase() || undefined,
    period: form.value.period,
    alertThresholdPercent: form.value.alertThresholdPercent,
    isActive: form.value.isActive,
    notes: form.value.notes.trim() || undefined,
  };
}

function describeMutation(result: BudgetMutationResult): void {
  if (result.approvalRequired) {
    notify('Budget change submitted for approval. Open the Approvals tab to track it.', 'info');
    return;
  }

  notify('Budget saved.');
}

async function save(): Promise<void> {
  const payload = buildPayload();

  if (!payload) {
    return;
  }

  saving.value = true;
  dialogError.value = null;

  try {
    const result = editingBudget.value
      ? await budgetsApi.update(props.businessId, editingBudget.value.id, payload)
      : await budgetsApi.create(props.businessId, payload);
    formDialog.value = false;
    describeMutation(result);
    await load();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to save the budget.');
  } finally {
    saving.value = false;
  }
}

function openSnapshot(budget: Budget): void {
  snapshotTarget.value = budget;
  snapshotForm.value = { amount: Number(budget.spentAmount), note: '' };
  dialogError.value = null;
  snapshotDialog.value = true;
}

async function saveSnapshot(): Promise<void> {
  const target = snapshotTarget.value;

  if (!target) {
    return;
  }

  if (!Number.isFinite(snapshotForm.value.amount) || snapshotForm.value.amount < 0) {
    dialogError.value = 'Enter a valid spend amount.';
    return;
  }

  saving.value = true;
  dialogError.value = null;

  try {
    await budgetsApi.recordSnapshot(props.businessId, target.id, {
      amount: snapshotForm.value.amount,
      note: snapshotForm.value.note.trim() || undefined,
    });
    snapshotDialog.value = false;
    notify('Spend snapshot recorded.');
    await load();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to record the snapshot.');
  } finally {
    saving.value = false;
  }
}

async function acknowledge(alert: BudgetAlert): Promise<void> {
  acknowledging.value = alert.id;

  try {
    await budgetsApi.acknowledgeAlert(props.businessId, alert.id);
    notify('Alert acknowledged.');
    await load();
  } catch (caught) {
    notify(describeError(caught, 'Unable to acknowledge the alert.'), 'error');
  } finally {
    acknowledging.value = null;
  }
}

async function openDetail(budget: Budget): Promise<void> {
  detailDialog.value = true;
  detail.value = null;

  try {
    detail.value = await budgetsApi.get(props.businessId, budget.id);
  } catch (caught) {
    notify(describeError(caught, 'Unable to load budget activity.'), 'error');
    detailDialog.value = false;
  }
}

function confirmDelete(budget: Budget): void {
  deleteTarget.value = budget;
  deleteDialog.value = true;
}

async function remove(): Promise<void> {
  const target = deleteTarget.value;

  if (!target) {
    return;
  }

  saving.value = true;

  try {
    const result = await budgetsApi.remove(props.businessId, target.id);
    deleteDialog.value = false;
    deleteTarget.value = null;
    describeMutation(result);
    await load();
  } catch (caught) {
    notify(describeError(caught, 'Unable to delete the budget.'), 'error');
    deleteDialog.value = false;
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
