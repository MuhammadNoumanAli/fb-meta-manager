import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { LeadConsentStatus } from '../../common/enums/lead-consent-status.enum';
import { LeadSourceType } from '../../common/enums/lead-source-type.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { LeadSyncStatus } from '../../common/enums/lead-sync-status.enum';
import { WebhookEventStatus } from '../../common/enums/webhook-event-status.enum';
import { WebhookProcessingStatus } from '../../common/enums/webhook-processing-status.enum';
import { IntegrationAuthorization } from '../../database/entities/integration-authorization.entity';
import { LeadSource } from '../../database/entities/lead-source.entity';
import { LeadSyncLog } from '../../database/entities/lead-sync-log.entity';
import { Lead } from '../../database/entities/lead.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';
import { WebhookProcessingLog } from '../../database/entities/webhook-processing-log.entity';
import { IntegrationCryptoService } from '../integrations/integration-crypto.service';
import { MetaGraphClient, MetaLeadDetails } from '../integrations/meta-graph.client';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { CreateWebsiteLeadDto } from './dto/create-website-lead.dto';

export interface WebsiteLeadResult {
  lead: Lead;
  duplicate: boolean;
}

export interface NormalisedLeadFields {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  message: string | null;
  consentStatus: LeadConsentStatus;
}

const PROVIDER = 'meta';

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const isDuplicateError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === 'ER_DUP_ENTRY';

const firstValue = (
  entries: Map<string, string[]>,
  names: string[],
): string | null => {
  for (const name of names) {
    const value = entries.get(name)?.find((entry) => entry.trim().length > 0);
    if (value) {
      return value.trim();
    }
  }

  return null;
};

const parseConsent = (value: string | null): LeadConsentStatus => {
  if (!value) {
    return LeadConsentStatus.UNKNOWN;
  }

  const normalised = value.trim().toLowerCase();

  if (/^(yes|true|1|granted|opted.?in|i agree)/.test(normalised)) {
    return LeadConsentStatus.GRANTED;
  }

  if (/^(no|false|0|denied|opted.?out|do not)/.test(normalised)) {
    return LeadConsentStatus.DENIED;
  }

  return LeadConsentStatus.UNKNOWN;
};

/** Maps Meta `field_data` into the normalised lead structure. */
export const normaliseMetaLeadFields = (
  details: MetaLeadDetails,
): NormalisedLeadFields => {
  const entries = new Map<string, string[]>();

  for (const field of details.fields) {
    const key = field.name.trim().toLowerCase();
    entries.set(key, [...(entries.get(key) ?? []), ...field.values]);
  }

  const firstName = firstValue(entries, ['first_name', 'firstname']);
  const lastName = firstValue(entries, ['last_name', 'lastname']);
  const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    fullName:
      firstValue(entries, ['full_name', 'fullname', 'name']) ||
      combinedName ||
      null,
    email: firstValue(entries, ['email', 'email_address', 'work_email']),
    phone: firstValue(entries, [
      'phone_number',
      'phone',
      'mobile_number',
      'mobile',
      'whatsapp_number',
    ]),
    language: firstValue(entries, ['language', 'locale']),
    message: firstValue(entries, ['message', 'comments', 'notes', 'custom_message']),
    consentStatus: parseConsent(
      firstValue(entries, ['consent', 'opt_in', 'marketing_consent']),
    ),
  };
};

@Injectable()
export class LeadIntakeService {
  private readonly logger = new Logger(LeadIntakeService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEvents: Repository<WebhookEvent>,
    @InjectRepository(WebhookProcessingLog)
    private readonly processingLogs: Repository<WebhookProcessingLog>,
    @InjectRepository(Lead)
    private readonly leads: Repository<Lead>,
    @InjectRepository(LeadSource)
    private readonly leadSources: Repository<LeadSource>,
    @InjectRepository(LeadSyncLog)
    private readonly syncLogs: Repository<LeadSyncLog>,
    @InjectRepository(IntegrationAuthorization)
    private readonly authorizations: Repository<IntegrationAuthorization>,
    private readonly crypto: IntegrationCryptoService,
    private readonly graph: MetaGraphClient,
    private readonly whatsapp: WhatsappMessagingService,
  ) {}

