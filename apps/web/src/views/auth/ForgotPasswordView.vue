<template>
  <div>
    <div class="text-overline text-medium-emphasis">Account recovery</div>
    <h1 class="text-h4 font-weight-bold mb-2">Reset your password</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Enter the email tied to your AdPilot account and we will create a reset link.
    </p>

    <v-alert v-if="message" type="success" variant="tonal" class="mb-4">
      {{ message }}
      <template v-if="resetToken">
        <div class="mt-3">
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="mdi-key-outline"
            :to="{ name: 'reset-password', query: { token: resetToken } }"
          >
            Open development reset link
          </v-btn>
        </div>
        <div class="text-caption mt-2">
          Email delivery is not connected yet, so the token is shown in development only.
        </div>
      </template>
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
      {{ error }}
    </v-alert>

    <v-form ref="form" @submit.prevent="submit">
      <v-text-field
        v-model="email"
        label="Email"
        type="email"
        autocomplete="email"
        prepend-inner-icon="mdi-email-outline"
        :rules="[rules.required, rules.email]"
        class="mb-4"
      />

      <v-btn type="submit" color="primary" size="large" block :loading="loading">
        Send reset link
      </v-btn>
    </v-form>

    <p class="text-body-2 text-medium-emphasis text-center mt-6 mb-0">
      Remembered it?
      <router-link :to="{ name: 'login' }" class="text-primary font-weight-medium">
        Back to sign in
      </router-link>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ApiError } from '@/services/api/client';
import { authApi } from '@/services/api/auth.api';

const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const email = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const message = ref<string | null>(null);
const resetToken = ref<string | null>(null);

const rules = {
  required: (value: string) => Boolean(value) || 'This field is required',
  email: (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a valid email address',
};

async function submit(): Promise<void> {
  const validation = await form.value?.validate();

  if (validation && !validation.valid) {
    return;
  }

  loading.value = true;
  error.value = null;
  message.value = null;
  resetToken.value = null;

  try {
    const response = await authApi.forgotPassword(email.value.trim());
    message.value = response.message;
    resetToken.value = response.resetToken ?? null;
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Unable to request a password reset. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>
