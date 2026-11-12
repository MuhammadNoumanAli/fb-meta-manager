const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Platform admin',
  agency_owner: 'Agency owner',
  agency_admin: 'Agency admin',
  agency_staff: 'Agency staff',
  business_owner: 'Business owner',
  business_admin: 'Business admin',
  business_viewer: 'Viewer',
};

export const formatRole = (role: string): string =>
  ROLE_LABELS[role] ?? role.replace(/_/g, ' ');

export const formatAccessType = (accessType: string): string => {
  switch (accessType) {
    case 'platform':
      return 'Platform access';
    case 'agency':
      return 'Managed by agency';
    default:
      return 'Direct member';
  }
};

export const formatStatus = (status: string): string =>
  status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

const INTEGRATION_HEALTH_LABELS: Record<string, string> = {
  not_connected: 'Not connected',
  healthy: 'Connected',
  attention: 'Needs attention',
  expired: 'Token expired',
  revoked: 'Access revoked',
};

export const formatIntegrationHealth = (health: string): string =>
  INTEGRATION_HEALTH_LABELS[health] ?? formatStatus(health);

export const integrationHealthColor = (health: string): string => {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'attention':
    case 'expired':
      return 'warning';
    case 'revoked':
      return 'error';
    default:
      return 'default';
  }
};

export const formatConnectionMode = (mode: string | null): string => {
  if (mode === 'system_user') {
    return 'System User token';
  }

  if (mode === 'client_oauth') {
    return 'Meta login';
  }

  return 'Not connected';
};

const INTEGRATION_EVENT_LABELS: Record<string, string> = {
  authorized: 'Meta authorized',
  system_user_connected: 'System User connected',
  reauthorized: 'Reauthorized',
  validated: 'Token validated',
  permissions_changed: 'Permissions changed',
  expired: 'Token expired',
  revoked: 'Access revoked',
  error: 'Integration error',
  discovered: 'Assets refreshed',
  disconnected: 'Disconnected',
};

export const formatIntegrationEvent = (eventType: string): string =>
  INTEGRATION_EVENT_LABELS[eventType] ?? formatStatus(eventType);
