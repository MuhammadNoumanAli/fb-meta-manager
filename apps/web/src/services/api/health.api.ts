import { apiRequest } from './client';
import type { LivenessResponse, ReadinessResponse } from '@/types/health';

export const healthApi = {
  getLiveness: () => apiRequest<LivenessResponse>('/health'),
  getReadiness: () => apiRequest<ReadinessResponse>('/health/ready'),
};
