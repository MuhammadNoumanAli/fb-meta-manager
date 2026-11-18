import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { LeadConsentStatus } from '../../common/enums/lead-consent-status.enum';
import { SuppressionReason } from '../../common/enums/suppression-reason.enum';
import { WhatsappConsentSource } from '../../common/enums/whatsapp-consent-source.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { normalisePhone } from '../../common/utilities/phone';
import { CommunicationSuppression } from '../../database/entities/communication-suppression.entity';
import { LeadConsent } from '../../database/entities/lead-consent.entity';
import { Lead } from '../../database/entities/lead.entity';
import { AuditService } from '../audit/audit.service';
import { CreateSuppressionDto } from './dto/create-suppression.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import {
  CommunicationSuppressionView,
  LeadConsentView,
  toConsentView,
  toSuppressionView,
} from './whatsapp.mappers';

export type ConsentReason =
  | 'ok'
  | 'missing_phone'
  | 'suppressed'
  | 'consent_denied'
  | 'consent_missing';

export interface ConsentEvaluation {
  allowed: boolean;
  reason: ConsentReason;
  phone: string | null;
  consent: LeadConsent | null;
  suppression: CommunicationSuppression | null;
}

const CHANNEL = 'whatsapp';

const OPT_OUT_KEYWORDS = [
  'stop',
  'stop promotion',
  'unsubscribe',
  'opt out',
  'optout',
  'quit',
  'berhenti',
  'batal',
  'jangan hantar',
];

