import type { CampaignApprovalPending } from '@/types/approvals';
import type {
  AdSet,
  AdSetDetail,
  AdSetInput,
  Advertisement,
  AdvertisementInput,
  AdvertisingStatus,
  Asset,
  Campaign,
  CampaignDetail,
  CampaignInput,
  CampaignStatusHistoryEntry,
  Creative,
  CreativeInput,
  PagedAdvertisingResult,
  SyncAllResult,
} from '@/types/advertising';
import { API_BASE_URL, apiRequest, authToken } from './client';

export interface CampaignQuery {
  status?: AdvertisingStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

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

export const advertisingApi = {
  listCampaigns: (businessId: string, params: CampaignQuery = {}) =>
    apiRequest<PagedAdvertisingResult<Campaign>>(
      `/businesses/${businessId}/campaigns${toQuery(params)}`,
    ),

  getCampaign: (businessId: string, campaignId: string) =>
    apiRequest<CampaignDetail>(`/businesses/${businessId}/campaigns/${campaignId}`),

  createCampaign: (businessId: string, payload: CampaignInput) =>
    apiRequest<Campaign>(`/businesses/${businessId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCampaign: (businessId: string, campaignId: string, payload: Partial<CampaignInput>) =>
    apiRequest<Campaign>(`/businesses/${businessId}/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteCampaign: (businessId: string, campaignId: string) =>
    apiRequest<void>(`/businesses/${businessId}/campaigns/${campaignId}`, {
      method: 'DELETE',
    }),

  updateCampaignStatus: (
    businessId: string,
    campaignId: string,
    status: 'active' | 'paused' | 'archived',
  ) =>
    apiRequest<Campaign | CampaignApprovalPending>(
      `/businesses/${businessId}/campaigns/${campaignId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    ),

  publishCampaign: (businessId: string, campaignId: string, activate: boolean) =>
    apiRequest<CampaignDetail | CampaignApprovalPending>(
      `/businesses/${businessId}/campaigns/${campaignId}/publish`,
      {
        method: 'POST',
        body: JSON.stringify({ activate }),
      },
    ),

  syncCampaign: (businessId: string, campaignId: string) =>
    apiRequest<CampaignDetail>(`/businesses/${businessId}/campaigns/${campaignId}/sync`, {
      method: 'POST',
      body: '{}',
    }),

  syncAllCampaigns: (businessId: string) =>
    apiRequest<SyncAllResult>(`/businesses/${businessId}/campaigns/sync`, {
      method: 'POST',
      body: '{}',
    }),

  createAdSet: (businessId: string, campaignId: string, payload: AdSetInput) =>
    apiRequest<AdSet>(`/businesses/${businessId}/campaigns/${campaignId}/ad-sets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdSet: (businessId: string, adSetId: string, payload: Partial<AdSetInput>) =>
    apiRequest<AdSet>(`/businesses/${businessId}/ad-sets/${adSetId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAdSet: (businessId: string, adSetId: string) =>
    apiRequest<void>(`/businesses/${businessId}/ad-sets/${adSetId}`, {
      method: 'DELETE',
    }),

  updateAdSetStatus: (
    businessId: string,
    adSetId: string,
    status: 'active' | 'paused' | 'archived',
  ) =>
    apiRequest<AdSet>(`/businesses/${businessId}/ad-sets/${adSetId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  createAdvertisement: (businessId: string, adSetId: string, payload: AdvertisementInput) =>
    apiRequest<Advertisement>(
      `/businesses/${businessId}/ad-sets/${adSetId}/advertisements`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  updateAdvertisement: (
    businessId: string,
    advertisementId: string,
    payload: Partial<AdvertisementInput>,
  ) =>
    apiRequest<Advertisement>(`/businesses/${businessId}/advertisements/${advertisementId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAdvertisement: (businessId: string, advertisementId: string) =>
    apiRequest<void>(`/businesses/${businessId}/advertisements/${advertisementId}`, {
      method: 'DELETE',
    }),

  updateAdvertisementStatus: (
    businessId: string,
    advertisementId: string,
    status: 'active' | 'paused' | 'archived',
  ) =>
    apiRequest<Advertisement>(
      `/businesses/${businessId}/advertisements/${advertisementId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    ),

  listCreatives: (businessId: string, params: { search?: string; pageSize?: number } = {}) =>
    apiRequest<PagedAdvertisingResult<Creative>>(
      `/businesses/${businessId}/creatives${toQuery({ pageSize: 100, ...params })}`,
    ),

  createCreative: (businessId: string, payload: CreativeInput) =>
    apiRequest<Creative>(`/businesses/${businessId}/creatives`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCreative: (businessId: string, creativeId: string, payload: Partial<CreativeInput>) =>
    apiRequest<Creative>(`/businesses/${businessId}/creatives/${creativeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteCreative: (businessId: string, creativeId: string) =>
    apiRequest<void>(`/businesses/${businessId}/creatives/${creativeId}`, {
      method: 'DELETE',
    }),

  listAssets: (businessId: string) =>
    apiRequest<Asset[]>(`/businesses/${businessId}/assets`),

  uploadAsset: (businessId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);

    return apiRequest<Asset>(`/businesses/${businessId}/assets`, {
      method: 'POST',
      body,
    });
  },

  deleteAsset: (businessId: string, assetId: string) =>
    apiRequest<void>(`/businesses/${businessId}/assets/${assetId}`, {
      method: 'DELETE',
    }),

  assetContentUrl: (businessId: string, assetId: string) =>
    `${API_BASE_URL}/businesses/${businessId}/assets/${assetId}/content`,

  fetchAssetBlob: async (businessId: string, assetId: string): Promise<Blob> => {
    const headers = new Headers({ Accept: 'image/*' });
    const token = authToken.get();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(
      advertisingApi.assetContentUrl(businessId, assetId),
      { headers, credentials: 'include' },
    );

    if (!response.ok) {
      throw new Error(`Unable to load the image (status ${response.status})`);
    }

    return response.blob();
  },
};

export type { AdSetDetail, CampaignStatusHistoryEntry };