  /**
   * Processes one stored webhook event. Safe to retry: completed events are
   * skipped and lead inserts are protected by a unique dedupe hash.
   */
  async processWebhookEvent(eventId: string): Promise<void> {
    const event = await this.webhookEvents.findOne({ where: { id: eventId } });

    if (
      !event ||
      event.status === WebhookEventStatus.PROCESSED ||
      event.status === WebhookEventStatus.IGNORED
    ) {
      return;
    }

    const startedAt = Date.now();
    await this.webhookEvents.update(event.id, {
      status: WebhookEventStatus.PROCESSING,
      attempts: event.attempts + 1,
      lastError: null,
    });
    await this.logEvent(event.id, WebhookProcessingStatus.PROCESSING, 'Processing started');

    try {
      if (event.field !== 'leadgen') {
        await this.finishIgnored(event, `No processor registered for field ${event.field ?? 'unknown'}`);
        return;
      }

      const value = this.readLeadgenValue(event);

      if (!event.businessId) {
        await this.finishIgnored(event, 'Webhook event is not linked to a business');
        return;
      }

      const leadgenId = value.leadgen_id;

      if (!leadgenId) {
        throw new BadRequestException('Leadgen payload is missing leadgen_id');
      }

      const authorization = await this.authorizations.findOne({
        where: { businessId: event.businessId, provider: PROVIDER },
      });

      if (!authorization?.accessTokenEncrypted) {
        throw new Error('Meta authorization is missing or disconnected');
      }

      const accessToken = this.crypto.decrypt(authorization.accessTokenEncrypted);
      const details = await this.graph.getLeadDetails(leadgenId, accessToken);
      const fields = normaliseMetaLeadFields(details);
      const source = await this.ensureMetaSource(event.businessId);
      const dedupeHash = sha256(`meta:${leadgenId}`);

      const existing = await this.leads.findOne({ where: { dedupeHash } });

      if (existing) {
        await this.markProcessed(event, `Duplicate lead ${leadgenId} ignored`);
        await this.syncLogs.insert({
          businessId: event.businessId,
          sourcePlatform: LeadSourceType.META_LEAD_ADS,
          externalLeadId: leadgenId,
          status: LeadSyncStatus.DUPLICATE,
          message: 'Lead already exists for this leadgen ID',
          metadata: { leadId: existing.id } as never,
        });
        await this.logEvent(
          event.id,
          WebhookProcessingStatus.PROCESSED,
          'Duplicate lead ignored',
          { leadId: existing.id, durationMs: Date.now() - startedAt },
        );
        return;
      }

      const capturedAt = this.parseTimestamp(details.createdTime);
      const lead = await this.leads.insert({
        businessId: event.businessId,
        leadSourceId: source.id,
        sourcePlatform: LeadSourceType.META_LEAD_ADS,
        externalLeadId: leadgenId,
        formId: details.formId ?? value.form_id ?? null,
        campaignExternalId: details.campaignId ?? value.campaign_id ?? null,
        adSetExternalId: details.adSetId ?? value.adset_id ?? null,
        adExternalId: details.adId ?? value.ad_id ?? null,
        pageExternalId: details.pageId ?? value.page_id ?? event.externalEntryId,
        fullName: fields.fullName,
        email: fields.email,
        phone: fields.phone,
        language: fields.language,
        message: fields.message,
        consentStatus: fields.consentStatus,
        status: LeadStatus.NEW,
        rawPayload: details as unknown as never,
        dedupeHash,
        capturedAt,
      });

      const leadId = lead.identifiers[0]?.id as string | undefined;

      await this.leadSources.update(source.id, { lastReceivedAt: new Date() });
      await this.syncLogs.insert({
        businessId: event.businessId,
        sourcePlatform: LeadSourceType.META_LEAD_ADS,
        externalLeadId: leadgenId,
        status: LeadSyncStatus.CREATED,
        message: 'Lead captured from Meta Lead Ads',
        metadata: { leadId: leadId ?? null } as never,
      });
      await this.markProcessed(event, 'Lead created');
      await this.logEvent(
        event.id,
        WebhookProcessingStatus.PROCESSED,
        'Lead created',
        { leadId: leadId ?? null, durationMs: Date.now() - startedAt },
      );

      if (leadId) {
        await this.acknowledgeLead(leadId);
      }
    } catch (error) {
      const message = this.describeError(error);

      await this.webhookEvents.update(event.id, {
        status: WebhookEventStatus.FAILED,
        lastError: message,
      });
      await this.logEvent(event.id, WebhookProcessingStatus.FAILED, message, {
        durationMs: Date.now() - startedAt,
      });

      if (event.businessId) {
        await this.syncLogs
          .insert({
            businessId: event.businessId,
            sourcePlatform: LeadSourceType.META_LEAD_ADS,
            externalLeadId: this.safeLeadgenId(event),
            status: LeadSyncStatus.FAILED,
            message,
          })
          .catch(() => undefined);
      }

      this.logger.warn(`Webhook event ${event.id} failed: ${message}`);
      // Rethrow so BullMQ can retry transient Graph or database failures.
      throw error;
    }
  }

