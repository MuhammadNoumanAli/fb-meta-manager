import type {
  CommunicationSuppression,
  CreateSuppressionInput,
  CreateWhatsappAccountInput,
  CreateWhatsappTemplateInput,
  LeadConsent,
  RecordConsentInput,
  SendWhatsappMessageInput,
  UpdateWhatsappAccountInput,
  UpdateWhatsappTemplateInput,
  WhatsappAccount,
  WhatsappMessage,
  WhatsappMessageDetail,
  WhatsappMessageListResult,
  WhatsappMessageQuery,
  WhatsappTemplate,
  WhatsappTemplateListResult,
  WhatsappTemplateQuery,
} from '@/types/whatsapp';
import { apiRequest } from './client';

const toQuery = (params: object): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
};

const base = (businessId: string) => `/businesses/${businessId}/whatsapp`;

export const whatsappApi = {
  listAccounts: (businessId: string) =>
    apiRequest<WhatsappAccount[]>(`${base(businessId)}/accounts`),

  getAccount: (businessId: string, accountId: string) =>
    apiRequest<WhatsappAccount>(`${base(businessId)}/accounts/${accountId}`),

  createAccount: (businessId: string, payload: CreateWhatsappAccountInput) =>
    apiRequest<WhatsappAccount>(`${base(businessId)}/accounts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAccount: (
    businessId: string,
    accountId: string,
    payload: UpdateWhatsappAccountInput,
  ) =>
    apiRequest<WhatsappAccount>(`${base(businessId)}/accounts/${accountId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  validateAccount: (businessId: string, accountId: string) =>
    apiRequest<WhatsappAccount>(`${base(businessId)}/accounts/${accountId}/validate`, {
      method: 'POST',
      body: '{}',
    }),

  disableAccount: (businessId: string, accountId: string) =>
    apiRequest<WhatsappAccount>(`${base(businessId)}/accounts/${accountId}`, {
      method: 'DELETE',
    }),

  listTemplates: (businessId: string, params: WhatsappTemplateQuery = {}) =>
    apiRequest<WhatsappTemplateListResult>(
      `${base(businessId)}/templates${toQuery(params)}`,
    ),

  createTemplate: (businessId: string, payload: CreateWhatsappTemplateInput) =>
    apiRequest<WhatsappTemplate>(`${base(businessId)}/templates`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTemplate: (
    businessId: string,
    templateId: string,
    payload: UpdateWhatsappTemplateInput,
  ) =>
    apiRequest<WhatsappTemplate>(`${base(businessId)}/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  seedDefaultTemplates: (businessId: string) =>
    apiRequest<WhatsappTemplate[]>(`${base(businessId)}/templates/seed-defaults`, {
      method: 'POST',
      body: '{}',
    }),

  submitTemplate: (businessId: string, templateId: string) =>
    apiRequest<WhatsappTemplate>(
      `${base(businessId)}/templates/${templateId}/submit`,
      { method: 'POST', body: '{}' },
    ),

  approveTemplate: (businessId: string, templateId: string) =>
    apiRequest<WhatsappTemplate>(
      `${base(businessId)}/templates/${templateId}/approve`,
      { method: 'POST', body: '{}' },
    ),

  rejectTemplate: (businessId: string, templateId: string, reason: string) =>
    apiRequest<WhatsappTemplate>(
      `${base(businessId)}/templates/${templateId}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),

  disableTemplate: (businessId: string, templateId: string) =>
    apiRequest<WhatsappTemplate>(
      `${base(businessId)}/templates/${templateId}/disable`,
      { method: 'POST', body: '{}' },
    ),

  listMessages: (businessId: string, params: WhatsappMessageQuery = {}) =>
    apiRequest<WhatsappMessageListResult>(
      `${base(businessId)}/messages${toQuery(params)}`,
    ),

  getMessage: (businessId: string, messageId: string) =>
    apiRequest<WhatsappMessageDetail>(`${base(businessId)}/messages/${messageId}`),

  sendMessage: (businessId: string, payload: SendWhatsappMessageInput) =>
    apiRequest<WhatsappMessage>(`${base(businessId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  retryMessage: (businessId: string, messageId: string) =>
    apiRequest<WhatsappMessageDetail>(
      `${base(businessId)}/messages/${messageId}/retry`,
      { method: 'POST', body: '{}' },
    ),

  listConsents: (
    businessId: string,
    params: { leadId?: string; phoneNumber?: string } = {},
  ) => apiRequest<LeadConsent[]>(`${base(businessId)}/consents${toQuery(params)}`),

  recordConsent: (businessId: string, payload: RecordConsentInput) =>
    apiRequest<LeadConsent>(`${base(businessId)}/consents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listSuppressions: (businessId: string) =>
    apiRequest<CommunicationSuppression[]>(`${base(businessId)}/suppressions`),

  addSuppression: (businessId: string, payload: CreateSuppressionInput) =>
    apiRequest<CommunicationSuppression>(`${base(businessId)}/suppressions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  removeSuppression: (businessId: string, suppressionId: string) =>
    apiRequest<void>(`${base(businessId)}/suppressions/${suppressionId}`, {
      method: 'DELETE',
    }),
};
