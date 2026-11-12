<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import StatusCard from '@/components/StatusCard.vue';
import { useHealthStore } from '@/stores/health';
import type { HealthState } from '@/types/health';
import { formatDateTime, formatUptime } from '@/utils/format';

const health = useHealthStore();
const { liveness, readiness, loading, error, lastCheckedAt } = storeToRefs(health);

const apiState = computed<HealthState>(() =>
  liveness.value ? 'up' : error.value ? 'down' : 'unknown',
);

function dependencyState(name: string): HealthState {
  const details = readiness.value?.details ?? readiness.value?.info;
  const entry = details?.[name];

  if (!entry) {
    return 'unknown';
  }

  return entry.status === 'up' ? 'up' : 'down';
}

function dependencyDetail(name: string): string {
  const details = readiness.value?.details ?? readiness.value?.info;
  const entry = details?.[name];

  if (!entry) {
    return 'No readiness report yet';
  }

  return entry.status === 'up' ? 'Connection healthy' : (entry.message ?? 'Check failed');
}

const databaseState = computed(() => dependencyState('database'));
const redisState = computed(() => dependencyState('redis'));

const deliverables = [
  'NestJS API and Vue 3 frontend running',
  'MySQL 8 connected through TypeORM',
  'Redis and BullMQ configured',
  'Environment validation at startup',
  'Liveness and readiness endpoints',
  'Linting, formatting and unit tests',
  'CI checks and architecture documentation',
];

onMounted(() => {
  void health.refresh();
});
</script>

<template>
  <v-container class="py-8" max-width="1200">
    <div class="d-flex flex-wrap justify-space-between align-center ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">Phase 0 — Foundation</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Live readiness of the AdPilot platform services.
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="health.refresh()"
      >
        Refresh
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-6">
      {{ error }}
    </v-alert>

    <v-row>
      <v-col cols="12" md="4">
        <StatusCard
          title="AdPilot API"
          :state="apiState"
          :detail="
            liveness
              ? `v${liveness.version} · ${liveness.environment}`
              : 'Liveness endpoint unreachable'
          "
          icon="mdi-server-network"
        />
      </v-col>

      <v-col cols="12" md="4">
        <StatusCard
          title="MySQL 8"
          :state="databaseState"
          :detail="dependencyDetail('database')"
          icon="mdi-database"
        />
      </v-col>

      <v-col cols="12" md="4">
        <StatusCard
          title="Redis / BullMQ"
          :state="redisState"
          :detail="dependencyDetail('redis')"
          icon="mdi-memory"
        />
      </v-col>
    </v-row>

    <v-row class="mt-2">
      <v-col cols="12" md="7">
        <v-card border flat>
          <v-card-title class="text-body-1 font-weight-medium">Service details</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                prepend-icon="mdi-timer-outline"
                title="Uptime"
                :subtitle="liveness ? formatUptime(liveness.uptimeSeconds) : '—'"
              />
              <v-list-item
                prepend-icon="mdi-clock-outline"
                title="Last checked"
                :subtitle="formatDateTime(lastCheckedAt)"
              />
              <v-list-item
                prepend-icon="mdi-book-open-variant"
                title="API documentation"
                subtitle="/api/docs"
              />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card border flat>
          <v-card-title class="text-body-1 font-weight-medium">Phase 0 deliverables</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="item in deliverables"
                :key="item"
                prepend-icon="mdi-check-circle-outline"
                :title="item"
              />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
