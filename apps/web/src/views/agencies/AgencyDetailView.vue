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
            <v-avatar color="secondary" variant="tonal" rounded="lg" size="46">
              <v-icon icon="mdi-office-building-outline" />
            </v-avatar>
            <div>
              <h1 class="text-h4 font-weight-bold">{{ detail.agency.name }}</h1>
              <div class="text-body-2 text-medium-emphasis">
                {{ detail.agency.slug }} ·
                {{ detail.accessType === 'platform' ? 'Platform access' : 'Agency workspace' }}
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-chip v-for="role in detail.roles" :key="role" size="small" color="secondary" variant="tonal">
              {{ formatRole(role) }}
            </v-chip>
            <v-chip size="small" variant="outlined" prepend-icon="mdi-shield-key-outline">
              {{ detail.permissions.length }} permissions
            </v-chip>
          </div>
        </div>

        <v-btn
          v-if="canManageAgency"
          variant="tonal"
          color="secondary"
          prepend-icon="mdi-pencil-outline"
          @click="openEdit"
        >
          Rename agency
        </v-btn>
      </div>

      <v-card border flat>
        <v-tabs v-model="tab" color="secondary">
          <v-tab value="clients" prepend-icon="mdi-briefcase-outline">Client businesses</v-tab>
          <v-tab value="members" prepend-icon="mdi-account-group-outline">Agency members</v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <v-window-item value="clients">
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <div class="text-subtitle-1 font-weight-medium">Managed clients</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Clients keep ownership of their business workspace and advertising assets.
                  </div>
                </div>
                <v-btn
                  v-if="canCreateBusiness"
                  color="secondary"
                  size="small"
                  prepend-icon="mdi-plus"
                  @click="clientDialog = true"
                >
                  Add client
                </v-btn>
              </div>

              <v-table density="comfortable">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="client in clients" :key="client.businessId">
                    <td>
                      <div class="font-weight-medium">{{ client.name }}</div>
                      <div class="text-caption text-medium-emphasis">{{ client.slug }}</div>
                    </td>
                    <td>
                      <v-chip
                        size="x-small"
                        :color="client.status === 'active' ? 'success' : 'default'"
                        variant="tonal"
                      >
                        {{ formatStatus(client.status) }}
                      </v-chip>
                    </td>
                    <td class="text-body-2">{{ formatDate(client.startedAt) }}</td>
                    <td class="text-right">
                      <v-btn
                        size="small"
                        variant="text"
                        color="primary"
                        @click="openBusiness(client.businessId)"
                      >
                        Open
                      </v-btn>
                      <v-btn
                        v-if="canManageAgency"
                        size="small"
                        variant="text"
                        color="secondary"
                        @click="openInvitations(client)"
                      >
                        Invitations
                      </v-btn>
                      <v-btn
                        v-if="canManageAgency && client.status === 'active'"
                        size="small"
                        variant="text"
                        color="secondary"
                        prepend-icon="mdi-email-plus-outline"
                        @click="openInvite(client)"
                      >
                        Invite
                      </v-btn>
                      <v-btn
                        v-if="canManageAgency && client.status === 'active'"
                        size="small"
                        variant="text"
                        color="error"
                        @click="confirmEnd(client)"
                      >
                        End
                      </v-btn>
                    </td>
                  </tr>
                  <tr v-if="clients.length === 0">
                    <td colspan="4" class="text-center text-medium-emphasis py-6">
                      No client businesses yet.
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-window-item>

          <v-window-item value="members">
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <div class="text-subtitle-1 font-weight-medium">Agency membership</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Agency roles grant access to all active client businesses.
                  </div>
                </div>
                <v-btn
                  v-if="canManageAgency"
                  color="secondary"
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
                    <th v-if="canManageAgency" class="text-right">Actions</th>
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
                        v-if="canManageAgency"
                        :model-value="member.roles[0]"
                        :items="agencyRoles"
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
                    <td v-if="canManageAgency" class="text-right">
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
                    <td :colspan="canManageAgency ? 5 : 4" class="text-center text-medium-emphasis py-6">
                      No agency members yet.
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-window-item>
        </v-window>
      </v-card>

      <v-dialog v-model="editDialog" max-width="460">
        <v-card>
          <v-card-title class="pt-5">Rename agency</v-card-title>
          <v-card-text>
            <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
              {{ dialogError }}
            </v-alert>
            <v-text-field v-model="editName" label="Agency name" />
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="editDialog = false">Cancel</v-btn>
            <v-btn color="secondary" :loading="saving" @click="saveEdit">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="memberDialog" max-width="480">
        <v-card>
          <v-card-title class="pt-5">Add agency member</v-card-title>
          <v-card-subtitle>
            The person needs an existing AdPilot account. Use client invitations to onboard a
            new client owner.
          </v-card-subtitle>
          <v-card-text>
            <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
              {{ dialogError }}
            </v-alert>
            <v-text-field v-model="memberForm.email" label="Email" type="email" class="mb-2" />
            <v-select
              v-model="memberForm.roleKey"
              :items="agencyRoles"
              item-title="title"
              item-value="value"
              label="Role"
            />
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="memberDialog = false">Cancel</v-btn>
            <v-btn color="secondary" :loading="saving" @click="addMember">Add member</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="removeDialog" max-width="440">
        <v-card>
          <v-card-title class="pt-5">Remove agency member?</v-card-title>
          <v-card-text>
            {{ removeTarget?.firstName }} {{ removeTarget?.lastName }} will lose access to every
            client business managed by this agency. An agency must keep at least one active owner.
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="removeDialog = false">Cancel</v-btn>
            <v-btn color="error" :loading="saving" @click="removeMember">Remove</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="endDialog" max-width="460">
        <v-card>
          <v-card-title class="pt-5">End client relationship?</v-card-title>
          <v-card-text>
            {{ endTarget?.name }} will no longer be accessible to this agency. The client keeps
            ownership of its workspace and can continue independently.
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="endDialog = false">Cancel</v-btn>
            <v-btn color="error" :loading="saving" @click="endClient">End relationship</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="inviteDialog" max-width="560">
        <v-card>
          <v-card-title class="pt-5">Invite client owner</v-card-title>
          <v-card-subtitle v-if="invitationClient">
            {{ invitationClient.name }} · the recipient becomes the business owner when they
            accept.
          </v-card-subtitle>
          <v-card-text>
            <v-alert v-if="dialogError" type="error" variant="tonal" density="compact" class="mb-4">
              {{ dialogError }}
            </v-alert>

            <template v-if="!createdInvitation">
              <v-text-field
                v-model="inviteForm.email"
                label="Client email"
                type="email"
                class="mb-2"
              />
              <v-select
                v-model="inviteForm.expiresInDays"
                :items="expiryOptions"
                label="Expires in"
              />
            </template>

            <template v-else>
              <v-alert type="success" variant="tonal" density="compact" class="mb-4">
                Invitation created for {{ createdInvitation.email }}.
              </v-alert>
              <v-text-field
                v-if="createdInvitation.acceptanceUrl"
                :model-value="createdInvitation.acceptanceUrl"
                label="Secure acceptance link"
                readonly
                append-inner-icon="mdi-content-copy"
                @click:append-inner="copyInvitationLink(createdInvitation.acceptanceUrl)"
              />
              <v-alert v-else type="info" variant="tonal" density="compact">
                Email delivery is not configured yet. The invitation is stored and can be
                tracked from the invitations list.
              </v-alert>
              <div class="text-caption text-medium-emphasis mt-2">
                Expires {{ formatDateTime(createdInvitation.expiresAt) }}
              </div>
            </template>
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <template v-if="!createdInvitation">
              <v-btn variant="text" @click="inviteDialog = false">Cancel</v-btn>
              <v-btn color="secondary" :loading="saving" @click="createInvitation">
                Create invitation
              </v-btn>
            </template>
            <template v-else>
              <v-btn variant="text" @click="showInvitationList">View invitations</v-btn>
              <v-btn color="secondary" @click="inviteDialog = false">Done</v-btn>
            </template>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="invitationsDialog" max-width="720">
        <v-card>
          <v-card-title class="pt-5">Client invitations</v-card-title>
          <v-card-subtitle v-if="invitationClient">{{ invitationClient.name }}</v-card-subtitle>
          <v-card-text>
            <div class="d-flex justify-end mb-3">
              <v-btn
                size="small"
                variant="tonal"
                color="secondary"
                prepend-icon="mdi-email-plus-outline"
                @click="startInviteFromList"
              >
                New invitation
              </v-btn>
            </div>

            <v-progress-linear v-if="invitationsLoading" indeterminate color="secondary" />

            <v-table v-else density="comfortable">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="invitation in invitationsList" :key="invitation.id">
                  <td>
                    <div class="font-weight-medium">{{ invitation.email }}</div>
                    <div class="text-caption text-medium-emphasis">
                      Sent {{ formatDate(invitation.createdAt) }}
                    </div>
                  </td>
                  <td>
                    <v-chip
                      size="x-small"
                      :color="invitationColor(invitation.status)"
                      variant="tonal"
                    >
                      {{ formatStatus(invitation.status) }}
                    </v-chip>
                  </td>
                  <td class="text-body-2">{{ formatDate(invitation.expiresAt) }}</td>
                  <td class="text-right">
                    <v-btn
                      v-if="invitation.status === 'pending'"
                      size="small"
                      variant="text"
                      color="error"
                      @click="revokeInvitation(invitation)"
                    >
                      Revoke
                    </v-btn>
                    <v-btn
                      v-if="invitation.status === 'pending' && invitation.acceptanceUrl"
                      size="small"
                      variant="text"
                      color="secondary"
                      @click="copyInvitationLink(invitation.acceptanceUrl)"
                    >
                      Copy link
                    </v-btn>
                  </td>
                </tr>
                <tr v-if="invitationsList.length === 0">
                  <td colspan="4" class="text-center text-medium-emphasis py-6">
                    No invitations for this client yet.
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="invitationsDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <CreateBusinessDialog
        v-model:open="clientDialog"
        :agency-id="agencyId"
        @created="openBusiness"
      />

      <v-snackbar v-model="snackbar" color="success" timeout="2500">
        {{ snackbarMessage }}
      </v-snackbar>
    </template>

    <v-skeleton-loader v-else-if="loading" type="article, table" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CreateBusinessDialog from '@/components/workspaces/CreateBusinessDialog.vue';
