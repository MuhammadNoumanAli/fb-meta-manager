<template>
  <v-card-text>
    <div v-if="loading" class="py-10 text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="loadError" type="error" variant="tonal" class="mb-4">
      {{ loadError }}
    </v-alert>

    <template v-else>
      <v-alert v-if="actionError" type="error" variant="tonal" class="mb-4">
        {{ actionError }}
      </v-alert>

      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
        <div>
          <div class="text-subtitle-1 font-weight-medium">Creatives</div>
          <div class="text-body-2 text-medium-emphasis">
            Reusable page, image and copy combinations for your advertisements.
          </div>
        </div>
        <v-btn
          v-if="canCreate"
          color="primary"
          size="small"
          prepend-icon="mdi-plus"
          @click="openCreate"
        >
          New creative
        </v-btn>
      </div>

      <v-table density="comfortable" class="mb-8">
        <thead>
          <tr>
            <th>Creative</th>
            <th>Page</th>
            <th>Media</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="creative in creatives" :key="creative.id">
            <td style="min-width: 200px">
              <div class="font-weight-medium">{{ creative.name }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ creative.headline || 'No headline' }}
              </div>
            </td>
            <td class="text-body-2">{{ creative.pageName || 'Not linked' }}</td>
            <td>
              <div class="d-flex align-center ga-2">
                <v-avatar v-if="creative.assetId && previews[creative.assetId]" rounded="lg" size="36">
                  <v-img :src="previews[creative.assetId]" cover />
                </v-avatar>
                <span class="text-caption text-medium-emphasis">
                  {{ creative.asset?.originalName || 'No image' }}
                </span>
              </div>
            </td>
            <td>
              <v-chip
                size="small"
                :color="creativeStatusColor(creative.status)"
                variant="tonal"
              >
                {{ formatCreativeStatus(creative.status) }}
              </v-chip>
              <div v-if="creative.externalId" class="text-caption text-medium-emphasis mt-1">
                Meta ID {{ creative.externalId }}
              </div>
            </td>
            <td class="text-right" style="white-space: nowrap">
              <v-btn
                v-if="canUpdate"
                size="small"
                variant="text"
                icon="mdi-pencil-outline"
                @click="openEdit(creative)"
              />
              <v-btn
                v-if="canUpdate"
                size="small"
                variant="text"
                color="error"
                icon="mdi-delete-outline"
                @click="confirmCreativeDelete(creative)"
              />
            </td>
          </tr>
          <tr v-if="creatives.length === 0">
            <td colspan="5" class="text-center text-medium-emphasis py-8">
              No creatives yet. Create one to use in advertisements.
            </td>
          </tr>
        </tbody>
      </v-table>

      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
        <div>
          <div class="text-subtitle-1 font-weight-medium">Media library</div>
          <div class="text-body-2 text-medium-emphasis">
            PNG, JPEG or WebP up to 8MB. Uploads are stored server-side and streamed back with
            access checks.
          </div>
        </div>
        <div v-if="canCreate" class="d-flex align-center ga-2">
          <v-file-input
            v-model="uploadFile"
            accept="image/png,image/jpeg,image/webp"
            label="Image file"
            density="compact"
            variant="outlined"
            hide-details
            prepend-icon=""
            prepend-inner-icon="mdi-image-plus"
            style="min-width: 260px"
          />
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-cloud-upload-outline"
            :loading="uploading"
            :disabled="!uploadFile"
            @click="upload"
          >
            Upload
          </v-btn>
        </div>
      </div>

      <v-row dense>
        <v-col
          v-for="asset in assets"
          :key="asset.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-card border flat class="h-100">
            <div class="d-flex align-center justify-center bg-surface-variant" style="height: 130px">
              <v-img
                v-if="previews[asset.id]"
                :src="previews[asset.id]"
                height="130"
                cover
              />
              <v-icon v-else icon="mdi-image-outline" size="40" class="text-medium-emphasis" />
            </div>
            <v-card-text class="py-3">
              <div class="font-weight-medium text-truncate" :title="asset.originalName">
                {{ asset.originalName }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formatBytes(asset.sizeBytes) }} · {{ asset.mimeType }}
              </div>
              <div class="d-flex align-center justify-space-between mt-2">
                <v-chip size="x-small" variant="tonal">
                  {{ asset.status }}
                </v-chip>
                <span v-if="asset.metaImageHash" class="text-caption text-medium-emphasis">
                  Meta image ready
                </span>
                <span v-else class="text-caption text-medium-emphasis">Local only</span>
              </div>
            </v-card-text>
            <v-card-actions v-if="canCreate" class="pt-0">
              <v-spacer />
              <v-btn
                size="small"
                variant="text"
                color="error"
                prepend-icon="mdi-delete-outline"
                @click="confirmAssetDelete(asset)"
              >
                Delete
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
        <v-col v-if="assets.length === 0" cols="12">
          <v-sheet border rounded class="pa-8 text-center text-medium-emphasis">
            No media uploaded yet.
          </v-sheet>
        </v-col>
      </v-row>
    </template>

    <CreativeFormDialog
      v-model="creativeDialog"
      :business-id="businessId"
      :creative="editingCreative"
      :pages="pages"
      :assets="assets"
      :previews="previews"
      @saved="onCreativeSaved"
    />

    <v-dialog v-model="deleteCreativeDialog" max-width="440">
      <v-card>
        <v-card-title class="pt-5">Delete creative?</v-card-title>
        <v-card-text>
          {{ deleteCreativeTarget?.name }} will be removed. Creatives used by an advertisement
          cannot be deleted.
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="deleteCreativeDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="deleteCreative">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteAssetDialog" max-width="440">
      <v-card>
        <v-card-title class="pt-5">Delete media?</v-card-title>
        <v-card-text>
          {{ deleteAssetTarget?.originalName }} will be removed from storage. Creatives using it
          keep their copy but lose the image link.
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="deleteAssetDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="deleteAsset">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card-text>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import CreativeFormDialog from '@/components/campaigns/CreativeFormDialog.vue';
import { advertisingApi } from '@/services/api/advertising.api';
import { ApiError } from '@/services/api/client';
import { integrationsApi } from '@/services/api/integrations.api';
import type { Asset, Creative } from '@/types/advertising';
import type { MetaAsset } from '@/types/integrations';
import { creativeStatusColor, formatCreativeStatus } from '@/utils/labels';
import { formatBytes } from '@/utils/format';

