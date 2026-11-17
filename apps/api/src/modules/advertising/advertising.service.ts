import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdvertisingEntityType } from '../../common/enums/advertising-entity-type.enum';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import { CreativeStatus } from '../../common/enums/creative-status.enum';
import { StatusChangeSource } from '../../common/enums/status-change-source.enum';
import { SyncDirection } from '../../common/enums/sync-direction.enum';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { AdSet } from '../../database/entities/ad-set.entity';
import { Advertisement } from '../../database/entities/advertisement.entity';
import { AdvertisingAsset } from '../../database/entities/advertising-asset.entity';
import { Business } from '../../database/entities/business.entity';
import { CampaignStatusHistory } from '../../database/entities/campaign-status-history.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { Creative } from '../../database/entities/creative.entity';
import { MetaAdAccount } from '../../database/entities/meta-ad-account.entity';
import { MetaReviewStatusHistory } from '../../database/entities/meta-review-status-history.entity';
import { MetaPage } from '../../database/entities/meta-page.entity';
import { PlatformSyncLog } from '../../database/entities/platform-sync-log.entity';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { MetaGraphError } from '../integrations/meta-graph.client';
import { MetaIntegrationsService } from '../integrations/meta-integrations.service';
import {
  toAdSetView,
  toAdvertisementView,
  toCampaignView,
  toCreativeView,
  toReviewHistoryView,
  toStatusHistoryView,
  type AdSetView,
  type AdvertisementView,
  type CampaignDetailView,
  type CampaignView,
  type CreativeView,
} from './advertising.mappers';
import { CreateAdSetDto } from './dto/create-ad-set.dto';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateCreativeDto } from './dto/create-creative.dto';
import { ListAdvertisingQueryDto } from './dto/list-advertising-query.dto';
import { UpdateAdSetDto } from './dto/update-ad-set.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import { UpdateAdvertisingStatusDto } from './dto/update-advertising-status.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';
import {
  ADVERTISING_PROVIDER,
  type AdvertisingProvider,
} from './providers/advertising-provider.interface';
import type { CampaignApprovalPending } from './campaign-approval.types';

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_ERROR_LENGTH = 500;
const toMoney = (value: number | null | undefined): string | null =>
  value === null || value === undefined ? null : value.toFixed(2);
const toDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

