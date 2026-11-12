<template>
  <div>
    <v-skeleton-loader v-if="loading" type="heading, text, text, actions" />

    <template v-else-if="unavailable">
      <div class="text-overline text-medium-emphasis">Invitation unavailable</div>
      <h1 class="text-h4 font-weight-bold mb-2">This link cannot be used</h1>
      <v-alert type="warning" variant="tonal" class="my-4">
        {{ unavailable }}
      </v-alert>
      <p class="text-body-2 text-medium-emphasis mb-6">
        Ask the agency to send a new invitation if you still need access to this workspace.
      </p>
      <v-btn variant="tonal" color="primary" block to="/login">Go to sign in</v-btn>
    </template>

    <template v-else-if="preview">
      <div class="text-overline text-medium-emphasis">Client invitation</div>
      <h1 class="text-h4 font-weight-bold mb-2">{{ preview.businessName }}</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">
        {{ preview.agencyName }} invited <strong>{{ preview.email }}</strong> to take ownership of
        this workspace on AdPilot.
      </p>

      <v-card variant="tonal" color="primary" class="mb-6">
        <v-card-text class="d-flex align-center ga-3">
          <v-icon icon="mdi-clock-outline" />
          <div class="text-body-2">
            This invitation expires on {{ formatDateTime(preview.expiresAt) }}.
          </div>
        </v-card-text>
      </v-card>

      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
        {{ error }}
      </v-alert>

      <v-alert
        v-if="preview.hasAccount"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        An AdPilot account already uses this email. Enter its password to accept.
      </v-alert>

      <v-form ref="form" @submit.prevent="submit">
        <template v-if="!preview.hasAccount">
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="formData.firstName"
                label="First name"
                autocomplete="given-name"
                :rules="[rules.required]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="formData.lastName"
                label="Last name"
                autocomplete="family-name"
                :rules="[rules.required]"
              />
            </v-col>
          </v-row>
        </template>

        <v-text-field
          v-model="formData.password"
          label="Password"
          type="password"
          :autocomplete="preview.hasAccount ? 'current-password' : 'new-password'"
          :rules="preview.hasAccount ? [rules.required] : [rules.required, rules.password]"
          class="mb-2"
        />

        <v-text-field
          v-if="!preview.hasAccount"
          v-model="formData.confirmPassword"
          label="Confirm password"
          type="password"
          autocomplete="new-password"
          :rules="[rules.required, rules.matches]"
          class="mb-2"
        />

        <v-row v-if="!preview.hasAccount" dense class="mb-2">
          <v-col cols="12" sm="6">
            <v-select v-model="formData.currency" :items="currencies" label="Currency" />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select v-model="formData.timezone" :items="timezones" label="Timezone" />
          </v-col>
        </v-row>

        <v-btn type="submit" color="primary" size="large" block :loading="submitting">
          {{ preview.hasAccount ? 'Sign in and accept' : 'Create account and accept' }}
        </v-btn>
      </v-form>

      <p class="text-caption text-medium-emphasis text-center mt-6 mb-0">
        By accepting you become the owner of this business workspace. The agency keeps its
        management access until the relationship ends.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/services/api/client';
import { invitationsApi } from '@/services/api/invitations.api';
import { useAuthStore } from '@/stores/auth';
import type { InvitationPreview } from '@/types/workspace';
import { formatDateTime } from '@/utils/format';
import { currencies, timezones } from '@/utils/options';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const token = String(route.params.token);

const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const preview = ref<InvitationPreview | null>(null);
const loading = ref(true);
const submitting = ref(false);
const unavailable = ref<string | null>(null);
const error = ref<string | null>(null);

const formData = ref({
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
  currency: 'MYR',
  timezone: 'UTC',
});

const rules = {
  required: (value: string) => Boolean(value) || 'This field is required',
  password: (value: string) =>
    value.length >= 8 || 'Use at least 8 characters',
  matches: (value: string) =>
    value === formData.value.password || 'Passwords do not match',
};

async function load(): Promise<void> {
  loading.value = true;

  try {
    preview.value = await invitationsApi.preview(token);
  } catch (caught) {
    unavailable.value =
      caught instanceof ApiError
        ? caught.message
        : 'We could not load this invitation.';
  } finally {
    loading.value = false;
  }
}

async function submit(): Promise<void> {
  const validation = await form.value?.validate();

  if (validation && !validation.valid) {
    return;
  }

  submitting.value = true;
  error.value = null;

  try {
    const payload = preview.value?.hasAccount
      ? { password: formData.value.password }
      : {
          password: formData.value.password,
          firstName: formData.value.firstName.trim(),
          lastName: formData.value.lastName.trim(),
          currency: formData.value.currency,
          timezone: formData.value.timezone,
        };

    const businessId = await auth.acceptInvitation(token, payload);
    await router.push({ name: 'business-detail', params: { businessId } });
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'We could not accept this invitation. Please try again.';
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>
