/** Shared reliability helpers for queue producers and workers. */

export type FailureClass = 'transient' | 'permanent';

export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
};

/**
 * Exponential backoff with full jitter. Spreads retries across workers so a
 * shared Meta rate limit does not produce synchronised retry storms.
 */
export function jitteredDelay(attempt: number, policy = DEFAULT_RETRY_POLICY): number {
  const exponential = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)),
  );

  return Math.max(250, Math.floor(exponential / 2 + Math.random() * (exponential / 2)));
}

/**
 * Retry transient failures only. Meta returns HTTP 429 and error code 17 for
 * rate limits; 5xx responses are also safe to retry. Validation, permission
 * and policy failures are permanent and must not be retried blindly.
 */
export function classifyFailure(error: unknown): FailureClass {
  if (error instanceof Error) {
    const status = (error as Error & { status?: number | null }).status;
    const code = (error as Error & { code?: number | null }).code;
    const message = error.message.toLowerCase();

    if (
      message.includes('rate limit') ||
      message.includes('temporarily unavailable') ||
      message.includes('timed out') ||
      message.includes('econnreset')
    ) {
      return 'transient';
    }

    // Wrapped service errors keep a 502 status even for a validation failure,
    // so message keywords must win over the HTTP status.
    if (
      message.includes('invalid') ||
      message.includes('permission') ||
      message.includes('not allowed') ||
      message.includes('validation') ||
      message.includes('needs a')
    ) {
      return 'permanent';
    }

    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      return 'transient';
    }

    if (code === 17 || code === 4 || code === 2) {
      return 'transient';
    }
  }

  return 'permanent';
}

export function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown execution error';
}
