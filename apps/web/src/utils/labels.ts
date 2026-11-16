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

const LEAD_SOURCE_LABELS: Record<string, string> = {
  meta_lead_ads: 'Meta Lead Ads',
  website_api: 'Website API',
  whatsapp: 'WhatsApp',
};

export const formatLeadSource = (source: string): string =>
  LEAD_SOURCE_LABELS[source] ?? formatStatus(source);

export const leadStatusColor = (status: string): string => {
  switch (status) {
    case 'new':
      return 'info';
    case 'contacted':
      return 'primary';
    case 'qualified':
    case 'converted':
      return 'success';
    default:
      return 'default';
  }
};

export const formatConsent = (status: string): string => {
  switch (status) {
    case 'granted':
      return 'Consent granted';
    case 'denied':
      return 'Consent denied';
    default:
      return 'Consent unknown';
  }
};

const WEBHOOK_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  processing: 'Processing',
  processed: 'Processed',
  failed: 'Failed',
  ignored: 'Ignored',
};

export const formatWebhookEventStatus = (status: string): string =>
  WEBHOOK_STATUS_LABELS[status] ?? formatStatus(status);

export const webhookEventStatusColor = (status: string): string => {
  switch (status) {
    case 'processed':
      return 'success';
    case 'failed':
      return 'error';
    case 'received':
    case 'processing':
      return 'warning';
    default:
      return 'default';
  }
};
