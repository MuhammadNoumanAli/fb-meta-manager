<template>
  <v-card-text>
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
      <div>
        <div class="text-subtitle-1 font-weight-medium">Automation and reliability</div>
        <div class="text-body-2 text-medium-emphasis">
          Schedule campaign changes, react to Meta events, and run bulk updates with per-item retries.
        </div>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip size="small" variant="tonal" color="error">
          {{ deadLetterCount }} dead letter{{ deadLetterCount === 1 ? '' : 's' }}
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
          size="small"
          variant="tonal"
          prepend-icon="mdi-clock-fast"
          :loading="dispatching"
          @click="dispatchDue"
        >
          Dispatch due
        </v-btn>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-tabs v-model="section" density="compact" color="primary" class="mb-2">
      <v-tab value="rules" prepend-icon="mdi-robot-outline">Automation rules</v-tab>
      <v-tab value="scheduled" prepend-icon="mdi-calendar-clock">Scheduled actions</v-tab>
      <v-tab value="executions" prepend-icon="mdi-history">Execution history</v-tab>
      <v-tab value="bulk" prepend-icon="mdi-format-list-checks">Bulk operations</v-tab>
    </v-tabs>

    <v-window v-model="section">
      <v-window-item value="rules">
        <div class="d-flex justify-end mb-3">
          <v-btn
            v-if="canManage"
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            @click="openRuleDialog"
          >
            New rule
          </v-btn>
        </div>

        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Trigger</th>
              <th>Action</th>
              <th>Next run</th>
              <th>Active</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in rules" :key="rule.id">
              <td style="min-width: 220px">
                <div class="font-weight-medium">{{ rule.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ rule.description || rule.campaignName || 'No campaign bound' }}
                </div>
              </td>
              <td>
                <v-chip size="small" variant="tonal" color="primary">
                  {{ TRIGGER_LABELS[rule.triggerType] }}
                </v-chip>
                <div v-if="rule.intervalMinutes" class="text-caption text-medium-emphasis mt-1">
                  Every {{ rule.intervalMinutes }} min
                </div>
              </td>
              <td class="text-body-2">
                {{ ACTION_LABELS[rule.actionType] }}
                <div v-if="rule.notifyMessage" class="text-caption text-medium-emphasis">
                  “{{ rule.notifyMessage }}”
                </div>
              </td>
              <td class="text-caption">{{ formatDateTime(rule.nextRunAt) }}</td>
              <td>
                <v-switch
                  :model-value="rule.isActive"
                  color="primary"
                  density="compact"
                  hide-details
                  :disabled="!canManage || ruleSaving === rule.id"
                  :loading="ruleSaving === rule.id"
                  @update:model-value="(value: unknown) => toggleRule(rule, Boolean(value))"
                />
              </td>
              <td class="text-right" style="white-space: nowrap">
                <v-btn
                  v-if="canManage"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-play"
                  :loading="ruleRunning === rule.id"
                  @click="runRule(rule)"
                >
                  Run now
                </v-btn>
                <v-btn
                  v-if="canManage"
                  size="small"
                  variant="text"
                  color="error"
                  icon="mdi-delete-outline"
                  :loading="ruleDeleting === rule.id"
                  @click="deleteRule(rule)"
                />
              </td>
            </tr>
            <tr v-if="rules.length === 0 && !loading">
              <td colspan="6" class="text-center text-medium-emphasis py-8">
                No automation rules yet.
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-window-item>

      <v-window-item value="scheduled">
        <div class="d-flex justify-end mb-3">
          <v-btn
            v-if="canManage"
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            @click="openScheduleDialog"
          >
            Schedule action
          </v-btn>
        </div>

        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Action</th>
              <th>Campaign</th>
              <th>Run at</th>
              <th>Status</th>
              <th>Executed</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="action in scheduledActions" :key="action.id">
              <td style="min-width: 180px">
                <div class="font-weight-medium">{{ ACTION_LABELS[action.actionType] }}</div>
                <div v-if="action.notifyMessage" class="text-caption text-medium-emphasis">
                  “{{ action.notifyMessage }}”
                </div>
              </td>
              <td class="text-body-2">{{ action.campaignName ?? '—' }}</td>
              <td class="text-caption">{{ formatDateTime(action.runAt) }}</td>
              <td>
                <v-chip size="small" :color="scheduledStatusColor(action.status)" variant="tonal">
                  {{ labelOf(action.status) }}
                </v-chip>
                <div v-if="action.error" class="text-caption text-error mt-1">
                  {{ action.error }}
                </div>
              </td>
              <td class="text-caption">{{ formatDateTime(action.executedAt) }}</td>
              <td class="text-right">
                <v-btn
                  v-if="canManage && canCancelScheduled(action.status)"
                  size="small"
                  variant="text"
                  color="error"
                  :loading="cancelling === action.id"
                  @click="cancelScheduled(action)"
                >
                  Cancel
                </v-btn>
              </td>
            </tr>
            <tr v-if="scheduledActions.length === 0 && !loading">
              <td colspan="6" class="text-center text-medium-emphasis py-8">
                No scheduled actions yet.
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-window-item>

      <v-window-item value="executions">
        <div class="d-flex flex-wrap align-center ga-3 mb-3">
          <v-select
            v-model="executionStatus"
            :items="executionStatusOptions"
            label="Status"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="max-width: 220px"
            @update:model-value="loadExecutions"
          />
          <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="loadExecutions">
            Refresh
          </v-btn>
        </div>

        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Execution</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Created</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="execution in executions" :key="execution.id">
              <td style="min-width: 220px">
                <div class="font-weight-medium">
                  {{ execution.ruleName || `Scheduled action ${shortId(execution.scheduledActionId)}` }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ execution.trigger }} · {{ execution.idempotencyKey.slice(0, 40) }}
                </div>
                <div v-if="execution.error" class="text-caption text-error mt-1">
                  {{ execution.error }}
                </div>
              </td>
              <td><v-chip size="small" variant="outlined">{{ execution.trigger }}</v-chip></td>
              <td>
                <v-chip size="small" :color="executionStatusColor(execution.status)" variant="tonal">
                  {{ labelOf(execution.status) }}
                </v-chip>
                <div
                  v-if="execution.approvalStatus"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  Approval: {{ execution.approvalStatus }}
                </div>
              </td>
              <td class="text-body-2">{{ execution.attempts }} / {{ execution.maxAttempts }}</td>
              <td class="text-caption">{{ formatDateTime(execution.createdAt) }}</td>
              <td class="text-right">
                <v-btn
                  v-if="canManage && canRetryExecution(execution.status)"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-replay"
                  :loading="executionRetrying === execution.id"
                  @click="retryExecution(execution)"
                >
                  Retry
                </v-btn>
              </td>
            </tr>
            <tr v-if="executions.length === 0 && !loading">
              <td colspan="6" class="text-center text-medium-emphasis py-8">
                No executions recorded yet.
              </td>
            </tr>
          </tbody>
        </v-table>

        <div v-if="executionPageCount > 1" class="d-flex justify-center mt-4">
          <v-pagination
            v-model="executionPage"
            :length="executionPageCount"
            :total-visible="5"
            density="comfortable"
            @update:model-value="loadExecutions"
          />
        </div>
      </v-window-item>

      <v-window-item value="bulk">
        <div class="d-flex justify-end mb-3">
          <v-btn
            v-if="canManage"
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            @click="openBulkDialog"
          >
            New bulk operation
          </v-btn>
        </div>

        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Requested by</th>
              <th>Created</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="operation in bulkOperations" :key="operation.id">
              <td style="min-width: 200px">
                <div class="font-weight-medium">{{ BULK_LABELS[operation.operation] }}</div>
                <div v-if="operation.reason" class="text-caption text-medium-emphasis">
                  {{ operation.reason }}
                </div>
              </td>
              <td>
                <v-chip size="small" :color="bulkStatusColor(operation.status)" variant="tonal">
                  {{ labelOf(operation.status) }}
                </v-chip>
                <div v-if="operation.approvalRequestId" class="text-caption text-medium-emphasis mt-1">
                  Awaiting approval
                </div>
              </td>
              <td class="text-body-2" style="min-width: 160px">
                {{ operation.succeeded }} ok · {{ operation.failed }} failed ·
                {{ operation.pending }} pending
                <v-progress-linear
                  class="mt-1"
                  :model-value="bulkProgress(operation)"
                  height="6"
                  rounded
                  :color="operation.failed > 0 ? 'warning' : 'success'"
                />
              </td>
              <td class="text-body-2">{{ operation.requestedBy?.name ?? '—' }}</td>
              <td class="text-caption">{{ formatDateTime(operation.createdAt) }}</td>
              <td class="text-right" style="white-space: nowrap">
                <v-btn size="small" variant="text" prepend-icon="mdi-eye-outline" @click="openBulkDetail(operation.id)">
                  Open
                </v-btn>
                <v-btn
                  v-if="canManage && (operation.status === 'partial' || operation.status === 'failed')"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-replay"
                  :loading="bulkRetrying === operation.id"
                  @click="retryBulk(operation)"
                >
                  Retry failed
                </v-btn>
              </td>
            </tr>
            <tr v-if="bulkOperations.length === 0 && !loading">
              <td colspan="6" class="text-center text-medium-emphasis py-8">
                No bulk operations yet.
              </td>
            </tr>
          </tbody>
        </v-table>

        <div v-if="bulkPageCount > 1" class="d-flex justify-center mt-4">
          <v-pagination
            v-model="bulkPage"
            :length="bulkPageCount"
            :total-visible="5"
            density="comfortable"
            @update:model-value="loadBulkOperations"
          />
        </div>
      </v-window-item>
    </v-window>

    <!-- Rule dialog -->
    <v-dialog v-model="ruleDialog" max-width="620" scrollable>
      <v-card>
        <v-card-title class="pt-5">New automation rule</v-card-title>
        <v-card-subtitle>
          Rules with a schedule trigger run automatically; event rules react to rejections or budget alerts.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-text-field v-model="ruleForm.name" label="Name" class="mb-2" />
          <v-text-field v-model="ruleForm.description" label="Description" class="mb-2" />
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="ruleForm.triggerType"
                :items="triggerOptions"
                label="Trigger"
                class="mb-2"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="ruleForm.actionType"
                :items="actionOptions"
                label="Action"
                class="mb-2"
              />
            </v-col>
          </v-row>
          <v-select
            v-if="ruleNeedsCampaign"
            v-model="ruleForm.campaignId"
            :items="campaignOptions"
            item-title="title"
            item-value="value"
            label="Campaign"
            class="mb-2"
          />
          <template v-if="ruleForm.triggerType === 'schedule'">
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="ruleForm.runAt"
                  label="First run"
                  type="datetime-local"
                  class="mb-2"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model.number="ruleForm.intervalMinutes"
                  label="Repeat every (minutes)"
                  type="number"
                  min="1"
                  hint="Leave empty for a one-off run"
                  persistent-hint
                  class="mb-2"
                />
              </v-col>
            </v-row>
          </template>
          <v-textarea
            v-if="ruleForm.actionType === 'notify'"
            v-model="ruleForm.notifyMessage"
            label="Notification message"
            rows="2"
            auto-grow
            class="mt-2"
          />
          <v-switch
            v-model="ruleForm.isActive"
            label="Active"
            color="primary"
            density="compact"
            hide-details
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="ruleDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveRule">Create rule</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Scheduled action dialog -->
    <v-dialog v-model="scheduleDialog" max-width="560">
      <v-card>
        <v-card-title class="pt-5">Schedule a campaign action</v-card-title>
        <v-card-subtitle>
          The dispatcher claims each action once; approval policies still apply at execution time.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-select
            v-model="scheduleForm.campaignId"
            :items="campaignOptions"
            item-title="title"
            item-value="value"
            label="Campaign"
            class="mb-2"
          />
          <v-select
            v-model="scheduleForm.actionType"
            :items="actionOptions.filter((option) => option.value !== 'notify')"
            label="Action"
            class="mb-2"
          />
          <v-text-field
            v-model="scheduleForm.runAt"
            label="Run at"
            type="datetime-local"
            class="mb-2"
          />
          <v-text-field v-model="scheduleForm.notifyMessage" label="Note (optional)" />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="scheduleDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveScheduledAction">Schedule</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk dialog -->
    <v-dialog v-model="bulkDialog" max-width="620" scrollable>
      <v-card>
        <v-card-title class="pt-5">New bulk operation</v-card-title>
        <v-card-subtitle>
          Each campaign is processed independently; failures can be retried without touching succeeded items.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-select
            v-model="bulkForm.operation"
            :items="bulkOptions"
            label="Operation"
            class="mb-2"
          />
          <v-select
            v-model="bulkForm.campaignIds"
            :items="campaignOptions"
            item-title="title"
            item-value="value"
            label="Campaigns"
            multiple
            chips
            closable-chips
            class="mb-2"
          />
          <v-text-field v-model="bulkForm.reason" label="Reason (optional)" />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="bulkDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveBulkOperation">
            Start operation
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk detail dialog -->
    <v-dialog v-model="bulkDetailDialog" max-width="820" scrollable>
      <v-card v-if="selectedBulk">
        <v-card-title class="pt-5 d-flex flex-wrap align-center ga-2">
          {{ BULK_LABELS[selectedBulk.operation] }}
          <v-chip size="small" :color="bulkStatusColor(selectedBulk.status)" variant="tonal">
            {{ labelOf(selectedBulk.status) }}
          </v-chip>
        </v-card-title>
        <v-card-subtitle>
          {{ selectedBulk.succeeded }} succeeded · {{ selectedBulk.failed }} failed ·
          {{ selectedBulk.pending }} pending · requested by
          {{ selectedBulk.requestedBy?.name ?? 'unknown' }}
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Error</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedBulk.items" :key="item.id">
                <td class="text-body-2">{{ item.campaignLabel }}</td>
                <td>
                  <v-chip size="x-small" :color="itemStatusColor(item.status)" variant="tonal">
                    {{ labelOf(item.status) }}
                  </v-chip>
                </td>
                <td class="text-body-2">{{ item.attempts }}</td>
                <td class="text-caption text-error">{{ item.error || '—' }}</td>
                <td class="text-caption">{{ formatDateTime(item.finishedAt) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-btn
            v-if="canManage && (selectedBulk.status === 'partial' || selectedBulk.status === 'failed')"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-replay"
            :loading="bulkRetrying === selectedBulk.id"
            @click="retryBulk(selectedBulk)"
          >
            Retry failed items
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="bulkDetailDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3500">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card-text>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { advertisingApi } from '@/services/api/advertising.api';
import { automationApi } from '@/services/api/automation.api';
import { ApiError } from '@/services/api/client';
import type { Campaign } from '@/types/advertising';
import type {
  AutomationActionType,
  AutomationExecution,
  AutomationExecutionStatus,
  AutomationRule,
  AutomationTriggerType,
  BulkOperation,
  BulkOperationDetail,
  BulkOperationType,
  ScheduledAction,
  ScheduledActionStatus,
} from '@/types/automation';
import { ACTION_LABELS, BULK_LABELS, TRIGGER_LABELS } from '@/types/automation';
import { formatDateTime } from '@/utils/format';

const props = defineProps<{
  businessId: string;
  canManage: boolean;
}>();

const section = ref('rules');
const loading = ref(true);
const error = ref<string | null>(null);

const rules = ref<AutomationRule[]>([]);
const scheduledActions = ref<ScheduledAction[]>([]);
const executions = ref<AutomationExecution[]>([]);
const executionTotal = ref(0);
const executionPage = ref(1);
const executionStatus = ref<AutomationExecutionStatus | null>(null);
const executionPageSize = 20;
const bulkOperations = ref<BulkOperation[]>([]);
const bulkTotal = ref(0);
const bulkPage = ref(1);
const bulkPageSize = 20;
const campaigns = ref<Campaign[]>([]);

const dispatching = ref(false);
const saving = ref(false);
const ruleSaving = ref<string | null>(null);
const ruleRunning = ref<string | null>(null);
const ruleDeleting = ref<string | null>(null);
const cancelling = ref<string | null>(null);
const executionRetrying = ref<string | null>(null);
const bulkRetrying = ref<string | null>(null);

const ruleDialog = ref(false);
const scheduleDialog = ref(false);
const bulkDialog = ref(false);
const bulkDetailDialog = ref(false);
const dialogError = ref<string | null>(null);
const selectedBulk = ref<BulkOperationDetail | null>(null);

const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const triggerOptions: { title: string; value: AutomationTriggerType }[] = [
  { title: 'Schedule', value: 'schedule' },
  { title: 'Campaign rejected', value: 'campaign_rejected' },
  { title: 'Budget threshold', value: 'budget_threshold' },
];

const actionOptions: { title: string; value: AutomationActionType }[] = [
  { title: 'Pause campaign', value: 'pause_campaign' },
  { title: 'Resume campaign', value: 'resume_campaign' },
  { title: 'Archive campaign', value: 'archive_campaign' },
  { title: 'Sync campaign', value: 'sync_campaign' },
  { title: 'Send notification', value: 'notify' },
];

const bulkOptions: { title: string; value: BulkOperationType }[] = [
  { title: 'Pause campaigns', value: 'pause_campaigns' },
  { title: 'Resume campaigns', value: 'resume_campaigns' },
  { title: 'Archive campaigns', value: 'archive_campaigns' },
  { title: 'Sync campaigns', value: 'sync_campaigns' },
];

const executionStatusOptions: { title: string; value: AutomationExecutionStatus }[] = [
  { title: 'Pending', value: 'pending' },
  { title: 'Running', value: 'running' },
  { title: 'Pending approval', value: 'pending_approval' },
  { title: 'Succeeded', value: 'succeeded' },
  { title: 'Failed', value: 'failed' },
  { title: 'Skipped', value: 'skipped' },
  { title: 'Dead letter', value: 'dead_letter' },
];

function localDateTime(offsetMs: number): string {
  const date = new Date(Date.now() + offsetMs);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const ruleForm = reactive({
  name: '',
  description: '',
  triggerType: 'schedule' as AutomationTriggerType,
  actionType: 'pause_campaign' as AutomationActionType,
  campaignId: '' as string,
  runAt: localDateTime(60 * 60 * 1000),
  intervalMinutes: null as number | null,
  notifyMessage: '',
  isActive: true,
});

const scheduleForm = reactive({
  campaignId: '' as string,
  actionType: 'pause_campaign' as AutomationActionType,
  runAt: localDateTime(60 * 60 * 1000),
  notifyMessage: '',
});

const bulkForm = reactive({
  operation: 'pause_campaigns' as BulkOperationType,
  campaignIds: [] as string[],
  reason: '',
});

const campaignOptions = computed(() =>
  campaigns.value.map((campaign) => ({
    title: `${campaign.name} (${campaign.status})`,
    value: campaign.id,
  })),
);

const ruleNeedsCampaign = computed(
  () =>
    ruleForm.triggerType === 'campaign_rejected' ||
    (ruleForm.triggerType === 'schedule' && ruleForm.actionType !== 'notify'),
);

const deadLetterCount = computed(
  () => executions.value.filter((execution) => execution.status === 'dead_letter').length,
);
const executionPageCount = computed(() =>
  Math.max(1, Math.ceil(executionTotal.value / executionPageSize)),
);
const bulkPageCount = computed(() => Math.max(1, Math.ceil(bulkTotal.value / bulkPageSize)));

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

function labelOf(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

function shortId(value: string | null): string {
  return value ? value.slice(0, 8) : '—';
}

function executionStatusColor(status: AutomationExecutionStatus): string {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'dead_letter':
      return 'error';
    case 'running':
      return 'info';
    case 'pending':
    case 'pending_approval':
      return 'warning';
    default:
      return 'default';
  }
}

function scheduledStatusColor(status: ScheduledActionStatus): string {
  switch (status) {
    case 'executed':
      return 'success';
    case 'failed':
      return 'error';
    case 'pending_approval':
    case 'queued':
      return 'warning';
    case 'skipped':
    case 'cancelled':
      return 'default';
    default:
      return 'info';
  }
}

function bulkStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'success';
    case 'partial':
      return 'warning';
    case 'failed':
      return 'error';
    case 'running':
      return 'info';
    default:
      return 'default';
  }
}

function itemStatusColor(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
      return 'info';
    default:
      return 'default';
  }
}

