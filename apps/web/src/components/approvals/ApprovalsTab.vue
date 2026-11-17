<template>
  <v-card-text>
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
      <div>
        <div class="text-subtitle-1 font-weight-medium">Approval workflow</div>
        <div class="text-body-2 text-medium-emphasis">
          Route restricted actions through an approver and keep one immutable payload per decision.
        </div>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip size="small" variant="tonal" color="warning">
          {{ pendingCount }} pending
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
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-card border flat class="mb-5">
      <v-card-text>
        <div class="text-subtitle-2 font-weight-medium mb-1">Approval policies</div>
        <div class="text-body-2 text-medium-emphasis mb-3">
          Members without decision rights submit a request for each enabled action. Owners and
          admins with approval rights keep acting directly.
        </div>
        <v-row dense>
          <v-col v-for="policy in policies" :key="policy.targetType" cols="12" md="4">
            <v-sheet border rounded class="pa-3 h-100">
              <div class="d-flex align-center justify-space-between ga-2">
                <div>
                  <div class="font-weight-medium">{{ formatTargetType(policy.targetType) }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ policy.isEnabled ? 'Approval required' : 'Direct change allowed' }}
                  </div>
                </div>
                <v-switch
                  :model-value="policy.isEnabled"
                  color="primary"
                  density="compact"
                  hide-details
                  :disabled="!canDecide || policySaving === policy.targetType"
                  :loading="policySaving === policy.targetType"
                  @update:model-value="(value: unknown) => togglePolicy(policy, Boolean(value))"
                />
              </div>
            </v-sheet>
          </v-col>
        </v-row>
        <div v-if="!canDecide" class="text-caption text-medium-emphasis mt-2">
          Only approvers can change these policies.
        </div>
      </v-card-text>
    </v-card>

    <v-row dense class="mb-3">
      <v-col cols="12" sm="4" md="3">
        <v-select
          v-model="statusFilter"
          :items="statusOptions"
          label="Status"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          @update:model-value="applyFilters"
        />
      </v-col>
      <v-col cols="12" sm="4" md="3">
        <v-select
          v-model="targetFilter"
          :items="targetOptions"
          label="Action"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          @update:model-value="applyFilters"
        />
      </v-col>
      <v-col cols="12" sm="4" md="3" class="d-flex align-center">
        <v-switch
          v-model="mineOnly"
          label="Only mine"
          color="primary"
          density="compact"
          hide-details
          @update:model-value="applyFilters"
        />
      </v-col>
    </v-row>

    <v-table density="comfortable">
      <thead>
        <tr>
          <th>Action</th>
          <th>Status</th>
          <th>Requested by</th>
          <th>Version</th>
          <th>Execution</th>
          <th>Expires</th>
          <th class="text-right">Review</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="request in requests" :key="request.id">
          <td style="min-width: 200px">
            <div class="font-weight-medium">
              {{ request.targetLabel || formatTargetType(request.targetType) }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ formatTargetType(request.targetType) }}
            </div>
          </td>
          <td>
            <v-chip size="small" :color="statusColor(request.status)" variant="tonal">
              {{ formatStatusLabel(request.status) }}
            </v-chip>
          </td>
          <td class="text-body-2">{{ request.requestedBy?.name ?? '—' }}</td>
          <td class="text-body-2">v{{ request.currentVersion }}</td>
          <td>
            <v-chip
              v-if="request.status === 'approved'"
              size="x-small"
              :color="executionColor(request.executionStatus)"
              variant="tonal"
            >
              {{ formatExecution(request.executionStatus) }}
            </v-chip>
            <span v-else class="text-caption text-medium-emphasis">—</span>
          </td>
          <td class="text-caption">{{ formatDateTime(request.expiresAt) }}</td>
          <td class="text-right">
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-eye-outline"
              @click="openDetail(request.id)"
            >
              Open
            </v-btn>
          </td>
        </tr>
        <tr v-if="requests.length === 0 && !loading">
          <td colspan="7" class="text-center text-medium-emphasis py-8">
            No approval requests match these filters.
          </td>
        </tr>
      </tbody>
    </v-table>

    <div v-if="pageCount > 1" class="d-flex justify-center mt-4">
      <v-pagination
        v-model="page"
        :length="pageCount"
        :total-visible="5"
        density="comfortable"
        @update:model-value="loadRequests"
      />
    </div>

    <v-dialog v-model="detailDialog" max-width="760" scrollable>
      <v-card v-if="selected">
        <v-card-title class="pt-5 d-flex flex-wrap align-center ga-2">
          {{ selected.targetLabel || formatTargetType(selected.targetType) }}
          <v-chip size="small" :color="statusColor(selected.status)" variant="tonal">
            {{ formatStatusLabel(selected.status) }}
          </v-chip>
          <v-chip v-if="selected.status === 'approved'" size="small" variant="outlined">
            {{ formatExecution(selected.executionStatus) }}
          </v-chip>
        </v-card-title>
        <v-card-subtitle>
          {{ formatTargetType(selected.targetType) }} · requested by
          {{ selected.requestedBy?.name ?? 'unknown' }} ·
          {{ formatDateTime(selected.createdAt) }}
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>

          <v-alert
            v-if="selected.executionError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            {{ selected.executionError }}
          </v-alert>

          <div v-if="selected.requesterNote" class="text-body-2 mb-4">
            <span class="text-medium-emphasis">Requester note:</span>
            {{ selected.requesterNote }}
          </div>

          <div class="text-subtitle-2 font-weight-medium mb-2">Payload versions</div>
          <v-timeline density="compact" side="end" truncate-line="both">
            <v-timeline-item
              v-for="version in selected.versions ?? []"
              :key="version.id"
              size="x-small"
              :dot-color="
                selected.approvedVersionId === version.id ? 'success' : 'primary'
              "
            >
              <div class="text-body-2 font-weight-medium">
                Version {{ version.version }}
                <v-chip
                  v-if="selected.approvedVersionId === version.id"
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="ml-1"
                >
                  approved
                </v-chip>
              </div>
              <pre class="text-caption payload">{{ prettyPayload(version.payload) }}</pre>
              <div class="text-caption text-medium-emphasis">
                {{ version.createdBy?.name ?? 'unknown' }} · {{ formatDateTime(version.createdAt) }}
                · hash {{ version.payloadHash.slice(0, 12) }}…
              </div>
            </v-timeline-item>
          </v-timeline>

          <div class="text-subtitle-2 font-weight-medium mb-2 mt-4">Decision history</div>
          <v-list v-if="(selected.decisions ?? []).length > 0" density="compact" lines="two">
            <v-list-item v-for="decision in selected.decisions" :key="decision.id">
              <template #prepend>
                <v-chip
                  size="x-small"
                  :color="decision.decision === 'approved' ? 'success' : 'error'"
                  variant="tonal"
                  class="mr-2"
                >
                  {{ decision.decision }}
                </v-chip>
              </template>
              <v-list-item-title class="text-body-2">
                {{ decision.decidedBy?.name ?? 'unknown' }} · v{{ versionNumber(decision.approvalVersionId) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ formatDateTime(decision.createdAt) }}
                <span v-if="decision.reason"> · {{ decision.reason }}</span>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <div v-else class="text-body-2 text-medium-emphasis mb-4">
            No decision recorded yet.
          </div>

          <template v-if="selected.status === 'pending' && canDecide">
            <v-divider class="my-4" />
            <div class="text-subtitle-2 font-weight-medium mb-2">Decision</div>
            <v-textarea
              v-model="decisionReason"
              label="Reason (optional)"
              rows="2"
              auto-grow
              density="compact"
              variant="outlined"
            />
            <div class="text-caption text-medium-emphasis mb-2">
              Approving version v{{ selected.currentVersion }} executes the stored payload
              immediately.
            </div>
          </template>
        </v-card-text>

        <v-card-actions class="px-6 pb-5 flex-wrap">
          <v-btn
            v-if="selected.status === 'approved' && selected.executionStatus !== 'executed'"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-play-circle-outline"
            :loading="acting"
            @click="retry"
          >
            Retry execution
          </v-btn>
          <v-btn
            v-if="selected.status === 'pending' && canRequest"
            variant="text"
            color="error"
            :loading="acting"
            @click="cancelRequest"
          >
            Cancel request
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="detailDialog = false">Close</v-btn>
          <template v-if="selected.status === 'pending' && canDecide">
            <v-btn color="error" variant="tonal" :loading="acting" @click="decide('rejected')">
              Reject
            </v-btn>
            <v-btn color="success" :loading="acting" @click="decide('approved')">Approve</v-btn>
          </template>
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
import { approvalsApi } from '@/services/api/approvals.api';
import { ApiError } from '@/services/api/client';
import type {
  ApprovalDecision,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalTargetType,
} from '@/types/approvals';
import { formatDateTime } from '@/utils/format';

