/**
 * AdPilot's own lifecycle status for a campaign, ad set or advertisement.
 * This is deliberately separate from the raw Meta status and from the Meta
 * review state so an API failure can never look like a successful publish.
 */
export enum AdvertisingStatus {
  DRAFT = 'draft',
  PUBLISHING = 'publishing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
  ERROR = 'error',
}