function bulkProgress(operation: BulkOperation): number {
  if (operation.total === 0) {
    return 0;
  }

  return Math.round(((operation.succeeded + operation.failed) / operation.total) * 100);
}

function canCancelScheduled(status: ScheduledActionStatus): boolean {
  return status === 'scheduled' || status === 'queued' || status === 'pending_approval';
}

function canRetryExecution(status: AutomationExecutionStatus): boolean {
  return status === 'failed' || status === 'dead_letter' || status === 'skipped';
}

async function loadCampaigns(): Promise<void> {
  try {
    const result = await advertisingApi.listCampaigns(props.businessId, { pageSize: 100 });
    campaigns.value = result.items;
  } catch {
    campaigns.value = [];
  }
}

async function loadRules(): Promise<void> {
  try {
    rules.value = await automationApi.listRules(props.businessId);
  } catch {
    rules.value = [];
  }
}

async function loadScheduledActions(): Promise<void> {
  try {
    scheduledActions.value = await automationApi.listScheduledActions(props.businessId);
  } catch {
    scheduledActions.value = [];
  }
}

async function loadExecutions(): Promise<void> {
  try {
    const result = await automationApi.listExecutions(props.businessId, {
      status: executionStatus.value ?? undefined,
      page: executionPage.value,
      pageSize: executionPageSize,
    });
    executions.value = result.items;
    executionTotal.value = result.total;
  } catch {
    executions.value = [];
    executionTotal.value = 0;
  }
}

