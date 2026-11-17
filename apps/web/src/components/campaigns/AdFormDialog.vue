<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    persistent
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <v-card>
      <v-card-title class="pt-5">
        {{ advertisement ? 'Edit advertisement' : 'New advertisement' }}
      </v-card-title>
      <v-card-subtitle>
        Each advertisement links a creative (image, copy and destination) to this ad set.
      </v-card-subtitle>
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <v-text-field v-model="form.name" label="Advertisement name" class="mb-2" />
        <v-select
          v-model="form.creativeId"
          :items="creativeItems"
          item-title="title"
          item-value="value"
          label="Creative"
          clearable
        />
        <div v-if="creatives.length === 0" class="text-caption text-medium-emphasis">
          No creatives yet. Create one in the Creatives &amp; media tab first.
        </div>
      </v-card-text>
      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" @click="save">
          {{ advertisement ? 'Save changes' : 'Create advertisement' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { advertisingApi } from '@/services/api/advertising.api';
import { ApiError } from '@/services/api/client';
import type { Advertisement, Creative } from '@/types/advertising';

const props = defineProps<{
  modelValue: boolean;
  businessId: string;
  adSetId: string;
  advertisement: Advertisement | null;
  creatives: Creative[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [advertisement: Advertisement];
}>();

const form = ref({ name: '', creativeId: null as string | null });
const saving = ref(false);
const error = ref<string | null>(null);

const creativeItems = computed(() =>
  props.creatives.map((creative) => ({
    title: creative.pageName ? `${creative.name} · ${creative.pageName}` : creative.name,
    value: creative.id,
  })),
);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      return;
    }

    form.value = {
      name: props.advertisement?.name ?? '',
      creativeId: props.advertisement?.creativeId ?? null,
    };
    error.value = null;
  },
);

function close(): void {
  emit('update:modelValue', false);
}

async function save(): Promise<void> {
  if (!form.value.name.trim()) {
    error.value = 'Give the advertisement a name.';
    return;
  }

  saving.value = true;
  error.value = null;

  try {
    const payload = {
      name: form.value.name.trim(),
      creativeId: form.value.creativeId,
    };
    const saved = props.advertisement
      ? await advertisingApi.updateAdvertisement(
          props.businessId,
          props.advertisement.id,
          payload,
        )
      : await advertisingApi.createAdvertisement(props.businessId, props.adSetId, payload);
    emit('saved', saved);
    close();
  } catch (caught) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Unable to save the advertisement.';
  } finally {
    saving.value = false;
  }
}
</script>
