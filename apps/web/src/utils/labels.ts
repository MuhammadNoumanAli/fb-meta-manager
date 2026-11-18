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

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_APP_PROMOTION: 'App promotion',
  OUTCOME_SALES: 'Sales',
};

export const formatObjective = (objective: string): string =>
  OBJECTIVE_LABELS[objective] ?? formatStatus(objective);

const ADVERTISING_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  publishing: 'Publishing',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
  error: 'Error',
};

export const formatAdvertisingStatus = (status: string): string =>
  ADVERTISING_STATUS_LABELS[status] ?? formatStatus(status);

export const advertisingStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'success';
    case 'publishing':
      return 'info';
    case 'paused':
      return 'warning';
    case 'error':
      return 'error';
    case 'archived':
      return 'default';
    default:
      return 'primary';
  }
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  unknown: 'Unknown',
  active: 'Delivering',
  paused: 'Paused',
  archived: 'Archived',
  deleted: 'Deleted',
  pending_billing_info: 'Pending billing',
  in_process: 'In process',
  with_issues: 'With issues',
};

export const formatDeliveryStatus = (status: string): string =>
  DELIVERY_STATUS_LABELS[status] ?? formatStatus(status);

export const deliveryStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'success';
    case 'in_process':
      return 'info';
    case 'paused':
    case 'pending_billing_info':
      return 'warning';
    case 'with_issues':
      return 'error';
    default:
      return 'default';
  }
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  unknown: 'Not reviewed',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  disabled: 'Disabled',
};

export const formatReviewStatus = (status: string): string =>
  REVIEW_STATUS_LABELS[status] ?? formatStatus(status);

export const reviewStatusColor = (status: string): string => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'in_review':
      return 'info';
    case 'rejected':
    case 'disabled':
      return 'error';
    default:
      return 'default';
  }
};

const CREATIVE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready',
  error: 'Error',
  archived: 'Archived',
};

export const formatCreativeStatus = (status: string): string =>
  CREATIVE_STATUS_LABELS[status] ?? formatStatus(status);

export const creativeStatusColor = (status: string): string => {
  switch (status) {
    case 'ready':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

const OPTIMIZATION_GOAL_LABELS: Record<string, string> = {
  NONE: 'No goal',
  REACH: 'Reach',
  IMPRESSIONS: 'Impressions',
  LINK_CLICKS: 'Link clicks',
  LANDING_PAGE_VIEWS: 'Landing page views',
  POST_ENGAGEMENT: 'Post engagement',
  CONVERSATIONS: 'Conversations',
  LEAD_GENERATION: 'Lead generation',
  VALUE: 'Value',
  OFFSITE_CONVERSIONS: 'Offsite conversions',
};

export const formatOptimizationGoal = (goal: string): string =>
  OPTIMIZATION_GOAL_LABELS[goal] ?? formatStatus(goal);

const BILLING_EVENT_LABELS: Record<string, string> = {
  IMPRESSIONS: 'Impressions',
  LINK_CLICKS: 'Link clicks',
  POST_ENGAGEMENT: 'Post engagement',
  THRUPLAY: 'ThruPlay',
};

export const formatBillingEvent = (event: string): string =>
  BILLING_EVENT_LABELS[event] ?? formatStatus(event);

const WHATSAPP_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: 'Connected',
  attention: 'Needs attention',
  disabled: 'Disabled',
};

export const formatWhatsappAccountStatus = (status: string): string =>
  WHATSAPP_ACCOUNT_STATUS_LABELS[status] ?? formatStatus(status);

export const whatsappAccountStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'success';
    case 'attention':
      return 'warning';
    case 'disabled':
      return 'error';
    default:
      return 'default';
  }
};

export const formatWhatsappProvider = (provider: string): string => {
  switch (provider) {
    case 'meta':
      return 'Meta Cloud API';
    case 'twilio':
      return 'Twilio';
    default:
      return formatStatus(provider);
  }
};

export const formatWhatsappTemplateStatus = (status: string): string =>
  formatStatus(status);

export const whatsappTemplateStatusColor = (status: string): string => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'info';
    case 'rejected':
    case 'disabled':
      return 'error';
    default:
      return 'default';
  }
};

const WHATSAPP_MESSAGE_STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
  received: 'Received',
  skipped: 'Skipped',
  suppressed: 'Suppressed',
};

export const formatWhatsappMessageStatus = (status: string): string =>
  WHATSAPP_MESSAGE_STATUS_LABELS[status] ?? formatStatus(status);

export const whatsappMessageStatusColor = (status: string): string => {
  switch (status) {
    case 'sent':
    case 'delivered':
    case 'read':
      return 'success';
    case 'queued':
    case 'sending':
      return 'info';
    case 'failed':
    case 'suppressed':
      return 'error';
    case 'skipped':
      return 'warning';
    default:
      return 'default';
  }
};

const SUPPRESSION_REASON_LABELS: Record<string, string> = {
  opt_out: 'Opted out',
  complaint: 'Complaint',
  manual: 'Manual block',
};

export const formatSuppressionReason = (reason: string): string =>
  SUPPRESSION_REASON_LABELS[reason] ?? formatStatus(reason);

