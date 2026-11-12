import { describe, expect, it } from 'vitest';
import { formatDateTime, formatUptime } from './format';

describe('formatUptime', () => {
  it('formats seconds only', () => {
    expect(formatUptime(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatUptime(125)).toBe('2m 5s');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(3725)).toBe('1h 2m');
  });

  it('never returns a negative duration', () => {
    expect(formatUptime(-10)).toBe('0s');
  });
});

describe('formatDateTime', () => {
  it('renders a placeholder for missing values', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('renders an invalid date as a placeholder', () => {
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('formats a valid ISO timestamp', () => {
    expect(formatDateTime('2026-11-12T08:30:00.000Z')).not.toBe('—');
  });
});
