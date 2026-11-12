<template>
  <div>
    <div class="text-overline text-medium-emphasis">Get started</div>
    <h1 class="text-h4 font-weight-bold mb-2">Create your account</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Start with a business workspace or an agency, then invite your team.
    </p>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
      {{ error }}
    </v-alert>

    <v-form ref="form" @submit.prevent="submit">
      <v-row dense>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="firstName"
            label="First name"
            autocomplete="given-name"
            :rules="[rules.required]"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="lastName"
            label="Last name"
            autocomplete="family-name"
            :rules="[rules.required]"
          />
        </v-col>
      </v-row>

      <v-text-field
        v-model="email"
        label="Email"
        type="email"
        autocomplete="email"
        prepend-inner-icon="mdi-email-outline"
        :rules="[rules.required, rules.email]"
        class="mt-2"
      />
      <v-text-field
        v-model="password"
        label="Password"
        type="password"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-outline"
        :rules="[rules.required, rules.password]"
        hint="At least 8 characters"
        class="mt-2"
      />
      <v-text-field
        v-model="confirmPassword"
        label="Confirm password"
        type="password"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-check-outline"
        :rules="[rules.required, rules.match]"
        class="mt-2 mb-4"
      />

      <v-btn type="submit" color="primary" size="large" block :loading="loading">
        Create account
      </v-btn>
    </v-form>

    <p class="text-body-2 text-medium-emphasis text-center mt-6 mb-0">
      Already registered?
      <router-link :to="{ name: 'login' }" class="text-primary font-weight-medium">
        Sign in
      </router-link>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError } from '@/services/api/client';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const rules = {
  required: (value: string) => Boolean(value) || 'This field is required',
  email: (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a valid email address',
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
    await auth.signUp({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim(),
      password: password.value,
    });
    await router.push({ name: 'workspaces' });
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : 'Unable to create your account. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>
