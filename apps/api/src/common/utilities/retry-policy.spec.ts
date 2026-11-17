import {
  DEFAULT_RETRY_POLICY,
  classifyFailure,
  failureMessage,
  jitteredDelay,
} from './retry-policy';

class StatusError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: number | null = null,
  ) {
    super(message);
  }
}

describe('retry policy', () => {
  it('classifies rate limits and 5xx responses as transient', () => {
    expect(classifyFailure(new StatusError('Meta failed', 429, 17))).toBe('transient');
    expect(classifyFailure(new StatusError('Bad gateway', 502))).toBe('transient');
    expect(classifyFailure(new StatusError('Temporarily unavailable'))).toBe('transient');
    expect(classifyFailure(new StatusError('request timed out'))).toBe('transient');
  });

  it('keeps validation, permission and policy failures permanent', () => {
    expect(classifyFailure(new StatusError('Invalid campaign payload', 400, 100))).toBe(
      'permanent',
    );
    expect(
      classifyFailure(
        new StatusError('Meta rejected the status change: Invalid campaign configuration', 502),
      ),
    ).toBe('permanent');
    expect(classifyFailure(new Error('This approval request has expired'))).toBe(
      'permanent',
    );
    expect(classifyFailure('not an error')).toBe('permanent');
  });

  it('backs off exponentially with jitter inside the configured bounds', () => {
    const first = jitteredDelay(1);
    const fourth = jitteredDelay(4);

    expect(first).toBeGreaterThanOrEqual(250);
    expect(first).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.baseDelayMs);
    expect(fourth).toBeGreaterThanOrEqual(250);
    expect(fourth).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxDelayMs);
    expect(jitteredDelay(12)).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it('produces a readable failure message', () => {
    expect(failureMessage(new Error('Meta unavailable'))).toBe('Meta unavailable');
    expect(failureMessage({})).toBe('Unknown execution error');
  });
});
