import type { AdvertisingPlatform } from '../../../common/enums/advertising-platform.enum';
import type { MappedMetaStatus } from '../meta-status.mapper';

export const ADVERTISING_PROVIDER = Symbol('ADVERTISING_PROVIDER');

export interface ProviderEntityResult {
  externalId: string;
}

export type ProviderStatusResult = MappedMetaStatus;

interface BaseContext {
  accessToken: string;
  adAccountExternalId: string;
}

export interface CreateCampaignInput extends BaseContext {
  name: string;
  objective: string;
  /** Meta configured status: ACTIVE or PAUSED. */
  configuredStatus: 'ACTIVE' | 'PAUSED';
  specialAdCategories: string[];
  dailyBudgetMinor: string | null;
  lifetimeBudgetMinor: string | null;
  startTime: Date | null;
  stopTime: Date | null;
}

export interface CreateAdSetInput extends BaseContext {
  campaignExternalId: string;
  name: string;
  configuredStatus: 'ACTIVE' | 'PAUSED';
  optimizationGoal: string;
  billingEvent: string;
  targeting: Record<string, unknown> | null;
  dailyBudgetMinor: string | null;
  lifetimeBudgetMinor: string | null;
  bidAmountMinor: string | null;
  startTime: Date | null;
  endTime: Date | null;
}

export interface CreateAdInput extends BaseContext {
  adSetExternalId: string;
  name: string;
  configuredStatus: 'ACTIVE' | 'PAUSED';
  creativeExternalId: string;
}

export interface CreateCreativeInput extends BaseContext {
  name: string;
  pageExternalId: string;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  callToAction: string | null;
  destinationUrl: string | null;
  imageHash: string | null;
}

export interface UpdateAdvertisingEntityInput extends BaseContext {
  externalId: string;
  /** Only the fields supported by the corresponding Graph endpoint. */
  fields: Record<string, string | number>;
}

export interface EntityStatusInput {
  accessToken: string;
  externalId: string;
}

export interface UploadImageInput extends BaseContext {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface UploadImageResult {
  imageHash: string;
}

export interface EntitySpendInput {
  accessToken: string;
  externalId: string;
  datePreset?: string;
}

export interface ProviderSpendResult {
  spend: number | null;
  currency: string | null;
  dateStart: string | null;
  dateStop: string | null;
}

/**
 * Advertising provider boundary. Meta-specific Graph calls stay inside the
 * implementation so campaign services remain provider-agnostic.
 */
export interface AdvertisingProvider {
  readonly platform: AdvertisingPlatform;

  createCampaign(input: CreateCampaignInput): Promise<ProviderEntityResult>;
  updateCampaign(input: UpdateAdvertisingEntityInput): Promise<void>;
  createAdSet(input: CreateAdSetInput): Promise<ProviderEntityResult>;
  updateAdSet(input: UpdateAdvertisingEntityInput): Promise<void>;
  createAd(input: CreateAdInput): Promise<ProviderEntityResult>;
  updateAd(input: UpdateAdvertisingEntityInput): Promise<void>;
  createCreative(input: CreateCreativeInput): Promise<ProviderEntityResult>;
  getEntityStatus(input: EntityStatusInput): Promise<ProviderStatusResult>;
  getSpend(input: EntitySpendInput): Promise<ProviderSpendResult>;
  uploadImage(input: UploadImageInput): Promise<UploadImageResult>;
}
