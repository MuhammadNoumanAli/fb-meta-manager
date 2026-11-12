import { describe, expect, it } from 'vitest';
import {
  formatAccessType,
  formatConnectionMode,
  formatIntegrationEvent,
  formatIntegrationHealth,
  formatRole,
  formatStatus,
  integrationHealthColor,
} from './labels';

describe('formatRole', () => {
  it('maps system role keys to friendly labels', () => {
    expect(formatRole('business_owner')).toBe('Business owner');
    expect(formatRole('agency_staff')).toBe('Agency staff');
  });

  it('falls back to a readable custom role key', () => {
    expect(formatRole('custom_finance_role')).toBe('custom finance role');
  });
});

describe('formatAccessType', () => {
  it('describes platform and agency access', () => {
    expect(formatAccessType('platform')).toBe('Platform access');
    expect(formatAccessType('agency')).toBe('Managed by agency');
    expect(formatAccessType('direct')).toBe('Direct member');
  });
});

describe('formatStatus', () => {
  it('capitalises statuses and expands underscores', () => {
    expect(formatStatus('active')).toBe('Active');
    expect(formatStatus('pending_review')).toBe('Pending review');
  });
});

describe('integration labels', () => {
  it('describes connection health and colours', () => {
    expect(formatIntegrationHealth('healthy')).toBe('Connected');
    expect(formatIntegrationHealth('revoked')).toBe('Access revoked');
    expect(integrationHealthColor('healthy')).toBe('success');
    expect(integrationHealthColor('revoked')).toBe('error');
  });

  it('describes connection modes and token events', () => {
    expect(formatConnectionMode('system_user')).toBe('System User token');
    expect(formatConnectionMode(null)).toBe('Not connected');
    expect(formatIntegrationEvent('permissions_changed')).toBe('Permissions changed');
    expect(formatIntegrationEvent('disconnected')).toBe('Disconnected');
  });
});
