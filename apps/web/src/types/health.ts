export type HealthState = 'up' | 'down' | 'unknown';

export interface HealthCheckEntry {
  status: 'up' | 'down';
  message?: string;
  [key: string]: unknown;
}

export interface LivenessResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ok' | 'error';
  info?: Record<string, HealthCheckEntry>;
  error?: Record<string, HealthCheckEntry>;
  details: Record<string, HealthCheckEntry>;
}
