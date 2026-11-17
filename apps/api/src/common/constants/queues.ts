/**
 * Canonical BullMQ queue names from the AdPilot architecture blueprint.
 * Phases register producers and workers as their features ship; Phase 7 adds
 * automation execution, dispatch, bulk operations, token monitoring and dead letters.
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
  DEAD_LETTER: 'dead-letter',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
