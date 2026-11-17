import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AdvertisingEntityType } from '../../common/enums/advertising-entity-type.enum';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import { MetaDeliveryStatus } from '../../common/enums/meta-delivery-status.enum';
import { StatusChangeSource } from '../../common/enums/status-change-source.enum';
import { SyncDirection } from '../../common/enums/sync-direction.enum';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { AdSet } from '../../database/entities/ad-set.entity';
import { Advertisement } from '../../database/entities/advertisement.entity';
import { CampaignStatusHistory } from '../../database/entities/campaign-status-history.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { Creative } from '../../database/entities/creative.entity';
import { MetaReviewStatusHistory } from '../../database/entities/meta-review-status-history.entity';
import { PlatformSyncLog } from '../../database/entities/platform-sync-log.entity';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { BudgetsService } from '../budgets/budgets.service';
import { MetaIntegrationsService } from '../integrations/meta-integrations.service';
import { AdvertisingAssetsService } from './advertising-assets.service';
import type { CampaignDetailView } from './advertising.mappers';
import { AdvertisingService } from './advertising.service';
import type { CampaignApprovalPending } from './campaign-approval.types';
import { CampaignQueueService, type CampaignPublishJob } from './campaign-queue.service';
import {
  ADVERTISING_PROVIDER,
  type AdvertisingProvider,
} from './providers/advertising-provider.interface';

const MAX_ERROR_LENGTH = 500;
const toMinorUnits = (value: string | null): string | null =>
  value === null ? null : String(Math.round(Number(value) * 100));

interface RefreshableEntity {
  id: string;
  businessId: string;
  externalId: string | null;
  externalStatus: string | null;
  deliveryStatus: MetaDeliveryStatus;
  metaReviewStatus: Campaign['metaReviewStatus'];
  lastSyncedAt: Date | null;
}

