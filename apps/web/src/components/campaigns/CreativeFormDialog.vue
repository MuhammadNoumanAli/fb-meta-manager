<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    persistent
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <v-card>
      <v-card-title class="pt-5">
        {{ creative ? 'Edit creative' : 'New creative' }}
      </v-card-title>
      <v-card-subtitle>
        Creatives combine the Meta page, image asset and ad copy used by advertisements.
      </v-card-subtitle>
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <v-text-field v-model="form.name" label="Creative name" class="mb-2" />

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.pageId"
              :items="pageItems"
              item-title="title"
              item-value="value"
              label="Meta page"
              clearable
              :hint="pages.length === 0 ? 'Connect Meta pages in Integrations first.' : undefined"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.assetId"
              :items="assetItems"
              item-title="title"
              item-value="value"
              label="Image asset"
              clearable
              :hint="assets.length === 0 ? 'Upload an image in the media library first.' : undefined"
              persistent-hint
            />
          </v-col>
        </v-row>

        <div v-if="selectedPreview" class="mt-4 d-flex justify-center">
          <v-img
            :src="selectedPreview"
            max-height="180"
            max-width="320"
            cover
            rounded="lg"
            class="border"
          />
        </div>

        <v-text-field v-model="form.headline" label="Headline" class="mt-4" />
        <v-textarea
          v-model="form.primaryText"
          label="Primary text"
          rows="3"
          auto-grow
          counter="2000"
        />
        <v-text-field v-model="form.description" label="Description" />
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-select
              v-model="form.callToAction"
              :items="callToActionOptions"
              label="Call to action"
              clearable
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.destinationUrl"
              label="Destination URL"
              placeholder="https://example.com/offer"
            />
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" @click="save">
          {{ creative ? 'Save changes' : 'Create creative' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { advertisingApi } from '@/services/api/advertising.api';
import { ApiError } from '@/services/api/client';
import type { Asset, Creative } from '@/types/advertising';
import type { MetaAsset } from '@/types/integrations';
import { callToActionOptions } from '@/utils/advertising-options';
import { formatBytes } from '@/utils/format';

const props = defineProps<{
  modelValue: boolean;
  businessId: string;
  creative: Creative | null;
  pages: MetaAsset[];
  assets: Asset[];
  previews: Record<string, string>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [creative: Creative];
}>();

const form = ref({
  name: '',
  pageId: null as string | null,
  assetId: null as string | null,
  headline: '',
  primaryText: '',
  description: '',
  callToAction: null as string | null,
  destinationUrl: '',
});
const saving = ref(false);
const error = ref<string | null>(null);

const pageItems = computed(() =>
  props.pages.map((page) => ({
    title: page.detail ? `${page.name} · ${page.detail}` : page.name,
    value: page.id,
  })),
);

const assetItems = computed(() =>
  props.assets.map((asset) => ({
    title: `${asset.originalName} (${formatBytes(asset.sizeBytes)})`,
    value: asset.id,
  })),
);

const selectedPreview = computed(() =>
  form.value.assetId ? props.previews[form.value.assetId] : undefined,
);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      return;
    }

    form.value = props.creative
      ? {
          name: props.creative.name,
          pageId: props.creative.pageId,
          assetId: props.creative.assetId,
          headline: props.creative.headline ?? '',
          primaryText: props.creative.primaryText ?? '',
          description: props.creative.description ?? '',
          callToAction: props.creative.callToAction,
          destinationUrl: props.creative.destinationUrl ?? '',
        }
      : {
          name: '',
          pageId: null,
          assetId: null,
          headline: '',
          primaryText: '',
          description: '',
          callToAction: null,
          destinationUrl: '',
        };
    error.value = null;
  },
);

function close(): void {
  emit('update:modelValue', false);
}

async function save(): Promise<void> {
  if (!form.value.name.trim()) {
    error.value = 'Give the creative a name.';
    return;
  }

  const payload = {
    name: form.value.name.trim(),
    pageId: form.value.pageId,
    assetId: form.value.assetId,
    headline: form.value.headline.trim() || null,
    primaryText: form.value.primaryText.trim() || null,
    description: form.value.description.trim() || null,
    callToAction: form.value.callToAction,
    destinationUrl: form.value.destinationUrl.trim() || null,
  };

  saving.value = true;
  error.value = null;

  try {
    const saved = props.creative
      ? await advertisingApi.updateCreative(props.businessId, props.creative.id, payload)
      : await advertisingApi.createCreative(props.businessId, payload);
    emit('saved', saved);
    close();
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : 'Unable to save the creative.';
  } finally {
    saving.value = false;
  }
}
</script>
