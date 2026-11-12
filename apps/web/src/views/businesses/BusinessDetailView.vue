<template>
  <v-container class="py-8" max-width="1200">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-2 ml-n2"
      :to="{ name: 'workspaces' }"
    >
      Workspaces
    </v-btn>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-6">
      {{ error }}
    </v-alert>

    <template v-if="detail">
      <div class="d-flex flex-wrap justify-space-between align-start ga-4 mb-6">
        <div>
          <div class="d-flex align-center ga-3 mb-2">
            <v-avatar color="primary" variant="tonal" rounded="lg" size="46">
              <v-icon icon="mdi-storefront-outline" />
            </v-avatar>
            <div>
              <h1 class="text-h4 font-weight-bold">{{ detail.business.name }}</h1>
              <div class="text-body-2 text-medium-emphasis">
                {{ detail.business.slug }} · {{ formatAccessType(detail.accessType) }}
              </div>
              <div v-if="detail.business.description" class="text-body-2 mt-1">
                {{ detail.business.description }}
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-chip v-for="role in detail.roles" :key="role" size="small" color="primary" variant="tonal">
              {{ formatRole(role) }}
            </v-chip>
            <v-chip size="small" variant="outlined" prepend-icon="mdi-shield-key-outline">
              {{ detail.permissions.length }} permissions
            </v-chip>
          </div>
        </div>

        <v-btn
          v-if="canUpdate"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-pencil-outline"
          @click="openEdit"
        >
          Edit workspace
        </v-btn>
      </div>

      <v-row class="mb-2">
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Currency</div>
              <div class="text-subtitle-1 font-weight-bold">{{ detail.business.currency }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Timezone</div>
              <div class="text-subtitle-1 font-weight-bold">{{ detail.business.timezone }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Members</div>
              <div class="text-subtitle-1 font-weight-bold">{{ members.length }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat>
            <v-card-text>
              <div class="text-caption text-medium-emphasis">Created</div>
              <div class="text-subtitle-1 font-weight-bold">
                {{ formatDate(detail.business.createdAt) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-card border flat class="mt-4">
        <v-tabs v-model="tab" color="primary">
          <v-tab value="members" prepend-icon="mdi-account-group-outline">Members</v-tab>
          <v-tab
            v-if="canReadIntegrations"
            value="integrations"
            prepend-icon="mdi-connection"
          >
            Integrations
          </v-tab>
          <v-tab v-if="canReadAudit" value="audit" prepend-icon="mdi-history">Audit log</v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <v-window-item value="members">
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <div class="text-subtitle-1 font-weight-medium">Workspace membership</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Direct members keep their roles even when an agency also manages the workspace.
                  </div>
                </div>
                <v-btn
                  v-if="canManageMembers"
                  color="primary"
                  size="small"
                  prepend-icon="mdi-account-plus-outline"
                  @click="memberDialog = true"
                >
                  Add member
                </v-btn>
              </div>

              <v-table density="comfortable">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th v-if="canManageMembers" class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="member in members" :key="member.userId">
                    <td>
                      <div class="font-weight-medium">
                        {{ member.firstName }} {{ member.lastName }}
                      </div>
                      <div class="text-caption text-medium-emphasis">{{ member.email }}</div>
                    </td>
                    <td>
                      <v-chip
                        size="x-small"
                        :color="member.status === 'active' ? 'success' : 'warning'"
                        variant="tonal"
                      >
                        {{ formatStatus(member.status) }}
                      </v-chip>
                    </td>
                    <td style="min-width: 190px">
                      <v-select
                        v-if="canManageMembers"
                        :model-value="member.roles[0]"
                        :items="businessRoles"
                        item-title="title"
                        item-value="value"
                        density="compact"
                        variant="outlined"
                        hide-details
                        @update:model-value="(value: string) => changeRole(member, value)"
                      />
                      <span v-else>{{ member.roles.map(formatRole).join(', ') }}</span>
                    </td>
                    <td class="text-body-2">{{ formatDate(member.joinedAt) }}</td>
                    <td v-if="canManageMembers" class="text-right">
                      <v-btn
                        icon="mdi-account-remove-outline"
                        size="small"
                        variant="text"
                        color="error"
                        @click="confirmRemove(member)"
                      />
                    </td>
                  </tr>
                  <tr v-if="members.length === 0">
                    <td :colspan="canManageMembers ? 5 : 4" class="text-center text-medium-emphasis py-6">
                      No direct members yet.
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-window-item>

          <v-window-item v-if="canReadIntegrations" value="integrations">
            <BusinessIntegrationsTab
              :business-id="businessId"
              :can-manage="canManageIntegrations"
            />
          </v-window-item>

          <v-window-item v-if="canReadAudit" value="audit">
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <div class="text-subtitle-1 font-weight-medium">Audit log</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Recent membership and workspace changes recorded by the API.
                  </div>
                </div>
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-refresh"
                  :loading="auditLoading"
                  @click="loadAudit"
                >
                  Refresh
                </v-btn>
              </div>

              <v-list density="compact" lines="two">
                <v-list-item
                  v-for="entry in audit"
                  :key="entry.id"
                  prepend-icon="mdi-history"
                >
                  <v-list-item-title class="font-weight-medium">{{ entry.action }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDateTime(entry.createdAt) }}
                    <span v-if="entry.actorUserId"> · actor {{ entry.actorUserId.slice(0, 8) }}</span>
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="audit.length === 0">
                  <v-list-item-title class="text-medium-emphasis">No audit entries yet.</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-window-item>
        </v-window>
      </v-card>

      <v-dialog v-model="editDialog" max-width="520">
        <v-card>
          <v-card-title class="pt-5">Edit workspace</v-card-title>
          <v-card-text>
            <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
              {{ dialogError }}
            </v-alert>
            <v-text-field v-model="editForm.name" label="Business name" class="mb-2" />
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-select v-model="editForm.currency" :items="currencies" label="Currency" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="editForm.timezone" :items="timezones" label="Timezone" />
              </v-col>
            </v-row>
            <v-text-field v-model="editForm.industry" label="Industry" class="mb-2" />
            <v-text-field
              v-model="editForm.website"
              label="Website"
              placeholder="https://example.com"
              class="mb-2"
            />
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field v-model="editForm.contactEmail" label="Contact email" type="email" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="editForm.contactPhone" label="Contact phone" />
              </v-col>
            </v-row>
            <v-textarea
              v-model="editForm.description"
              label="Description"
              rows="2"
              auto-grow
              class="mt-2"
            />
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="editDialog = false">Cancel</v-btn>
            <v-btn color="primary" :loading="saving" @click="saveEdit">Save changes</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="memberDialog" max-width="480">
        <v-card>
          <v-card-title class="pt-5">Add business member</v-card-title>
          <v-card-subtitle>
            Direct members need an existing AdPilot account. Invite new client owners from the
            agency workspace.
          </v-card-subtitle>
          <v-card-text>
            <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
              {{ dialogError }}
            </v-alert>
            <v-text-field v-model="memberForm.email" label="Email" type="email" class="mb-2" />
            <v-select
              v-model="memberForm.roleKey"
              :items="businessRoles"
              item-title="title"
              item-value="value"
              label="Role"
            />
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="memberDialog = false">Cancel</v-btn>
            <v-btn color="primary" :loading="saving" @click="addMember">Add member</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="removeDialog" max-width="440">
        <v-card>
          <v-card-title class="pt-5">Remove member?</v-card-title>
          <v-card-text>
            {{ removeTarget?.firstName }} {{ removeTarget?.lastName }} will lose access to this
            workspace. A business must keep at least one active owner.
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="removeDialog = false">Cancel</v-btn>
            <v-btn color="error" :loading="saving" @click="removeMember">Remove</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="2500">
        {{ snackbarMessage }}
      </v-snackbar>
    </template>

    <v-skeleton-loader v-else-if="loading" type="article, table" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BusinessIntegrationsTab from '@/components/integrations/BusinessIntegrationsTab.vue';
import { ApiError } from '@/services/api/client';
import { workspaceApi } from '@/services/api/workspace.api';
import { useAuthStore } from '@/stores/auth';
import type { AuditLogEntry, BusinessDetail, BusinessMember } from '@/types/workspace';
import { formatDateTime } from '@/utils/format';
import { formatAccessType, formatRole, formatStatus } from '@/utils/labels';
import { currencies, timezones } from '@/utils/options';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const businessId = computed(() => String(route.params.businessId));

const detail = ref<BusinessDetail | null>(null);
const members = ref<BusinessMember[]>([]);
const audit = ref<AuditLogEntry[]>([]);
const loading = ref(true);
const auditLoading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const dialogError = ref<string | null>(null);
const tab = ref('members');
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const editDialog = ref(false);
const memberDialog = ref(false);
const removeDialog = ref(false);
const removeTarget = ref<BusinessMember | null>(null);

const editForm = ref({
  name: '',
  currency: 'MYR',
  timezone: 'UTC',
  industry: '',
  website: '',
  contactEmail: '',
  contactPhone: '',
  description: '',
});
const memberForm = ref({ email: '', roleKey: 'business_viewer' });

const businessRoles = [
  { title: 'Business owner', value: 'business_owner' },
  { title: 'Business admin', value: 'business_admin' },
  { title: 'Viewer', value: 'business_viewer' },
];

const canUpdate = computed(() => detail.value?.permissions.includes('business.update') ?? false);
const canManageMembers = computed(
  () => detail.value?.permissions.includes('business.manage_members') ?? false,
);
const canReadAudit = computed(() => detail.value?.permissions.includes('audit.read') ?? false);
const canReadIntegrations = computed(
  () => detail.value?.permissions.includes('integration.read') ?? false,
);
const canManageIntegrations = computed(
  () => detail.value?.permissions.includes('integration.manage') ?? false,
);

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    detail.value = await workspaceApi.getBusiness(businessId.value);
    members.value = await workspaceApi.listBusinessMembers(businessId.value);
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Unable to load this business workspace.';
  } finally {
    loading.value = false;
  }
}

async function loadAudit(): Promise<void> {
  auditLoading.value = true;

  try {
    audit.value = await workspaceApi.listAuditLogs(businessId.value);
  } finally {
    auditLoading.value = false;
  }
}

function openEdit(): void {
  if (!detail.value) {
    return;
  }

  editForm.value = {
    name: detail.value.business.name,
    currency: detail.value.business.currency,
    timezone: detail.value.business.timezone,
    industry: detail.value.business.industry ?? '',
    website: detail.value.business.website ?? '',
    contactEmail: detail.value.business.contactEmail ?? '',
    contactPhone: detail.value.business.contactPhone ?? '',
    description: detail.value.business.description ?? '',
  };
  dialogError.value = null;
  editDialog.value = true;
}

async function saveEdit(): Promise<void> {
  saving.value = true;
  dialogError.value = null;

  try {
    detail.value = await workspaceApi.updateBusiness(businessId.value, {
      name: editForm.value.name.trim(),
      currency: editForm.value.currency,
      timezone: editForm.value.timezone,
      industry: editForm.value.industry.trim(),
      website: editForm.value.website.trim(),
      contactEmail: editForm.value.contactEmail.trim(),
      contactPhone: editForm.value.contactPhone.trim(),
      description: editForm.value.description.trim(),
    });
    await auth.reload();
    editDialog.value = false;
    notify('Workspace updated');
  } catch (caught) {
    dialogError.value = caught instanceof ApiError ? caught.message : 'Unable to save changes.';
  } finally {
    saving.value = false;
  }
}

async function addMember(): Promise<void> {
  saving.value = true;
  dialogError.value = null;

  try {
    members.value = await workspaceApi.addBusinessMember(businessId.value, {
      email: memberForm.value.email.trim(),
      roleKey: memberForm.value.roleKey,
    });
    memberDialog.value = false;
    memberForm.value = { email: '', roleKey: 'business_viewer' };
    notify('Member added');
  } catch (caught) {
    dialogError.value = caught instanceof ApiError ? caught.message : 'Unable to add member.';
  } finally {
    saving.value = false;
  }
}

async function changeRole(member: BusinessMember, roleKey: string): Promise<void> {
  if (!roleKey || roleKey === member.roles[0]) {
    return;
  }

  try {
    members.value = await workspaceApi.updateBusinessMember(businessId.value, member.userId, {
      roleKey,
    });
    notify('Role updated');
  } catch (caught) {
    notify(caught instanceof ApiError ? caught.message : 'Unable to update role.');
  }
}

function confirmRemove(member: BusinessMember): void {
  removeTarget.value = member;
  removeDialog.value = true;
}

async function removeMember(): Promise<void> {
  if (!removeTarget.value) {
    return;
  }

  saving.value = true;

  try {
    members.value = await workspaceApi.removeBusinessMember(
      businessId.value,
      removeTarget.value.userId,
    );
    removeDialog.value = false;
    removeTarget.value = null;
    notify('Member removed');
  } catch (caught) {
    notify(caught instanceof ApiError ? caught.message : 'Unable to remove member.');
  } finally {
    saving.value = false;
  }
}

watch(tab, (value) => {
  if (value === 'audit' && audit.value.length === 0) {
    void loadAudit();
  }
});

function applyIntegrationQuery(): void {
  const meta = route.query.meta;

  if (typeof meta === 'string') {
    if (canReadIntegrations.value) {
      tab.value = 'integrations';

      if (meta === 'connected') {
        notify('Meta connected. Connected assets are ready.');
      } else if (meta === 'reconnected') {
        notify('Meta reconnected. Connected assets refreshed.');
      } else if (meta === 'error') {
        notify(
          `Meta connection failed (${String(route.query.reason ?? 'unknown')}).`,
          'error',
        );
      }
    }

    void router.replace({ path: route.path, query: {} });
    return;
  }

  if (route.query.tab === 'integrations' && canReadIntegrations.value) {
    tab.value = 'integrations';
    void router.replace({ path: route.path, query: {} });
  }
}

onMounted(async () => {
  await load();
  applyIntegrationQuery();
});
</script>
