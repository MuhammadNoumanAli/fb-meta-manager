<template>
  <v-app>
    <div class="auth-shell">
      <section class="auth-brand d-none d-md-flex">
        <div class="auth-brand__content">
          <div class="d-flex align-center ga-3 mb-8">
            <v-avatar color="white" size="44" rounded="lg">
              <v-icon icon="mdi-rocket-launch-outline" color="primary" size="26" />
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold text-white">AdPilot</div>
              <div class="text-body-2 text-blue-lighten-4">Advertising control for agencies</div>
            </div>
          </div>

          <h2 class="text-h4 font-weight-bold text-white mb-4">
            One platform for agency and self-service advertising.
          </h2>
          <p class="text-body-1 text-blue-lighten-4 mb-8" style="max-width: 430px">
            Manage client workspaces, roles and permissions with tenant-safe access from day
            one. Meta and WhatsApp integrations arrive in later phases.
          </p>

          <v-list class="bg-transparent" density="compact">
            <v-list-item
              v-for="item in highlights"
              :key="item"
              prepend-icon="mdi-check-circle-outline"
              class="px-0"
            >
              <v-list-item-title class="text-blue-lighten-4 text-body-2">{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <div class="auth-brand__badge text-caption text-blue-lighten-3">
          Phase 1 · Authentication &amp; multi-tenancy
        </div>
      </section>

      <section class="auth-form">
        <div class="auth-form__inner">
          <router-view />
        </div>
      </section>
    </div>
  </v-app>
</template>

<script setup lang="ts">
const highlights = [
  'Separate agency and client business workspaces',
  'Role-based access enforced by the API',
  'Client-owned advertising assets',
  'Auditable membership changes',
];
</script>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
}

.auth-brand {
  position: relative;
  flex-direction: column;
  justify-content: center;
  padding: 64px;
  background:
    radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.16), transparent 45%),
    linear-gradient(150deg, #0d47a1 0%, #1565c0 55%, #00897b 130%);
}

.auth-brand__content {
  max-width: 520px;
}

.auth-brand__badge {
  position: absolute;
  bottom: 32px;
  left: 64px;
}

.auth-form {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background-color: #f5f7fa;
}

.auth-form__inner {
  width: 100%;
  max-width: 440px;
}

@media (max-width: 959px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }
}
</style>
