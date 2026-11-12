<template>
  <v-dialog :model-value="open" max-width="480" @update:model-value="close">
    <v-card>
      <v-card-title class="pt-5">Create agency</v-card-title>
      <v-card-subtitle>
        Agencies manage client businesses while clients keep ownership of their assets.
      </v-card-subtitle>

      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="name"
            label="Agency name"
            :rules="[rules.required]"
            autofocus
          />
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="close(false)">Cancel</v-btn>
        <v-btn color="primary" :loading="loading" @click="submit">Create agency</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ApiError } from '@/services/api/client';
import { workspaceApi } from '@/services/api/workspace.api';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ open: boolean }>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [agencyId: string];
}>();

const auth = useAuthStore();
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const name = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const rules = {
  required: (value: string) => Boolean(value) || 'This field is required',
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = '';
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
    const detail = await workspaceApi.createAgency({ name: name.value.trim() });
    await auth.reload();
    emit('created', detail.agency.id);
    close(false);
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Unable to create the agency. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>
