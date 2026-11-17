<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    persistent
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <v-card>
      <v-card-title class="pt-5">
        {{ adSet ? 'Edit ad set' : 'New ad set' }}
      </v-card-title>
      <v-card-subtitle>
        Ad sets define targeting, budget and placement inside the campaign.
      </v-card-subtitle>
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <v-text-field v-model="form.name" label="Ad set name" class="mb-2" />

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.optimizationGoal"
              :items="optimizationGoalOptions"
              label="Optimization goal"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.billingEvent"
              :items="billingEventOptions"
              label="Billing event"
            />
          </v-col>
        </v-row>

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model.number="form.dailyBudget"
              label="Daily budget"
              type="number"
              min="0"
              :prefix="currency ?? ''"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model.number="form.lifetimeBudget"
              label="Lifetime budget"
              type="number"
              min="0"
              :prefix="currency ?? ''"
            />
          </v-col>
        </v-row>

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model.number="form.bidAmount"
              label="Bid amount (optional)"
              type="number"
              min="0"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.startTime"
              label="Start time"
              type="datetime-local"
              hide-details
            />
          </v-col>
        </v-row>

        <v-text-field
          v-model="form.endTime"
          label="End time"
          type="datetime-local"
          class="mt-2"
          hide-details
        />

        <v-textarea
          v-model="targetingText"
          label="Targeting (Meta JSON)"
          rows="4"
          auto-grow
          class="mt-4"
          hint='Example: {"geo_locations":{"countries":["MY"]},"age_min":18,"age_max":65}'
          persistent-hint
        />
      </v-card-text>
      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" @click="save">
          {{ adSet ? 'Save changes' : 'Create ad set' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ApiError } from '@/services/api/client';
import { advertisingApi } from '@/services/api/advertising.api';
import type { AdSet, BillingEvent, OptimizationGoal } from '@/types/advertising';
import {
  billingEventOptions,
  fromDateTimeInput,
  optimizationGoalOptions,
  toDateTimeInput,
} from '@/utils/advertising-options';

const props = defineProps<{
  modelValue: boolean;
  businessId: string;
  campaignId: string;
  adSet: AdSet | null;
  currency: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [adSet: AdSet];
}>();

const form = ref({
  name: '',
  optimizationGoal: 'LINK_CLICKS' as OptimizationGoal,
  billingEvent: 'IMPRESSIONS' as BillingEvent,
  dailyBudget: null as number | null,
  lifetimeBudget: null as number | null,
  bidAmount: null as number | null,
  startTime: '',
  endTime: '',
});
const targetingText = ref('');
const saving = ref(false);
const error = ref<string | null>(null);

function reset(): void {
  if (props.adSet) {
    form.value = {
      name: props.adSet.name,
      optimizationGoal: props.adSet.optimizationGoal,
      billingEvent: props.adSet.billingEvent,
      dailyBudget: props.adSet.dailyBudget,
      lifetimeBudget: props.adSet.lifetimeBudget,
      bidAmount: props.adSet.bidAmount,
      startTime: toDateTimeInput(props.adSet.startTime),
      endTime: toDateTimeInput(props.adSet.endTime),
    };
    targetingText.value = props.adSet.targeting
      ? JSON.stringify(props.adSet.targeting, null, 2)
      : '';
  } else {
    form.value = {
      name: '',
      optimizationGoal: 'LINK_CLICKS',
      billingEvent: 'IMPRESSIONS',
      dailyBudget: null,
      lifetimeBudget: null,
      bidAmount: null,
      startTime: '',
      endTime: '',
    };
    targetingText.value = '';
  }

  error.value = null;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      reset();
    }
  },
);

function close(): void {
  emit('update:modelValue', false);
}

async function save(): Promise<void> {
  if (!form.value.name.trim()) {
    error.value = 'Give the ad set a name.';
    return;
  }

  let targeting: Record<string, unknown> | undefined;

  if (targetingText.value.trim()) {
    try {
      targeting = JSON.parse(targetingText.value) as Record<string, unknown>;
    } catch {
      error.value = 'Targeting must be valid JSON.';
      return;
    }
  }

  const payload = {
    name: form.value.name.trim(),
    optimizationGoal: form.value.optimizationGoal,
    billingEvent: form.value.billingEvent,
    dailyBudget: form.value.dailyBudget ?? undefined,
    lifetimeBudget: form.value.lifetimeBudget ?? undefined,
    bidAmount: form.value.bidAmount ?? undefined,
    targeting,
    startTime: fromDateTimeInput(form.value.startTime),
    endTime: fromDateTimeInput(form.value.endTime),
  };

  saving.value = true;
  error.value = null;

  try {
    const saved = props.adSet
      ? await advertisingApi.updateAdSet(props.businessId, props.adSet.id, payload)
      : await advertisingApi.createAdSet(props.businessId, props.campaignId, payload);
    emit('saved', saved);
    close();
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : 'Unable to save the ad set.';
  } finally {
    saving.value = false;
  }
}
</script>