@Injectable()
export class CampaignPublishingService {
  private readonly logger = new Logger(CampaignPublishingService.name);

  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(AdSet) private readonly adSets: Repository<AdSet>,
    @InjectRepository(Advertisement)
    private readonly advertisements: Repository<Advertisement>,
    @InjectRepository(Creative) private readonly creatives: Repository<Creative>,
    @InjectRepository(CampaignStatusHistory)
    private readonly statusHistory: Repository<CampaignStatusHistory>,
    @InjectRepository(MetaReviewStatusHistory)
    private readonly reviewHistory: Repository<MetaReviewStatusHistory>,
    @InjectRepository(PlatformSyncLog)
    private readonly syncLogs: Repository<PlatformSyncLog>,
    private readonly advertising: AdvertisingService,
    private readonly assets: AdvertisingAssetsService,
    private readonly integrations: MetaIntegrationsService,
    private readonly marketingQueue: CampaignQueueService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly budgets: BudgetsService,
    @Inject(ADVERTISING_PROVIDER) private readonly provider: AdvertisingProvider,
  ) {}

  /**
   * Public entry point. When the business enables the publish approval policy,
   * a requester without decision rights gets a pending approval instead of a
   * queued publish.
   */
  async startPublish(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    activate: boolean,
    context: RequestContext,
  ): Promise<CampaignDetailView | CampaignApprovalPending> {
    const campaign = await this.advertising.requireCampaign(businessId, campaignId);
    this.assertPublishable(campaign);

    const gate = await this.approvals.getGate(
      actorUserId,
      businessId,
      ApprovalTargetType.CAMPAIGN_PUBLISH,
    );

    if (!gate.required) {
      return this.publishNow(actorUserId, businessId, campaignId, activate, context);
    }

    const approval = await this.approvals.createRequest({
      actorUserId,
      businessId,
      targetType: ApprovalTargetType.CAMPAIGN_PUBLISH,
      targetId: campaign.id,
      targetLabel: campaign.name,
      payload: { campaignId: campaign.id, activate },
      note: activate ? 'Publish campaign as active' : 'Publish campaign as paused',
      context,
    });

    return { approvalRequired: true, approval, campaign: null };
  }

  /** Executes an approved publish (also used when no policy is enabled). */
  async publishNow(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    activate: boolean,
    context: RequestContext,
  ): Promise<CampaignDetailView> {
    const campaign = await this.advertising.requireCampaign(businessId, campaignId);
    this.assertPublishable(campaign);

    // Guard against accidental duplicate jobs while a publish is in flight.
    if (
      campaign.status === AdvertisingStatus.PUBLISHING &&
      Date.now() - campaign.updatedAt.getTime() < 2 * 60 * 1000
    ) {
      return this.advertising.getCampaign(businessId, campaignId);
    }

    if (campaign.status !== AdvertisingStatus.PUBLISHING) {
      const from = campaign.status;
      campaign.status = AdvertisingStatus.PUBLISHING;
      campaign.lastError = null;
      await this.campaigns.save(campaign);
      await this.recordStatus(
        campaign,
        from,
        AdvertisingStatus.PUBLISHING,
        actorUserId,
        activate ? 'Publishing to Meta as active' : 'Publishing to Meta as paused',
      );
      await this.audit.record({
        action: 'campaign.publish_requested',
        actorUserId,
        businessId,
        entityType: 'campaign',
        entityId: campaign.id,
        metadata: { activate },
        context,
      });
    }

    try {
      await this.marketingQueue.enqueuePublish({
        businessId,
        campaignId,
        actorUserId,
        activate,
        context,
      });
    } catch {
      campaign.status = AdvertisingStatus.ERROR;
      campaign.lastError = 'Unable to queue the publish job';
      await this.campaigns.save(campaign);
      await this.recordStatus(
        campaign,
        AdvertisingStatus.PUBLISHING,
        AdvertisingStatus.ERROR,
        actorUserId,
        'Unable to queue the publish job',
        StatusChangeSource.SYSTEM,
      );
      throw new ServiceUnavailableException('Unable to queue the publish job');
    }

    return this.advertising.getCampaign(businessId, campaignId);
  }

  private assertPublishable(campaign: Campaign): void {
    if (!campaign.adAccountExternalId) {
      throw new BadRequestException(
        'Link this campaign to a connected Meta ad account before publishing',
      );
    }

    if (campaign.status === AdvertisingStatus.ARCHIVED) {
      throw new BadRequestException('Archived campaigns cannot be published');
    }
  }

  /**
   * Publishes a campaign and its structure to Meta. External IDs are persisted
   * as soon as each Meta call succeeds, which makes retries idempotent. The
   * campaign is only marked published after every required call succeeds.
   */
  async publishCampaign(job: CampaignPublishJob): Promise<void> {
    const campaign = await this.campaigns.findOne({
      where: { id: job.campaignId, businessId: job.businessId },
    });

    if (!campaign || campaign.status === AdvertisingStatus.ARCHIVED) {
      return;
    }

    const fromStatus = campaign.status;
    const configuredStatus = job.activate ? 'ACTIVE' : 'PAUSED';
    const createdAdSetIds = new Set<string>();
    const createdAdIds = new Set<string>();

    try {
      if (!campaign.adAccountExternalId) {
        throw new Error('The campaign is not linked to a Meta ad account');
      }

      const token = await this.integrations.getAccessTokenForBusiness(job.businessId);
      const adAccountExternalId = campaign.adAccountExternalId;
      const [adSets, advertisements] = await Promise.all([
        this.adSets.find({
          where: { businessId: job.businessId, campaignId: campaign.id },
          order: { createdAt: 'ASC' },
        }),
        this.advertisements.find({
          where: { businessId: job.businessId },
          order: { createdAt: 'ASC' },
        }),
      ]);
      const adSetIds = new Set(adSets.map((adSet) => adSet.id));
      const campaignAds = advertisements.filter((ad) => adSetIds.has(ad.adSetId));
      const creativeIds = [
        ...new Set(
          campaignAds
            .map((ad) => ad.creativeId)
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      const creatives =
        creativeIds.length > 0
          ? await this.creatives.find({
              where: { businessId: job.businessId, id: In(creativeIds) },
              relations: { asset: true, page: true },
            })
          : [];

      if (!campaign.externalId) {
        const result = await this.provider.createCampaign({
          accessToken: token,
          adAccountExternalId,
          name: campaign.name,
          objective: campaign.objective,
          configuredStatus,
          specialAdCategories: campaign.specialAdCategories ?? [],
          dailyBudgetMinor: toMinorUnits(campaign.dailyBudget),
          lifetimeBudgetMinor: toMinorUnits(campaign.lifetimeBudget),
          startTime: campaign.startTime,
          stopTime: campaign.stopTime,
        });
        campaign.externalId = result.externalId;
        await this.campaigns.save(campaign);
        await this.logPush(
          campaign.businessId,
          AdvertisingEntityType.CAMPAIGN,
          campaign.id,
          SyncStatus.SUCCESS,
          'Campaign created on Meta',
          result.externalId,
        );
      }

      for (const creative of creatives) {
        await this.ensureCreative(creative, token, adAccountExternalId);
      }

      const campaignExternalId = campaign.externalId;

      if (!campaignExternalId) {
        throw new Error('Meta did not return a campaign identifier');
      }

      for (const adSet of adSets) {
        if (!adSet.externalId) {
          const result = await this.provider.createAdSet({
            accessToken: token,
            adAccountExternalId,
            campaignExternalId,
            name: adSet.name,
            configuredStatus,
            optimizationGoal: adSet.optimizationGoal,
            billingEvent: adSet.billingEvent,
            targeting: adSet.targeting,
            dailyBudgetMinor: toMinorUnits(adSet.dailyBudget),
            lifetimeBudgetMinor: toMinorUnits(adSet.lifetimeBudget),
            bidAmountMinor: toMinorUnits(adSet.bidAmount),
            startTime: adSet.startTime,
            endTime: adSet.endTime,
          });
          adSet.externalId = result.externalId;
          await this.adSets.save(adSet);
          createdAdSetIds.add(adSet.id);
          await this.logPush(
            campaign.businessId,
            AdvertisingEntityType.AD_SET,
            adSet.id,
            SyncStatus.SUCCESS,
            'Ad set created on Meta',
            result.externalId,
          );
        }
      }

      const creativeById = new Map(creatives.map((creative) => [creative.id, creative]));

      for (const advertisement of campaignAds) {
        if (advertisement.externalId) {
          continue;
        }

        const adSet = adSets.find((candidate) => candidate.id === advertisement.adSetId);
        const adSetExternalId = adSet?.externalId;

        if (!adSetExternalId) {
          throw new Error(`Ad set for "${advertisement.name}" is not published`);
        }

        const creative = advertisement.creativeId
          ? creativeById.get(advertisement.creativeId)
          : null;
        const creativeExternalId = creative?.externalId;

        if (!creativeExternalId) {
          throw new Error(`Advertisement "${advertisement.name}" needs a published creative`);
        }

        const result = await this.provider.createAd({
          accessToken: token,
          adAccountExternalId,
          adSetExternalId,
          name: advertisement.name,
          configuredStatus,
          creativeExternalId,
        });
        advertisement.externalId = result.externalId;
        await this.advertisements.save(advertisement);
        createdAdIds.add(advertisement.id);
        await this.logPush(
          campaign.businessId,
          AdvertisingEntityType.ADVERTISEMENT,
          advertisement.id,
          SyncStatus.SUCCESS,
          'Advertisement created on Meta',
          result.externalId,
        );
      }

      // Refresh Meta's review state before reporting success. Verification
      // failures are logged but do not invalidate a successful publish.
      await this.refreshEntity(campaign, AdvertisingEntityType.CAMPAIGN, token);
      for (const adSet of adSets) {
        await this.refreshEntity(adSet, AdvertisingEntityType.AD_SET, token);
      }
      for (const advertisement of campaignAds) {
        await this.refreshEntity(advertisement, AdvertisingEntityType.ADVERTISEMENT, token);
      }

      const now = new Date();
      const targetStatus = job.activate
        ? AdvertisingStatus.ACTIVE
        : AdvertisingStatus.PAUSED;

      for (const adSet of adSets) {
        if (createdAdSetIds.has(adSet.id) && adSet.status !== targetStatus) {
          adSet.status = targetStatus;
          adSet.publishedAt = adSet.publishedAt ?? now;
          await this.adSets.save(adSet);
        }
      }

      for (const advertisement of campaignAds) {
        if (createdAdIds.has(advertisement.id) && advertisement.status !== targetStatus) {
          advertisement.status = targetStatus;
          advertisement.publishedAt = advertisement.publishedAt ?? now;
          await this.advertisements.save(advertisement);
        }
      }

      campaign.status = targetStatus;
      campaign.publishedAt = campaign.publishedAt ?? now;
      campaign.lastSyncedAt = now;
      campaign.lastError = null;
      await this.campaigns.save(campaign);
      await this.recordStatus(
        campaign,
        fromStatus,
        targetStatus,
        null,
        'Meta accepted the campaign',
        StatusChangeSource.SYSTEM,
      );
      await this.logPush(
        job.businessId,
        AdvertisingEntityType.CAMPAIGN,
        campaign.id,
        SyncStatus.SUCCESS,
        'Campaign published',
        campaign.externalId,
      );
      await this.audit.record({
        action: 'campaign.published',
        actorUserId: job.actorUserId,
        businessId: job.businessId,
        entityType: 'campaign',
        entityId: campaign.id,
        metadata: { externalId: campaign.externalId, activate: job.activate },
        context: job.context,
      });
    } catch (error) {
      const message = this.describeError(error);
      campaign.status = AdvertisingStatus.ERROR;
      campaign.lastError = message.slice(0, MAX_ERROR_LENGTH);
      await this.campaigns.save(campaign);
      await this.recordStatus(
        campaign,
        fromStatus,
        AdvertisingStatus.ERROR,
        null,
        message,
        StatusChangeSource.SYSTEM,
      );
      await this.logPush(
        job.businessId,
        AdvertisingEntityType.CAMPAIGN,
        campaign.id,
        SyncStatus.FAILED,
        message,
        campaign.externalId,
      );
      await this.audit.record({
        action: 'campaign.publish_failed',
        actorUserId: job.actorUserId,
        businessId: job.businessId,
        entityType: 'campaign',
        entityId: campaign.id,
        metadata: { message },
        context: job.context,
      });
    }
  }

  async syncCampaign(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    context: RequestContext,
  ): Promise<CampaignDetailView> {
    const campaign = await this.advertising.requireCampaign(businessId, campaignId);

    if (!campaign.externalId) {
      throw new BadRequestException(
        'Publish this campaign to Meta before synchronising its status',
      );
    }

    const token = await this.integrations.getAccessTokenForBusiness(businessId);
    const [adSets, advertisements] = await Promise.all([
      this.adSets.find({ where: { businessId, campaignId }, order: { createdAt: 'ASC' } }),
      this.advertisements.find({ where: { businessId }, order: { createdAt: 'ASC' } }),
    ]);
    const campaignStatus = await this.refreshEntity(
      campaign,
      AdvertisingEntityType.CAMPAIGN,
      token,
    );

    if (!campaignStatus) {
      throw new BadGatewayException(
        'Meta did not return the campaign status. Try again shortly.',
      );
    }

    for (const adSet of adSets) {
      await this.refreshEntity(adSet, AdvertisingEntityType.AD_SET, token);
    }

    const adSetIds = new Set(adSets.map((adSet) => adSet.id));

    for (const advertisement of advertisements) {
      if (adSetIds.has(advertisement.adSetId)) {
        await this.refreshEntity(advertisement, AdvertisingEntityType.ADVERTISEMENT, token);
      }
    }

    await this.applyLocalStatus(campaign, actorUserId);
    await this.campaigns.save(campaign);
    await this.recordSpend(businessId, campaign, token);
    await this.syncLogs.insert({
      businessId,
      entityType: AdvertisingEntityType.CAMPAIGN,
      entityId: campaign.id,
      direction: SyncDirection.PULL,
      status: SyncStatus.SUCCESS,
      message: 'Campaign status synchronised',
    });
    await this.audit.record({
      action: 'campaign.synced',
      actorUserId,
      businessId,
      entityType: 'campaign',
      entityId: campaign.id,
      metadata: {
        externalStatus: campaign.externalStatus,
        metaReviewStatus: campaign.metaReviewStatus,
      },
      context,
    });

    return this.advertising.getCampaign(businessId, campaignId);
  }

  async syncAllCampaigns(
    actorUserId: string,
    businessId: string,
    context: RequestContext,
  ): Promise<{ synced: number; failed: number }> {
    const campaigns = await this.campaigns.find({
      where: { businessId, externalId: Not(IsNull()) },
    });
    let synced = 0;
    let failed = 0;

    for (const campaign of campaigns) {
      try {
        await this.syncCampaign(actorUserId, businessId, campaign.id, context);
        synced += 1;
      } catch {
        failed += 1;
      }
    }

    return { synced, failed };
  }

  private async ensureCreative(
    creative: Creative,
    token: string,
    adAccountExternalId: string,
  ): Promise<void> {
    if (!creative.pageExternalId) {
      throw new Error(`Creative "${creative.name}" needs a connected Meta page`);
    }

    if (!creative.imageHash) {
      if (!creative.asset) {
        throw new Error(`Creative "${creative.name}" needs an uploaded image`);
      }

      if (creative.asset.metaImageHash) {
        creative.imageHash = creative.asset.metaImageHash;
      } else {
        const buffer = await this.assets.read(creative.asset);

        try {
          const uploaded = await this.provider.uploadImage({
            accessToken: token,
            adAccountExternalId,
            buffer,
            filename: creative.asset.originalName,
            mimeType: creative.asset.mimeType,
          });
          creative.imageHash = uploaded.imageHash;
          await this.assets.markImageHash(creative.asset.id, uploaded.imageHash);
        } catch (error) {
          const message = this.describeError(error);
          await this.assets.markError(creative.asset.id, message);
          throw new Error(`Unable to upload the creative image: ${message}`);
        }
      }

      await this.creatives.save(creative);
    }

    if (!creative.externalId) {
      const result = await this.provider.createCreative({
        accessToken: token,
        adAccountExternalId,
        name: creative.name,
        pageExternalId: creative.pageExternalId,
        headline: creative.headline,
        primaryText: creative.primaryText,
        description: creative.description,
        callToAction: creative.callToAction,
        destinationUrl: creative.destinationUrl,
        imageHash: creative.imageHash,
      });
      creative.externalId = result.externalId;
      await this.creatives.save(creative);
      await this.logPush(
        creative.businessId,
        AdvertisingEntityType.CREATIVE,
        creative.id,
        SyncStatus.SUCCESS,
        'Creative created on Meta',
        result.externalId,
      );
    }
  }

  private async refreshEntity(
    entity: RefreshableEntity,
    entityType: AdvertisingEntityType,
    token: string,
  ): Promise<boolean> {
    if (!entity.externalId) {
      return false;
    }

    try {
      const mapped = await this.provider.getEntityStatus({
        accessToken: token,
        externalId: entity.externalId,
      });
      const previousReview = entity.metaReviewStatus;
      entity.externalStatus = mapped.externalStatus;
      entity.deliveryStatus = mapped.deliveryStatus;
      entity.metaReviewStatus = mapped.metaReviewStatus;
      entity.lastSyncedAt = new Date();
      await this.saveEntity(entity, entityType);

      if (previousReview !== mapped.metaReviewStatus) {
        await this.reviewHistory.insert({
          businessId: entity.businessId,
          entityType,
          entityId: entity.id,
          fromStatus: previousReview,
          toStatus: mapped.metaReviewStatus,
          message: mapped.externalStatus,
        });
      }

      await this.syncLogs.insert({
        businessId: entity.businessId,
        entityType,
        entityId: entity.id,
        direction: SyncDirection.PULL,
        status: SyncStatus.SUCCESS,
        message: `Meta status: ${mapped.externalStatus ?? 'unknown'}`,
      });

      return true;
    } catch (error) {
      await this.syncLogs.insert({
        businessId: entity.businessId,
        entityType,
        entityId: entity.id,
        direction: SyncDirection.PULL,
        status: SyncStatus.FAILED,
        message: this.describeError(error).slice(0, MAX_ERROR_LENGTH),
      });

      return false;
    }
  }

  /**
   * Best-effort spend capture during a campaign sync. A failed insights call or
   * missing currency never fails the status synchronisation itself.
   */
  private async recordSpend(
    businessId: string,
    campaign: Campaign,
    token: string,
  ): Promise<void> {
    if (!campaign.externalId) {
      return;
    }

    try {
      const spend = await this.provider.getSpend({
        accessToken: token,
        externalId: campaign.externalId,
        datePreset: 'this_month',
      });

      if (spend.spend === null) {
        return;
      }

      const currency = spend.currency ?? campaign.budgetCurrency;

      if (!currency) {
        return;
      }

      await this.budgets.recordCampaignSpend(
        businessId,
        campaign.id,
        spend.spend,
        currency,
        { externalId: campaign.externalId, datePreset: 'this_month' },
        toDate(spend.dateStart),
        toDate(spend.dateStop),
      );
    } catch (error) {
      this.logger.warn(
        `Unable to record Meta spend for campaign ${campaign.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async applyLocalStatus(
    campaign: Campaign,
    actorUserId: string,
  ): Promise<void> {
    const desired = statusFromDelivery(campaign.deliveryStatus);

    if (!desired || desired === campaign.status || campaign.status === AdvertisingStatus.ERROR) {
      campaign.lastSyncedAt = new Date();
      return;
    }

    const from = campaign.status;
    campaign.status = desired;
    campaign.lastSyncedAt = new Date();
    await this.recordStatus(
      campaign,
      from,
      desired,
      actorUserId,
      `Meta reports ${campaign.externalStatus ?? desired}`,
      StatusChangeSource.META,
    );
  }

  private async saveEntity(
    entity: RefreshableEntity,
    entityType: AdvertisingEntityType,
  ): Promise<void> {
    if (entityType === AdvertisingEntityType.CAMPAIGN) {
      await this.campaigns.save(entity as Campaign);
    } else if (entityType === AdvertisingEntityType.AD_SET) {
      await this.adSets.save(entity as AdSet);
    } else if (entityType === AdvertisingEntityType.ADVERTISEMENT) {
      await this.advertisements.save(entity as Advertisement);
    }
  }

  private async logPush(
    businessId: string,
    entityType: AdvertisingEntityType,
    entityId: string,
    status: SyncStatus,
    message: string,
    externalId: string | null,
  ): Promise<void> {
    await this.syncLogs.insert({
      businessId,
      entityType,
      entityId,
      direction: SyncDirection.PUSH,
      status,
      message: message.slice(0, MAX_ERROR_LENGTH),
      metadata: externalId ? { externalId } : null,
    });
  }

  private async recordStatus(
    campaign: Campaign,
    from: AdvertisingStatus | null,
    to: AdvertisingStatus,
    actorUserId: string | null,
    message: string | null,
    source = StatusChangeSource.INTERNAL,
  ): Promise<void> {
    await this.statusHistory.insert({
      businessId: campaign.businessId,
      campaignId: campaign.id,
      fromStatus: from,
      toStatus: to,
      source,
      actorUserId,
      message: message?.slice(0, MAX_ERROR_LENGTH) ?? null,
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown Meta API error';
  }
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function statusFromDelivery(delivery: MetaDeliveryStatus): AdvertisingStatus | null {
  switch (delivery) {
    case MetaDeliveryStatus.ACTIVE:
      return AdvertisingStatus.ACTIVE;
    case MetaDeliveryStatus.PAUSED:
      return AdvertisingStatus.PAUSED;
    case MetaDeliveryStatus.ARCHIVED:
    case MetaDeliveryStatus.DELETED:
      return AdvertisingStatus.ARCHIVED;
    default:
      return null;
  }
}