import { ApiError } from '@/services/api/client';
import { workspaceApi } from '@/services/api/workspace.api';
import { useAuthStore } from '@/stores/auth';
import type {
  AgencyClient,
  AgencyDetail,
  AgencyMember,
  InvitationSummary,
} from '@/types/workspace';
import { formatDateTime } from '@/utils/format';
import { formatRole, formatStatus } from '@/utils/labels';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const agencyId = computed(() => String(route.params.agencyId));

const detail = ref<AgencyDetail | null>(null);
const clients = ref<AgencyClient[]>([]);
const members = ref<AgencyMember[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const dialogError = ref<string | null>(null);
const tab = ref('clients');
const snackbar = ref(false);
const snackbarMessage = ref('');

const editDialog = ref(false);
const editName = ref('');
const memberDialog = ref(false);
const removeDialog = ref(false);
const endDialog = ref(false);
const clientDialog = ref(false);
const removeTarget = ref<AgencyMember | null>(null);
const endTarget = ref<AgencyClient | null>(null);
const memberForm = ref({ email: '', roleKey: 'agency_staff' });

const inviteDialog = ref(false);
const invitationsDialog = ref(false);
const invitationsLoading = ref(false);
const invitationClient = ref<AgencyClient | null>(null);
const invitationsList = ref<InvitationSummary[]>([]);
const createdInvitation = ref<InvitationSummary | null>(null);
const inviteForm = ref({ email: '', expiresInDays: 7 });
const expiryOptions = [1, 3, 7, 14, 30];

const agencyRoles = [
  { title: 'Agency owner', value: 'agency_owner' },
  { title: 'Agency admin', value: 'agency_admin' },
  { title: 'Agency staff', value: 'agency_staff' },
];

const canManageAgency = computed(
  () => detail.value?.permissions.includes('agency.manage') ?? false,
);
const canCreateBusiness = computed(
  () => detail.value?.permissions.includes('business.create') ?? false,
);

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function notify(message: string): void {
  snackbarMessage.value = message;
  snackbar.value = true;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    detail.value = await workspaceApi.getAgency(agencyId.value);
    clients.value = await workspaceApi.listAgencyClients(agencyId.value);
    members.value = await workspaceApi.listAgencyMembers(agencyId.value);
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : 'Unable to load this agency.';
  } finally {
    loading.value = false;
  }
}

