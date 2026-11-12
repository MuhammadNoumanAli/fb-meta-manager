<template>
  <v-container class="py-8" max-width="1280">
    <div class="d-flex flex-wrap justify-space-between align-center ga-4 mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">Workspace overview</div>
        <h1 class="text-h4 font-weight-bold mb-1">Hello, {{ auth.user?.firstName }}</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Choose a workspace to manage, or create a new one.
        </p>
      </div>
      <div class="d-flex ga-2">
        <v-btn variant="tonal" color="secondary" prepend-icon="mdi-office-building-plus" @click="agencyDialog = true">
          New agency
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-storefront-plus" @click="businessDialog = true">
          New business
        </v-btn>
      </div>
    </div>

    <v-row class="mb-2">
      <v-col cols="12" sm="4">
        <v-card border flat>
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Business workspaces</div>
            <div class="text-h4 font-weight-bold mt-1">{{ auth.businessWorkspaces.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card border flat>
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Agencies</div>
            <div class="text-h4 font-weight-bold mt-1">{{ auth.agencyWorkspaces.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card border flat>
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Assigned roles</div>
            <div class="text-h4 font-weight-bold mt-1">{{ roleCount }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <template v-if="auth.businessWorkspaces.length">
      <div class="d-flex align-center justify-space-between mt-6 mb-3">
        <h2 class="text-h6 font-weight-bold">Businesses</h2>
      </div>

      <v-row>
        <v-col
          v-for="business in auth.businessWorkspaces"
          :key="business.id"
          cols="12"
          md="6"
          lg="4"
        >
          <v-card border flat hover class="h-100 workspace-card">
            <v-card-text>
              <div class="d-flex align-start justify-space-between mb-3">
                <v-avatar color="primary" variant="tonal" rounded="lg">
                  <v-icon icon="mdi-storefront-outline" />
                </v-avatar>
                <v-chip size="small" variant="tonal" color="info">
                  {{ formatAccessType(business.accessType) }}
                </v-chip>
              </div>

              <div class="text-subtitle-1 font-weight-bold">{{ business.name }}</div>
              <div class="text-body-2 text-medium-emphasis mb-3">
                {{ business.roles.map(formatRole).join(', ') || 'No roles assigned' }}
              </div>

              <div class="d-flex flex-wrap ga-1 mb-1">
                <v-chip
                  v-for="role in business.roles"
                  :key="role"
                  size="x-small"
                  variant="outlined"
                >
                  {{ formatRole(role) }}
                </v-chip>
              </div>
            </v-card-text>
            <v-card-actions class="px-4 pb-4">
              <span class="text-caption text-medium-emphasis">
                {{ business.permissions.length }} permissions
              </span>
              <v-spacer />
              <v-btn
                color="primary"
                variant="text"
                append-icon="mdi-arrow-right"
                @click="openBusiness(business.id)"
              >
                Manage
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <template v-else>
      <v-alert type="info" variant="tonal" class="mt-6">
        You do not have a business workspace yet. Create one to start configuring campaigns in a
        later phase.
        <template #append>
          <v-btn size="small" color="primary" variant="text" @click="businessDialog = true">
            Create business
          </v-btn>
        </template>
      </v-alert>
    </template>

    <div class="d-flex align-center justify-space-between mt-8 mb-3">
      <h2 class="text-h6 font-weight-bold">Agencies</h2>
    </div>

    <v-row v-if="auth.agencyWorkspaces.length">
      <v-col
        v-for="agency in auth.agencyWorkspaces"
        :key="agency.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card border flat hover class="h-100 workspace-card">
          <v-card-text>
            <div class="d-flex align-start justify-space-between mb-3">
              <v-avatar color="secondary" variant="tonal" rounded="lg">
                <v-icon icon="mdi-office-building-outline" />
              </v-avatar>
              <v-chip size="small" variant="tonal" color="secondary">
                {{ formatAccessType(agency.accessType) }}
              </v-chip>
            </div>

            <div class="text-subtitle-1 font-weight-bold">{{ agency.name }}</div>
            <div class="text-body-2 text-medium-emphasis mb-3">
              {{ agency.roles.map(formatRole).join(', ') || 'No roles assigned' }}
            </div>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <span class="text-caption text-medium-emphasis">
              {{ agency.permissions.length }} permissions
            </span>
            <v-spacer />
            <v-btn
              color="secondary"
              variant="text"
              append-icon="mdi-arrow-right"
              @click="openAgency(agency.id)"
            >
              Open
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-card v-else border flat class="mt-1">
      <v-card-text class="text-center py-8">
        <v-icon icon="mdi-office-building-outline" size="42" color="medium-emphasis" class="mb-3" />
        <div class="text-subtitle-1 font-weight-medium mb-1">No agency workspace yet</div>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Create an agency to manage client businesses from one place.
        </p>
        <v-btn color="secondary" variant="tonal" prepend-icon="mdi-plus" @click="agencyDialog = true">
          Create agency
        </v-btn>
      </v-card-text>
    </v-card>

    <CreateBusinessDialog
      v-model:open="businessDialog"
      @created="openBusiness"
    />
    <CreateAgencyDialog v-model:open="agencyDialog" @created="openAgency" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import CreateAgencyDialog from '@/components/workspaces/CreateAgencyDialog.vue';
import CreateBusinessDialog from '@/components/workspaces/CreateBusinessDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { formatAccessType, formatRole } from '@/utils/labels';

const auth = useAuthStore();
const router = useRouter();

const businessDialog = ref(false);
const agencyDialog = ref(false);

const roleCount = computed(
  () => new Set(auth.workspaces.flatMap((workspace) => workspace.roles)).size,
);

function openBusiness(businessId: string): void {
  void router.push({ name: 'business-detail', params: { businessId } });
}

function openAgency(agencyId: string): void {
  void router.push({ name: 'agency-detail', params: { agencyId } });
}
</script>

<style scoped>
.workspace-card {
  transition: transform 0.15s ease;
}

.workspace-card:hover {
  transform: translateY(-2px);
}
</style>
