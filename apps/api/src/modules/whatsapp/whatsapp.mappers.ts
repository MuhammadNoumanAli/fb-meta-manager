import { LeadConsentStatus } from '../../common/enums/lead-consent-status.enum';
import { SuppressionReason } from '../../common/enums/suppression-reason.enum';
import { WhatsappAccountStatus } from '../../common/enums/whatsapp-account-status.enum';
import { WhatsappMessageDirection } from '../../common/enums/whatsapp-message-direction.enum';
import { WhatsappMessageStatus } from '../../common/enums/whatsapp-message-status.enum';
import { WhatsappMessageType } from '../../common/enums/whatsapp-message-type.enum';
import { WhatsappPhoneNumberStatus } from '../../common/enums/whatsapp-phone-number-status.enum';
import { WhatsappProvider } from '../../common/enums/whatsapp-provider.enum';
import { WhatsappTemplateCategory } from '../../common/enums/whatsapp-template-category.enum';
import { WhatsappTemplateStatus } from '../../common/enums/whatsapp-template-status.enum';
import { CommunicationSuppression } from '../../database/entities/communication-suppression.entity';
import { LeadConsent } from '../../database/entities/lead-consent.entity';
import { WhatsappAccount } from '../../database/entities/whatsapp-account.entity';
import { WhatsappMessage } from '../../database/entities/whatsapp-message.entity';
import { WhatsappMessageEvent } from '../../database/entities/whatsapp-message-event.entity';
import { WhatsappPhoneNumber } from '../../database/entities/whatsapp-phone-number.entity';
import { WhatsappTemplate } from '../../database/entities/whatsapp-template.entity';

export interface WhatsappPhoneNumberView {
  id: string;
  externalPhoneNumberId: string;
  displayPhoneNumber: string;
  qualityRating: string | null;
  status: WhatsappPhoneNumberStatus;
  isDefault: boolean;
}

export interface WhatsappAccountView {
  id: string;
  provider: WhatsappProvider;
  name: string;
  externalAccountId: string;
  status: WhatsappAccountStatus;
  lastError: string | null;
  lastValidatedAt: Date | null;
  credentialsExpiresAt: Date | null;
  hasCredentials: boolean;
  phoneNumbers: WhatsappPhoneNumberView[];
  createdAt: Date;
}

export interface WhatsappTemplateView {
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
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappTemplateListResult {
  items: WhatsappTemplateView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WhatsappMessageView {
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
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface WhatsappMessageEventView {
  id: string;
  status: WhatsappMessageStatus;
  eventType: string | null;
  error: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface WhatsappMessageDetailView extends WhatsappMessageView {
  events: WhatsappMessageEventView[];
}

export interface WhatsappMessageListResult {
  items: WhatsappMessageView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadConsentView {
  id: string;
  leadId: string | null;
  channel: string;
  phoneNumber: string | null;
  status: LeadConsentStatus;
  source: string;
  consentText: string | null;
  capturedAt: Date;
  revokedAt: Date | null;
}

export interface CommunicationSuppressionView {
  id: string;
  phoneNumber: string;
  reason: SuppressionReason;
  source: string;
  notes: string | null;
  createdAt: Date;
}

export const toPhoneNumberView = (
  phone: WhatsappPhoneNumber,
): WhatsappPhoneNumberView => ({
  id: phone.id,
  externalPhoneNumberId: phone.externalPhoneNumberId,
  displayPhoneNumber: phone.displayPhoneNumber,
  qualityRating: phone.qualityRating,
  status: phone.status,
  isDefault: phone.isDefault,
});

export const toAccountView = (
  account: WhatsappAccount,
  phoneNumbers: WhatsappPhoneNumber[],
): WhatsappAccountView => ({
  id: account.id,
  provider: account.provider,
  name: account.name,
  externalAccountId: account.externalAccountId,
  status: account.status,
  lastError: account.lastError,
  lastValidatedAt: account.lastValidatedAt,
  credentialsExpiresAt: account.credentialsExpiresAt,
  hasCredentials: Boolean(account.credentialsEncrypted),
  phoneNumbers: phoneNumbers.map(toPhoneNumberView),
  createdAt: account.createdAt,
});

export const toTemplateView = (template: WhatsappTemplate): WhatsappTemplateView => ({
  id: template.id,
  accountId: template.accountId,
  name: template.name,
  language: template.language,
  category: template.category,
  status: template.status,
  providerTemplateId: template.providerTemplateId,
  body: template.body,
  variableMapping: template.variableMapping,
  rejectionReason: template.rejectionReason,
  isEnabled: template.isEnabled,
  isAcknowledgment: template.isAcknowledgment,
  approvedAt: template.approvedAt,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

export const toMessageView = (message: WhatsappMessage): WhatsappMessageView => ({
  id: message.id,
  leadId: message.leadId,
  accountId: message.accountId,
  phoneNumberId: message.phoneNumberId,
  templateId: message.templateId,
  direction: message.direction,
  messageType: message.messageType,
  status: message.status,
  toPhone: message.toPhone,
  fromPhone: message.fromPhone,
  body: message.body,
  variables: message.variables,
  externalMessageId: message.externalMessageId,
  attempts: message.attempts,
  maxAttempts: message.maxAttempts,
  error: message.error,
  sentAt: message.sentAt,
  deliveredAt: message.deliveredAt,
  readAt: message.readAt,
  createdAt: message.createdAt,
});

export const toMessageDetailView = (
  message: WhatsappMessage,
  events: WhatsappMessageEventView[],
): WhatsappMessageDetailView => ({
  ...toMessageView(message),
  events,
});

export const toMessageEventView = (
  event: WhatsappMessageEvent,
): WhatsappMessageEventView => ({
  id: event.id,
  status: event.status,
  eventType: event.eventType,
  error: event.error,
  occurredAt: event.occurredAt,
  createdAt: event.createdAt,
});

export const toConsentView = (consent: LeadConsent): LeadConsentView => ({
  id: consent.id,
  leadId: consent.leadId,
  channel: consent.channel,
  phoneNumber: consent.phoneNumber,
  status: consent.status,
  source: consent.source,
  consentText: consent.consentText,
  capturedAt: consent.capturedAt,
  revokedAt: consent.revokedAt,
});

export const toSuppressionView = (
  suppression: CommunicationSuppression,
): CommunicationSuppressionView => ({
  id: suppression.id,
  phoneNumber: suppression.phoneNumber,
  reason: suppression.reason,
  source: suppression.source,
  notes: suppression.notes,
  createdAt: suppression.createdAt,
});
