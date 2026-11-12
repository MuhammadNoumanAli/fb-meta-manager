<template>
  <v-dialog :model-value="open" max-width="520" @update:model-value="close">
    <v-card>
      <v-card-title class="pt-5">{{ agencyId ? 'Add client business' : 'Create business workspace' }}</v-card-title>
      <v-card-subtitle>
        {{
          agencyId
            ? 'The client keeps ownership of the workspace while your agency manages it.'
            : 'You become the first business owner and can invite your team afterwards.'
        }}
      </v-card-subtitle>

      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="name"
            label="Business name"
            :rules="[rules.required]"
            autofocus
            class="mb-2"
          />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="currency"
                :items="currencies"
                label="Currency"
                :rules="[rules.required]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="timezone"
                :items="timezones"
                label="Timezone"
                :rules="[rules.required]"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn color="primary" :loading="loading" @click="submit">
          {{ agencyId ? 'Add client' : 'Create workspace' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ApiError } from '@/services/api/client';
import { workspaceApi } from '@/services/api/workspace.api';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  open: boolean;
  agencyId?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [businessId: string];
}>();

const auth = useAuthStore();
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const name = ref('');
const currency = ref('MYR');
const timezone = ref('Asia/Kuala_Lumpur');
const loading = ref(false);
const error = ref<string | null>(null);

const currencies = ['MYR', 'USD', 'SGD', 'IDR', 'THB', 'PHP', 'VND'];
const timezones = [
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Bangkok',
  'Asia/Manila',
  'UTC',
];

const rules = {
  required: (value: string) => Boolean(value) || 'This field is required',
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = '';
      currency.value = 'MYR';
      timezone.value = 'Asia/Kuala_Lumpur';
      error.value = null;
    }
  },
);

function close(value: boolean): void {
  emit('update:open', value);
}

async function submit(): Promise<void> {
  const validation = await form.value?.validate();

  if (validation && !validation.valid) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const detail = props.agencyId
      ? await workspaceApi.createClient(props.agencyId, {
          name: name.value.trim(),
          currency: currency.value,
          timezone: timezone.value,
        })
      : await workspaceApi.createBusiness({
          name: name.value.trim(),
          currency: currency.value,
          timezone: timezone.value,
        });

    await auth.reload();
    emit('created', detail.business.id);
    close(false);
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Unable to create the business workspace. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>