async function loadBulkOperations(): Promise<void> {
  try {
    const result = await automationApi.listBulkOperations(props.businessId, {
      page: bulkPage.value,
      pageSize: bulkPageSize,
    });
    bulkOperations.value = result.items;
    bulkTotal.value = result.total;
  } catch {
    bulkOperations.value = [];
    bulkTotal.value = 0;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    await Promise.all([
      loadCampaigns(),
      loadRules(),
      loadScheduledActions(),
      loadExecutions(),
      loadBulkOperations(),
    ]);
  } finally {
    loading.value = false;
  }
}

function openRuleDialog(): void {
  dialogError.value = null;
  ruleForm.name = '';
  ruleForm.description = '';
  ruleForm.triggerType = 'schedule';
  ruleForm.actionType = 'pause_campaign';
  ruleForm.campaignId = campaignOptions.value[0]?.value ?? '';
  ruleForm.runAt = localDateTime(60 * 60 * 1000);
  ruleForm.intervalMinutes = null;
  ruleForm.notifyMessage = '';
  ruleForm.isActive = true;
  ruleDialog.value = true;
}

async function saveRule(): Promise<void> {
  dialogError.value = null;

  if (!ruleForm.name.trim()) {
    dialogError.value = 'A rule name is required.';
    return;
  }

  if (ruleNeedsCampaign.value && !ruleForm.campaignId) {
    dialogError.value = 'Select the campaign this rule should act on.';
    return;
  }

  saving.value = true;

  try {
    await automationApi.createRule(props.businessId, {
      name: ruleForm.name.trim(),
      description: ruleForm.description.trim() || null,
      triggerType: ruleForm.triggerType,
      actionType: ruleForm.actionType,
      campaignId: ruleNeedsCampaign.value ? ruleForm.campaignId : null,
      runAt:
        ruleForm.triggerType === 'schedule' && ruleForm.runAt
          ? new Date(ruleForm.runAt).toISOString()
          : null,
      intervalMinutes:
        ruleForm.triggerType === 'schedule' && ruleForm.intervalMinutes
          ? Number(ruleForm.intervalMinutes)
          : null,
      notifyMessage:
        ruleForm.actionType === 'notify' ? ruleForm.notifyMessage.trim() || null : null,
      isActive: ruleForm.isActive,
    });
    ruleDialog.value = false;
    notify('Automation rule created.');
    await Promise.all([loadRules(), loadExecutions()]);
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to create the rule.');
  } finally {
    saving.value = false;
  }
}

