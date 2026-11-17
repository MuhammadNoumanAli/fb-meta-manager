import type { AdvertisingObjective } from '../../common/enums/advertising-objective.enum';
import type { AdvertisingPlatform } from '../../common/enums/advertising-platform.enum';
import type { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import type { AdvertisingAssetStatus } from '../../common/enums/advertising-asset-status.enum';
import type { BillingEvent } from '../../common/enums/billing-event.enum';
import type { CreativeStatus } from '../../common/enums/creative-status.enum';
import type { MetaDeliveryStatus } from '../../common/enums/meta-delivery-status.enum';
import type { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';
import type { OptimizationGoal } from '../../common/enums/optimization-goal.enum';
import type { StatusChangeSource } from '../../common/enums/status-change-source.enum';
import type { AdSet } from '../../database/entities/ad-set.entity';
import type { Advertisement } from '../../database/entities/advertisement.entity';
import type { AdvertisingAsset } from '../../database/entities/advertising-asset.entity';
import type { CampaignStatusHistory } from '../../database/entities/campaign-status-history.entity';
import type { Campaign } from '../../database/entities/campaign.entity';
import type { Creative } from '../../database/entities/creative.entity';
import type { MetaReviewStatusHistory } from '../../database/entities/meta-review-status-history.entity';

const money = (value: string | null): number | null =>
  value === null ? null : Number(value);

export interface CampaignView {
  id: string;
  name: string;
  objective: AdvertisingObjective;
  platform: AdvertisingPlatform;
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
  startTime: Date | null;
  stopTime: Date | null;
  lastSyncedAt: Date | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdSetView {
  id: string;
  campaignId: string;
  name: string;
  platform: AdvertisingPlatform;
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
  startTime: Date | null;
  endTime: Date | null;
  lastSyncedAt: Date | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdvertisementView {
  id: string;
  adSetId: string;
  creativeId: string | null;
  name: string;
  platform: AdvertisingPlatform;
  status: AdvertisingStatus;
  adAccountId: string | null;
  adAccountExternalId: string | null;
  externalId: string | null;
  externalStatus: string | null;
  deliveryStatus: MetaDeliveryStatus;
  metaReviewStatus: MetaReviewStatus;
  lastSyncedAt: Date | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetView {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: AdvertisingAssetStatus;
  metaImageHash: string | null;
  lastError: string | null;
  contentUrl: string;
  createdAt: Date;
}

export interface CreativeView {
  id: string;
  name: string;
  platform: AdvertisingPlatform;
  status: CreativeStatus;
  pageId: string | null;
  pageExternalId: string | null;
  pageName: string | null;
  assetId: string | null;
  asset: AssetView | null;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  callToAction: string | null;
  destinationUrl: string | null;
  imageHash: string | null;
  externalId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignStatusHistoryView {
  id: string;
  fromStatus: AdvertisingStatus | null;
  toStatus: AdvertisingStatus;
  source: StatusChangeSource;
  message: string | null;
  createdAt: Date;
}

export interface MetaReviewHistoryView {
  id: string;
  entityType: string;
  entityId: string;
  fromStatus: MetaReviewStatus | null;
  toStatus: MetaReviewStatus;
  message: string | null;
  createdAt: Date;
}

export interface AdSetDetailView extends AdSetView {
  advertisements: AdvertisementView[];
}

export interface CampaignDetailView extends CampaignView {
  adSets: AdSetDetailView[];
  statusHistory: CampaignStatusHistoryView[];
  reviewHistory: MetaReviewHistoryView[];
}

export const toCampaignView = (campaign: Campaign): CampaignView => ({
  id: campaign.id,
  name: campaign.name,
  objective: campaign.objective,
  platform: campaign.platform,
  status: campaign.status,
  adAccountId: campaign.adAccountId,
  adAccountExternalId: campaign.adAccountExternalId,
  adAccountName: campaign.adAccount?.name ?? null,
  externalId: campaign.externalId,
  externalStatus: campaign.externalStatus,
  deliveryStatus: campaign.deliveryStatus,
  metaReviewStatus: campaign.metaReviewStatus,
  dailyBudget: money(campaign.dailyBudget),
  lifetimeBudget: money(campaign.lifetimeBudget),
  budgetCurrency: campaign.budgetCurrency,
  specialAdCategories: campaign.specialAdCategories ?? [],
  startTime: campaign.startTime,
  stopTime: campaign.stopTime,
  lastSyncedAt: campaign.lastSyncedAt,
  publishedAt: campaign.publishedAt,
  lastError: campaign.lastError,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});

export const toAdSetView = (adSet: AdSet): AdSetView => ({
  id: adSet.id,
  campaignId: adSet.campaignId,
  name: adSet.name,
  platform: adSet.platform,
  status: adSet.status,
  adAccountId: adSet.adAccountId,
  adAccountExternalId: adSet.adAccountExternalId,
  externalId: adSet.externalId,
  externalStatus: adSet.externalStatus,
  deliveryStatus: adSet.deliveryStatus,
  metaReviewStatus: adSet.metaReviewStatus,
  optimizationGoal: adSet.optimizationGoal,
  billingEvent: adSet.billingEvent,
  targeting: adSet.targeting,
  dailyBudget: money(adSet.dailyBudget),
  lifetimeBudget: money(adSet.lifetimeBudget),
  bidAmount: money(adSet.bidAmount),
  budgetCurrency: adSet.budgetCurrency,
  startTime: adSet.startTime,
  endTime: adSet.endTime,
  lastSyncedAt: adSet.lastSyncedAt,
  publishedAt: adSet.publishedAt,
  lastError: adSet.lastError,
  createdAt: adSet.createdAt,
  updatedAt: adSet.updatedAt,
});

export const toAdvertisementView = (ad: Advertisement): AdvertisementView => ({
  id: ad.id,
  adSetId: ad.adSetId,
  creativeId: ad.creativeId,
  name: ad.name,
  platform: ad.platform,
  status: ad.status,
  adAccountId: ad.adAccountId,
  adAccountExternalId: ad.adAccountExternalId,
  externalId: ad.externalId,
  externalStatus: ad.externalStatus,
  deliveryStatus: ad.deliveryStatus,
  metaReviewStatus: ad.metaReviewStatus,
  lastSyncedAt: ad.lastSyncedAt,
  publishedAt: ad.publishedAt,
  lastError: ad.lastError,
  createdAt: ad.createdAt,
  updatedAt: ad.updatedAt,
});

export const toAssetView = (asset: AdvertisingAsset): AssetView => ({
  id: asset.id,
  originalName: asset.originalName,
  mimeType: asset.mimeType,
  sizeBytes: asset.sizeBytes,
  checksum: asset.checksum,
  status: asset.status,
  metaImageHash: asset.metaImageHash,
  lastError: asset.lastError,
  contentUrl: `/api/v1/businesses/${asset.businessId}/assets/${asset.id}/content`,
  createdAt: asset.createdAt,
});

export const toCreativeView = (creative: Creative): CreativeView => ({
  id: creative.id,
  name: creative.name,
  platform: creative.platform,
  status: creative.status,
  pageId: creative.pageId,
  pageExternalId: creative.pageExternalId,
  pageName: creative.page?.name ?? null,
  assetId: creative.assetId,
  asset: creative.asset ? toAssetView(creative.asset) : null,
  headline: creative.headline,
  primaryText: creative.primaryText,
  description: creative.description,
  callToAction: creative.callToAction,
  destinationUrl: creative.destinationUrl,
  imageHash: creative.imageHash,
  externalId: creative.externalId,
  lastError: creative.lastError,
  createdAt: creative.createdAt,
  updatedAt: creative.updatedAt,
});

export const toStatusHistoryView = (
  entry: CampaignStatusHistory,
): CampaignStatusHistoryView => ({
  id: entry.id,
  fromStatus: entry.fromStatus,
  toStatus: entry.toStatus,
  source: entry.source,
  message: entry.message,
  createdAt: entry.createdAt,
});

export const toReviewHistoryView = (
  entry: MetaReviewStatusHistory,
): MetaReviewHistoryView => ({
  id: entry.id,
  entityType: entry.entityType,
  entityId: entry.entityId,
  fromStatus: entry.fromStatus,
  toStatus: entry.toStatus,
  message: entry.message,
  createdAt: entry.createdAt,
});
