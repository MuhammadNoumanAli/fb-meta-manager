import { Injectable } from '@nestjs/common';
import { AdvertisingPlatform } from '../../../common/enums/advertising-platform.enum';
import { MetaGraphClient } from '../../integrations/meta-graph.client';
import { mapMetaStatus } from '../meta-status.mapper';
import type {
  AdvertisingProvider,
  CreateAdInput,
  CreateAdSetInput,
  CreateCampaignInput,
  CreateCreativeInput,
  EntityStatusInput,
  ProviderEntityResult,
  ProviderStatusResult,
  UpdateAdvertisingEntityInput,
  UploadImageInput,
  UploadImageResult,
} from './advertising-provider.interface';

const iso = (value: Date | null): string | undefined =>
  value ? value.toISOString() : undefined;

const compact = (
  entries: Record<string, string | number | undefined>,
): Record<string, string | number> => {
  const result: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
};

@Injectable()
export class MetaAdvertisingProvider implements AdvertisingProvider {
  readonly platform = AdvertisingPlatform.META;

  constructor(private readonly graphClient: MetaGraphClient) {}

  async createCampaign(input: CreateCampaignInput): Promise<ProviderEntityResult> {
    const result = await this.graphClient.createCampaign(
      input.accessToken,
      input.adAccountExternalId,
      compact({
        name: input.name,
        objective: input.objective,
        status: input.configuredStatus,
        special_ad_categories: JSON.stringify(input.specialAdCategories),
        daily_budget: input.dailyBudgetMinor ?? undefined,
        lifetime_budget: input.lifetimeBudgetMinor ?? undefined,
        start_time: iso(input.startTime),
        stop_time: iso(input.stopTime),
      }),
    );

    return { externalId: result.id };
  }

  async updateCampaign(input: UpdateAdvertisingEntityInput): Promise<void> {
    await this.graphClient.updateAdvertisingEntity(
      input.accessToken,
      input.externalId,
      input.fields,
    );
  }

  async createAdSet(input: CreateAdSetInput): Promise<ProviderEntityResult> {
    const result = await this.graphClient.createAdSet(
      input.accessToken,
      input.adAccountExternalId,
      compact({
        name: input.name,
        campaign_id: input.campaignExternalId,
        status: input.configuredStatus,
        optimization_goal: input.optimizationGoal,
        billing_event: input.billingEvent,
        targeting: input.targeting ? JSON.stringify(input.targeting) : undefined,
        daily_budget: input.dailyBudgetMinor ?? undefined,
        lifetime_budget: input.lifetimeBudgetMinor ?? undefined,
        bid_amount: input.bidAmountMinor ?? undefined,
        start_time: iso(input.startTime),
        end_time: iso(input.endTime),
      }),
    );

    return { externalId: result.id };
  }

  async updateAdSet(input: UpdateAdvertisingEntityInput): Promise<void> {
    await this.graphClient.updateAdvertisingEntity(
      input.accessToken,
      input.externalId,
      input.fields,
    );
  }

  async createAd(input: CreateAdInput): Promise<ProviderEntityResult> {
    const result = await this.graphClient.createAd(
      input.accessToken,
      input.adAccountExternalId,
      compact({
        name: input.name,
        adset_id: input.adSetExternalId,
        status: input.configuredStatus,
        creative: JSON.stringify({ creative_id: input.creativeExternalId }),
      }),
    );

    return { externalId: result.id };
  }

  async updateAd(input: UpdateAdvertisingEntityInput): Promise<void> {
    await this.graphClient.updateAdvertisingEntity(
      input.accessToken,
      input.externalId,
      input.fields,
    );
  }

  async createCreative(input: CreateCreativeInput): Promise<ProviderEntityResult> {
    const linkData = compact({
      message: input.primaryText ?? undefined,
      name: input.headline ?? undefined,
      description: input.description ?? undefined,
      link: input.destinationUrl ?? undefined,
      image_hash: input.imageHash ?? undefined,
    });

    if (input.callToAction && input.destinationUrl) {
      linkData.call_to_action = JSON.stringify({
        type: input.callToAction,
        value: { link: input.destinationUrl },
      });
    }

    const result = await this.graphClient.createCreative(
      input.accessToken,
      input.adAccountExternalId,
      {
        name: input.name,
        object_story_spec: JSON.stringify({
          page_id: input.pageExternalId,
          link_data: linkData,
        }),
      },
    );

    return { externalId: result.id };
  }

  async getEntityStatus(input: EntityStatusInput): Promise<ProviderStatusResult> {
    const snapshot = await this.graphClient.getAdvertisingStatus(
      input.accessToken,
      input.externalId,
    );

    return mapMetaStatus(snapshot);
  }

  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    const result = await this.graphClient.uploadAdImage(
      input.accessToken,
      input.adAccountExternalId,
      {
        buffer: input.buffer,
        filename: input.filename,
        mimeType: input.mimeType,
      },
    );

    return { imageHash: result.hash };
  }
}