function openEdit(): void {
  editName.value = detail.value?.agency.name ?? '';
  dialogError.value = null;
  editDialog.value = true;
}

async function saveEdit(): Promise<void> {
  saving.value = true;
  dialogError.value = null;

  try {
    detail.value = await workspaceApi.updateAgency(agencyId.value, {
      name: editName.value.trim(),
    });
    await auth.reload();
    editDialog.value = false;
    notify('Agency renamed');
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
    members.value = await workspaceApi.addAgencyMember(agencyId.value, {
      email: memberForm.value.email.trim(),
      roleKey: memberForm.value.roleKey,
    });
    memberDialog.value = false;
    memberForm.value = { email: '', roleKey: 'agency_staff' };
    notify('Member added');
  } catch (caught) {
    dialogError.value = caught instanceof ApiError ? caught.message : 'Unable to add member.';
  } finally {
    saving.value = false;
  }
}

async function changeRole(member: AgencyMember, roleKey: string): Promise<void> {
  if (!roleKey || roleKey === member.roles[0]) {
    return;
  }

  try {
    members.value = await workspaceApi.updateAgencyMember(agencyId.value, member.userId, {
      roleKey,
    });
    notify('Role updated');
  } catch (caught) {
    notify(caught instanceof ApiError ? caught.message : 'Unable to update role.');
  }
}

