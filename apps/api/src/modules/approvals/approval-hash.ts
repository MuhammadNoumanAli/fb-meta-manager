import { createHash } from 'crypto';

/**
 * Deterministic JSON representation so the same logical payload always yields
 * the same hash regardless of property order.
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}
