export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'disqualified';

export type LeadSourceType = 'meta_lead_ads' | 'website_api' | 'whatsapp';

export type LeadConsentStatus = 'unknown' | 'granted' | 'denied';

export interface Lead {
  id: string;
  sourcePlatform: LeadSourceType;
  externalLeadId: string | null;
  formId: string | null;
  campaignExternalId: string | null;
  adSetExternalId: string | null;
  adExternalId: string | null;
  pageExternalId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  message: string | null;
  consentStatus: LeadConsentStatus;
  status: LeadStatus;
  assignedUserId: string | null;
  capturedAt: string;
  createdAt: string;
}

export interface LeadListResult {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadSource {
  id: string;
  type: LeadSourceType;
  name: string;
  externalId: string | null;
  isActive: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  lastReceivedAt: string | null;
  createdAt: string;
}

export interface WebsiteKeyResult {
  source: LeadSource;
  apiKey: string;
}

export interface LeadSyncLog {
  id: string;
  sourcePlatform: LeadSourceType;
  externalLeadId: string | null;
  status: string;
  message: string | null;
  createdAt: string;
}

export type WebhookEventStatus =
  | 'received'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'ignored';

export interface MetaWebhookEvent {
  id: string;
  objectType: string;
  field: string | null;
  status: WebhookEventStatus;
  attempts: number;
  lastError: string | null;
  externalEntryId: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface MetaWebhookEventDetail extends MetaWebhookEvent {
  logs: Array<{
    id: string;
    status: string;
    message: string | null;
    createdAt: string;
  }>;
}
