import { apiRequest } from './client';
import type {
  MetaIntegrationOverview,
  MetaOAuthStartResult,
  MetaTokenEvent,
} from '@/types/integrations';

export const integrationsApi = {
  getMetaOverview: (businessId: string) =>
    apiRequest<MetaIntegrationOverview>(`/businesses/${businessId}/integrations/meta`),

  listMetaEvents: (businessId: string) =>
    apiRequest<MetaTokenEvent[]>(`/businesses/${businessId}/integrations/meta/events`),

  startMetaOAuth: (businessId: string, redirectPath?: string) =>
    apiRequest<MetaOAuthStartResult>(
      `/businesses/${businessId}/integrations/meta/oauth/start`,
      {
        method: 'POST',
        body: JSON.stringify(redirectPath ? { redirectPath } : {}),
      },
    ),

  connectSystemUser: (
    businessId: string,
    payload: { accessToken: string; tokenExpiresAt?: string },
  ) =>
    apiRequest<MetaIntegrationOverview>(
      `/businesses/${businessId}/integrations/meta/system-user`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  validateMeta: (businessId: string) =>
    apiRequest<MetaIntegrationOverview>(
      `/businesses/${businessId}/integrations/meta/validate`,
      { method: 'POST', body: '{}' },
    ),

  discoverMetaAssets: (businessId: string) =>
    apiRequest<MetaIntegrationOverview>(
      `/businesses/${businessId}/integrations/meta/discover`,
      { method: 'POST', body: '{}' },
    ),

  disconnectMeta: (businessId: string) =>
    apiRequest<MetaIntegrationOverview>(`/businesses/${businessId}/integrations/meta`, {
      method: 'DELETE',
    }),
};
