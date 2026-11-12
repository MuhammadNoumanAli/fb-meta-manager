<template>
  <v-card-text>
    <div v-if="loading" class="py-10 text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="loadError" type="error" variant="tonal" class="mb-4">
      {{ loadError }}
    </v-alert>

    <template v-else-if="overview && authorization">
      <div class="d-flex flex-wrap align-start justify-space-between ga-4 mb-4">
        <div class="d-flex align-center ga-3">
          <v-avatar color="primary" variant="tonal" rounded="lg" size="46">
            <v-icon icon="mdi-facebook" />
          </v-avatar>
          <div>
            <div class="text-subtitle-1 font-weight-medium">Meta advertising</div>
            <div v-if="authorization.connectionMode" class="text-body-2 text-medium-emphasis">
              {{ formatConnectionMode(authorization.connectionMode) }}
              <span v-if="authorization.externalUserName">
                · {{ authorization.externalUserName }}
              </span>
            </div>
            <div v-else class="text-body-2 text-medium-emphasis">
              Connect a Meta account to sync advertising assets
            </div>
          </div>
          <v-chip
            size="small"
            :color="integrationHealthColor(authorization.health)"
            variant="tonal"
          >
            {{ formatIntegrationHealth(authorization.health) }}
          </v-chip>
        </div>

        <div v-if="canManage" class="d-flex flex-wrap ga-2">
          <v-btn
            color="primary"
            :loading="busy === 'connect'"
            prepend-icon="mdi-facebook"
            @click="connect"
          >
            {{ authorization.connected ? 'Reconnect Meta' : 'Connect Meta' }}
          </v-btn>
          <v-btn
            v-if="!authorization.connected"
            variant="tonal"
            prepend-icon="mdi-account-key-outline"
            @click="openSystemUser"
          >
            System User token
          </v-btn>
          <v-btn
            v-if="authorization.connected"
            variant="tonal"
            :loading="busy === 'validate'"
            prepend-icon="mdi-shield-check-outline"
            @click="validate"
          >
            Check access
          </v-btn>
          <v-btn
            v-if="authorization.connected"
            variant="tonal"
            :loading="busy === 'discover'"
            prepend-icon="mdi-refresh"
            @click="discover"
          >
            Refresh assets
          </v-btn>
          <v-btn
            v-if="authorization.connected"
            variant="text"
            color="error"
            prepend-icon="mdi-link-off"
            @click="disconnectDialog = true"
          >
            Disconnect
          </v-btn>
        </div>
      </div>

      <v-alert
        v-if="authorization.health === 'revoked'"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        Meta revoked this business's access. Reconnect to resume asset sync, campaign publishing and
        lead retrieval.
      </v-alert>
      <v-alert
        v-else-if="authorization.health === 'expired'"
        type="warning"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        The Meta access token has expired. Reconnect to keep this business's advertising data in
        sync.
      </v-alert>
      <v-alert
        v-else-if="authorization.health === 'attention'"
        type="warning"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        Some Meta permissions are missing. Reconnect and approve every requested permission so
        AdPilot can manage the connected assets.
      </v-alert>
      <v-alert
        v-if="authorization.lastError"
        type="warning"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        {{ authorization.lastError }}
      </v-alert>
      <v-alert v-if="actionError" type="error" variant="tonal" density="comfortable" class="mb-4">
        {{ actionError }}
      </v-alert>

      <v-alert
        v-if="!authorization.connected && !authorization.requiresReauthorization"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        <div class="font-weight-medium">Connect this business to Meta</div>
        <div class="text-body-2 mt-1">
          Authorize a Meta Business Portfolio to discover its Pages, Instagram accounts and
          advertising accounts. Credentials stay encrypted on the server and are never sent to the
          browser.
        </div>
        <div v-if="canManage" class="d-flex flex-wrap ga-2 mt-4">
          <v-btn
            color="primary"
            prepend-icon="mdi-facebook"
            :loading="busy === 'connect'"
            @click="connect"
          >
            Connect with Meta
          </v-btn>
          <v-btn
            variant="text"
            prepend-icon="mdi-account-key-outline"
            @click="openSystemUser"
          >
            Use a System User token
          </v-btn>
        </div>
      </v-alert>

      <v-row dense class="mb-2">
        <v-col cols="12" sm="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Connection</div>
              <div class="text-subtitle-2 font-weight-bold text-capitalize">
                {{ formatStatus(authorization.status) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Token expires</div>
              <div class="text-subtitle-2 font-weight-bold">
                {{ formatDateTime(authorization.tokenExpiresAt) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Last checked</div>
              <div class="text-subtitle-2 font-weight-bold">
                {{ formatDateTime(authorization.lastValidatedAt) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Granted permissions</div>
              <div class="text-subtitle-2 font-weight-bold">
                {{ authorization.grantedPermissions.length }}
                <span class="text-body-2 text-medium-emphasis">
                  / {{ authorization.scopes.length || authorization.grantedPermissions.length }}
                </span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <div v-if="authorization.grantedPermissions.length || authorization.missingPermissions.length">
        <div class="text-subtitle-2 font-weight-medium mb-2">Permissions</div>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="scope in authorization.grantedPermissions"
            :key="scope"
            size="small"
            color="success"
            variant="tonal"
            prepend-icon="mdi-check-circle-outline"
          >
            {{ scope }}
          </v-chip>
          <v-chip
            v-for="scope in authorization.missingPermissions"
            :key="scope"
            size="small"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-alert-circle-outline"
          >
            {{ scope }}
          </v-chip>
        </div>
      </div>

      <v-divider class="my-6" />

      <div class="text-subtitle-1 font-weight-medium mb-1">Connected assets</div>
      <div class="text-body-2 text-medium-emphasis mb-4">
        Assets discovered from the authorized Meta Business Portfolio and linked to this business.
      </div>

      <v-row dense>
        <v-col v-for="section in assetSections" :key="section.key" cols="12" md="6">
          <v-card border flat class="h-100">
            <v-card-item>
              <template #prepend>
                <v-icon :icon="section.icon" color="primary" />
              </template>
              <v-card-title class="text-body-1">
                {{ section.title }}
                <v-chip size="x-small" variant="outlined" class="ml-2">
                  {{ section.items.length }}
                </v-chip>
              </v-card-title>
            </v-card-item>
            <v-divider />
            <v-list v-if="section.items.length" density="compact" lines="two">
              <v-list-item
                v-for="item in section.items"
                :key="item.id"
                :title="item.name"
                :subtitle="item.detail ? `${item.externalId} · ${item.detail}` : item.externalId"
              />
            </v-list>
            <v-card-text v-else class="text-body-2 text-medium-emphasis">
              No {{ section.title.toLowerCase() }} discovered yet.
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-divider class="my-6" />

      <div class="d-flex align-center justify-space-between mb-2">
        <div>
          <div class="text-subtitle-1 font-weight-medium">Connection activity</div>
          <div class="text-body-2 text-medium-emphasis">
            Authorization, validation and permission changes recorded for this business.
          </div>
        </div>
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-refresh"
          :loading="eventsLoading"
          @click="loadEvents"
        >
          Refresh
        </v-btn>
      </div>

      <v-list density="compact" lines="two">
        <v-list-item
          v-for="event in events"
          :key="event.id"
          prepend-icon="mdi-history"
          :title="formatIntegrationEvent(event.eventType)"
          :subtitle="formatDateTime(event.createdAt)"
        />
        <v-list-item v-if="events.length === 0">
          <v-list-item-title class="text-medium-emphasis">
            No connection activity yet.
          </v-list-item-title>
        </v-list-item>
      </v-list>

      <v-dialog v-model="systemDialog" max-width="520">
        <v-card>
          <v-card-title class="pt-5">Use a System User token</v-card-title>
          <v-card-subtitle class="pb-2">
            For agency-managed businesses connected through Meta Business Manager. The token is
            encrypted on the server and never displayed again.
          </v-card-subtitle>
          <v-card-text>
            <v-alert
              v-if="dialogError"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              {{ dialogError }}
            </v-alert>
            <v-text-field
              v-model="systemForm.accessToken"
              label="System User access token"
              type="password"
              autocomplete="off"
              prepend-inner-icon="mdi-key-outline"
              class="mb-2"
            />
            <v-text-field
              v-model="systemForm.tokenExpiresAt"
              label="Token expiry (optional)"
              type="datetime-local"
              hint="Leave empty to use the expiry reported by Meta."
              persistent-hint
            />
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="systemDialog = false">Cancel</v-btn>
            <v-btn
              color="primary"
              :loading="busy === 'system-user'"
              :disabled="systemForm.accessToken.trim().length < 20"
              @click="connectSystemUser"
            >
              Connect
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="disconnectDialog" max-width="460">
        <v-card>
          <v-card-title class="pt-5">Disconnect Meta?</v-card-title>
          <v-card-text>
            AdPilot will revoke the stored credential and remove the discovered Pages, Instagram
            accounts and advertising accounts from this business. This cannot be undone without
            reconnecting.
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="disconnectDialog = false">Cancel</v-btn>
            <v-btn
              color="error"
              :loading="busy === 'disconnect'"
              @click="disconnect"
            >
              Disconnect
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar" :color="snackbarError ? 'error' : 'success'" timeout="3000">
        {{ snackbarMessage }}
      </v-snackbar>
    </template>
  </v-card-text>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ApiError } from '@/services/api/client';
import { integrationsApi } from '@/services/api/integrations.api';
import type {
  MetaAsset,
  MetaIntegrationOverview,
  MetaTokenEvent,
} from '@/types/integrations';
import { formatDateTime } from '@/utils/format';
import {
  formatConnectionMode,
  formatIntegrationEvent,
  formatIntegrationHealth,
  formatStatus,
  integrationHealthColor,
} from '@/utils/labels';

type ActionKey = 'connect' | 'validate' | 'discover' | 'disconnect' | 'system-user';

const props = defineProps<{
  businessId: string;
  canManage: boolean;
}>();

const overview = ref<MetaIntegrationOverview | null>(null);
const events = ref<MetaTokenEvent[]>([]);
const loading = ref(true);
const eventsLoading = ref(false);
const busy = ref<ActionKey | null>(null);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarError = ref(false);

const systemDialog = ref(false);
const dialogError = ref<string | null>(null);
const systemForm = ref({ accessToken: '', tokenExpiresAt: '' });
const disconnectDialog = ref(false);

const authorization = computed(() => overview.value?.authorization ?? null);

const assetSections = computed(() => {
  const assets = overview.value?.assets;
  const empty: MetaAsset[] = [];

  return [
    {
      key: 'portfolios',
      title: 'Business Portfolios',
      icon: 'mdi-briefcase-outline',
      items: assets?.businessPortfolios ?? empty,
    },
    {
      key: 'pages',
      title: 'Facebook Pages',
      icon: 'mdi-flag-outline',
      items: assets?.pages ?? empty,
    },
    {
      key: 'instagram',
      title: 'Instagram accounts',
      icon: 'mdi-instagram',
      items: assets?.instagramAccounts ?? empty,
    },
    {
      key: 'ad-accounts',
      title: 'Advertising accounts',
      icon: 'mdi-bullhorn-outline',
      items: assets?.adAccounts ?? empty,
    },
  ];
});

function notify(message: string, isError = false): void {
  snackbarMessage.value = message;
  snackbarError.value = isError;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

function applyOverview(result: MetaIntegrationOverview): void {
  overview.value = result;
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;

  try {
    const [overviewResult, eventResult] = await Promise.all([
      integrationsApi.getMetaOverview(props.businessId),
      integrationsApi.listMetaEvents(props.businessId),
    ]);
    overview.value = overviewResult;
    events.value = eventResult;
  } catch (caught) {
    loadError.value = describeError(caught, 'Unable to load the Meta integration.');
  } finally {
    loading.value = false;
  }
}

async function loadEvents(): Promise<void> {
  eventsLoading.value = true;

  try {
    events.value = await integrationsApi.listMetaEvents(props.businessId);
  } catch (caught) {
    notify(describeError(caught, 'Unable to load connection activity.'), true);
  } finally {
    eventsLoading.value = false;
  }
}

async function connect(): Promise<void> {
  busy.value = 'connect';
  actionError.value = null;

  try {
    const result = await integrationsApi.startMetaOAuth(
      props.businessId,
      `/businesses/${props.businessId}`,
    );
    window.location.assign(result.authorizationUrl);
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to start the Meta authorization.');
    busy.value = null;
  }
}

async function runAction(
  key: ActionKey,
  action: () => Promise<MetaIntegrationOverview>,
  successMessage: string,
): Promise<void> {
  busy.value = key;
  actionError.value = null;

  try {
    applyOverview(await action());
    await loadEvents();
    notify(successMessage);
  } catch (caught) {
    actionError.value = describeError(caught, 'The Meta integration could not be updated.');
    notify(actionError.value, true);
  } finally {
    busy.value = null;
  }
}

function validate(): Promise<void> {
  return runAction(
    'validate',
    () => integrationsApi.validateMeta(props.businessId),
    'Meta access validated',
  );
}

function discover(): Promise<void> {
  return runAction(
    'discover',
    () => integrationsApi.discoverMetaAssets(props.businessId),
    'Connected assets refreshed',
  );
}

function disconnect(): Promise<void> {
  disconnectDialog.value = false;

  return runAction(
    'disconnect',
    () => integrationsApi.disconnectMeta(props.businessId),
    'Meta disconnected',
  );
}

function openSystemUser(): void {
  dialogError.value = null;
  systemForm.value = { accessToken: '', tokenExpiresAt: '' };
  systemDialog.value = true;
}

async function connectSystemUser(): Promise<void> {
  const accessToken = systemForm.value.accessToken.trim();

  if (accessToken.length < 20) {
    dialogError.value = 'Enter a valid System User access token.';
    return;
  }

  let tokenExpiresAt: string | undefined;

  if (systemForm.value.tokenExpiresAt) {
    const parsed = new Date(systemForm.value.tokenExpiresAt);

    if (Number.isNaN(parsed.getTime())) {
      dialogError.value = 'Enter a valid token expiry.';
      return;
    }

    tokenExpiresAt = parsed.toISOString();
  }

  busy.value = 'system-user';
  dialogError.value = null;

  try {
    applyOverview(
      await integrationsApi.connectSystemUser(props.businessId, {
        accessToken,
        tokenExpiresAt,
      }),
    );
    await loadEvents();
    systemDialog.value = false;
    systemForm.value = { accessToken: '', tokenExpiresAt: '' };
    notify('System User connected');
  } catch (caught) {
    dialogError.value = describeError(caught, 'Unable to connect this System User token.');
  } finally {
    busy.value = null;
  }
}

onMounted(load);
</script>
