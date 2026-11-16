import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadSourceType } from '../../common/enums/lead-source-type.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { generateOpaqueToken } from '../../common/utilities/slug';
import { LeadSource } from '../../database/entities/lead-source.entity';
import { LeadSyncLog } from '../../database/entities/lead-sync-log.entity';
import { Lead } from '../../database/entities/lead.entity';
import { AuditService } from '../audit/audit.service';
import { hashToken } from '../auth/tokens.service';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

export interface LeadView {
  id: string;
  sourcePlatform: LeadSourceType;
  externalLeadId: string | null;
  formId: string | null;
  campaignExternalId: string | null;
  adSetExternalId: string | null;
  adExternalId: string | null;
  pageExternalId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  message: string | null;
  consentStatus: string;
  status: LeadStatus;
  assignedUserId: string | null;
  capturedAt: Date;
  createdAt: Date;
}

export interface LeadListResult {
  items: LeadView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadSourceView {
  id: string;
  type: LeadSourceType;
  name: string;
  externalId: string | null;
  isActive: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  lastReceivedAt: Date | null;
  createdAt: Date;
}

export interface WebsiteKeyResult {
  source: LeadSourceView;
  apiKey: string;
}

export interface LeadSyncLogView {
  id: string;
  sourcePlatform: LeadSourceType;
  externalLeadId: string | null;
  status: string;
  message: string | null;
  createdAt: Date;
}

const toLeadView = (lead: Lead): LeadView => ({
  id: lead.id,
  sourcePlatform: lead.sourcePlatform,
  externalLeadId: lead.externalLeadId,
  formId: lead.formId,
  campaignExternalId: lead.campaignExternalId,
  adSetExternalId: lead.adSetExternalId,
  adExternalId: lead.adExternalId,
  pageExternalId: lead.pageExternalId,
  fullName: lead.fullName,
  email: lead.email,
  phone: lead.phone,
  language: lead.language,
  message: lead.message,
  consentStatus: lead.consentStatus,
  status: lead.status,
  assignedUserId: lead.assignedUserId,
  capturedAt: lead.capturedAt,
  createdAt: lead.createdAt,
});

const toSourceView = (source: LeadSource): LeadSourceView => ({
  id: source.id,
  type: source.type,
  name: source.name,
  externalId: source.externalId,
  isActive: source.isActive,
  hasApiKey: Boolean(source.apiKeyHash),
  apiKeyHint: source.apiKeyHint,
  lastReceivedAt: source.lastReceivedAt,
  createdAt: source.createdAt,
});

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(LeadSource) private readonly leadSources: Repository<LeadSource>,
    @InjectRepository(LeadSyncLog) private readonly syncLogs: Repository<LeadSyncLog>,
    private readonly audit: AuditService,
  ) {}

  async list(businessId: string, query: ListLeadsQueryDto): Promise<LeadListResult> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
    const builder = this.leads
      .createQueryBuilder('lead')
      .where('lead.business_id = :businessId', { businessId })
      .orderBy('lead.captured_at', 'DESC')
      .addOrderBy('lead.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      builder.andWhere('lead.status = :status', { status: query.status });
    }

    if (query.source) {
      builder.andWhere('lead.source_platform = :source', { source: query.source });
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      builder.andWhere(
        '(lead.full_name LIKE :search OR lead.email LIKE :search OR lead.phone LIKE :search)',
        { search },
      );
    }

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map((lead) => toLeadView(lead)),
      total,
      page,
      pageSize,
    };
  }

  async get(businessId: string, leadId: string): Promise<LeadView> {
    const lead = await this.leads.findOne({ where: { id: leadId, businessId } });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return toLeadView(lead);
  }

  async update(
    userId: string,
    businessId: string,
    leadId: string,
    dto: UpdateLeadDto,
    context?: RequestContext,
  ): Promise<LeadView> {
    const lead = await this.leads.findOne({ where: { id: leadId, businessId } });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (dto.status && dto.status !== lead.status) {
      const previous = lead.status;
      lead.status = dto.status;
      await this.leads.update(lead.id, { status: dto.status });
      await this.audit.record({
        action: 'lead.status_changed',
        actorUserId: userId,
        businessId,
        entityType: 'lead',
        entityId: lead.id,
        metadata: { from: previous, to: dto.status },
        context,
      });
    }

    return toLeadView(lead);
  }

  async syncLog(
    businessId: string,
    limit = 50,
  ): Promise<LeadSyncLogView[]> {
    const logs = await this.syncLogs.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    return logs.map((log) => ({
      id: log.id,
      sourcePlatform: log.sourcePlatform,
      externalLeadId: log.externalLeadId,
      status: log.status,
      message: log.message,
      createdAt: log.createdAt,
    }));
  }

  async listSources(businessId: string): Promise<LeadSourceView[]> {
    const sources = await this.leadSources.find({
      where: { businessId },
      order: { createdAt: 'ASC' },
    });

    return sources.map((source) => toSourceView(source));
  }

  /** Creates or rotates the website API key. The raw key is returned once. */
  async issueWebsiteKey(
    userId: string,
    businessId: string,
    context?: RequestContext,
  ): Promise<WebsiteKeyResult> {
    const apiKey = `adp_${generateOpaqueToken(24)}`;
    const apiKeyHash = hashToken(apiKey);
    const apiKeyHint = apiKey.slice(-4);
    let source = await this.leadSources.findOne({
      where: { businessId, type: LeadSourceType.WEBSITE_API },
    });

    if (source) {
      source.apiKeyHash = apiKeyHash;
      source.apiKeyHint = apiKeyHint;
      source.isActive = true;
      await this.leadSources.update(source.id, {
        apiKeyHash,
        apiKeyHint,
        isActive: true,
      });
    } else {
      const result = await this.leadSources.insert({
        businessId,
        type: LeadSourceType.WEBSITE_API,
        name: 'Website API',
        apiKeyHash,
        apiKeyHint,
        isActive: true,
      });
      source = await this.leadSources.findOneByOrFail({
        id: result.identifiers[0]?.id as string,
      });
    }

    await this.audit.record({
      action: 'lead_source.website_key_issued',
      actorUserId: userId,
      businessId,
      entityType: 'lead_source',
      entityId: source.id,
      metadata: { apiKeyHint },
      context,
    });

    return { source: toSourceView(source), apiKey };
  }

  async revokeWebsiteKey(
    userId: string,
    businessId: string,
    context?: RequestContext,
  ): Promise<LeadSourceView> {
    const source = await this.leadSources.findOne({
      where: { businessId, type: LeadSourceType.WEBSITE_API },
    });

    if (!source) {
      throw new NotFoundException('Website lead source is not configured');
    }

    await this.leadSources.update(source.id, {
      apiKeyHash: null,
      apiKeyHint: null,
      isActive: false,
    });
    source.apiKeyHash = null;
    source.apiKeyHint = null;
    source.isActive = false;

    await this.audit.record({
      action: 'lead_source.website_key_revoked',
      actorUserId: userId,
      businessId,
      entityType: 'lead_source',
      entityId: source.id,
      context,
    });

    return toSourceView(source);
  }

  async resolveWebsiteSource(apiKey: string): Promise<LeadSource | null> {
    if (!apiKey) {
      return null;
    }

    const source = await this.leadSources.findOne({
      where: {
        apiKeyHash: hashToken(apiKey),
        isActive: true,
        type: LeadSourceType.WEBSITE_API,
      },
    });

    return source ?? null;
  }
}