  /** Creates a lead from the public website API. */
  async intakeWebsiteLead(
    source: LeadSource,
    dto: CreateWebsiteLeadDto,
  ): Promise<WebsiteLeadResult> {
    if (!dto.email && !dto.phone && !dto.fullName) {
      throw new BadRequestException(
        'Provide at least a name, email address or phone number',
      );
    }

    const dedupeHash = dto.externalId
      ? sha256(`website:${source.businessId}:${dto.externalId}`)
      : null;

    if (dedupeHash) {
      const existing = await this.leads.findOne({ where: { dedupeHash } });

      if (existing) {
        await this.leadSources.update(source.id, { lastReceivedAt: new Date() });
        return { lead: existing, duplicate: true };
      }
    }

    const capturedAt = new Date();
    const rawPayload = {
      externalId: dto.externalId ?? null,
      campaignId: dto.campaignId ?? null,
      adSetId: dto.adSetId ?? null,
      adId: dto.adId ?? null,
      metadata: dto.metadata ?? null,
      receivedAt: capturedAt.toISOString(),
    };

    try {
      const result = await this.leads.insert({
        businessId: source.businessId,
        leadSourceId: source.id,
        sourcePlatform: LeadSourceType.WEBSITE_API,
        externalLeadId: dto.externalId ?? null,
        campaignExternalId: dto.campaignId ?? null,
        adSetExternalId: dto.adSetId ?? null,
        adExternalId: dto.adId ?? null,
        fullName: dto.fullName?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        language: dto.language?.trim() || null,
        message: dto.message?.trim() || null,
        consentStatus:
          dto.consent === true
            ? LeadConsentStatus.GRANTED
            : dto.consent === false
              ? LeadConsentStatus.DENIED
              : LeadConsentStatus.UNKNOWN,
        status: LeadStatus.NEW,
        rawPayload: rawPayload as never,
        dedupeHash,
        capturedAt,
      });
      const leadId = result.identifiers[0]?.id as string;
      const lead = await this.leads.findOneByOrFail({ id: leadId });

      await this.leadSources.update(source.id, { lastReceivedAt: capturedAt });
      await this.syncLogs.insert({
        businessId: source.businessId,
        sourcePlatform: LeadSourceType.WEBSITE_API,
        externalLeadId: dto.externalId ?? null,
        status: LeadSyncStatus.CREATED,
        message: 'Lead captured from the website API',
        metadata: { leadId } as never,
      });

      await this.acknowledgeLead(leadId);

      return { lead, duplicate: false };
    } catch (error) {
      if (dedupeHash && isDuplicateError(error)) {
        const existing = await this.leads.findOne({ where: { dedupeHash } });

        if (existing) {
          return { lead: existing, duplicate: true };
        }
      }

      throw error;
    }
  }

  /**
   * WhatsApp acknowledgment is best-effort. Lead capture must never fail
   * because consent is missing, a template is unapproved or the queue is down.
   */
  private async acknowledgeLead(leadId: string): Promise<void> {
    try {
      await this.whatsapp.sendAcknowledgment(leadId);
    } catch (error) {
      this.logger.warn(
        `WhatsApp acknowledgment for lead ${leadId} skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async ensureMetaSource(businessId: string): Promise<LeadSource> {
    const existing = await this.leadSources.findOne({
      where: { businessId, type: LeadSourceType.META_LEAD_ADS },
    });

    if (existing) {
      return existing;
    }

    try {
      const result = await this.leadSources.insert({
        businessId,
        type: LeadSourceType.META_LEAD_ADS,
        name: 'Meta Lead Ads',
      });

      return this.leadSources.findOneByOrFail({
        id: result.identifiers[0]?.id as string,
      });
    } catch (error) {
      if (isDuplicateError(error)) {
        return this.leadSources.findOneOrFail({
          where: { businessId, type: LeadSourceType.META_LEAD_ADS },
        });
      }

      throw error;
    }
  }

  private readLeadgenValue(event: WebhookEvent): Record<string, string | undefined> {
    const payload = event.payload as {
      value?: Record<string, unknown>;
    };
    const value = payload.value ?? {};

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        entry === null || entry === undefined ? undefined : String(entry),
      ]),
    );
  }

  private safeLeadgenId(event: WebhookEvent): string | null {
    try {
      return this.readLeadgenValue(event).leadgen_id ?? null;
    } catch {
      return null;
    }
  }

  private parseTimestamp(value: string | null): Date {
    if (value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }

  private async markProcessed(event: WebhookEvent, message: string): Promise<void> {
    await this.webhookEvents.update(event.id, {
      status: WebhookEventStatus.PROCESSED,
      processedAt: new Date(),
      lastError: null,
    });
    this.logger.log(`Webhook event ${event.id} processed: ${message}`);
  }

  private async finishIgnored(event: WebhookEvent, message: string): Promise<void> {
    await this.webhookEvents.update(event.id, {
      status: WebhookEventStatus.IGNORED,
      processedAt: new Date(),
    });
    await this.logEvent(event.id, WebhookProcessingStatus.IGNORED, message);
  }

  private async logEvent(
    eventId: string,
    status: WebhookProcessingStatus,
    message: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    await this.processingLogs
      .insert({
        webhookEventId: eventId,
        status,
        message,
        detail: (detail ?? null) as never,
        durationMs:
          typeof detail?.durationMs === 'number' ? detail.durationMs : null,
      })
      .catch(() => undefined);
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.slice(0, 500);
    }

    return 'Unknown lead processing error';
  }
}
