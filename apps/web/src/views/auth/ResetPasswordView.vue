<template>
  <div>
    <div class="text-overline text-medium-emphasis">Account recovery</div>
    <h1 class="text-h4 font-weight-bold mb-2">Choose a new password</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Reset links expire after 30 minutes. All existing sessions are signed out once the
      password changes.
    </p>

    <v-alert v-if="success" type="success" variant="tonal" class="mb-4">
      {{ success }}
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
      {{ error }}
    </v-alert>

    <v-form v-if="!success" ref="form" @submit.prevent="submit">
      <v-text-field
        v-model="token"
        label="Reset token"
        prepend-inner-icon="mdi-key-outline"
        :rules="[rules.required]"
        class="mb-2"
        hint="Pasted automatically from the reset link"
      />
      <v-text-field
        v-model="password"
        label="New password"
        type="password"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-outline"
        :rules="[rules.required, rules.password]"
        class="mt-2"
      />
      <v-text-field
        v-model="confirmPassword"
        label="Confirm new password"
        type="password"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-check-outline"
        :rules="[rules.required, rules.match]"
        class="mt-2 mb-4"
      />

      <v-btn type="submit" color="primary" size="large" block :loading="loading">
        Update password
      </v-btn>
    </v-form>

    <v-btn
      v-if="success"
      color="primary"
      size="large"
      block
      :to="{ name: 'login' }"
    >
      Sign in with new password
    </v-btn>

    <p class="text-body-2 text-medium-emphasis text-center mt-6 mb-0">
      <router-link :to="{ name: 'login' }" class="text-primary font-weight-medium">
        Back to sign in
      </router-link>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { ApiError } from '@/services/api/client';
import { authApi } from '@/services/api/auth.api';

const route = useRoute();
const initialToken = typeof route.query.token === 'string' ? route.query.token : '';

const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const token = ref(initialToken);
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const rules = {
  required: (value: string) => Boolean(value) || 'This field is required',
  password: (value: string) => value.length >= 8 || 'Use at least 8 characters',
  match: (value: string) => value === password.value || 'Passwords do not match',
};

async function submit(): Promise<void> {
  const validation = await form.value?.validate();

  if (validation && !validation.valid) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await authApi.resetPassword(token.value.trim(), password.value);
    success.value = response.message;
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Unable to reset your password. Please request a new link.';
  } finally {
    loading.value = false;
  }
}
</script>
