<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :permanent="mdAndUp" :temporary="!mdAndUp" width="260">
      <div class="pa-5 d-flex align-center ga-3">
        <v-avatar color="primary" size="38" rounded="lg">
          <v-icon icon="mdi-rocket-launch-outline" color="white" />
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">AdPilot</div>
          <div class="text-caption text-medium-emphasis">Advertising control</div>
        </div>
      </div>

      <v-divider />

      <v-list nav density="compact" class="mt-2">
        <v-list-item
          prepend-icon="mdi-view-grid-outline"
          title="Workspaces"
          to="/"
          exact
          color="primary"
        />
        <v-list-item
          prepend-icon="mdi-heart-pulse"
          title="System status"
          to="/system-status"
          color="primary"
        />
      </v-list>

      <template v-if="auth.agencyWorkspaces.length">
        <v-list-subheader class="text-uppercase text-caption">Agencies</v-list-subheader>
        <v-list nav density="compact">
          <v-list-item
            v-for="agency in auth.agencyWorkspaces"
            :key="agency.id"
            :title="agency.name"
            :to="{ name: 'agency-detail', params: { agencyId: agency.id } }"
            prepend-icon="mdi-office-building-outline"
            color="primary"
          />
        </v-list>
      </template>

      <template v-if="auth.businessWorkspaces.length">
        <v-list-subheader class="text-uppercase text-caption">Businesses</v-list-subheader>
        <v-list nav density="compact">
          <v-list-item
            v-for="business in auth.businessWorkspaces"
            :key="business.id"
            :title="business.name"
            :to="{ name: 'business-detail', params: { businessId: business.id } }"
            prepend-icon="mdi-storefront-outline"
            color="primary"
          />
        </v-list>
      </template>

      <template #append>
        <v-divider />
        <div class="pa-4 text-caption text-medium-emphasis">Phase 1 · Identity &amp; tenancy</div>
      </template>
    </v-navigation-drawer>

    <v-app-bar flat border>
      <v-app-bar-nav-icon v-if="!mdAndUp" @click="drawer = !drawer" />
      <v-app-bar-title class="text-body-1 font-weight-medium">{{ pageTitle }}</v-app-bar-title>
      <v-spacer />

      <v-menu location="bottom end">
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none">
            <v-avatar color="primary" size="32" class="mr-2">
              <span class="text-caption font-weight-bold text-white">{{ initials }}</span>
            </v-avatar>
            <span class="d-none d-sm-inline">{{ auth.displayName }}</span>
            <v-icon end icon="mdi-chevron-down" size="18" />
          </v-btn>
        </template>

        <v-list density="compact" min-width="240">
          <v-list-item :title="auth.displayName" :subtitle="auth.user?.email ?? ''" />
          <v-divider class="my-1" />
          <v-list-item
            prepend-icon="mdi-logout"
            title="Sign out"
            @click="signOut"
          />
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main class="bg-background">
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { mdAndUp } = useDisplay();

const drawer = ref(mdAndUp.value);

const pageTitle = computed(() => {
  if (route.name === 'business-detail') {
    const businessId = String(route.params.businessId);
    return auth.findWorkspace('business', businessId)?.name ?? 'Business workspace';
  }

  if (route.name === 'agency-detail') {
    const agencyId = String(route.params.agencyId);
    return auth.findWorkspace('agency', agencyId)?.name ?? 'Agency';
  }

  return typeof route.meta.title === 'string' ? route.meta.title : 'AdPilot';
});

const initials = computed(() => {
  if (!auth.user) {
    return '?';
  }

  return `${auth.user.firstName.charAt(0)}${auth.user.lastName.charAt(0)}`.toUpperCase();
});

watch(
  () => route.fullPath,
  () => {
    if (!mdAndUp.value) {
      drawer.value = false;
    }
  },
);

async function signOut(): Promise<void> {
  await auth.signOut();
  await router.push({ name: 'login' });
}
</script>