async function toggleRule(rule: AutomationRule, isActive: boolean): Promise<void> {
  ruleSaving.value = rule.id;

  try {
    const updated = await automationApi.updateRule(props.businessId, rule.id, { isActive });
    const index = rules.value.findIndex((entry) => entry.id === rule.id);

    if (index >= 0) {
      rules.value[index] = updated;
    }

    notify(`${rule.name} ${isActive ? 'activated' : 'paused'}.`);
  } catch (caught) {
    notify(describeError(caught, 'Unable to update the rule.'), 'error');
  } finally {
    ruleSaving.value = null;
  }
}

async function runRule(rule: AutomationRule): Promise<void> {
  ruleRunning.value = rule.id;

  try {
    await automationApi.runRule(props.businessId, rule.id);
    notify(`${rule.name} queued.`);
    await loadExecutions();
  } catch (caught) {
    notify(describeError(caught, 'Unable to run the rule.'), 'error');
  } finally {
    ruleRunning.value = null;
  }
}

async function deleteRule(rule: AutomationRule): Promise<void> {
  ruleDeleting.value = rule.id;

  try {
    await automationApi.deleteRule(props.businessId, rule.id);
    rules.value = rules.value.filter((entry) => entry.id !== rule.id);
    notify('Rule deleted.');
  } catch (caught) {
    notify(describeError(caught, 'Unable to delete the rule.'), 'error');
  } finally {
    ruleDeleting.value = null;
  }
}

