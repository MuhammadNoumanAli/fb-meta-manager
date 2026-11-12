<script setup lang="ts">
import { computed } from 'vue';
import type { HealthState } from '@/types/health';

const props = defineProps<{
  title: string;
  state: HealthState;
  detail?: string;
  icon?: string;
}>();

const labels: Record<HealthState, string> = {
  up: 'Operational',
  down: 'Unavailable',
  unknown: 'Unknown',
};

const colors: Record<HealthState, string> = {
  up: 'success',
  down: 'error',
  unknown: 'grey',
};

const icons: Record<HealthState, string> = {
  up: 'mdi-check-circle',
  down: 'mdi-alert-circle',
  unknown: 'mdi-help-circle',
};

const label = computed(() => labels[props.state]);
const color = computed(() => colors[props.state]);
const iconName = computed(() => props.icon ?? icons[props.state]);
</script>

<template>
  <v-card border flat class="h-100">
    <v-card-item>
      <template #prepend>
        <v-avatar :color="color" variant="tonal" size="42">
          <v-icon :icon="iconName" />
        </v-avatar>
      </template>
      <v-card-title class="text-body-1 font-weight-medium">{{ title }}</v-card-title>
      <v-card-subtitle class="text-wrap">
        {{ detail ?? 'No details reported' }}
      </v-card-subtitle>
    </v-card-item>

    <v-card-text>
      <v-chip :color="color" size="small" variant="tonal">{{ label }}</v-chip>
    </v-card-text>
  </v-card>
</template>