const props = defineProps<{
  businessId: string;
  canCreate: boolean;
  canUpdate: boolean;
}>();

const creatives = ref<Creative[]>([]);
const assets = ref<Asset[]>([]);
const pages = ref<MetaAsset[]>([]);
const previews = ref<Record<string, string>>({});
const loading = ref(true);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);

const uploadFile = ref<File | null>(null);
const uploading = ref(false);

const creativeDialog = ref(false);
const editingCreative = ref<Creative | null>(null);
const deleteCreativeDialog = ref(false);
const deleteCreativeTarget = ref<Creative | null>(null);
const deleteAssetDialog = ref(false);
const deleteAssetTarget = ref<Asset | null>(null);
const deleting = ref(false);

const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

function notify(message: string, color = 'success'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function describeError(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

function releasePreview(assetId: string): void {
  const url = previews.value[assetId];

  if (url) {
    URL.revokeObjectURL(url);
    delete previews.value[assetId];
  }
}

async function loadPreview(assetId: string): Promise<void> {
  if (previews.value[assetId]) {
    return;
  }

  try {
    const blob = await advertisingApi.fetchAssetBlob(props.businessId, assetId);
    previews.value[assetId] = URL.createObjectURL(blob);
  } catch {
    // Thumbnails are best-effort; the asset list still renders without them.
  }
}

async function loadAssetPreviews(): Promise<void> {
  await Promise.all(assets.value.map((asset) => loadPreview(asset.id)));
}

async function loadCreatives(): Promise<void> {
  const result = await advertisingApi.listCreatives(props.businessId);
  creatives.value = result.items;
}

async function loadAssets(): Promise<void> {
  assets.value = await advertisingApi.listAssets(props.businessId);
}

async function loadPages(): Promise<void> {
  try {
    const overview = await integrationsApi.getMetaOverview(props.businessId);
    pages.value = overview.assets.pages;
  } catch {
    pages.value = [];
  }
}

async function refresh(): Promise<void> {
  await Promise.all([loadCreatives(), loadAssets(), loadPages()]);
  await loadAssetPreviews();
}

async function upload(): Promise<void> {
  if (!uploadFile.value) {
    return;
  }

  uploading.value = true;
  actionError.value = null;

  try {
    await advertisingApi.uploadAsset(props.businessId, uploadFile.value);
    uploadFile.value = null;
    await loadAssets();
    await loadAssetPreviews();
    notify('Image uploaded.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to upload the image.');
  } finally {
    uploading.value = false;
  }
}

function openCreate(): void {
  editingCreative.value = null;
  creativeDialog.value = true;
}

function openEdit(creative: Creative): void {
  editingCreative.value = creative;
  creativeDialog.value = true;
}

async function onCreativeSaved(): Promise<void> {
  await refresh();
  notify('Creative saved.');
}

function confirmCreativeDelete(creative: Creative): void {
  deleteCreativeTarget.value = creative;
  deleteCreativeDialog.value = true;
}

function confirmAssetDelete(asset: Asset): void {
  deleteAssetTarget.value = asset;
  deleteAssetDialog.value = true;
}

async function deleteCreative(): Promise<void> {
  if (!deleteCreativeTarget.value) {
    return;
  }

  deleting.value = true;
  actionError.value = null;

  try {
    await advertisingApi.deleteCreative(props.businessId, deleteCreativeTarget.value.id);
    deleteCreativeDialog.value = false;
    deleteCreativeTarget.value = null;
    await loadCreatives();
    notify('Creative deleted.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to delete the creative.');
    deleteCreativeDialog.value = false;
  } finally {
    deleting.value = false;
  }
}

async function deleteAsset(): Promise<void> {
  if (!deleteAssetTarget.value) {
    return;
  }

  const assetId = deleteAssetTarget.value.id;
  deleting.value = true;
  actionError.value = null;

  try {
    await advertisingApi.deleteAsset(props.businessId, assetId);
    deleteAssetDialog.value = false;
    deleteAssetTarget.value = null;
    releasePreview(assetId);
    await loadAssets();
    await loadCreatives();
    notify('Media deleted.');
  } catch (caught) {
    actionError.value = describeError(caught, 'Unable to delete the media.');
    deleteAssetDialog.value = false;
  } finally {
    deleting.value = false;
  }
}

onBeforeUnmount(() => {
  Object.values(previews.value).forEach((url) => URL.revokeObjectURL(url));
});

onMounted(async () => {
  try {
    await refresh();
  } catch (caught) {
    loadError.value = describeError(caught, 'Unable to load creatives and media.');
  } finally {
    loading.value = false;
  }
});
</script>