function openScheduleDialog(): void {
  dialogError.value = null;
  scheduleForm.campaignId = campaignOptions.value[0]?.value ?? '';
  scheduleForm.actionType = 'pause_campaign';
  scheduleForm.runAt = localDateTime(60 * 60 * 1000);
  scheduleForm.notifyMessage = '';
  scheduleDialog.value = true;
}

async function saveScheduledAction(): Promise<void> {
  dialogError.value = null;

  if (!scheduleForm.campaignId) {
    dialogError.value = 'Select the campaign to act on.';
    return;
  }

  saving.value = true;

  try {
    await automationApi.createScheduledAction(props.businessId, {
      campaignId: scheduleForm.campaignId,
      actionType: scheduleForm.actionType,
      runAt: new Date(scheduleForm.runAt).toISOString(),
      notifyMessage: scheduleForm.notifyMessage.trim() || null,
    });
    scheduleDialog.value = false;
    notify('Action scheduled.');
    await loadScheduledActions();
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to schedule the action.');
  } finally {
    saving.value = false;
  }
}

async function cancelScheduled(action: ScheduledAction): Promise<void> {
  cancelling.value = action.id;

  try {
    const updated = await automationApi.cancelScheduledAction(props.businessId, action.id);
    const index = scheduledActions.value.findIndex((entry) => entry.id === action.id);

    if (index >= 0) {
      scheduledActions.value[index] = updated;
    }

    notify('Scheduled action cancelled.');
  } catch (caught) {
    notify(describeError(caught, 'Unable to cancel the action.'), 'error');
  } finally {
    cancelling.value = null;
  }
}

