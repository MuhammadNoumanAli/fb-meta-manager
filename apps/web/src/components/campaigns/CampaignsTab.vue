<template>
  <CampaignDetailPanel
    v-if="selectedCampaignId"
    :business-id="businessId"
    :campaign-id="selectedCampaignId"
    :can-create="canCreate"
    :can-update="canUpdate"
    :can-publish="canPublish"
    @back="closeDetail"
    @changed="onDetailChanged"
  />

  <v-card-text v-else>
    <v-tabs v-model="section" color="primary" density="comfortable" class="mb-4">
      <v-tab value="campaigns" prepend-icon="mdi-bullhorn-outline">Campaigns</v-tab>
      <v-tab value="creatives" prepend-icon="mdi-image-multiple-outline">
        Creatives &amp; media
      </v-tab>
    </v-tabs>

    <CreativeManager
      v-if="section === 'creatives'"
      :business-id="businessId"
      :can-create="canCreate"
      :can-update="canUpdate"
    />

    <template v-else>
      <div v-if="loading" class="py-10 text-center">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <v-alert v-else-if="loadError" type="error" variant="tonal" class="mb-4">
        {{ loadError }}
      </v-alert>

      <template v-else>
        <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
          <div>
            <div class="text-subtitle-1 font-weight-medium">Campaigns</div>
            <div class="text-body-2 text-medium-emphasis">
              Build campaigns in AdPilot, publish them to Meta and track review state.
            </div>
          </div>
          <div class="d-flex align-center ga-2">
            <v-chip size="small" variant="tonal" color="primary">
              {{ total }} {{ total === 1 ? 'campaign' : 'campaigns' }}
            </v-chip>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-sync"
              :loading="syncingAll"
              :disabled="total === 0"
              @click="syncAll"
            >
              Sync all
            </v-btn>
            <v-btn
              v-if="canCreate"
              color="primary"
              size="small"
              prepend-icon="mdi-plus"
              @click="openCreate"
            >
              New campaign
            </v-btn>
          </div>
        </div>

        <v-row class="mb-2">
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="search"
              label="Search campaigns"
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
              :items="campaignStatusOptions"
              label="Status"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              @update:model-value="applyFilters"
            />
          </v-col>
          <v-col cols="12" sm="3" md="2" class="d-flex align-center">
            <v-btn variant="tonal" color="primary" prepend-icon="mdi-filter" @click="applyFilters">
              Apply
            </v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="actionError" type="error" variant="tonal" class="mb-4">
          {{ actionError }}
        </v-alert>

        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Meta review</th>
              <th>Budget</th>
              <th>Last synced</th>
              <th class="text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="campaign in campaigns" :key="campaign.id">
              <td style="min-width: 220px">
                <div class="font-weight-medium">{{ campaign.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatObjective(campaign.objective) }}
                  <template v-if="campaign.externalId">
                    · Meta ID {{ campaign.externalId }}
                  </template>
                </div>
                <div v-if="campaign.lastError" class="text-caption text-error text-truncate" :title="campaign.lastError">
                  {{ campaign.lastError }}
                </div>
              </td>
              <td>
                <v-chip
                  size="small"
                  :color="advertisingStatusColor(campaign.status)"
                  variant="tonal"
                >
                  {{ formatAdvertisingStatus(campaign.status) }}
                </v-chip>
                <div v-if="campaign.deliveryStatus !== 'unknown'" class="mt-1">
                  <v-chip
                    size="x-small"
                    :color="deliveryStatusColor(campaign.deliveryStatus)"
                    variant="outlined"
                  >
                    {{ formatDeliveryStatus(campaign.deliveryStatus) }}
                  </v-chip>
                </div>
              </td>
              <td>
                <v-chip
                  size="small"
                  :color="reviewStatusColor(campaign.metaReviewStatus)"
                  variant="tonal"
                >
                  {{ formatReviewStatus(campaign.metaReviewStatus) }}
                </v-chip>
              </td>
              <td class="text-body-2">
                <template v-if="campaign.dailyBudget !== null">
                  {{ formatMoney(campaign.dailyBudget, campaign.budgetCurrency) }} / day
                </template>
                <template v-else-if="campaign.lifetimeBudget !== null">
                  {{ formatMoney(campaign.lifetimeBudget, campaign.budgetCurrency) }} total
                </template>
                <template v-else>—</template>
              </td>
              <td class="text-caption">{{ formatDateTime(campaign.lastSyncedAt) }}</td>
              <td class="text-right">
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-arrow-right"
                  @click="openDetail(campaign)"
                />
              </td>
            </tr>
            <tr v-if="campaigns.length === 0">
              <td colspan="6" class="text-center text-medium-emphasis py-8">
                No campaigns yet. Create one and publish it to Meta when it is ready.
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
            @update:model-value="loadCampaigns"
          />
        </div>
      </template>
    </template>

    <v-dialog v-model="createDialog" max-width="680" persistent>
      <v-card>
        <v-card-title class="pt-5">New campaign</v-card-title>
        <v-card-subtitle>
          Campaigns are created locally as drafts. Publish when ad sets and ads are ready.
        </v-card-subtitle>
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
            {{ dialogError }}
          </v-alert>

          <v-alert
            v-if="createFormLoading"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            Loading Meta ad accounts…
          </v-alert>
          <v-alert
            v-else-if="adAccounts.length === 0"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            No Meta ad accounts found. Connect Meta and discover assets in the Integrations tab,
            then try again.
          </v-alert>

          <v-text-field v-model="createForm.name" label="Campaign name" class="mb-2" />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="createForm.objective"
                :items="objectiveOptions"
                label="Objective"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="createForm.adAccountId"
                :items="adAccountItems"
                item-title="title"
                item-value="value"
                label="Meta ad account"
              />
            </v-col>
          </v-row>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="createForm.dailyBudget"
                label="Daily budget"
                type="number"
                min="0"
                :prefix="adAccountCurrency"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="createForm.lifetimeBudget"
                label="Lifetime budget"
                type="number"
                min="0"
                :prefix="adAccountCurrency"
              />
            </v-col>
          </v-row>

          <v-select
            v-model="createForm.specialAdCategory"
            :items="specialCategoryOptions"
            label="Special ad category"
            class="mb-2"
          />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="createForm.startTime"
                label="Start time (optional)"
                type="datetime-local"
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="createForm.stopTime"
                label="Stop time (optional)"
                type="datetime-local"
                hide-details
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="createDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="createCampaign">
            Create draft
          </v-btn>
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
import CampaignDetailPanel from '@/components/campaigns/CampaignDetailPanel.vue';
import CreativeManager from '@/components/campaigns/CreativeManager.vue';
import { advertisingApi } from '@/services/api/advertising.api';
import { ApiError } from '@/services/api/client';
import { integrationsApi } from '@/services/api/integrations.api';
import type {
  AdvertisingObjective,
  AdvertisingStatus,
  Campaign,
  CampaignInput,
} from '@/types/advertising';
import type { MetaAsset } from '@/types/integrations';
import {
  campaignStatusOptions,
  fromDateTimeInput,
  objectiveOptions,
  specialCategoryOptions,
} from '@/utils/advertising-options';
import {
  advertisingStatusColor,
  deliveryStatusColor,
  formatAdvertisingStatus,
  formatDeliveryStatus,
  formatObjective,
  formatReviewStatus,
  reviewStatusColor,
} from '@/utils/labels';
import { formatDateTime, formatMoney } from '@/utils/format';

