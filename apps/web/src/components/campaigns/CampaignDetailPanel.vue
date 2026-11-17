<template>
  <v-card-text>
    <div v-if="loading" class="py-10 text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="loadError" type="error" variant="tonal" class="mb-4">
      {{ loadError }}
    </v-alert>

    <template v-else-if="campaign">
      <div class="d-flex flex-wrap align-start justify-space-between ga-4 mb-4">
        <div>
          <div class="d-flex flex-wrap align-center ga-2 mb-1">
            <h2 class="text-h5 font-weight-bold">{{ campaign.name }}</h2>
            <v-chip
              size="small"
              :color="advertisingStatusColor(campaign.status)"
              variant="tonal"
            >
              {{ formatAdvertisingStatus(campaign.status) }}
            </v-chip>
            <v-chip
              v-if="campaign.publishedAt"
              size="small"
              :color="reviewStatusColor(campaign.metaReviewStatus)"
              variant="tonal"
              prepend-icon="mdi-shield-check-outline"
            >
              Meta review: {{ formatReviewStatus(campaign.metaReviewStatus) }}
            </v-chip>
            <v-chip
              v-if="campaign.deliveryStatus !== 'unknown'"
              size="small"
              :color="deliveryStatusColor(campaign.deliveryStatus)"
              variant="tonal"
            >
              {{ formatDeliveryStatus(campaign.deliveryStatus) }}
            </v-chip>
            <v-progress-circular
              v-if="polling"
              indeterminate
              size="18"
              width="2"
              color="info"
            />
          </div>
          <div class="text-body-2 text-medium-emphasis">
            {{ formatObjective(campaign.objective) }} ·
            {{ campaign.adAccountName || campaign.adAccountExternalId || 'No ad account' }}
          </div>
        </div>

        <div class="d-flex flex-wrap ga-2">
          <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="emit('back')">
            Campaigns
          </v-btn>
          <v-btn
            v-if="canPublish && !campaign.publishedAt"
            color="primary"
            prepend-icon="mdi-rocket-launch-outline"
            :disabled="campaign.status === 'publishing' || polling"
            @click="publishDialog = true"
          >
            Publish to Meta
          </v-btn>
          <v-btn
            v-if="campaign.externalId"
            variant="tonal"
            prepend-icon="mdi-sync"
            :loading="syncing"
            @click="sync"
          >
            Sync status
          </v-btn>
          <v-menu v-if="canUpdate">
            <template #activator="{ props: menuProps }">
              <v-btn variant="tonal" append-icon="mdi-chevron-down" v-bind="menuProps">
                Status
              </v-btn>
            </template>
            <v-list density="compact">
              <v-list-item
                v-for="option in liveStatusOptions"
                :key="option.value"
                :disabled="campaign.status === option.value"
                @click="changeStatus(option.value)"
              >
                <v-list-item-title>{{ option.title }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <v-alert v-if="actionError" type="error" variant="tonal" class="mb-4">
        {{ actionError }}
      </v-alert>

      <v-alert
        v-if="pendingApprovals.length > 0"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        <div class="font-weight-medium mb-1">Awaiting approval</div>
        <div class="text-body-2">
          {{ pendingApprovals.length }}
          {{ pendingApprovals.length === 1 ? 'request is' : 'requests are' }} pending for this
          campaign. An approver can approve or reject them in the Approvals tab.
        </div>
        <ul class="pl-4 mt-1 text-body-2">
          <li v-for="request in pendingApprovals" :key="request.id">
            {{ formatApprovalTarget(request.targetType) }} ·
            {{ request.requestedBy?.name ?? 'Unknown requester' }} ·
            v{{ request.currentVersion }}
          </li>
        </ul>
      </v-alert>

      <v-alert v-if="campaign.lastError" type="error" variant="tonal" class="mb-4">
        <div class="font-weight-medium mb-1">Last Meta error</div>
        <div class="text-body-2">{{ campaign.lastError }}</div>
        <div class="text-caption mt-1">
          Fix the issue and publish again. Published campaigns always keep the external IDs
          already created.
        </div>
      </v-alert>

      <v-row dense class="mb-2">
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Daily budget</div>
              <div class="text-subtitle-1 font-weight-bold">
                {{ formatMoney(campaign.dailyBudget, campaign.budgetCurrency) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Lifetime budget</div>
              <div class="text-subtitle-1 font-weight-bold">
                {{ formatMoney(campaign.lifetimeBudget, campaign.budgetCurrency) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">External ID</div>
              <div class="text-subtitle-1 font-weight-bold text-truncate">
                {{ campaign.externalId || 'Not published' }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Last synced</div>
              <div class="text-subtitle-2 font-weight-bold">
                {{ formatDateTime(campaign.lastSyncedAt) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-alert
        v-if="!campaign.publishedAt"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        This campaign is local until you publish it. Publishing creates the campaign, ad sets,
        creatives and advertisements in Meta, then stores every external ID.
      </v-alert>

      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-3">
        <div>
          <div class="text-subtitle-1 font-weight-medium">
            Ad sets and advertisements ({{ campaign.adSets.length }})
          </div>
          <div class="text-body-2 text-medium-emphasis">
            Build the structure top-down: ad set targeting, then advertisements using a creative.
          </div>
        </div>
        <v-btn
          v-if="canCreate && !structureLocked"
          color="primary"
          variant="tonal"
          size="small"
          prepend-icon="mdi-plus"
          @click="openAdSetCreate"
        >
          Add ad set
        </v-btn>
      </div>

      <v-alert
        v-if="structureLocked"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        Published campaigns keep their structure locked. Pause, archive or sync it instead of
        editing ad sets and advertisements.
      </v-alert>

      <v-expansion-panels v-if="campaign.adSets.length > 0" variant="accordion" class="mb-4">
        <v-expansion-panel v-for="adSet in campaign.adSets" :key="adSet.id">
          <v-expansion-panel-title>
            <div class="d-flex flex-wrap align-center ga-2">
              <span class="font-weight-medium">{{ adSet.name }}</span>
              <v-chip
                size="x-small"
                :color="advertisingStatusColor(adSet.status)"
                variant="tonal"
              >
                {{ formatAdvertisingStatus(adSet.status) }}
              </v-chip>
              <v-chip size="x-small" variant="outlined">
                {{ formatOptimizationGoal(adSet.optimizationGoal) }}
              </v-chip>
              <v-chip
                v-if="adSet.externalId"
                size="x-small"
                :color="reviewStatusColor(adSet.metaReviewStatus)"
                variant="tonal"
              >
                {{ formatReviewStatus(adSet.metaReviewStatus) }}
              </v-chip>
              <span class="text-caption text-medium-emphasis">
                {{ adSet.advertisements.length }}
                {{ adSet.advertisements.length === 1 ? 'ad' : 'ads' }}
              </span>
            </div>
            <template #actions>
              <div class="d-flex align-center ga-1" @click.stop>
                <v-menu v-if="canUpdate && !structureLocked">
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      size="small"
                      variant="text"
                      icon="mdi-dots-vertical"
                      v-bind="menuProps"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item @click="openAdSetEdit(adSet)">
                      <v-list-item-title>Edit ad set</v-list-item-title>
                    </v-list-item>
                    <v-list-item @click="confirmAdSetDelete(adSet)">
                      <v-list-item-title class="text-error">Delete ad set</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
                <v-menu v-if="canUpdate">
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      size="small"
                      variant="text"
                      icon="mdi-power"
                      v-bind="menuProps"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      v-for="option in liveStatusOptions"
                      :key="option.value"
                      :disabled="adSet.status === option.value"
                      @click="changeAdSetStatus(adSet, option.value)"
                    >
                      <v-list-item-title>{{ option.title }}</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </template>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row dense class="mb-3">
              <v-col cols="6" md="3">
                <div class="text-caption text-medium-emphasis">Billing</div>
                <div class="text-body-2">{{ formatBillingEvent(adSet.billingEvent) }}</div>
              </v-col>
              <v-col cols="6" md="3">
                <div class="text-caption text-medium-emphasis">Daily budget</div>
                <div class="text-body-2">
                  {{ formatMoney(adSet.dailyBudget, adSet.budgetCurrency) }}
                </div>
              </v-col>
              <v-col cols="6" md="3">
                <div class="text-caption text-medium-emphasis">Lifetime budget</div>
                <div class="text-body-2">
                  {{ formatMoney(adSet.lifetimeBudget, adSet.budgetCurrency) }}
                </div>
              </v-col>
              <v-col cols="6" md="3">
                <div class="text-caption text-medium-emphasis">External ID</div>
                <div class="text-body-2 text-truncate">{{ adSet.externalId || '—' }}</div>
              </v-col>
            </v-row>

            <div v-if="adSet.lastError" class="text-caption text-error mb-3">
              {{ adSet.lastError }}
            </div>

            <v-table density="compact">
              <thead>
                <tr>
                  <th>Advertisement</th>
                  <th>Creative</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>External ID</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ad in adSet.advertisements" :key="ad.id">
                  <td>
                    <div class="font-weight-medium">{{ ad.name }}</div>
                    <div v-if="ad.lastError" class="text-caption text-error">
                      {{ ad.lastError }}
                    </div>
                  </td>
                  <td>
                    <div class="d-flex align-center ga-2">
                      <v-avatar v-if="creativePreview(ad.creativeId)" rounded="lg" size="32">
                        <v-img :src="creativePreview(ad.creativeId)" cover />
                      </v-avatar>
                      <span class="text-body-2">{{ creativeName(ad.creativeId) }}</span>
                    </div>
                  </td>
                  <td>
                    <v-chip
                      size="x-small"
                      :color="advertisingStatusColor(ad.status)"
                      variant="tonal"
                    >
                      {{ formatAdvertisingStatus(ad.status) }}
                    </v-chip>
                  </td>
                  <td>
                    <v-chip
                      size="x-small"
                      :color="reviewStatusColor(ad.metaReviewStatus)"
                      variant="tonal"
                    >
                      {{ formatReviewStatus(ad.metaReviewStatus) }}
                    </v-chip>
                  </td>
                  <td class="text-caption">{{ ad.externalId || '—' }}</td>
                  <td class="text-right" style="white-space: nowrap">
                    <v-menu v-if="canUpdate">
                      <template #activator="{ props: menuProps }">
                        <v-btn
                          size="small"
                          variant="text"
                          icon="mdi-dots-vertical"
                          v-bind="menuProps"
                        />
                      </template>
                      <v-list density="compact">
                        <template v-if="!structureLocked">
                          <v-list-item @click="openAdEdit(ad, adSet.id)">
                            <v-list-item-title>Edit advertisement</v-list-item-title>
                          </v-list-item>
                          <v-list-item @click="confirmAdDelete(ad)">
                            <v-list-item-title class="text-error">
                              Delete advertisement
                            </v-list-item-title>
                          </v-list-item>
                          <v-divider />
                        </template>
                        <v-list-item
                          v-for="option in liveStatusOptions"
                          :key="option.value"
                          :disabled="ad.status === option.value"
                          @click="changeAdStatus(ad, option.value)"
                        >
                          <v-list-item-title>{{ option.title }}</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </td>
                </tr>
                <tr v-if="adSet.advertisements.length === 0">
                  <td colspan="6" class="text-center text-medium-emphasis py-4">
                    No advertisements in this ad set.
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="canCreate && !structureLocked" class="mt-3">
              <v-btn
                size="small"
                variant="tonal"
                prepend-icon="mdi-plus"
                @click="openAdCreate(adSet.id)"
              >
                Add advertisement
              </v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-sheet v-else border rounded class="pa-8 text-center text-medium-emphasis mb-4">
        No ad sets yet. Add one to define targeting and budget before publishing.
      </v-sheet>

      <v-row class="mt-2">
        <v-col cols="12" md="6">
          <div class="text-subtitle-1 font-weight-medium mb-2">Status history</div>
          <v-timeline density="compact" side="end" truncate-line="both">
            <v-timeline-item
              v-for="entry in campaign.statusHistory"
              :key="entry.id"
              size="x-small"
              :dot-color="advertisingStatusColor(entry.toStatus)"
            >
              <div class="text-body-2">
                <strong>{{ formatAdvertisingStatus(entry.toStatus) }}</strong>
                <span class="text-medium-emphasis">
                  · {{ entry.source }}
                  <template v-if="entry.fromStatus">
                    (from {{ formatAdvertisingStatus(entry.fromStatus) }})
                  </template>
                </span>
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formatDateTime(entry.createdAt) }}
                <span v-if="entry.message"> · {{ entry.message }}</span>
              </div>
            </v-timeline-item>
            <v-timeline-item v-if="campaign.statusHistory.length === 0" size="x-small">
              <div class="text-body-2 text-medium-emphasis">No status changes recorded yet.</div>
            </v-timeline-item>
          </v-timeline>
        </v-col>
        <v-col cols="12" md="6">
          <div class="text-subtitle-1 font-weight-medium mb-2">Meta review history</div>
          <v-list density="compact" lines="two">
            <v-list-item v-for="entry in campaign.reviewHistory" :key="entry.id">
              <template #prepend>
                <v-chip
                  size="x-small"
                  :color="reviewStatusColor(entry.toStatus)"
                  variant="tonal"
                  class="mr-2"
                >
                  {{ formatReviewStatus(entry.toStatus) }}
                </v-chip>
              </template>
              <v-list-item-title class="text-body-2">
                {{ entry.entityType }} {{ entry.entityId.slice(0, 8) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ formatDateTime(entry.createdAt) }}
                <span v-if="entry.message"> · {{ entry.message }}</span>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="campaign.reviewHistory.length === 0">
              <v-list-item-title class="text-medium-emphasis">
                Review states appear here after publishing and syncing.
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-col>
      </v-row>
    </template>

    <AdSetFormDialog
      v-model="adSetDialog"
      :business-id="businessId"
      :campaign-id="campaignId"
      :ad-set="editingAdSet"
      :currency="campaign?.budgetCurrency ?? null"
      @saved="onAdSetSaved"
    />

    <AdFormDialog
      v-model="adDialog"
      :business-id="businessId"
      :ad-set-id="adTargetAdSetId"
      :advertisement="editingAd"
      :creatives="creatives"
      @saved="onAdSaved"
    />

    <v-dialog v-model="publishDialog" max-width="520">
      <v-card>
        <v-card-title class="pt-5">Publish campaign to Meta?</v-card-title>
        <v-card-text>
          <v-alert v-if="publishChecklist.length > 0" type="warning" variant="tonal" density="compact" class="mb-4">
            <div class="font-weight-medium mb-1">Before publishing</div>
            <ul class="pl-4">
              <li v-for="item in publishChecklist" :key="item">{{ item }}</li>
            </ul>
          </v-alert>
          <v-switch
            v-model="activateOnPublish"
            color="primary"
            label="Activate immediately after publishing"
            density="compact"
            hide-details
          />
          <div class="text-caption text-medium-emphasis mt-2">
            The campaign is created in PAUSED state unless you activate it. If Meta rejects any
            step, the campaign is marked as error and existing external IDs are kept.
          </div>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="publishDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="publishing"
            :disabled="publishChecklist.length > 0"
            @click="publish"
          >
            Publish
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card>
        <v-card-title class="pt-5">Delete {{ deleteTargetLabel }}?</v-card-title>
        <v-card-text>
          This removes the local record. Published Meta entities must be archived instead.
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3500">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card-text>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AdFormDialog from '@/components/campaigns/AdFormDialog.vue';
import AdSetFormDialog from '@/components/campaigns/AdSetFormDialog.vue';
import { advertisingApi } from '@/services/api/advertising.api';
import { approvalsApi } from '@/services/api/approvals.api';
import { ApiError } from '@/services/api/client';
import type { ApprovalRequest, ApprovalTargetType } from '@/types/approvals';
import type {
  AdSet,
  Advertisement,
  ActiveAdvertisingStatus,
  CampaignDetail,
  Creative,
} from '@/types/advertising';
import {
  advertisingStatusColor,
  deliveryStatusColor,
  formatAdvertisingStatus,
  formatBillingEvent,
  formatDeliveryStatus,
  formatObjective,
  formatOptimizationGoal,
  formatReviewStatus,
  reviewStatusColor,
} from '@/utils/labels';
import { formatDateTime, formatMoney } from '@/utils/format';
import { liveStatusOptions } from '@/utils/advertising-options';

const props = defineProps<{
  businessId: string;
  campaignId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canPublish: boolean;
}>();

const emit = defineEmits<{
  back: [];
  changed: [];
}>();

const campaign = ref<CampaignDetail | null>(null);
const creatives = ref<Creative[]>([]);
const previews = ref<Record<string, string>>({});
const pendingApprovals = ref<ApprovalRequest[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);

const syncing = ref(false);
const publishing = ref(false);
const polling = ref(false);
const publishDialog = ref(false);
const activateOnPublish = ref(false);

const adSetDialog = ref(false);
const editingAdSet = ref<AdSet | null>(null);
const adDialog = ref(false);
const editingAd = ref<Advertisement | null>(null);
const adTargetAdSetId = ref('');

const deleteDialog = ref(false);
const deleting = ref(false);
const deleteTarget = ref<{ kind: 'adSet' | 'ad'; id: string; name: string } | null>(null);

const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const structureLocked = computed(() => Boolean(campaign.value?.publishedAt));

const publishChecklist = computed(() => {
  const items: string[] = [];
  const current = campaign.value;

  if (!current) {
    return items;
  }

  if (!current.adAccountId && !current.adAccountExternalId) {
    items.push('Link a Meta ad account to the campaign.');
  }

  if (current.adSets.length === 0) {
    items.push('Add at least one ad set.');
  }

  const ads = current.adSets.flatMap((adSet) => adSet.advertisements);

  if (ads.length === 0) {
    items.push('Add at least one advertisement.');
  }

  for (const adSet of current.adSets) {
    if (adSet.advertisements.length === 0) {
      items.push(`Ad set "${adSet.name}" has no advertisements.`);
    }
  }

  for (const ad of ads) {
    if (!ad.creativeId) {
      items.push(`Advertisement "${ad.name}" has no creative.`);
      continue;
    }

    const creative = creatives.value.find((entry) => entry.id === ad.creativeId);

    if (!creative) {
      items.push(`Creative for "${ad.name}" could not be loaded.`);
      continue;
    }

    if (!creative.pageId) {
      items.push(`Creative "${creative.name}" is missing a Meta page.`);
    }

    if (!creative.assetId) {
      items.push(`Creative "${creative.name}" is missing an image asset.`);
    }
  }

  if (!current.budgetCurrency) {
    items.push('The linked ad account has no currency.');
  }

  return items;
});

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

const deleteTargetLabel = computed(() =>
  deleteTarget.value?.kind === 'adSet' ? `ad set "${deleteTarget.value.name}"` : `advertisement "${deleteTarget.value?.name ?? ''}"`,
);

function creativeName(creativeId: string | null): string {
  if (!creativeId) {
    return 'No creative';
  }

  return creatives.value.find((creative) => creative.id === creativeId)?.name ?? 'Creative';
}

function creativePreview(creativeId: string | null): string | undefined {
  if (!creativeId) {
    return undefined;
  }

  const assetId = creatives.value.find((creative) => creative.id === creativeId)?.assetId;
  return assetId ? previews.value[assetId] : undefined;
}

async function loadCreatives(): Promise<void> {
  try {
    const result = await advertisingApi.listCreatives(props.businessId);
    creatives.value = result.items;
    await Promise.all(
      result.items.map(async (creative) => {
        const assetId = creative.assetId;

        if (!assetId || previews.value[assetId]) {
          return;
        }

        try {
          const blob = await advertisingApi.fetchAssetBlob(props.businessId, assetId);
          previews.value[assetId] = URL.createObjectURL(blob);
        } catch {
          // Preview is optional.
        }
      }),
    );
  } catch {
    creatives.value = [];
  }
}

async function loadCampaign(): Promise<void> {
  campaign.value = await advertisingApi.getCampaign(props.businessId, props.campaignId);
  actionError.value = null;
}

async function loadPendingApprovals(): Promise<void> {
  try {
    const result = await approvalsApi.list(props.businessId, {
      status: 'pending',
      targetId: props.campaignId,
      pageSize: 20,
    });
    pendingApprovals.value = result.items;
  } catch {
    pendingApprovals.value = [];
  }
}

function formatApprovalTarget(targetType: ApprovalTargetType): string {
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

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  try {
    await Promise.all([loadCampaign(), loadCreatives(), loadPendingApprovals()]);
  } catch (caught) {
    loadError.value = describeError(caught, 'Unable to load the campaign.');
  } finally {
    loading.value = false;
  }

  if (campaign.value?.status === 'publishing') {
    void pollPublishing();
  }
}

async function refresh(): Promise<void> {
  try {
    await Promise.all([loadCampaign(), loadPendingApprovals()]);
    emit('changed');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to refresh the campaign.');
  }
}

async function pollPublishing(): Promise<void> {
  polling.value = true;

  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await loadCampaign();
    } catch {
      continue;
    }

    if (campaign.value?.status !== 'publishing') {
      emit('changed');

      if (campaign.value?.status === 'error') {
        notify('Publishing failed. Review the Meta error above.', 'error');
      } else {
        notify('Campaign published to Meta.');
      }

      polling.value = false;
      return;
    }
  }

  polling.value = false;
  notify('Publishing is still running. Refresh in a moment.', 'info');
}

async function publish(): Promise<void> {
  publishing.value = true;
  actionError.value = null;

  try {
    const result = await advertisingApi.publishCampaign(
      props.businessId,
      props.campaignId,
      activateOnPublish.value,
    );

    publishDialog.value = false;

    if ('approvalRequired' in result) {
      emit('changed');
      await loadPendingApprovals();
      notify('Publish request submitted for approval.', 'info');
      return;
    }

    campaign.value = result;
    emit('changed');
    notify('Publishing started.');
    void pollPublishing();
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to start publishing.');
  } finally {
    publishing.value = false;
  }
}

async function sync(): Promise<void> {
  syncing.value = true;
  actionError.value = null;

  try {
    campaign.value = await advertisingApi.syncCampaign(props.businessId, props.campaignId);
    emit('changed');
    notify('Campaign synced from Meta.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to sync the campaign.');
  } finally {
    syncing.value = false;
  }
}

async function changeStatus(status: ActiveAdvertisingStatus): Promise<void> {
  actionError.value = null;

  try {
    const result = await advertisingApi.updateCampaignStatus(
      props.businessId,
      props.campaignId,
      status,
    );

    if ('approvalRequired' in result) {
      await refresh();
      notify('Status change submitted for approval.', 'info');
      return;
    }

    await refresh();
    notify(`Campaign marked ${status}.`);
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to change the campaign status.');
  }
}

function openAdSetCreate(): void {
  editingAdSet.value = null;
  adSetDialog.value = true;
}

function openAdSetEdit(adSet: AdSet): void {
  editingAdSet.value = adSet;
  adSetDialog.value = true;
}

async function onAdSetSaved(): Promise<void> {
  await refresh();
  notify('Ad set saved.');
}

function openAdCreate(adSetId: string): void {
  adTargetAdSetId.value = adSetId;
  editingAd.value = null;
  adDialog.value = true;
}

function openAdEdit(ad: Advertisement, adSetId: string): void {
  adTargetAdSetId.value = adSetId;
  editingAd.value = ad;
  adDialog.value = true;
}

async function onAdSaved(): Promise<void> {
  await refresh();
  notify('Advertisement saved.');
}

async function changeAdSetStatus(adSet: AdSet, status: ActiveAdvertisingStatus): Promise<void> {
  actionError.value = null;

  try {
    await advertisingApi.updateAdSetStatus(props.businessId, adSet.id, status);
    await refresh();
    notify(`Ad set marked ${status}.`);
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to change the ad set status.');
  }
}

async function changeAdStatus(ad: Advertisement, status: ActiveAdvertisingStatus): Promise<void> {
  actionError.value = null;

  try {
    await advertisingApi.updateAdvertisementStatus(props.businessId, ad.id, status);
    await refresh();
    notify(`Advertisement marked ${status}.`);
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to change the advertisement status.');
  }
}

function confirmAdSetDelete(adSet: AdSet): void {
  deleteTarget.value = { kind: 'adSet', id: adSet.id, name: adSet.name };
  deleteDialog.value = true;
}

function confirmAdDelete(ad: Advertisement): void {
  deleteTarget.value = { kind: 'ad', id: ad.id, name: ad.name };
  deleteDialog.value = true;
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value;

  if (!target) {
    return;
  }

  deleting.value = true;
  actionError.value = null;

  try {
    if (target.kind === 'adSet') {
      await advertisingApi.deleteAdSet(props.businessId, target.id);
    } else {
      await advertisingApi.deleteAdvertisement(props.businessId, target.id);
    }

    deleteDialog.value = false;
    deleteTarget.value = null;
    await refresh();
    notify('Deleted.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to delete the record.');
    deleteDialog.value = false;
  } finally {
    deleting.value = false;
  }
}

onBeforeUnmount(() => {
  Object.values(previews.value).forEach((url) => URL.revokeObjectURL(url));
});

onMounted(load);
</script>