const props = defineProps<{
  businessId: string;
  canRequest: boolean;
  canDecide: boolean;
}>();

const policies = ref<ApprovalPolicy[]>([]);
const requests = ref<ApprovalRequest[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(true);
const error = ref<string | null>(null);
const statusFilter = ref<ApprovalStatus | null>(null);
const targetFilter = ref<ApprovalTargetType | null>(null);
const mineOnly = ref(false);
const policySaving = ref<ApprovalTargetType | null>(null);

const detailDialog = ref(false);
const selected = ref<ApprovalRequest | null>(null);
const decisionReason = ref('');
const acting = ref(false);
const dialogError = ref<string | null>(null);

const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const statusOptions = [
  { title: 'Pending', value: 'pending' },
  { title: 'Approved', value: 'approved' },
  { title: 'Rejected', value: 'rejected' },
  { title: 'Expired', value: 'expired' },
  { title: 'Cancelled', value: 'cancelled' },
];

const targetOptions = [
  { title: 'Campaign publish', value: 'campaign.publish' },
  { title: 'Campaign status', value: 'campaign.status' },
  { title: 'Budget change', value: 'budget.change' },
];

const pendingCount = computed(
  () => requests.value.filter((request) => request.status === 'pending').length,
);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

type TargetType = ApprovalTargetType;

function formatTargetType(targetType: TargetType): string {
  switch (targetType) {
    case 'campaign.publish':
      return 'Campaign publish';
    case 'campaign.status':
      return 'Campaign status';
    case 'budget.change':
      return 'Budget change';
    default:
      return targetType;
  }
}

function formatStatusLabel(status: ApprovalStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusColor(status: ApprovalStatus): string {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
}

function formatExecution(status: string): string {
  switch (status) {
    case 'executed':
      return 'Executed';
    case 'executing':
      return 'Executing';
    case 'failed':
      return 'Execution failed';
    default:
      return 'Not executed';
  }
}

function executionColor(status: string): string {
  switch (status) {
    case 'executed':
      return 'success';
    case 'failed':
      return 'error';
    case 'executing':
      return 'info';
    default:
      return 'default';
  }
}

function prettyPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function versionNumber(versionId: string): string {
  return String(selected.value?.versions?.find((version) => version.id === versionId)?.version ?? '?');
}

async function loadPolicies(): Promise<void> {
  try {
    policies.value = await approvalsApi.listPolicies(props.businessId);
  } catch {
    policies.value = [];
  }
}

async function loadRequests(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const result = await approvalsApi.list(props.businessId, {
      status: statusFilter.value ?? undefined,
      targetType: targetFilter.value ?? undefined,
      mine: mineOnly.value || undefined,
      page: page.value,
      pageSize,
    });
    requests.value = result.items;
    total.value = result.total;
  } catch (caught) {
    error.value = describeError(caught, 'Unable to load approval requests.');
  } finally {
    loading.value = false;
  }
}

async function load(): Promise<void> {
  await Promise.all([loadPolicies(), loadRequests()]);
}

function applyFilters(): void {
  page.value = 1;
  void loadRequests();
}

async function togglePolicy(policy: ApprovalPolicy, isEnabled: boolean): Promise<void> {
  policySaving.value = policy.targetType;

  try {
    const updated = await approvalsApi.setPolicy(props.businessId, policy.targetType, isEnabled);
    const index = policies.value.findIndex((entry) => entry.targetType === policy.targetType);

    if (index >= 0) {
      policies.value[index] = updated;
    }

    notify(
      `${formatTargetType(policy.targetType)} ${isEnabled ? 'now requires' : 'no longer requires'} approval.`,
    );
  } catch (caught) {
    notify(describeError(caught, 'Unable to update the policy.'), 'error');
  } finally {
    policySaving.value = null;
  }
}

async function openDetail(approvalId: string): Promise<void> {
  detailDialog.value = true;
  dialogError.value = null;
  decisionReason.value = '';
  selected.value = null;

  try {
    selected.value = await approvalsApi.get(props.businessId, approvalId);
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to load the request.');
  }
}

async function decide(decision: ApprovalDecision): Promise<void> {
  if (!selected.value) {
    return;
  }

  acting.value = true;
  dialogError.value = null;

  try {
    selected.value = await approvalsApi.decide(
      props.businessId,
      selected.value.id,
      decision,
      decisionReason.value.trim() || undefined,
    );
    notify(decision === 'approved' ? 'Request approved.' : 'Request rejected.', decision === 'approved' ? 'success' : 'info');
    await loadRequests();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to record the decision.');
  } finally {
    acting.value = false;
  }
}

async function cancelRequest(): Promise<void> {
  if (!selected.value) {
    return;
  }

  acting.value = true;
  dialogError.value = null;

  try {
    selected.value = await approvalsApi.cancel(props.businessId, selected.value.id);
    notify('Request cancelled.');
    await loadRequests();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to cancel the request.');
  } finally {
    acting.value = false;
  }
}

async function retry(): Promise<void> {
  if (!selected.value) {
    return;
  }

  acting.value = true;
  dialogError.value = null;

  try {
    selected.value = await approvalsApi.retryExecution(props.businessId, selected.value.id);

    if (selected.value.executionStatus === 'failed') {
      notify(selected.value.executionError ?? 'Execution failed again.', 'error');
    } else {
      notify('Execution retried.');
    }

    await loadRequests();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to retry execution.');
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.payload {
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 6px 0;
  max-height: 220px;
  overflow: auto;
}
</style>