const props = defineProps<{
  businessId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canPublish: boolean;
}>();

const campaigns = ref<Campaign[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(true);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const section = ref<'campaigns' | 'creatives'>('campaigns');

const search = ref('');
const statusFilter = ref<AdvertisingStatus | null>(null);
const selectedCampaignId = ref<string | null>(null);
const syncingAll = ref(false);

const createDialog = ref(false);
const saving = ref(false);
const dialogError = ref<string | null>(null);
const createFormLoading = ref(false);
const adAccounts = ref<MetaAsset[]>([]);
const createForm = ref({
  name: '',
  objective: 'OUTCOME_LEADS' as AdvertisingObjective,
  adAccountId: null as string | null,
  dailyBudget: null as number | null,
  lifetimeBudget: null as number | null,
  specialAdCategory: 'NONE',
  startTime: '',
  stopTime: '',
});

const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const adAccountItems = computed(() =>
  adAccounts.value.map((account) => ({
    title: account.detail ? `${account.name} (${account.detail})` : account.name,
    value: account.id,
  })),
);

const adAccountCurrency = computed(() => {
  const selected = adAccounts.value.find((account) => account.id === createForm.value.adAccountId);
  return selected?.detail ?? '';
});

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

async function loadCampaigns(): Promise<void> {
  loading.value = true;
  actionError.value = null;

  try {
    const result = await advertisingApi.listCampaigns(props.businessId, {
      page: page.value,
      pageSize,
      search: (search.value ?? '').trim() || undefined,
      status: statusFilter.value ?? undefined,
    });
    campaigns.value = result.items;
    total.value = result.total;
  } catch (caught) {
    loadError.value = describeError(caught, 'Unable to load campaigns.');
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  page.value = 1;
  void loadCampaigns();
}

function openDetail(campaign: Campaign): void {
  selectedCampaignId.value = campaign.id;
}

function closeDetail(): void {
  selectedCampaignId.value = null;
  void loadCampaigns();
}

function onDetailChanged(): void {
  void loadCampaigns();
}

async function syncAll(): Promise<void> {
  syncingAll.value = true;
  actionError.value = null;

  try {
    const result = await advertisingApi.syncAllCampaigns(props.businessId);
    await loadCampaigns();

    if (result.failed > 0) {
      notify(`Synced ${result.synced} campaigns, ${result.failed} failed.`, 'warning');
    } else {
      notify(`Synced ${result.synced} campaigns.`);
    }
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to sync campaigns.');
  } finally {
    syncingAll.value = false;
  }
}

function resetCreateForm(): void {
  createForm.value = {
    name: '',
    objective: 'OUTCOME_LEADS',
    adAccountId: adAccounts.value[0]?.id ?? null,
    dailyBudget: null,
    lifetimeBudget: null,
    specialAdCategory: 'NONE',
    startTime: '',
    stopTime: '',
  };
  dialogError.value = null;
}

async function openCreate(): Promise<void> {
  createDialog.value = true;
  resetCreateForm();

  if (adAccounts.value.length > 0) {
    return;
  }

  createFormLoading.value = true;

  try {
    const overview = await integrationsApi.getMetaOverview(props.businessId);
    adAccounts.value = overview.assets.adAccounts;
    resetCreateForm();
  } catch {
    adAccounts.value = [];
  } finally {
    createFormLoading.value = false;
  }
}

async function createCampaign(): Promise<void> {
  if (!createForm.value.name.trim()) {
    dialogError.value = 'Give the campaign a name.';
    return;
  }

  const payload: CampaignInput = {
    name: createForm.value.name.trim(),
    objective: createForm.value.objective,
    adAccountId: createForm.value.adAccountId ?? undefined,
    dailyBudget: createForm.value.dailyBudget ?? undefined,
    lifetimeBudget: createForm.value.lifetimeBudget ?? undefined,
    specialAdCategories: [createForm.value.specialAdCategory],
    startTime: fromDateTimeInput(createForm.value.startTime),
    stopTime: fromDateTimeInput(createForm.value.stopTime),
  };

  saving.value = true;
  dialogError.value = null;

  try {
    const campaign = await advertisingApi.createCampaign(props.businessId, payload);
    createDialog.value = false;
    await loadCampaigns();
    notify('Campaign draft created.');
    selectedCampaignId.value = campaign.id;
  } catch (caught) {
    dialogError.value =
      caught instanceof ApiError ? caught.message : 'Unable to create the campaign.';
  } finally {
    saving.value = false;
  }
}

onMounted(loadCampaigns);
</script>
