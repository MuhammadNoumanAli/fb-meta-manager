import type { LeadConsentStatus } from './leads';

export type WhatsappProvider = 'meta' | 'twilio';

export type WhatsappAccountStatus = 'active' | 'attention' | 'disabled';

export type WhatsappPhoneNumberStatus = 'active' | 'paused' | 'disabled';

export type WhatsappTemplateCategory = 'marketing' | 'utility' | 'authentication';

export type WhatsappTemplateStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'disabled';

export type WhatsappMessageDirection = 'outbound' | 'inbound';

export type WhatsappMessageType = 'template' | 'text' | 'system';

export type WhatsappMessageStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'received'
  | 'skipped'
  | 'suppressed';

export type SuppressionReason = 'opt_out' | 'complaint' | 'manual';

export type WhatsappConsentSource =
  | 'meta_form'
  | 'website_form'
  | 'manual'
  | 'inbound_reply'
  | 'import';

export interface WhatsappPhoneNumber {
  id: string;
  externalPhoneNumberId: string;
  displayPhoneNumber: string;
  qualityRating: string | null;
  status: WhatsappPhoneNumberStatus;
  isDefault: boolean;
}

export interface WhatsappAccount {
  id: string;
  provider: WhatsappProvider;
  name: string;
  externalAccountId: string;
  status: WhatsappAccountStatus;
  lastError: string | null;
  lastValidatedAt: string | null;
  credentialsExpiresAt: string | null;
  hasCredentials: boolean;
  phoneNumbers: WhatsappPhoneNumber[];
  createdAt: string;
}

export interface WhatsappPhoneNumberInput {
  externalPhoneNumberId: string;
  displayPhoneNumber: string;
  isDefault?: boolean;
}

export interface CreateWhatsappAccountInput {
  provider: WhatsappProvider;
  name: string;
  externalAccountId: string;
  accessToken: string;
  businessAccountId?: string;
  phoneNumbers: WhatsappPhoneNumberInput[];
}

export interface UpdateWhatsappAccountInput {
  name?: string;
  status?: WhatsappAccountStatus;
  accessToken?: string;
}

export interface WhatsappTemplate {
  id: string;
  accountId: string | null;
  name: string;
  language: string;
  category: WhatsappTemplateCategory;
  status: WhatsappTemplateStatus;
  providerTemplateId: string | null;
  body: string;
  variableMapping: Record<string, string> | null;
  rejectionReason: string | null;
  isEnabled: boolean;
  isAcknowledgment: boolean;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsappTemplateInput {
  name: string;
  language: string;
  category: WhatsappTemplateCategory;
  body: string;
  variableMapping?: Record<string, string>;
  accountId?: string;
  providerTemplateId?: string;
  isAcknowledgment?: boolean;
}

export interface UpdateWhatsappTemplateInput {
  body?: string;
  category?: WhatsappTemplateCategory;
  variableMapping?: Record<string, string>;
  accountId?: string;
  providerTemplateId?: string;
  isEnabled?: boolean;
  isAcknowledgment?: boolean;
}

export interface WhatsappMessage {
  id: string;
  leadId: string | null;
  accountId: string;
  phoneNumberId: string;
  templateId: string | null;
  direction: WhatsappMessageDirection;
  messageType: WhatsappMessageType;
  status: WhatsappMessageStatus;
  toPhone: string;
  fromPhone: string | null;
  body: string | null;
  variables: Record<string, string> | null;
  externalMessageId: string | null;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface WhatsappMessageEvent {
  id: string;
  status: WhatsappMessageStatus;
  eventType: string | null;
  error: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface WhatsappMessageDetail extends WhatsappMessage {
  events: WhatsappMessageEvent[];
}

export interface SendWhatsappMessageInput {
  leadId: string;
  templateId: string;
  accountId?: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
}

export interface LeadConsent {
  id: string;
  leadId: string | null;
  channel: string;
  phoneNumber: string | null;
  status: LeadConsentStatus;
  source: string;
  consentText: string | null;
  capturedAt: string;
  revokedAt: string | null;
}

export interface RecordConsentInput {
  leadId: string;
  status: 'granted' | 'denied';
  source?: WhatsappConsentSource;
  consentText?: string;
  phoneNumber?: string;
}

export interface CommunicationSuppression {
  id: string;
  phoneNumber: string;
  reason: SuppressionReason;
  source: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateSuppressionInput {
  phoneNumber: string;
  reason?: SuppressionReason;
  source?: string;
  notes?: string;
}

export interface WhatsappMessageQuery {
  leadId?: string;
  accountId?: string;
  status?: WhatsappMessageStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface WhatsappTemplateQuery {
  accountId?: string;
  status?: WhatsappTemplateStatus;
  page?: number;
  pageSize?: number;
}

export interface WhatsappMessageListResult {
  items: WhatsappMessage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WhatsappTemplateListResult {
  items: WhatsappTemplate[];
  total: number;
  page: number;
  pageSize: number;
}
