<template>
  <v-card-text>
    <div v-if="loading" class="py-10 text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="loadError" type="error" variant="tonal" class="mb-4">
      {{ loadError }}
    </v-alert>

    <template v-else>
      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
        <div>
          <div class="text-subtitle-1 font-weight-medium">Captured leads</div>
          <div class="text-body-2 text-medium-emphasis">
            Meta Lead Ads and website submissions land here automatically.
          </div>
        </div>
        <div class="d-flex align-center ga-2">
          <v-chip size="small" variant="tonal" color="primary">
            {{ total }} {{ total === 1 ? 'lead' : 'leads' }}
          </v-chip>
          <v-btn
            size="small"
            variant="text"
            prepend-icon="mdi-refresh"
            :loading="loadingLeads"
            @click="refresh"
          >
            Refresh
          </v-btn>
        </div>
      </div>

      <v-row class="mb-2">
        <v-col cols="12" sm="6" md="4">
          <v-text-field
            v-model="search"
            label="Search name, email or phone"
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            @keyup.enter="applyFilters"
            @click:clear="applyFilters"
          />
        </v-col>
        <v-col cols="6" sm="3" md="2">
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
        <v-col cols="6" sm="3" md="2">
          <v-select
            v-model="sourceFilter"
            :items="sourceOptions"
            label="Source"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            @update:model-value="applyFilters"
          />
        </v-col>
        <v-col cols="12" sm="12" md="4" class="d-flex align-center">
          <v-btn variant="tonal" color="primary" prepend-icon="mdi-filter" @click="applyFilters">
            Apply filters
          </v-btn>
        </v-col>
      </v-row>

      <v-alert v-if="actionError" type="error" variant="tonal" class="mb-4">
        {{ actionError }}
      </v-alert>

      <v-table density="comfortable" class="mb-4">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Source</th>
            <th>Consent</th>
            <th>Captured</th>
            <th>Status</th>
            <th class="text-right">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lead in leads" :key="lead.id">
            <td>
              <div class="font-weight-medium">{{ lead.fullName || 'Unnamed lead' }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ lead.email || lead.phone || 'No contact details' }}
              </div>
            </td>
            <td>
              <v-chip size="small" variant="tonal">
                {{ formatLeadSource(lead.sourcePlatform) }}
              </v-chip>
            </td>
            <td class="text-caption">{{ formatConsent(lead.consentStatus) }}</td>
            <td class="text-caption">{{ formatDateTime(lead.capturedAt) }}</td>
            <td style="min-width: 150px">
              <v-select
                v-if="canManage"
                :model-value="lead.status"
                :items="statusOptions"
                density="compact"
                variant="plain"
                hide-details
                :disabled="busyLeadId === lead.id"
                @update:model-value="(value) => changeStatus(lead, value)"
              />
              <v-chip v-else size="small" :color="leadStatusColor(lead.status)" variant="tonal">
                {{ formatStatus(lead.status) }}
              </v-chip>
            </td>
            <td class="text-right">
              <v-btn
                size="small"
                variant="text"
                icon="mdi-open-in-new"
                @click="openLead(lead)"
              />
            </td>
          </tr>
          <tr v-if="leads.length === 0">
            <td colspan="6" class="text-center text-medium-emphasis py-8">
              No leads match these filters yet.
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="pageCount > 1" class="d-flex justify-center">
        <v-pagination
          v-model="page"
          :length="pageCount"
          :total-visible="5"
          density="comfortable"
          @update:model-value="loadLeads"
        />
      </div>

      <v-card border flat class="mt-6">
        <v-card-text>
          <div class="d-flex flex-wrap align-center justify-space-between ga-3">
            <div>
              <div class="text-subtitle-1 font-weight-medium">Website lead API</div>
              <div class="text-body-2 text-medium-emphasis">
                Connect forms on the client website with a keyed ingestion endpoint.
              </div>
            </div>
            <div v-if="canManage" class="d-flex ga-2">
              <v-btn
                v-if="websiteSource?.hasApiKey"
                color="primary"
                variant="tonal"
                prepend-icon="mdi-key-change"
                :loading="issuingKey"
                @click="rotateDialog = true"
              >
                Rotate key
              </v-btn>
              <v-btn
                v-else
                color="primary"
                prepend-icon="mdi-key-plus"
                :loading="issuingKey"
                @click="issueKey"
              >
                Generate key
              </v-btn>
              <v-btn
                v-if="websiteSource?.hasApiKey"
                variant="text"
                color="error"
                prepend-icon="mdi-key-remove"
                @click="revokeDialog = true"
              >
                Revoke
              </v-btn>
            </div>
          </div>

          <v-alert
            v-if="websiteSource?.hasApiKey"
            type="success"
            variant="tonal"
            density="compact"
            class="mt-4"
          >
            Key active ending in <strong>{{ websiteSource.apiKeyHint }}</strong>
            <span v-if="websiteSource.lastReceivedAt">
              · last submission {{ formatDateTime(websiteSource.lastReceivedAt) }}
            </span>
          </v-alert>
          <v-alert v-else type="info" variant="tonal" density="compact" class="mt-4">
            No website key yet. Generate one to accept leads from your forms.
          </v-alert>

          <div class="text-caption text-medium-emphasis mt-4 mb-2">
            POST leads to this endpoint with your key in the
            <code>x-adpilot-lead-key</code> header:
          </div>
          <v-sheet color="surface-variant" rounded class="pa-3 text-caption">
            <pre class="mb-0" style="white-space: pre-wrap">{{ sampleRequest }}</pre>
          </v-sheet>
        </v-card-text>
      </v-card>

      <v-expansion-panels variant="accordion" class="mt-6">
        <v-expansion-panel>
          <v-expansion-panel-title>
            Recent intake activity ({{ syncLogs.length }})
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in syncLogs" :key="log.id">
                  <td class="text-caption">{{ formatDateTime(log.createdAt) }}</td>
                  <td class="text-caption">{{ formatLeadSource(log.sourcePlatform) }}</td>
                  <td>
                    <v-chip size="x-small" variant="tonal">{{ formatStatus(log.status) }}</v-chip>
                  </td>
                  <td class="text-caption">{{ log.message || '—' }}</td>
                </tr>
                <tr v-if="syncLogs.length === 0">
                  <td colspan="4" class="text-center text-medium-emphasis py-4">
                    No intake attempts recorded yet.
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <v-dialog v-model="leadDialog" max-width="760">
      <v-card v-if="selectedLead">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>{{ selectedLead.fullName || 'Lead details' }}</span>
          <v-chip
            size="small"
            :color="leadStatusColor(selectedLead.status)"
            variant="tonal"
          >
            {{ formatStatus(selectedLead.status) }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-1">
            <strong>Email:</strong> {{ selectedLead.email || '—' }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>Phone:</strong> {{ selectedLead.phone || '—' }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>Source:</strong> {{ formatLeadSource(selectedLead.sourcePlatform) }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>Consent:</strong> {{ formatConsent(selectedLead.consentStatus) }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>Language:</strong> {{ selectedLead.language || '—' }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>Captured:</strong> {{ formatDateTime(selectedLead.capturedAt) }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>External ID:</strong> {{ selectedLead.externalLeadId || '—' }}
          </div>
          <div class="text-body-2 mb-1">
            <strong>Campaign / ad:</strong>
            {{ selectedLead.campaignExternalId || '—' }} /
            {{ selectedLead.adExternalId || '—' }}
          </div>
          <div v-if="selectedLead.message" class="mt-4">
            <div class="text-caption text-medium-emphasis mb-1">Message</div>
            <v-sheet color="surface-variant" rounded class="pa-3 text-body-2">
              {{ selectedLead.message }}
            </v-sheet>
          </div>

          <template v-if="canWhatsapp">
            <v-divider class="my-4" />
            <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-2">
              <div class="text-subtitle-2 font-weight-medium">WhatsApp</div>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-refresh"
                :loading="whatsappLoading"
                @click="loadLeadWhatsapp(selectedLead.id)"
              >
                Refresh
              </v-btn>
            </div>

            <div class="d-flex flex-wrap align-center ga-2 mb-3">
              <v-chip size="small" variant="tonal" :color="consentColor">
                {{ formatConsent(selectedLead.consentStatus) }}
              </v-chip>
              <v-btn
                v-if="canManage"
                size="small"
                variant="tonal"
                color="success"
                :loading="whatsappBusy === 'grant'"
                @click="updateLeadConsent('granted')"
              >
                Grant consent
              </v-btn>
              <v-btn
                v-if="canManage"
                size="small"
                variant="tonal"
                color="error"
                :loading="whatsappBusy === 'deny'"
                @click="updateLeadConsent('denied')"
              >
                Record opt-out
              </v-btn>
            </div>

            <div v-if="canManage" class="d-flex flex-wrap align-center ga-2 mb-3">
              <v-select
                v-model="selectedTemplateId"
                :items="approvedTemplates"
                item-title="title"
                item-value="value"
                label="Approved template"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 300px"
              />
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-send"
                :disabled="!selectedTemplateId"
                :loading="whatsappBusy === 'send'"
                @click="sendWhatsappMessage"
              >
                Send template
              </v-btn>
            </div>

            <v-alert
              v-if="whatsappError"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              {{ whatsappError }}
            </v-alert>

            <v-list v-if="leadMessages.length > 0" density="compact" lines="two" class="pa-0">
              <v-list-item v-for="message in leadMessages" :key="message.id">
                <v-list-item-title class="text-body-2">
                  {{ message.body || '—' }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatWhatsappMessageStatus(message.status) }} ·
                  {{ formatDateTime(message.createdAt) }}
                  <span v-if="message.error"> · {{ message.error }}</span>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div v-else class="text-caption text-medium-emphasis">
              No WhatsApp messages for this lead yet.
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="leadDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="keyDialog" max-width="620" persistent>
      <v-card>
        <v-card-title>Website key generated</v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            Copy this key now. It is shown once and only a hash is stored.
          </v-alert>
          <v-text-field
            :model-value="issuedKey"
            label="Lead API key"
            readonly
            append-inner-icon="mdi-content-copy"
            @click:append-inner="copyKey"
          />
          <div class="text-caption text-medium-emphasis">
            Send it as the <code>x-adpilot-lead-key</code> header on every submission.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="tonal" @click="keyDialog = false">Done</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="rotateDialog" max-width="480">
      <v-card>
        <v-card-title>Rotate website key?</v-card-title>
        <v-card-text>
          The current key stops working immediately. Forms using it must be updated.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rotateDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="issuingKey" @click="issueKey">Rotate key</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="revokeDialog" max-width="480">
      <v-card>
        <v-card-title>Revoke website key?</v-card-title>
        <v-card-text>
          Submissions with this key are rejected until you generate a new one.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="revokeDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="revokingKey" @click="revokeKey">Revoke key</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card-text>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { API_BASE_URL, ApiError } from '@/services/api/client';
import { leadsApi } from '@/services/api/leads.api';
import { whatsappApi } from '@/services/api/whatsapp.api';
import type {
  Lead,
  LeadSource,
  LeadStatus,
  LeadSyncLog,
} from '@/types/leads';
import type { WhatsappMessage } from '@/types/whatsapp';
import { formatDateTime } from '@/utils/format';
import {
  formatConsent,
  formatLeadSource,
  formatStatus,
  formatWhatsappMessageStatus,
  leadStatusColor,
} from '@/utils/labels';

const props = defineProps<{
  businessId: string;
  canManage: boolean;
  canWhatsapp?: boolean;
}>();

const leads = ref<Lead[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(true);
const loadingLeads = ref(false);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);

const search = ref('');
const statusFilter = ref<LeadStatus | null>(null);
const sourceFilter = ref<string | null>(null);

const sources = ref<LeadSource[]>([]);
const syncLogs = ref<LeadSyncLog[]>([]);
const issuingKey = ref(false);
const revokingKey = ref(false);
const busyLeadId = ref<string | null>(null);

const leadDialog = ref(false);
const selectedLead = ref<Lead | null>(null);
const keyDialog = ref(false);
const rotateDialog = ref(false);
const revokeDialog = ref(false);
const issuedKey = ref('');
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const approvedTemplates = ref<Array<{ title: string; value: string }>>([]);
const selectedTemplateId = ref<string | null>(null);
const leadMessages = ref<WhatsappMessage[]>([]);
const whatsappLoading = ref(false);
const whatsappBusy = ref<'grant' | 'deny' | 'send' | null>(null);
const whatsappError = ref<string | null>(null);

const consentColor = computed(() => {
  switch (selectedLead.value?.consentStatus) {
    case 'granted':
      return 'success';
    case 'denied':
      return 'error';
    default:
      return 'default';
  }
});

const statusOptions = [
  { title: 'New', value: 'new' },
  { title: 'Contacted', value: 'contacted' },
  { title: 'Qualified', value: 'qualified' },
  { title: 'Converted', value: 'converted' },
  { title: 'Disqualified', value: 'disqualified' },
];

const sourceOptions = [
  { title: 'Meta Lead Ads', value: 'meta_lead_ads' },
  { title: 'Website API', value: 'website_api' },
];

const websiteSource = computed(
  () => sources.value.find((source) => source.type === 'website_api') ?? null,
);

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const sampleRequest = computed(() => {
  const key = issuedKey.value || 'YOUR_LEAD_KEY';
  return `curl -X POST ${API_BASE_URL}/leads/intake \\
  -H "Content-Type: application/json" \\
  -H "x-adpilot-lead-key: ${key}" \\
  -d '{
    "fullName": "Aisha Rahman",
    "email": "aisha@example.com",
    "phone": "+60123456789",
    "message": "Interested in the coffee subscription",
    "externalId": "form-2026-001",
    "consent": true
  }'`;
});

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

async function loadLeads(): Promise<void> {
  loadingLeads.value = true;
  actionError.value = null;

  try {
    const result = await leadsApi.list(props.businessId, {
      page: page.value,
      pageSize,
      search: (search.value ?? '').trim() || undefined,
      status: statusFilter.value ?? undefined,
      source: sourceFilter.value ?? undefined,
    });
    leads.value = result.items;
    total.value = result.total;
  } catch (caught) {
    loadError.value = describeError(caught, 'Unable to load leads.');
  } finally {
    loadingLeads.value = false;
  }
}

async function loadSources(): Promise<void> {
  sources.value = await leadsApi.listSources(props.businessId);
}

async function loadSyncLogs(): Promise<void> {
  syncLogs.value = await leadsApi.syncLogs(props.businessId);
}

function applyFilters(): void {
  page.value = 1;
  void loadLeads();
}

async function refresh(): Promise<void> {
  try {
    await Promise.all([loadLeads(), loadSources(), loadSyncLogs()]);
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to refresh lead data.');
  }
}

async function changeStatus(lead: Lead, value: LeadStatus): Promise<void> {
  if (!value || value === lead.status) {
    return;
  }

  busyLeadId.value = lead.id;
  actionError.value = null;

  try {
    const updated = await leadsApi.updateStatus(props.businessId, lead.id, value);
    lead.status = updated.status;
    notify('Lead status updated.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to update the lead.');
  } finally {
    busyLeadId.value = null;
  }
}

function openLead(lead: Lead): void {
  selectedLead.value = lead;
  leadDialog.value = true;
  selectedTemplateId.value = null;
  whatsappError.value = null;

  if (props.canWhatsapp) {
    void loadLeadWhatsapp(lead.id);
  }
}

async function loadLeadWhatsapp(leadId: string): Promise<void> {
  if (!props.canWhatsapp) {
    return;
  }

  whatsappLoading.value = true;
  whatsappError.value = null;

  try {
    const [templates, messages] = await Promise.all([
      whatsappApi.listTemplates(props.businessId, {
        status: 'approved',
        pageSize: 100,
      }),
      whatsappApi.listMessages(props.businessId, { leadId, pageSize: 10 }),
    ]);

    approvedTemplates.value = templates.items
      .filter((template) => template.isEnabled)
      .map((template) => ({
        title: `${template.name} · ${template.language}`,
        value: template.id,
      }));
    leadMessages.value = messages.items;
  } catch (caught) {
    whatsappError.value = describeError(caught, 'Unable to load WhatsApp activity.');
  } finally {
    whatsappLoading.value = false;
  }
}

async function updateLeadConsent(status: 'granted' | 'denied'): Promise<void> {
  const lead = selectedLead.value;
  if (!lead) {
    return;
  }

  whatsappBusy.value = status === 'granted' ? 'grant' : 'deny';
  whatsappError.value = null;

  try {
    await whatsappApi.recordConsent(props.businessId, { leadId: lead.id, status });
    lead.consentStatus = status;
    notify(status === 'granted' ? 'Consent recorded.' : 'Opt-out recorded.');
  } catch (caught) {
    whatsappError.value = describeError(caught, 'Unable to record consent.');
  } finally {
    whatsappBusy.value = null;
  }
}

async function sendWhatsappMessage(): Promise<void> {
  const lead = selectedLead.value;
  if (!lead || !selectedTemplateId.value) {
    return;
  }

  whatsappBusy.value = 'send';
  whatsappError.value = null;

  try {
    const message = await whatsappApi.sendMessage(props.businessId, {
      leadId: lead.id,
      templateId: selectedTemplateId.value,
    });

    if (message.status === 'skipped' || message.status === 'suppressed') {
      notify(message.error ?? 'Message blocked before delivery.', 'warning');
    } else {
      notify('Template message queued for delivery.');
    }

    await loadLeadWhatsapp(lead.id);
  } catch (caught) {
    whatsappError.value = describeError(caught, 'Unable to send the template message.');
  } finally {
    whatsappBusy.value = null;
  }
}

async function issueKey(): Promise<void> {
  issuingKey.value = true;
  actionError.value = null;

  try {
    const result = await leadsApi.issueWebsiteKey(props.businessId);
    issuedKey.value = result.apiKey;
    keyDialog.value = true;
    rotateDialog.value = false;
    await loadSources();
    notify('Website key generated. Store it securely.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to generate a website key.');
  } finally {
    issuingKey.value = false;
  }
}

async function revokeKey(): Promise<void> {
  revokingKey.value = true;
  actionError.value = null;

  try {
    await leadsApi.revokeWebsiteKey(props.businessId);
    revokeDialog.value = false;
    issuedKey.value = '';
    await loadSources();
    notify('Website key revoked.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to revoke the website key.');
  } finally {
    revokingKey.value = false;
  }
}

async function copyKey(): Promise<void> {
  try {
    await navigator.clipboard.writeText(issuedKey.value);
    notify('Key copied to the clipboard.');
  } catch {
    notify('Copy failed. Select the key manually.', 'warning');
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadLeads(), loadSources(), loadSyncLogs()]);
  } catch (caught) {
    loadError.value = describeError(caught, 'Unable to load lead data.');
  } finally {
    loading.value = false;
  }
});
</script>
