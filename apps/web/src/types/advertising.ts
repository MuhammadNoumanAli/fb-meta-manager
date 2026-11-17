export type AdvertisingObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_APP_PROMOTION'
  | 'OUTCOME_SALES';

export type AdvertisingStatus = 'draft' | 'publishing' | 'active' | 'paused' | 'archived' | 'error';

export type ActiveAdvertisingStatus = Extract<AdvertisingStatus, 'active' | 'paused' | 'archived'>;

export type MetaDeliveryStatus =
  | 'unknown'
  | 'active'
  | 'paused'
  | 'archived'
  | 'deleted'
  | 'pending_billing_info'
  | 'in_process'
  | 'with_issues';

export type MetaReviewStatus = 'unknown' | 'in_review' | 'approved' | 'rejected' | 'disabled';

export type OptimizationGoal =
  | 'NONE'
  | 'REACH'
  | 'IMPRESSIONS'
  | 'LINK_CLICKS'
  | 'LANDING_PAGE_VIEWS'
  | 'POST_ENGAGEMENT'
  | 'CONVERSATIONS'
  | 'LEAD_GENERATION'
  | 'VALUE'
  | 'OFFSITE_CONVERSIONS';

export type BillingEvent = 'IMPRESSIONS' | 'LINK_CLICKS' | 'POST_ENGAGEMENT' | 'THRUPLAY';

export type CreativeStatus = 'draft' | 'ready' | 'error' | 'archived';

export type AdvertisingAssetStatus = 'uploaded' | 'ready' | 'error';

export interface Campaign {
  id: string;
  name: string;
  objective: AdvertisingObjective;
  platform: string;
  status: AdvertisingStatus;
  adAccountId: string | null;
  adAccountExternalId: string | null;
  adAccountName: string | null;
  externalId: string | null;
  externalStatus: string | null;
  deliveryStatus: MetaDeliveryStatus;
  metaReviewStatus: MetaReviewStatus;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  budgetCurrency: string | null;
  specialAdCategories: string[];
  startTime: string | null;
  stopTime: string | null;
  lastSyncedAt: string | null;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  platform: string;
  status: AdvertisingStatus;
  adAccountId: string | null;
  adAccountExternalId: string | null;
  externalId: string | null;
  externalStatus: string | null;
  deliveryStatus: MetaDeliveryStatus;
  metaReviewStatus: MetaReviewStatus;
  optimizationGoal: OptimizationGoal;
  billingEvent: BillingEvent;
  targeting: Record<string, unknown> | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  bidAmount: number | null;
  budgetCurrency: string | null;
  startTime: string | null;
  endTime: string | null;
  lastSyncedAt: string | null;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Advertisement {
  id: string;
  adSetId: string;
  creativeId: string | null;
  name: string;
  platform: string;
  status: AdvertisingStatus;
  adAccountId: string | null;
  adAccountExternalId: string | null;
  externalId: string | null;
  externalStatus: string | null;
  deliveryStatus: MetaDeliveryStatus;
  metaReviewStatus: MetaReviewStatus;
  lastSyncedAt: string | null;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: AdvertisingAssetStatus;
  metaImageHash: string | null;
  lastError: string | null;
  contentUrl: string;
  createdAt: string;
}

export interface Creative {
  id: string;
  name: string;
  platform: string;
  status: CreativeStatus;
  pageId: string | null;
  pageExternalId: string | null;
  pageName: string | null;
  assetId: string | null;
  asset: Asset | null;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  callToAction: string | null;
  destinationUrl: string | null;
  imageHash: string | null;
  externalId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStatusHistoryEntry {
  id: string;
  fromStatus: AdvertisingStatus | null;
  toStatus: AdvertisingStatus;
  source: 'internal' | 'meta' | 'system';
  message: string | null;
  createdAt: string;
}

export interface MetaReviewHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  fromStatus: MetaReviewStatus | null;
  toStatus: MetaReviewStatus;
  message: string | null;
  createdAt: string;
}

export interface AdSetDetail extends AdSet {
  advertisements: Advertisement[];
}

export interface CampaignDetail extends Campaign {
  adSets: AdSetDetail[];
  statusHistory: CampaignStatusHistoryEntry[];
  reviewHistory: MetaReviewHistoryEntry[];
}

export interface PagedAdvertisingResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CampaignInput {
  name: string;
  objective: AdvertisingObjective;
  adAccountId?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  specialAdCategories?: string[];
  startTime?: string;
  stopTime?: string;
}

export interface AdSetInput {
  name: string;
  optimizationGoal: OptimizationGoal;
  billingEvent: BillingEvent;
  targeting?: Record<string, unknown>;
  dailyBudget?: number;
  lifetimeBudget?: number;
  bidAmount?: number;
  startTime?: string;
  endTime?: string;
}

export interface AdvertisementInput {
  name: string;
  creativeId?: string | null;
}

export interface CreativeInput {
  name: string;
  pageId?: string | null;
  assetId?: string | null;
  headline?: string | null;
  primaryText?: string | null;
  description?: string | null;
  callToAction?: string | null;
  destinationUrl?: string | null;
}

export interface SyncAllResult {
  synced: number;
  failed: number;
}