/** Detects a full-message opt-out keyword in English or Bahasa Malaysia. */
export const isOptOutMessage = (body: string | null | undefined): boolean => {
  if (!body) {
    return false;
  }

  const normalised = body
    .trim()
    .toLowerCase()
    .replace(/[.!?,;"]+$/g, '')
    .replace(/\s+/g, ' ');

  return OPT_OUT_KEYWORDS.includes(normalised);
};

@Injectable()
export class WhatsappConsentService {
  constructor(
    @InjectRepository(LeadConsent)
    private readonly consents: Repository<LeadConsent>,
    @InjectRepository(CommunicationSuppression)
    private readonly suppressions: Repository<CommunicationSuppression>,
    @InjectRepository(Lead)
    private readonly leads: Repository<Lead>,
    private readonly audit: AuditService,
  ) {}

  async list(
    businessId: string,
    filters: { leadId?: string; phoneNumber?: string },
  ): Promise<LeadConsentView[]> {
    const where: Record<string, unknown> = { businessId, channel: CHANNEL };

    if (filters.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters.phoneNumber) {
      where.phoneNumber = normalisePhone(filters.phoneNumber);
    }

    const records = await this.consents.find({
      where,
      order: { capturedAt: 'DESC' },
      take: 200,
    });

    return records.map(toConsentView);
  }

  /** Records an explicit opt-in or opt-out for a lead. */
  async record(
    userId: string,
    businessId: string,
    dto: RecordConsentDto,
    context?: RequestContext,
  ): Promise<LeadConsentView> {
    if (dto.status === LeadConsentStatus.UNKNOWN) {
      throw new BadRequestException('Consent must be granted or denied');
    }

    const lead = await this.leads.findOne({
      where: { id: dto.leadId, businessId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const phone = normalisePhone(dto.phoneNumber ?? lead.phone);

    if (!phone) {
      throw new BadRequestException(
        'A phone number is required to record WhatsApp consent',
      );
    }

    const existing = await this.consents.findOne({
      where: { businessId, channel: CHANNEL, leadId: lead.id },
    });
    const now = new Date();
    const granted = dto.status === LeadConsentStatus.GRANTED;

    let consent: LeadConsent;

    if (existing) {
      await this.consents.update(existing.id, {
        phoneNumber: phone,
        status: dto.status,
        source: dto.source ?? existing.source,
        consentText: dto.consentText ?? existing.consentText,
        capturedAt: now,
        revokedAt: granted ? null : now,
        createdByUserId: userId,
      });
      consent = await this.consents.findOneByOrFail({ id: existing.id });
    } else {
      const result = await this.consents.insert({
        businessId,
        leadId: lead.id,
        channel: CHANNEL,
        phoneNumber: phone,
        status: dto.status,
        source: dto.source ?? WhatsappConsentSource.MANUAL,
        consentText: dto.consentText ?? null,
        capturedAt: now,
        revokedAt: granted ? null : now,
        createdByUserId: userId,
      });
      consent = await this.consents.findOneByOrFail({
        id: result.identifiers[0]?.id as string,
      });
    }

    await this.leads.update(lead.id, {
      consentStatus: dto.status,
      phone: lead.phone ?? phone,
    });

    if (!granted) {
      await this.upsertSuppression(businessId, phone, SuppressionReason.OPT_OUT, {
        source: dto.source ?? WhatsappConsentSource.MANUAL,
        notes: 'WhatsApp opt-out recorded from the CRM',
        userId,
      });
    } else {
      // A fresh opt-in clears previous opt-out entries, but never complaints.
      await this.suppressions.delete({
        businessId,
        phoneNumber: phone,
        reason: SuppressionReason.OPT_OUT,
      });
    }

    await this.audit.record({
      action: granted ? 'whatsapp.consent_granted' : 'whatsapp.consent_denied',
      actorUserId: userId,
      businessId,
      entityType: 'lead',
      entityId: lead.id,
      metadata: { phoneNumber: phone, source: consent.source },
      context,
    });

    return toConsentView(consent);
  }

  async listSuppressions(businessId: string): Promise<CommunicationSuppressionView[]> {
    const records = await this.suppressions.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: 200,
    });

    return records.map(toSuppressionView);
  }

  async addSuppression(
    userId: string,
    businessId: string,
    dto: CreateSuppressionDto,
    context?: RequestContext,
  ): Promise<CommunicationSuppressionView> {
    const phone = normalisePhone(dto.phoneNumber);

    if (!phone) {
      throw new BadRequestException('Enter a valid phone number');
    }

    const suppression = await this.upsertSuppression(
      businessId,
      phone,
      dto.reason ?? SuppressionReason.MANUAL,
      {
        source: dto.source ?? 'manual',
        notes: dto.notes ?? null,
        userId,
      },
    );

    await this.audit.record({
      action: 'whatsapp.suppression_added',
      actorUserId: userId,
      businessId,
      entityType: 'communication_suppression',
      entityId: suppression.id,
      metadata: { phoneNumber: phone, reason: suppression.reason },
      context,
    });

    return toSuppressionView(suppression);
  }

  /**
   * Applies an inbound STOP-style reply: matching leads are opted out, a
   * consent record is rejected and the number is suppressed.
   */
  async recordInboundOptOut(businessId: string, phoneInput: string): Promise<void> {
    const phone = normalisePhone(phoneInput);

    if (!phone) {
      return;
    }

    const now = new Date();
    const tail = phone.slice(-9);
    const matches = tail
      ? await this.leads.find({
          where: { businessId, phone: Like(`%${tail}%`) },
        })
      : [];

    for (const lead of matches) {
      const existing = await this.consents.findOne({
        where: { businessId, channel: CHANNEL, leadId: lead.id },
      });

      if (existing) {
        await this.consents.update(existing.id, {
          phoneNumber: phone,
          status: LeadConsentStatus.DENIED,
          source: WhatsappConsentSource.INBOUND_REPLY,
          capturedAt: now,
          revokedAt: now,
        });
      } else {
        await this.consents.insert({
          businessId,
          leadId: lead.id,
          channel: CHANNEL,
          phoneNumber: phone,
          status: LeadConsentStatus.DENIED,
          source: WhatsappConsentSource.INBOUND_REPLY,
          consentText: 'Opt-out requested through WhatsApp',
          capturedAt: now,
          revokedAt: now,
        });
      }

      await this.leads.update(lead.id, { consentStatus: LeadConsentStatus.DENIED });
    }

    const suppression = await this.upsertSuppression(
      businessId,
      phone,
      SuppressionReason.OPT_OUT,
      {
        source: WhatsappConsentSource.INBOUND_REPLY,
        notes: 'Inbound WhatsApp opt-out keyword',
        userId: null,
      },
    );

    await this.audit.record({
      action: 'whatsapp.consent_denied',
      actorUserId: null,
      businessId,
      entityType: 'communication_suppression',
      entityId: suppression.id,
      metadata: { phoneNumber: phone, source: 'inbound_reply' },
    });
  }

  async removeSuppression(
    userId: string,
    businessId: string,
    suppressionId: string,
    context?: RequestContext,
  ): Promise<void> {
    const suppression = await this.suppressions.findOne({
      where: { id: suppressionId, businessId },
    });

    if (!suppression) {
      throw new NotFoundException('Suppression entry not found');
    }

    await this.suppressions.delete(suppression.id);

    await this.audit.record({
      action: 'whatsapp.suppression_removed',
      actorUserId: userId,
      businessId,
      entityType: 'communication_suppression',
      entityId: suppression.id,
      metadata: { phoneNumber: suppression.phoneNumber },
      context,
    });
  }

  /**
   * Decides whether an outbound message is permitted. Both an explicit consent
   * record and the suppression list are checked before every send.
   */
  async evaluate(
    businessId: string,
    lead: Lead | null,
    phoneInput: string | null,
  ): Promise<ConsentEvaluation> {
    const phone = normalisePhone(phoneInput ?? lead?.phone ?? null);

    if (!phone) {
      return {
        allowed: false,
        reason: 'missing_phone',
        phone: null,
        consent: null,
        suppression: null,
      };
    }

    const suppression = await this.suppressions.findOne({
      where: { businessId, phoneNumber: phone },
    });

    if (suppression) {
      return {
        allowed: false,
        reason: 'suppressed',
        phone,
        consent: null,
        suppression,
      };
    }

    const consent = lead
      ? await this.consents.findOne({
          where: { businessId, channel: CHANNEL, leadId: lead.id },
        })
      : await this.consents.findOne({
          where: { businessId, channel: CHANNEL, phoneNumber: phone },
        });

    if (consent?.status === LeadConsentStatus.DENIED) {
      return { allowed: false, reason: 'consent_denied', phone, consent, suppression: null };
    }

    if (consent?.status === LeadConsentStatus.GRANTED) {
      return { allowed: true, reason: 'ok', phone, consent, suppression: null };
    }

    if (lead?.consentStatus === LeadConsentStatus.DENIED) {
      return { allowed: false, reason: 'consent_denied', phone, consent: null, suppression: null };
    }

    if (lead?.consentStatus === LeadConsentStatus.GRANTED) {
      return { allowed: true, reason: 'ok', phone, consent: null, suppression: null };
    }

    return { allowed: false, reason: 'consent_missing', phone, consent: null, suppression: null };
  }

  private async upsertSuppression(
    businessId: string,
    phoneNumber: string,
    reason: SuppressionReason,
    detail: { source: string; notes: string | null; userId: string | null },
  ): Promise<CommunicationSuppression> {
    const existing = await this.suppressions.findOne({
      where: { businessId, phoneNumber },
    });

    if (existing) {
      await this.suppressions.update(existing.id, {
        reason,
        source: detail.source,
        notes: detail.notes ?? existing.notes,
      });

      return this.suppressions.findOneByOrFail({ id: existing.id });
    }

    const result = await this.suppressions.insert({
      businessId,
      phoneNumber,
      reason,
      source: detail.source.slice(0, 40),
      notes: detail.notes,
      createdByUserId: detail.userId,
    });

    return this.suppressions.findOneByOrFail({
      id: result.identifiers[0]?.id as string,
    });
  }
}
