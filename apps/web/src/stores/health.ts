import { defineStore } from 'pinia';
import { ApiError } from '@/services/api/client';
import { healthApi } from '@/services/api/health.api';
import type { LivenessResponse, ReadinessResponse } from '@/types/health';

interface HealthState {
  liveness: LivenessResponse | null;
  readiness: ReadinessResponse | null;
  loading: boolean;
  error: string | null;
  lastCheckedAt: string | null;
}

export const useHealthStore = defineStore('health', {
  state: (): HealthState => ({
    liveness: null,
    readiness: null,
    loading: false,
    error: null,
    lastCheckedAt: null,
  }),

  actions: {
    async refresh(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        this.liveness = await healthApi.getLiveness();
        this.readiness = await healthApi.getReadiness();
      } catch (error) {
        if (error instanceof ApiError) {
          this.error = error.message;
          const payload = error.payload as ReadinessResponse | null;
          if (payload && typeof payload === 'object' && 'details' in payload) {
            this.readiness = payload;
          }
        } else {
          this.error =
            error instanceof Error
              ? error.message
              : 'Unexpected error while checking service health';
        }
      } finally {
        this.loading = false;
        this.lastCheckedAt = new Date().toISOString();
      }
    },
  },
});
