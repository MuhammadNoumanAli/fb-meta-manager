<template>
  <div>
    <div class="text-overline text-medium-emphasis">Welcome back</div>
    <h1 class="text-h4 font-weight-bold mb-2">Sign in to AdPilot</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Use your email and password to access your workspaces.
    </p>

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
        class="mb-2"
      />
      <v-text-field
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        prepend-inner-icon="mdi-lock-outline"
        :rules="[rules.required]"
        class="mb-2"
      />

      <div class="d-flex justify-end mb-4">
        <router-link :to="{ name: 'forgot-password' }" class="text-body-2 text-primary">
          Forgot password?
        </router-link>
      </div>

      <v-btn type="submit" color="primary" size="large" block :loading="loading">
        Sign in
      </v-btn>
    </v-form>

    <p class="text-body-2 text-medium-emphasis text-center mt-6 mb-0">
      New to AdPilot?
      <router-link :to="{ name: 'register' }" class="text-primary font-weight-medium">
        Create an account
      </router-link>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/services/api/client';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

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

  try {
    await auth.signIn({ email: email.value.trim(), password: password.value });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.push(redirect.startsWith('/') ? redirect : '/');
  } catch (caught) {
    error.value =
      caught instanceof ApiError ? caught.message : 'Unable to sign in. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>
