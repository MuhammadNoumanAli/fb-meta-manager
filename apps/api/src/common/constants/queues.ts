/**
 * Canonical BullMQ queue names from the AdPilot architecture blueprint.
 * Phase 0 registers only the notification queue; later phases add producers
 * and workers for each queue as their features are implemented.
 */
export const QUEUE_NAMES = {
  CAMPAIGN_OPERATIONS: 'campaign-operations',
  SCHEDULED_ACTIONS: 'scheduled-actions',
  META_SYNC: 'meta-sync',
  META_WEBHOOKS: 'meta-webhooks',
  LEAD_PROCESSING: 'lead-processing',
  WHATSAPP_MESSAGES: 'whatsapp-messages',
  ANALYTICS_SYNC: 'analytics-sync',
  TOKEN_MONITORING: 'token-monitoring',
  AUTOMATION_EXECUTION: 'automation-execution',
  NOTIFICATIONS: 'notifications',
  BULK_OPERATIONS: 'bulk-operations',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