function confirmRemove(member: AgencyMember): void {
  removeTarget.value = member;
  removeDialog.value = true;
}

async function removeMember(): Promise<void> {
  if (!removeTarget.value) {
    return;
  }

  saving.value = true;

  try {
    members.value = await workspaceApi.removeAgencyMember(agencyId.value, removeTarget.value.userId);
    removeDialog.value = false;
    removeTarget.value = null;
    notify('Member removed');
  } catch (caught) {
    notify(caught instanceof ApiError ? caught.message : 'Unable to remove member.');
  } finally {
    saving.value = false;
  }
}

function confirmEnd(client: AgencyClient): void {
  endTarget.value = client;
  endDialog.value = true;
}

async function endClient(): Promise<void> {
  if (!endTarget.value) {
    return;
  }

  saving.value = true;

  try {
    clients.value = await workspaceApi.endClient(agencyId.value, endTarget.value.businessId);
    endDialog.value = false;
    endTarget.value = null;
    await auth.reload();
    notify('Client relationship ended');
  } catch (caught) {
    notify(caught instanceof ApiError ? caught.message : 'Unable to end the relationship.');
  } finally {
    saving.value = false;
  }
}

function openBusiness(businessId: string): void {
  void router.push({ name: 'business-detail', params: { businessId } });
}

function openInvite(client: AgencyClient): void {
  invitationClient.value = client;
  inviteForm.value = { email: '', expiresInDays: 7 };
  createdInvitation.value = null;
  dialogError.value = null;
  inviteDialog.value = true;
}

async function createInvitation(): Promise<void> {
  if (!invitationClient.value) {
    return;
  }

  saving.value = true;
  dialogError.value = null;

  try {
    createdInvitation.value = await workspaceApi.createClientInvitation(
      agencyId.value,
      invitationClient.value.businessId,
      {
        email: inviteForm.value.email.trim(),
        expiresInDays: inviteForm.value.expiresInDays,
      },
    );
    notify('Invitation created');
  } catch (caught) {
    dialogError.value =
      caught instanceof ApiError ? caught.message : 'Unable to create the invitation.';
  } finally {
    saving.value = false;
  }
}

async function openInvitations(client: AgencyClient): Promise<void> {
  invitationClient.value = client;
  invitationsList.value = [];
  invitationsDialog.value = true;
  await loadInvitations();
}

async function loadInvitations(): Promise<void> {
  if (!invitationClient.value) {
    return;
  }

  invitationsLoading.value = true;

  try {
    invitationsList.value = await workspaceApi.listClientInvitations(
      agencyId.value,
      invitationClient.value.businessId,
    );
  } catch (caught) {
    notify(caught instanceof ApiError ? caught.message : 'Unable to load invitations.');
  } finally {
    invitationsLoading.value = false;
  }
}

async function revokeInvitation(invitation: InvitationSummary): Promise<void> {
  if (!invitationClient.value) {
    return;
  }

  try {
    await workspaceApi.revokeClientInvitation(
      agencyId.value,
      invitationClient.value.businessId,
      invitation.id,
    );
    await loadInvitations();
    notify('Invitation revoked');
  } catch (caught) {
    notify(caught instanceof ApiError ? caught.message : 'Unable to revoke the invitation.');
  }
}

function showInvitationList(): void {
  if (!invitationClient.value) {
    return;
  }

  const client = invitationClient.value;
  inviteDialog.value = false;
  void openInvitations(client);
}

function startInviteFromList(): void {
  if (!invitationClient.value) {
    return;
  }

  const client = invitationClient.value;
  invitationsDialog.value = false;
  openInvite(client);
}

function copyInvitationLink(link?: string): void {
  if (!link) {
    return;
  }

  void navigator.clipboard?.writeText(link).then(
    () => notify('Acceptance link copied'),
    () => notify('Copy is not available in this browser'),
  );
}

function invitationColor(status: string): string {
  if (status === 'pending') {
    return 'warning';
  }
  if (status === 'accepted') {
    return 'success';
  }
  return 'default';
}

onMounted(load);
</script>
