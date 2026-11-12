<template>
  <v-app>
    <v-navigation-drawer permanent width="248">
      <div class="pa-5 d-flex align-center ga-3">
        <v-avatar color="primary" size="38">
          <v-icon icon="mdi-rocket-launch-outline" color="white" />
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">AdPilot</div>
          <div class="text-caption text-medium-emphasis">Advertising control</div>
        </div>
      </div>

      <v-divider />

      <v-list nav density="comfortable" class="mt-2">
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" to="/" exact />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat border>
      <v-app-bar-title class="text-body-1 font-weight-medium">System status</v-app-bar-title>
      <v-spacer />
      <v-chip size="small" variant="tonal" color="info" prepend-icon="mdi-source-branch">
        Phase 0
      </v-chip>
    </v-app-bar>

    <v-main class="bg-background">
      <router-view />
    </v-main>
  </v-app>
</template>