@Injectable()
export class AdvertisingService {
  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(AdSet) private readonly adSets: Repository<AdSet>,
    @InjectRepository(Advertisement)
    private readonly advertisements: Repository<Advertisement>,
    @InjectRepository(Creative) private readonly creatives: Repository<Creative>,
    @InjectRepository(AdvertisingAsset)
    private readonly assets: Repository<AdvertisingAsset>,
    @InjectRepository(CampaignStatusHistory)
    private readonly statusHistory: Repository<CampaignStatusHistory>,
    @InjectRepository(MetaReviewStatusHistory)
    private readonly reviewHistory: Repository<MetaReviewStatusHistory>,
    @InjectRepository(PlatformSyncLog)
    private readonly syncLogs: Repository<PlatformSyncLog>,
    @InjectRepository(MetaAdAccount)
    private readonly adAccounts: Repository<MetaAdAccount>,
    @InjectRepository(MetaPage) private readonly pages: Repository<MetaPage>,
    @InjectRepository(Business) private readonly businesses: Repository<Business>,
    private readonly integrations: MetaIntegrationsService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    @Inject(ADVERTISING_PROVIDER) private readonly provider: AdvertisingProvider,
  ) {}

  async listCampaigns(
    businessId: string,
    query: ListAdvertisingQueryDto,
  ): Promise<PagedResult<CampaignView>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
    const builder = this.campaigns
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.adAccount', 'adAccount')
      .where('campaign.businessId = :businessId', { businessId })
      .orderBy('campaign.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      builder.andWhere('campaign.status = :status', { status: query.status });
    }

    if (query.search) {
      builder.andWhere('LOWER(campaign.name) LIKE :search', {
        search: `%${query.search.toLowerCase()}%`,
      });
    }

    const [items, total] = await builder.getManyAndCount();

    return { items: items.map(toCampaignView), total, page, pageSize };
  }

  async getCampaign(businessId: string, campaignId: string): Promise<CampaignDetailView> {
    const campaign = await this.requireCampaign(businessId, campaignId);
    const adSets = await this.adSets.find({
      where: { businessId, campaignId },
      order: { createdAt: 'ASC' },
    });
    const advertisements =
      adSets.length > 0
        ? await this.advertisements.find({
            where: { businessId, adSetId: In(adSets.map((adSet) => adSet.id)) },
            order: { createdAt: 'ASC' },
          })
        : [];
    const [statusEntries, reviewEntries] = await Promise.all([
      this.statusHistory.find({
        where: { businessId, campaignId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.reviewHistory.find({
        where: [
          {
            businessId,
            entityType: AdvertisingEntityType.CAMPAIGN,
            entityId: campaignId,
          },
          ...(adSets.length > 0
            ? [
                {
                  businessId,
                  entityType: AdvertisingEntityType.AD_SET,
                  entityId: In(adSets.map((adSet) => adSet.id)),
                },
              ]
            : []),
          ...(advertisements.length > 0
            ? [
                {
                  businessId,
                  entityType: AdvertisingEntityType.ADVERTISEMENT,
                  entityId: In(advertisements.map((ad) => ad.id)),
                },
              ]
            : []),
        ],
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    ]);
    const adsBySet = new Map<string, AdvertisementView[]>();

    for (const advertisement of advertisements) {
      const list = adsBySet.get(advertisement.adSetId) ?? [];
      list.push(toAdvertisementView(advertisement));
      adsBySet.set(advertisement.adSetId, list);
    }

    return {
      ...toCampaignView(campaign),
      adSets: adSets.map((adSet) => ({
        ...toAdSetView(adSet),
        advertisements: adsBySet.get(adSet.id) ?? [],
      })),
      statusHistory: statusEntries.map(toStatusHistoryView),
      reviewHistory: reviewEntries.map(toReviewHistoryView),
    };
  }

  async createCampaign(
    actorUserId: string,
    businessId: string,
    dto: CreateCampaignDto,
    context: RequestContext,
  ): Promise<CampaignView> {
    const account = await this.resolveAdAccount(businessId, dto);
    const business = await this.businesses.findOne({ where: { id: businessId } });
    const campaign = await this.campaigns.save(
      this.campaigns.create({
        businessId,
        adAccountId: account.id,
        adAccountExternalId: account.externalId,
        name: dto.name.trim(),
        objective: dto.objective,
        status: AdvertisingStatus.DRAFT,
        dailyBudget: toMoney(dto.dailyBudget),
        lifetimeBudget: toMoney(dto.lifetimeBudget),
        budgetCurrency: account.currency ?? business?.currency ?? null,
        specialAdCategories: dto.specialAdCategories ?? [],
        startTime: toDate(dto.startTime),
        stopTime: toDate(dto.stopTime),
        createdByUserId: actorUserId,
      }),
    );
    await this.recordStatus(campaign, null, AdvertisingStatus.DRAFT, actorUserId, null);
    await this.audit.record({
      action: 'campaign.created',
      actorUserId,
      businessId,
      entityType: 'campaign',
      entityId: campaign.id,
      metadata: { name: campaign.name, objective: campaign.objective },
      context,
    });

    return toCampaignView(campaign);
  }

  async updateCampaign(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
    context: RequestContext,
  ): Promise<CampaignView> {
    const campaign = await this.requireCampaign(businessId, campaignId);
    this.assertEditable(campaign);

    if (dto.name !== undefined) {
      campaign.name = dto.name.trim();
    }

    if (dto.objective !== undefined) {
      campaign.objective = dto.objective;
    }

    if (dto.dailyBudget !== undefined) {
      campaign.dailyBudget = toMoney(dto.dailyBudget);
    }

    if (dto.lifetimeBudget !== undefined) {
      campaign.lifetimeBudget = toMoney(dto.lifetimeBudget);
    }

    if (dto.specialAdCategories !== undefined) {
      campaign.specialAdCategories = dto.specialAdCategories;
    }

    if (dto.startTime !== undefined) {
      campaign.startTime = toDate(dto.startTime);
    }

    if (dto.stopTime !== undefined) {
      campaign.stopTime = toDate(dto.stopTime);
    }

    await this.campaigns.save(campaign);
    await this.audit.record({
      action: 'campaign.updated',
      actorUserId,
      businessId,
      entityType: 'campaign',
      entityId: campaign.id,
      metadata: { fields: Object.keys(dto) },
      context,
    });

    return toCampaignView(campaign);
  }

  async deleteCampaign(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    context: RequestContext,
  ): Promise<void> {
    const campaign = await this.requireCampaign(businessId, campaignId);

    if (campaign.externalId) {
      throw new BadRequestException(
        'Campaigns published to Meta must be archived instead of deleted',
      );
    }

    await this.campaigns.remove(campaign);
    await this.audit.record({
      action: 'campaign.deleted',
      actorUserId,
      businessId,
      entityType: 'campaign',
      entityId: campaignId,
      context,
    });
  }

  /**
   * Public status change. Restricted changes become a pending approval when
   * the business enables the status policy and the actor cannot decide.
   */
  async updateCampaignStatus(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    dto: UpdateAdvertisingStatusDto,
    context: RequestContext,
  ): Promise<CampaignView | CampaignApprovalPending> {
    const campaign = await this.requireCampaign(businessId, campaignId);

    if (campaign.status === dto.status) {
      return toCampaignView(campaign);
    }

    const gate = await this.approvals.getGate(
      actorUserId,
      businessId,
      ApprovalTargetType.CAMPAIGN_STATUS,
    );

    if (!gate.required) {
      return this.applyStatusChange(actorUserId, businessId, campaignId, dto.status, context);
    }

    const approval = await this.approvals.createRequest({
      actorUserId,
      businessId,
      targetType: ApprovalTargetType.CAMPAIGN_STATUS,
      targetId: campaign.id,
      targetLabel: campaign.name,
      payload: { campaignId: campaign.id, status: dto.status },
      note: `Change campaign status from ${campaign.status} to ${dto.status}`,
      context,
    });

    return { approvalRequired: true, approval, campaign: null };
  }

  /** Applies a status change (also used when an approved request executes). */
  async applyStatusChange(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    status: AdvertisingStatus,
    context: RequestContext,
  ): Promise<CampaignView> {
    const campaign = await this.requireCampaign(businessId, campaignId);

    if (campaign.status === status) {
      return toCampaignView(campaign);
    }

    if (campaign.externalId) {
      await this.pushStatus(
        businessId,
        campaign.adAccountExternalId,
        campaign.externalId,
        status,
        AdvertisingEntityType.CAMPAIGN,
        campaign.id,
      );
    }

    const from = campaign.status;
    campaign.status = status;
    campaign.lastError = null;
    await this.campaigns.save(campaign);
    await this.recordStatus(campaign, from, status, actorUserId, null);
    await this.audit.record({
      action: 'campaign.status_changed',
      actorUserId,
      businessId,
      entityType: 'campaign',
      entityId: campaign.id,
      metadata: { from, to: status },
      context,
    });

    return toCampaignView(campaign);
  }

  async listAdSets(
    businessId: string,
    query: ListAdvertisingQueryDto,
  ): Promise<PagedResult<AdSetView>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 100);
    const where: Record<string, unknown> = { businessId };

    if (query.campaignId) {
      where.campaignId = query.campaignId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.adSets.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items: items.map(toAdSetView), total, page, pageSize };
  }

  async createAdSet(
    actorUserId: string,
    businessId: string,
    campaignId: string,
    dto: CreateAdSetDto,
    context: RequestContext,
  ): Promise<AdSetView> {
    const campaign = await this.requireCampaign(businessId, campaignId);
    const adSet = await this.adSets.save(
      this.adSets.create({
        businessId,
        campaignId: campaign.id,
        adAccountId: campaign.adAccountId,
        adAccountExternalId: campaign.adAccountExternalId,
        name: dto.name.trim(),
        optimizationGoal: dto.optimizationGoal,
        billingEvent: dto.billingEvent,
        targeting: dto.targeting ?? null,
        dailyBudget: toMoney(dto.dailyBudget),
        lifetimeBudget: toMoney(dto.lifetimeBudget),
        bidAmount: toMoney(dto.bidAmount),
        budgetCurrency: campaign.budgetCurrency,
        startTime: toDate(dto.startTime),
        endTime: toDate(dto.endTime),
        createdByUserId: actorUserId,
      }),
    );
    await this.audit.record({
      action: 'ad_set.created',
      actorUserId,
      businessId,
      entityType: 'ad_set',
      entityId: adSet.id,
      metadata: { campaignId },
      context,
    });

    return toAdSetView(adSet);
  }

  async updateAdSet(
    actorUserId: string,
    businessId: string,
    adSetId: string,
    dto: UpdateAdSetDto,
    context: RequestContext,
  ): Promise<AdSetView> {
    const adSet = await this.requireAdSet(businessId, adSetId);
    this.assertEditable(adSet);

    if (dto.name !== undefined) {
      adSet.name = dto.name.trim();
    }

    if (dto.optimizationGoal !== undefined) {
      adSet.optimizationGoal = dto.optimizationGoal;
    }

    if (dto.billingEvent !== undefined) {
      adSet.billingEvent = dto.billingEvent;
    }

    if (dto.targeting !== undefined) {
      adSet.targeting = dto.targeting;
    }

    if (dto.dailyBudget !== undefined) {
      adSet.dailyBudget = toMoney(dto.dailyBudget);
    }

    if (dto.lifetimeBudget !== undefined) {
      adSet.lifetimeBudget = toMoney(dto.lifetimeBudget);
    }

    if (dto.bidAmount !== undefined) {
      adSet.bidAmount = toMoney(dto.bidAmount);
    }

    if (dto.startTime !== undefined) {
      adSet.startTime = toDate(dto.startTime);
    }

    if (dto.endTime !== undefined) {
      adSet.endTime = toDate(dto.endTime);
    }

    await this.adSets.save(adSet);
    await this.audit.record({
      action: 'ad_set.updated',
      actorUserId,
      businessId,
      entityType: 'ad_set',
      entityId: adSet.id,
      metadata: { fields: Object.keys(dto) },
      context,
    });

    return toAdSetView(adSet);
  }

  async deleteAdSet(
    actorUserId: string,
    businessId: string,
    adSetId: string,
    context: RequestContext,
  ): Promise<void> {
    const adSet = await this.requireAdSet(businessId, adSetId);

    if (adSet.externalId) {
      throw new BadRequestException(
        'Ad sets published to Meta must be archived instead of deleted',
      );
    }

    await this.adSets.remove(adSet);
    await this.audit.record({
      action: 'ad_set.deleted',
      actorUserId,
      businessId,
      entityType: 'ad_set',
      entityId: adSetId,
      context,
    });
  }

  async updateAdSetStatus(
    actorUserId: string,
    businessId: string,
    adSetId: string,
    dto: UpdateAdvertisingStatusDto,
    context: RequestContext,
  ): Promise<AdSetView> {
    const adSet = await this.requireAdSet(businessId, adSetId);

    if (adSet.status === dto.status) {
      return toAdSetView(adSet);
    }

    if (adSet.externalId) {
      await this.pushStatus(
        businessId,
        adSet.adAccountExternalId,
        adSet.externalId,
        dto.status,
        AdvertisingEntityType.AD_SET,
        adSet.id,
      );
    }

    adSet.status = dto.status;
    adSet.lastError = null;
    await this.adSets.save(adSet);
    await this.audit.record({
      action: 'ad_set.status_changed',
      actorUserId,
      businessId,
      entityType: 'ad_set',
      entityId: adSet.id,
      metadata: { to: dto.status },
      context,
    });

    return toAdSetView(adSet);
  }

  async getAdvertisement(
    businessId: string,
    advertisementId: string,
  ): Promise<AdvertisementView> {
    return toAdvertisementView(
      await this.requireAdvertisement(businessId, advertisementId),
    );
  }

  async listAdvertisements(
    businessId: string,
    query: ListAdvertisingQueryDto,
  ): Promise<PagedResult<AdvertisementView>> {    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 100);
    const where: Record<string, unknown> = { businessId };

    if (query.adSetId) {
      where.adSetId = query.adSetId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.advertisements.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items: items.map(toAdvertisementView), total, page, pageSize };
  }

  async createAdvertisement(
    actorUserId: string,
    businessId: string,
    adSetId: string,
    dto: CreateAdvertisementDto,
    context: RequestContext,
  ): Promise<AdvertisementView> {
    const adSet = await this.requireAdSet(businessId, adSetId);
    const creative = dto.creativeId
      ? await this.requireCreative(businessId, dto.creativeId)
      : null;
    const advertisement = await this.advertisements.save(
      this.advertisements.create({
        businessId,
        adSetId: adSet.id,
        creativeId: creative?.id ?? null,
        adAccountId: adSet.adAccountId,
        adAccountExternalId: adSet.adAccountExternalId,
        name: dto.name.trim(),
        createdByUserId: actorUserId,
      }),
    );
    await this.audit.record({
      action: 'advertisement.created',
      actorUserId,
      businessId,
      entityType: 'advertisement',
      entityId: advertisement.id,
      metadata: { adSetId },
      context,
    });

    return toAdvertisementView(advertisement);
  }

  async updateAdvertisement(
    actorUserId: string,
    businessId: string,
    advertisementId: string,
    dto: UpdateAdvertisementDto,
    context: RequestContext,
  ): Promise<AdvertisementView> {
    const advertisement = await this.requireAdvertisement(businessId, advertisementId);
    this.assertEditable(advertisement);

    if (dto.name !== undefined) {
      advertisement.name = dto.name.trim();
    }

    if (dto.creativeId !== undefined) {
      advertisement.creativeId = dto.creativeId
        ? (await this.requireCreative(businessId, dto.creativeId)).id
        : null;
    }

    await this.advertisements.save(advertisement);
    await this.audit.record({
      action: 'advertisement.updated',
      actorUserId,
      businessId,
      entityType: 'advertisement',
      entityId: advertisement.id,
      metadata: { fields: Object.keys(dto) },
      context,
    });

    return toAdvertisementView(advertisement);
  }

  async deleteAdvertisement(
    actorUserId: string,
    businessId: string,
    advertisementId: string,
    context: RequestContext,
  ): Promise<void> {
    const advertisement = await this.requireAdvertisement(businessId, advertisementId);

    if (advertisement.externalId) {
      throw new BadRequestException(
        'Advertisements published to Meta must be archived instead of deleted',
      );
    }

    await this.advertisements.remove(advertisement);
    await this.audit.record({
      action: 'advertisement.deleted',
      actorUserId,
      businessId,
      entityType: 'advertisement',
      entityId: advertisementId,
      context,
    });
  }

  async updateAdvertisementStatus(
    actorUserId: string,
    businessId: string,
    advertisementId: string,
    dto: UpdateAdvertisingStatusDto,
    context: RequestContext,
  ): Promise<AdvertisementView> {
    const advertisement = await this.requireAdvertisement(businessId, advertisementId);

    if (advertisement.status === dto.status) {
      return toAdvertisementView(advertisement);
    }

    if (advertisement.externalId) {
      await this.pushStatus(
        businessId,
        advertisement.adAccountExternalId,
        advertisement.externalId,
        dto.status,
        AdvertisingEntityType.ADVERTISEMENT,
        advertisement.id,
      );
    }

    advertisement.status = dto.status;
    advertisement.lastError = null;
    await this.advertisements.save(advertisement);
    await this.audit.record({
      action: 'advertisement.status_changed',
      actorUserId,
      businessId,
      entityType: 'advertisement',
      entityId: advertisement.id,
      metadata: { to: dto.status },
      context,
    });

    return toAdvertisementView(advertisement);
  }

  async listCreatives(
    businessId: string,
    query: ListAdvertisingQueryDto,
  ): Promise<PagedResult<CreativeView>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 100);
    const builder = this.creatives
      .createQueryBuilder('creative')
      .leftJoinAndSelect('creative.asset', 'asset')
      .leftJoinAndSelect('creative.page', 'page')
      .where('creative.businessId = :businessId', { businessId })
      .orderBy('creative.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.search) {
      builder.andWhere('LOWER(creative.name) LIKE :search', {
        search: `%${query.search.toLowerCase()}%`,
      });
    }

    const [items, total] = await builder.getManyAndCount();

    return { items: items.map(toCreativeView), total, page, pageSize };
  }

  async createCreative(
    actorUserId: string,
    businessId: string,
    dto: CreateCreativeDto,
    context: RequestContext,
  ): Promise<CreativeView> {
    const [page, asset] = await Promise.all([
      dto.pageId ? this.requirePage(businessId, dto.pageId) : Promise.resolve(null),
      dto.assetId ? this.requireAsset(businessId, dto.assetId) : Promise.resolve(null),
    ]);
    const creative = await this.creatives.save(
      this.creatives.create({
        businessId,
        pageId: page?.id ?? null,
        pageExternalId: page?.externalId ?? null,
        assetId: asset?.id ?? null,
        imageHash: asset?.metaImageHash ?? null,
        name: dto.name.trim(),
        headline: dto.headline?.trim() ?? null,
        primaryText: dto.primaryText?.trim() ?? null,
        description: dto.description?.trim() ?? null,
        callToAction: dto.callToAction ?? null,
        destinationUrl: dto.destinationUrl ?? null,
        status: CreativeStatus.DRAFT,
        createdByUserId: actorUserId,
      }),
    );
    const saved = await this.requireCreative(businessId, creative.id);
    await this.audit.record({
      action: 'creative.created',
      actorUserId,
      businessId,
      entityType: 'creative',
      entityId: creative.id,
      context,
    });

    return toCreativeView(saved);
  }

  async updateCreative(
    actorUserId: string,
    businessId: string,
    creativeId: string,
    dto: UpdateCreativeDto,
    context: RequestContext,
  ): Promise<CreativeView> {
    const creative = await this.requireCreative(businessId, creativeId);

    if (dto.name !== undefined) {
      creative.name = dto.name.trim();
    }

    if (dto.pageId !== undefined) {
      const page = dto.pageId ? await this.requirePage(businessId, dto.pageId) : null;
      creative.pageId = page?.id ?? null;
      creative.pageExternalId = page?.externalId ?? null;
    }

    if (dto.assetId !== undefined) {
      const asset = dto.assetId ? await this.requireAsset(businessId, dto.assetId) : null;
      creative.assetId = asset?.id ?? null;
      creative.imageHash = asset?.metaImageHash ?? null;
    }

    if (dto.headline !== undefined) {
      creative.headline = dto.headline?.trim() ?? null;
    }

    if (dto.primaryText !== undefined) {
      creative.primaryText = dto.primaryText?.trim() ?? null;
    }

    if (dto.description !== undefined) {
      creative.description = dto.description?.trim() ?? null;
    }

    if (dto.callToAction !== undefined) {
      creative.callToAction = dto.callToAction;
    }

    if (dto.destinationUrl !== undefined) {
      creative.destinationUrl = dto.destinationUrl;
    }

    // Editing a creative's content requires a new Meta creative on republish.
    creative.externalId = null;
    creative.status = CreativeStatus.DRAFT;
    creative.lastError = null;
    await this.creatives.save(creative);
    await this.audit.record({
      action: 'creative.updated',
      actorUserId,
      businessId,
      entityType: 'creative',
      entityId: creative.id,
      metadata: { fields: Object.keys(dto) },
      context,
    });

    return toCreativeView(await this.requireCreative(businessId, creativeId));
  }

  async deleteCreative(
    actorUserId: string,
    businessId: string,
    creativeId: string,
    context: RequestContext,
  ): Promise<void> {
    const creative = await this.requireCreative(businessId, creativeId);
    const used = await this.advertisements.count({ where: { creativeId } });

    if (used > 0) {
      throw new BadRequestException(
        'Remove this creative from its advertisements before deleting it',
      );
    }

    await this.creatives.remove(creative);
    await this.audit.record({
      action: 'creative.deleted',
      actorUserId,
      businessId,
      entityType: 'creative',
      entityId: creativeId,
      context,
    });
  }

  async requireCampaign(businessId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaigns.findOne({
      where: { id: campaignId, businessId },
      relations: { adAccount: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async requireAdSet(businessId: string, adSetId: string): Promise<AdSet> {
    const adSet = await this.adSets.findOne({ where: { id: adSetId, businessId } });

    if (!adSet) {
      throw new NotFoundException('Ad set not found');
    }

    return adSet;
  }

  async requireAdvertisement(
    businessId: string,
    advertisementId: string,
  ): Promise<Advertisement> {
    const advertisement = await this.advertisements.findOne({
      where: { id: advertisementId, businessId },
    });

    if (!advertisement) {
      throw new NotFoundException('Advertisement not found');
    }

    return advertisement;
  }

  async requireCreative(businessId: string, creativeId: string): Promise<Creative> {
    const creative = await this.creatives.findOne({
      where: { id: creativeId, businessId },
      relations: { asset: true, page: true },
    });

    if (!creative) {
      throw new NotFoundException('Creative not found');
    }

    return creative;
  }

  async requirePage(businessId: string, pageId: string): Promise<MetaPage> {
    const page = await this.pages.findOne({ where: { id: pageId, businessId } });

    if (!page) {
      throw new BadRequestException('The selected Meta page is not connected to this business');
    }

    return page;
  }

  async requireAsset(businessId: string, assetId: string): Promise<AdvertisingAsset> {
    const asset = await this.assets.findOne({ where: { id: assetId, businessId } });

    if (!asset) {
      throw new BadRequestException('The selected media asset is not available');
    }

    return asset;
  }

  private async resolveAdAccount(
    businessId: string,
    dto: CreateCampaignDto,
  ): Promise<MetaAdAccount> {
    if (!dto.adAccountId && !dto.adAccountExternalId) {
      throw new BadRequestException('Select a connected Meta ad account');
    }

    const account = dto.adAccountId
      ? await this.adAccounts.findOne({ where: { id: dto.adAccountId, businessId } })
      : await this.adAccounts.findOne({
          where: { externalId: dto.adAccountExternalId, businessId },
        });

    if (!account) {
      throw new BadRequestException(
        'The selected Meta ad account is not connected to this business',
      );
    }

    return account;
  }

  private assertEditable(record: { externalId: string | null; name: string }): void {
    if (record.externalId) {
      throw new BadRequestException(
        `${record.name} is already published to Meta and cannot be edited`,
      );
    }
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
      message,
    });
  }

  private async pushStatus(
    businessId: string,
    adAccountExternalId: string | null,
    externalId: string,
    status: AdvertisingStatus,
    entityType: AdvertisingEntityType,
    entityId: string,
  ): Promise<void> {
    if (!adAccountExternalId) {
      throw new BadRequestException(
        'The advertising account is no longer connected to this business',
      );
    }

    try {
      const token = await this.integrations.getAccessTokenForBusiness(businessId);
      const input = {
        accessToken: token,
        adAccountExternalId,
        externalId,
        fields: { status: status.toUpperCase() },
      };

      if (entityType === AdvertisingEntityType.AD_SET) {
        await this.provider.updateAdSet(input);
      } else if (entityType === AdvertisingEntityType.ADVERTISEMENT) {
        await this.provider.updateAd(input);
      } else {
        await this.provider.updateCampaign(input);
      }

      await this.syncLogs.insert({
        businessId,
        entityType,
        entityId,
        direction: SyncDirection.PUSH,
        status: SyncStatus.SUCCESS,
        message: `Status set to ${status}`,
      });
    } catch (error) {
      const message = this.describeError(error);
      await this.syncLogs.insert({
        businessId,
        entityType,
        entityId,
        direction: SyncDirection.PUSH,
        status: SyncStatus.FAILED,
        message: message.slice(0, MAX_ERROR_LENGTH),
      });
      throw new BadGatewayException(`Meta rejected the status change: ${message}`);
    }
  }

  describeError(error: unknown): string {
    if (error instanceof MetaGraphError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown Meta API error';
  }
}
