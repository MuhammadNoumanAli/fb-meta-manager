import type {
  Lead,
  LeadListResult,
  LeadSource,
  LeadStatus,
  LeadSyncLog,
  MetaWebhookEvent,
  MetaWebhookEventDetail,
  WebsiteKeyResult,
} from '@/types/leads';
import { apiRequest } from './client';

export interface LeadQuery {
  status?: LeadStatus;
  source?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const toQuery = (params: LeadQuery): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
};

export const leadsApi = {
  list: (businessId: string, params: LeadQuery = {}) =>
    apiRequest<LeadListResult>(`/businesses/${businessId}/leads${toQuery(params)}`),

  get: (businessId: string, leadId: string) =>
    apiRequest<Lead>(`/businesses/${businessId}/leads/${leadId}`),

  updateStatus: (businessId: string, leadId: string, status: LeadStatus) =>
    apiRequest<Lead>(`/businesses/${businessId}/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  syncLogs: (businessId: string) =>
    apiRequest<LeadSyncLog[]>(`/businesses/${businessId}/leads/sync-logs`),

  listSources: (businessId: string) =>
    apiRequest<LeadSource[]>(`/businesses/${businessId}/lead-sources`),

  issueWebsiteKey: (businessId: string) =>
    apiRequest<WebsiteKeyResult>(`/businesses/${businessId}/lead-sources/website`, {
      method: 'POST',
    }),

  revokeWebsiteKey: (businessId: string) =>
    apiRequest<LeadSource>(`/businesses/${businessId}/lead-sources/website`, {
      method: 'DELETE',
    }),

  listWebhookEvents: (businessId: string, limit = 25) =>
    apiRequest<MetaWebhookEvent[]>(
      `/businesses/${businessId}/integrations/meta/webhook-events?limit=${limit}`,
    ),

  webhookEvent: (businessId: string, eventId: string) =>
    apiRequest<MetaWebhookEventDetail>(
      `/businesses/${businessId}/integrations/meta/webhook-events/${eventId}`,
    ),

  retryWebhookEvent: (businessId: string, eventId: string) =>
    apiRequest<MetaWebhookEvent>(
      `/businesses/${businessId}/integrations/meta/webhook-events/${eventId}/retry`,
      { method: 'POST' },
    ),
};