async function retryExecution(execution: AutomationExecution): Promise<void> {
  executionRetrying.value = execution.id;

  try {
    await automationApi.retryExecution(props.businessId, execution.id);
    notify('Execution re-queued.');
    await loadExecutions();
  } catch (caught) {
    notify(describeError(caught, 'Unable to retry the execution.'), 'error');
  } finally {
    executionRetrying.value = null;
  }
}

function openBulkDialog(): void {
  dialogError.value = null;
  bulkForm.operation = 'pause_campaigns';
  bulkForm.campaignIds = [];
  bulkForm.reason = '';
  bulkDialog.value = true;
}

async function saveBulkOperation(): Promise<void> {
  dialogError.value = null;

  if (bulkForm.campaignIds.length === 0) {
    dialogError.value = 'Select at least one campaign.';
    return;
  }

  saving.value = true;

  try {
    const result = await automationApi.createBulkOperation(props.businessId, {
      operation: bulkForm.operation,
      campaignIds: bulkForm.campaignIds,
      reason: bulkForm.reason.trim() || null,
    });
    bulkDialog.value = false;
    notify(
      result.approvalRequired
        ? 'Bulk operation submitted for approval.'
        : 'Bulk operation completed.',
    );
    await Promise.all([loadBulkOperations(), loadExecutions()]);
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to start the bulk operation.');
  } finally {
    saving.value = false;
  }
}

async function openBulkDetail(operationId: string): Promise<void> {
  dialogError.value = null;
  selectedBulk.value = null;
  bulkDetailDialog.value = true;

  try {
    selectedBulk.value = await automationApi.getBulkOperation(props.businessId, operationId);
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to load the operation.');
  }
}

async function retryBulk(operation: BulkOperation): Promise<void> {
  bulkRetrying.value = operation.id;

  try {
    const updated = await automationApi.retryBulkOperation(props.businessId, operation.id);

    if (selectedBulk.value?.id === operation.id) {
      selectedBulk.value = updated;
    }

    notify('Failed items retried.');
    await Promise.all([loadBulkOperations(), loadExecutions()]);
  } catch (caught) {
    notify(describeError(caught, 'Unable to retry the operation.'), 'error');
  } finally {
    bulkRetrying.value = null;
  }
}

async function dispatchDue(): Promise<void> {
  dispatching.value = true;

  try {
    const result = await automationApi.dispatch(props.businessId);
    notify(
      `Dispatched ${result.executions} execution(s): ${result.scheduledActions} scheduled action(s), ${result.scheduledRules} scheduled rule(s), ${result.eventRules} event rule(s).`,
    );
    await Promise.all([loadExecutions(), loadScheduledActions(), loadRules()]);
  } catch (caught) {
    notify(describeError(caught, 'Unable to dispatch due actions.'), 'error');
  } finally {
    dispatching.value = false;
  }
}

onMounted(load);
</script>
