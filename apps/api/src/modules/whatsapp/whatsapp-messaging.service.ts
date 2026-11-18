import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Like, Repository } from 'typeorm';
import { WhatsappAccountStatus } from '../../common/enums/whatsapp-account-status.enum';
import { WhatsappMessageDirection } from '../../common/enums/whatsapp-message-direction.enum';
import { WhatsappMessageStatus } from '../../common/enums/whatsapp-message-status.enum';
import { WhatsappMessageType } from '../../common/enums/whatsapp-message-type.enum';
import { WhatsappTemplateStatus } from '../../common/enums/whatsapp-template-status.enum';
import { normalisePhone } from '../../common/utilities/phone';
import type { RequestContext } from '../../common/utilities/request-context';
import { Business } from '../../database/entities/business.entity';
import { Lead } from '../../database/entities/lead.entity';
import { WhatsappAccount } from '../../database/entities/whatsapp-account.entity';
import { WhatsappMessage } from '../../database/entities/whatsapp-message.entity';
import { WhatsappMessageEvent } from '../../database/entities/whatsapp-message-event.entity';
import { WhatsappPhoneNumber } from '../../database/entities/whatsapp-phone-number.entity';
import { WhatsappTemplate } from '../../database/entities/whatsapp-template.entity';
import { AuditService } from '../audit/audit.service';
import { ListWhatsappMessagesQueryDto, SendTemplateMessageDto } from './dto/send-template-message.dto';
import { ProviderCredentials, ProviderError } from './providers/messaging-provider';
import { MessagingProviderRegistry } from './providers/messaging-provider.registry';
import { WhatsappAccountsService } from './whatsapp-accounts.service';
import { WhatsappConsentService } from './whatsapp-consent.service';
import {
  WhatsappMessageDetailView,
  WhatsappMessageListResult,
  WhatsappMessageView,
  toMessageDetailView,
  toMessageEventView,
  toMessageView,
} from './whatsapp.mappers';
import { WhatsappQueueService } from './whatsapp-queue.service';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

const STATUS_RANK: Record<WhatsappMessageStatus, number> = {
  [WhatsappMessageStatus.QUEUED]: 0,
  [WhatsappMessageStatus.SENDING]: 1,
  [WhatsappMessageStatus.SENT]: 2,
  [WhatsappMessageStatus.DELIVERED]: 3,
  [WhatsappMessageStatus.READ]: 4,
  [WhatsappMessageStatus.FAILED]: 5,
  [WhatsappMessageStatus.RECEIVED]: 0,
  [WhatsappMessageStatus.SKIPPED]: 0,
  [WhatsappMessageStatus.SUPPRESSED]: 0,
};

const DELIVERY_STATUSES = new Set<WhatsappMessageStatus>([
  WhatsappMessageStatus.SENT,
  WhatsappMessageStatus.DELIVERED,
  WhatsappMessageStatus.READ,
  WhatsappMessageStatus.FAILED,
]);

const isDuplicateError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === 'ER_DUP_ENTRY';

const truncate = (value: string, length = 500): string =>
  value.length > length ? value.slice(0, length) : value;

export interface StatusUpdateInput {
  externalMessageId: string;
  status: WhatsappMessageStatus;
  occurredAt: Date;
  error?: string | null;
  eventType?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface InboundMessageInput {
  account: WhatsappAccount;
  phone: WhatsappPhoneNumber;
  fromPhone: string;
  body: string;
  externalMessageId: string;
  occurredAt: Date;
  payload?: Record<string, unknown> | null;
}

@Injectable()
export class WhatsappMessagingService {
  private readonly logger = new Logger(WhatsappMessagingService.name);

  constructor(
    @InjectRepository(WhatsappMessage)
    private readonly messages: Repository<WhatsappMessage>,
    @InjectRepository(WhatsappMessageEvent)
    private readonly events: Repository<WhatsappMessageEvent>,
    @InjectRepository(WhatsappAccount)
    private readonly accounts: Repository<WhatsappAccount>,
    @InjectRepository(WhatsappPhoneNumber)
    private readonly phoneNumbers: Repository<WhatsappPhoneNumber>,
    @InjectRepository(WhatsappTemplate)
    private readonly templates: Repository<WhatsappTemplate>,
    @InjectRepository(Lead)
    private readonly leads: Repository<Lead>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    private readonly accountsService: WhatsappAccountsService,
    private readonly templatesService: WhatsappTemplatesService,
    private readonly consent: WhatsappConsentService,
    private readonly queue: WhatsappQueueService,
    private readonly registry: MessagingProviderRegistry,
    private readonly audit: AuditService,
  ) {}

  async list(
    businessId: string,
    query: ListWhatsappMessagesQueryDto,
  ): Promise<WhatsappMessageListResult> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
    const builder = this.messages
      .createQueryBuilder('message')
      .where('message.business_id = :businessId', { businessId })
      .orderBy('message.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.leadId) {
      builder.andWhere('message.lead_id = :leadId', { leadId: query.leadId });
    }

    if (query.accountId) {
      builder.andWhere('message.account_id = :accountId', { accountId: query.accountId });
    }

    if (query.status) {
      builder.andWhere('message.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      builder.andWhere(
        '(message.to_phone LIKE :search OR message.from_phone LIKE :search OR message.body LIKE :search)',
        { search },
      );
    }

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map(toMessageView),
      total,
      page,
      pageSize,
    };
  }

  async getDetail(
    businessId: string,
    messageId: string,
  ): Promise<WhatsappMessageDetailView> {
    const message = await this.findMessage(businessId, messageId);
    const events = await this.events.find({
      where: { messageId: message.id },
      order: { occurredAt: 'DESC' },
      take: 100,
    });

    return toMessageDetailView(message, events.map(toMessageEventView));
  }

  /** Queues an approved template for one lead after consent checks. */
  async sendTemplate(
    userId: string,
    businessId: string,
    dto: SendTemplateMessageDto,
    context?: RequestContext,
  ): Promise<WhatsappMessageView> {
    const lead = await this.leads.findOne({
      where: { id: dto.leadId, businessId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const template = await this.templatesService.findTemplate(
      businessId,
      dto.templateId,
    );

    if (
      template.status !== WhatsappTemplateStatus.APPROVED ||
      !template.isEnabled
    ) {
      throw new BadRequestException(
        'Only approved and enabled templates can be sent',
      );
    }

    const idempotencyKey = dto.idempotencyKey
      ? `manual:${businessId}:${dto.idempotencyKey}`
      : `manual:${randomUUID()}`;

    if (dto.idempotencyKey) {
      const existing = await this.messages.findOne({
        where: { idempotencyKey },
      });

      if (existing) {
        return toMessageView(existing);
      }
    }

    const sender = await this.accountsService.resolveSender(
      businessId,
      dto.accountId ?? template.accountId,
    );
    const evaluation = await this.consent.evaluate(businessId, lead, lead.phone);
    const business = await this.businesses.findOne({ where: { id: businessId } });
    const variables = this.resolveVariables(
      template,
      lead,
      business?.name ?? '',
      dto.variables,
    );
    const body = this.renderBody(template.body, variables);
    const toPhone = evaluation.phone ?? normalisePhone(lead.phone) ?? '';

    if (!evaluation.allowed) {
      const skipped = await this.recordBlockedAttempt(
        businessId,
        lead,
        template,
        sender,
        toPhone,
        variables,
        body,
        idempotencyKey,
        evaluation.reason,
        evaluation.reason === 'suppressed'
          ? WhatsappMessageStatus.SUPPRESSED
          : WhatsappMessageStatus.SKIPPED,
        userId,
      );

      await this.audit.record({
        action: 'whatsapp.message_blocked',
        actorUserId: userId,
        businessId,
        entityType: 'whatsapp_message',
        entityId: skipped.id,
        metadata: { reason: evaluation.reason, leadId: lead.id },
        context,
      });

      return toMessageView(skipped);
    }

    if (!evaluation.phone) {
      throw new BadRequestException(
        'The lead has no usable phone number for WhatsApp',
      );
    }

    const message = await this.createOutbound({
      businessId,
      lead,
      template,
      sender,
      toPhone: evaluation.phone,
      variables,
      body,
      idempotencyKey,
      userId,
    });

    await this.queue.enqueue(message.id);
    await this.audit.record({
      action: 'whatsapp.message_queued',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_message',
      entityId: message.id,
      metadata: { leadId: lead.id, templateId: template.id },
      context,
    });

    return toMessageView(message);
  }

  /**
   * Sends the configured acknowledgment template after a lead is captured.
   * Acknowledgment is best-effort: missing consent, templates or accounts are
   * skipped silently so lead capture always succeeds.
   */
  async sendAcknowledgment(leadId: string): Promise<WhatsappMessageView | null> {
    const lead = await this.leads.findOne({ where: { id: leadId } });

    if (!lead) {
      return null;
    }

    const existing = await this.messages.findOne({
      where: { businessId: lead.businessId, idempotencyKey: `ack:${lead.id}` },
    });

    if (existing) {
      return toMessageView(existing);
    }

    const template = await this.templatesService.findAcknowledgmentTemplate(
      lead.businessId,
      lead.language,
    );

    if (!template) {
      return null;
    }

    const evaluation = await this.consent.evaluate(
      lead.businessId,
      lead,
      lead.phone,
    );

    if (!evaluation.allowed || !evaluation.phone) {
      this.logger.debug(
        `Skipping WhatsApp acknowledgment for lead ${lead.id}: ${evaluation.reason}`,
      );

      return null;
    }

    let sender: { account: WhatsappAccount; phone: WhatsappPhoneNumber };

    try {
      sender = await this.accountsService.resolveSender(
        lead.businessId,
        template.accountId,
      );
    } catch {
      return null;
    }

    const business = await this.businesses.findOne({
      where: { id: lead.businessId },
    });
    const variables = this.resolveVariables(
      template,
      lead,
      business?.name ?? '',
      null,
    );
    const body = this.renderBody(template.body, variables);

    try {
      const message = await this.createOutbound({
        businessId: lead.businessId,
        lead,
        template,
        sender,
        toPhone: evaluation.phone,
        variables,
        body,
        idempotencyKey: `ack:${lead.id}`,
        userId: null,
      });

      await this.queue.enqueue(message.id);

      return toMessageView(message);
    } catch (error) {
      if (isDuplicateError(error)) {
        const duplicate = await this.messages.findOne({
          where: {
            businessId: lead.businessId,
            idempotencyKey: `ack:${lead.id}`,
          },
        });

        return duplicate ? toMessageView(duplicate) : null;
      }

      this.logger.warn(
        `Could not queue a WhatsApp acknowledgment for lead ${lead.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return null;
    }
  }

  /** Re-queues a failed message without creating a duplicate record. */
  async retry(
    userId: string,
    businessId: string,
    messageId: string,
    context?: RequestContext,
  ): Promise<WhatsappMessageDetailView> {
    const message = await this.findMessage(businessId, messageId);

    if (message.status !== WhatsappMessageStatus.FAILED) {
      throw new BadRequestException('Only failed messages can be retried');
    }

    if (message.direction !== WhatsappMessageDirection.OUTBOUND) {
      throw new BadRequestException('Inbound messages cannot be retried');
    }

    await this.messages.update(message.id, {
      status: WhatsappMessageStatus.QUEUED,
      attempts: 0,
      error: null,
    });

    await this.queue.enqueue(message.id, Date.now());
    await this.audit.record({
      action: 'whatsapp.message_retried',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_message',
      entityId: message.id,
      context,
    });

    return this.getDetail(businessId, message.id);
  }

  /**
   * Performs one delivery attempt. Retryable provider failures are re-thrown so
   * BullMQ applies the exponential backoff; permanent failures are recorded.
   */
  async deliver(messageId: string): Promise<void> {
    const message = await this.messages.findOne({ where: { id: messageId } });

    if (!message || message.status !== WhatsappMessageStatus.QUEUED) {
      return;
    }

    const attempts = message.attempts + 1;
    const claim = await this.messages.update(
      { id: message.id, status: WhatsappMessageStatus.QUEUED },
      { status: WhatsappMessageStatus.SENDING, attempts },
    );

    if (!claim.affected) {
      return;
    }

    const fail = async (reason: string, retryable: boolean): Promise<void> => {
      const finalAttempt = !retryable || attempts >= message.maxAttempts;

      await this.messages.update(message.id, {
        status: finalAttempt
          ? WhatsappMessageStatus.FAILED
          : WhatsappMessageStatus.QUEUED,
        error: truncate(reason),
      });
      await this.recordEvent(
        message,
        finalAttempt ? WhatsappMessageStatus.FAILED : WhatsappMessageStatus.QUEUED,
        finalAttempt ? 'send_failed' : 'retry_scheduled',
        truncate(reason),
        null,
        new Date(),
      );
    };

    const account = await this.accounts.findOne({
      where: { id: message.accountId, businessId: message.businessId },
    });

    if (!account || account.status !== WhatsappAccountStatus.ACTIVE) {
      await fail('The WhatsApp account is not active', false);
      return;
    }

    const phone = await this.phoneNumbers.findOne({
      where: { id: message.phoneNumberId, businessId: message.businessId },
    });

    if (!phone) {
      await fail('The sender phone number is no longer connected', false);
      return;
    }

    const template = message.templateId
      ? await this.templates.findOne({ where: { id: message.templateId } })
      : null;

    if (
      !template ||
      template.status !== WhatsappTemplateStatus.APPROVED ||
      !template.isEnabled
    ) {
      await fail('The template is no longer approved or enabled', false);
      return;
    }

    const lead = message.leadId
      ? await this.leads.findOne({ where: { id: message.leadId } })
      : null;
    const evaluation = await this.consent.evaluate(
      message.businessId,
      lead,
      message.toPhone,
    );

    if (!evaluation.allowed) {
      const status =
        evaluation.reason === 'suppressed'
          ? WhatsappMessageStatus.SUPPRESSED
          : WhatsappMessageStatus.SKIPPED;

      await this.messages.update(message.id, {
        status,
        error: `Blocked before delivery: ${evaluation.reason}`,
      });
      await this.recordEvent(
        message,
        status,
        'blocked',
        evaluation.reason,
        null,
        new Date(),
      );
      return;
    }

    let credentials: ProviderCredentials;

    try {
      credentials = await this.accountsService.loadCredentials(account);
    } catch (error) {
      await fail(
        error instanceof Error ? error.message : 'Credentials are unavailable',
        false,
      );
      return;
    }

    const provider = this.registry.get(account.provider);

    try {
      const result = await provider.sendTemplateMessage(
        {
          credentials,
          phoneNumberExternalId: phone.externalPhoneNumberId,
          phoneNumberDisplay: phone.displayPhoneNumber,
        },
        {
          toPhone: message.toPhone,
          templateName: template.name,
          language: template.language,
          variables: message.variables ?? {},
          body: message.body ?? template.body,
          providerTemplateId: template.providerTemplateId,
        },
      );

      await this.messages.update(message.id, {
        status: WhatsappMessageStatus.SENT,
        externalMessageId: result.externalMessageId,
        sentAt: new Date(),
        error: null,
        payload: result.payload as never,
      });
      await this.recordEvent(
        message,
        WhatsappMessageStatus.SENT,
        'send_success',
        null,
        result.payload,
        new Date(),
        result.externalMessageId,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown WhatsApp send error';
      const retryable =
        error instanceof ProviderError
          ? error.retryable
          : this.isNetworkError(error);

      await fail(reason, retryable);

      if (retryable && attempts < message.maxAttempts) {
        throw error;
      }
    }
  }

  /** Applies a delivery-status webhook to the matching outbound message. */
  async recordStatusUpdate(
    input: StatusUpdateInput,
  ): Promise<WhatsappMessage | null> {
    if (!DELIVERY_STATUSES.has(input.status)) {
      return null;
    }

    const message = await this.messages.findOne({
      where: { externalMessageId: input.externalMessageId },
    });

    if (!message) {
      return null;
    }

    const duplicate = await this.events.findOne({
      where: {
        messageId: message.id,
        status: input.status,
        occurredAt: input.occurredAt,
      },
    });

    if (
      message.status === WhatsappMessageStatus.FAILED ||
      STATUS_RANK[input.status] <= STATUS_RANK[message.status]
    ) {
      if (!duplicate) {
        await this.recordEvent(
          message,
          input.status,
          input.eventType ?? 'status_update',
          input.error ?? null,
          input.payload ?? null,
          input.occurredAt,
        );
      }

      return message;
    }

    const changes: Partial<WhatsappMessage> = { status: input.status };

    if (input.status === WhatsappMessageStatus.SENT && !message.sentAt) {
      changes.sentAt = input.occurredAt;
    }

    if (input.status === WhatsappMessageStatus.DELIVERED) {
      changes.deliveredAt = input.occurredAt;
      changes.sentAt = message.sentAt ?? input.occurredAt;
    }

    if (input.status === WhatsappMessageStatus.READ) {
      changes.readAt = input.occurredAt;
      changes.deliveredAt = message.deliveredAt ?? input.occurredAt;
    }

    if (input.status === WhatsappMessageStatus.FAILED) {
      changes.error = truncate(input.error ?? 'Delivery failed');
    }

    await this.messages.update(message.id, changes as never);
    await this.recordEvent(
      message,
      input.status,
      input.eventType ?? 'status_update',
      input.error ?? null,
      input.payload ?? null,
      input.occurredAt,
    );

    Object.assign(message, changes);

    return message;
  }

  /** Stores an inbound customer message and links it to a lead when found. */
  async recordInbound(
    input: InboundMessageInput,
  ): Promise<WhatsappMessageView | null> {
    const fromPhone = normalisePhone(input.fromPhone) ?? '';
    const idempotencyKey = `in:${input.externalMessageId}`;
    const existing = await this.messages.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return toMessageView(existing);
    }

    const lead = fromPhone
      ? await this.leads.findOne({
          where: {
            businessId: input.account.businessId,
            phone: Like(`%${fromPhone.slice(-9)}%`),
          },
        })
      : null;

    try {
      const result = await this.messages.insert({
        businessId: input.account.businessId,
        leadId: lead?.id ?? null,
        accountId: input.account.id,
        phoneNumberId: input.phone.id,
        templateId: null,
        direction: WhatsappMessageDirection.INBOUND,
        messageType: WhatsappMessageType.TEXT,
        status: WhatsappMessageStatus.RECEIVED,
        toPhone: normalisePhone(input.phone.displayPhoneNumber) ?? '',
        fromPhone,
        body: input.body,
        variables: null,
        externalMessageId: input.externalMessageId,
        idempotencyKey,
        payload: (input.payload ?? null) as never,
      });
      const message = await this.messages.findOneByOrFail({
        id: result.identifiers[0]?.id as string,
      });

      await this.recordEvent(
        message,
        WhatsappMessageStatus.RECEIVED,
        'inbound',
        null,
        input.payload ?? null,
        input.occurredAt,
        input.externalMessageId,
      );

      return toMessageView(message);
    } catch (error) {
      if (isDuplicateError(error)) {
        const duplicate = await this.messages.findOne({
          where: { idempotencyKey },
        });

        return duplicate ? toMessageView(duplicate) : null;
      }

      throw error;
    }
  }

  private async createOutbound(input: {
    businessId: string;
    lead: Lead;
    template: WhatsappTemplate;
    sender: { account: WhatsappAccount; phone: WhatsappPhoneNumber };
    toPhone: string;
    variables: Record<string, string>;
    body: string;
    idempotencyKey: string;
    userId: string | null;
  }): Promise<WhatsappMessage> {
    const result = await this.messages.insert({
      businessId: input.businessId,
      leadId: input.lead.id,
      accountId: input.sender.account.id,
      phoneNumberId: input.sender.phone.id,
      templateId: input.template.id,
      direction: WhatsappMessageDirection.OUTBOUND,
      messageType: WhatsappMessageType.TEMPLATE,
      status: WhatsappMessageStatus.QUEUED,
      toPhone: input.toPhone,
      fromPhone:
        normalisePhone(input.sender.phone.displayPhoneNumber) ?? null,
      body: input.body,
      variables: input.variables as never,
      externalMessageId: null,
      idempotencyKey: input.idempotencyKey,
      attempts: 0,
      maxAttempts: 3,
      error: null,
      payload: null,
      createdByUserId: input.userId,
    });

    return this.messages.findOneByOrFail({
      id: result.identifiers[0]?.id as string,
    });
  }

  private async recordBlockedAttempt(
    businessId: string,
    lead: Lead,
    template: WhatsappTemplate,
    sender: { account: WhatsappAccount; phone: WhatsappPhoneNumber },
    toPhone: string,
    variables: Record<string, string>,
    body: string,
    idempotencyKey: string,
    reason: string,
    status: WhatsappMessageStatus,
    userId: string | null,
  ): Promise<WhatsappMessage> {
    const result = await this.messages.insert({
      businessId,
      leadId: lead.id,
      accountId: sender.account.id,
      phoneNumberId: sender.phone.id,
      templateId: template.id,
      direction: WhatsappMessageDirection.OUTBOUND,
      messageType: WhatsappMessageType.TEMPLATE,
      status,
      toPhone,
      fromPhone: normalisePhone(sender.phone.displayPhoneNumber),
      body,
      variables: variables as never,
      externalMessageId: null,
      idempotencyKey,
      attempts: 0,
      maxAttempts: 3,
      error: `Blocked before delivery: ${reason}`,
      payload: null,
      createdByUserId: userId,
    });
    const message = await this.messages.findOneByOrFail({
      id: result.identifiers[0]?.id as string,
    });

    await this.recordEvent(
      message,
      status,
      'blocked',
      reason,
      null,
      new Date(),
    );

    return message;
  }

  private async recordEvent(
    message: WhatsappMessage,
    status: WhatsappMessageStatus,
    eventType: string,
    error: string | null,
    payload: Record<string, unknown> | null,
    occurredAt: Date,
    externalMessageId?: string,
  ): Promise<void> {
    await this.events
      .insert({
        businessId: message.businessId,
        messageId: message.id,
        status,
        eventType,
        externalMessageId:
          externalMessageId ?? message.externalMessageId ?? null,
        error,
        payload: payload as never,
        occurredAt,
      })
      .catch(() => undefined);
  }

  private async findMessage(
    businessId: string,
    messageId: string,
  ): Promise<WhatsappMessage> {
    const message = await this.messages.findOne({
      where: { id: messageId, businessId },
    });

    if (!message) {
      throw new NotFoundException('WhatsApp message not found');
    }

    return message;
  }

  private resolveVariables(
    template: WhatsappTemplate,
    lead: Lead,
    businessName: string,
    overrides: Record<string, string> | null | undefined,
  ): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [index, source] of Object.entries(template.variableMapping ?? {})) {
      resolved[index] = this.readVariableSource(source, lead, businessName);
    }

    for (const [index, value] of Object.entries(overrides ?? {})) {
      if (typeof value === 'string') {
        resolved[index] = value;
      }
    }

    return resolved;
  }

  private readVariableSource(
    source: string,
    lead: Lead,
    businessName: string,
  ): string {
    switch (source) {
      case 'lead.fullName':
        return lead.fullName?.trim() || 'there';
      case 'lead.email':
        return lead.email ?? '';
      case 'lead.phone':
        return lead.phone ?? '';
      case 'lead.language':
        return lead.language ?? '';
      case 'lead.message':
        return lead.message ?? '';
      case 'business.name':
        return businessName;
      default:
        return source.startsWith('literal:') ? source.slice(8) : '';
    }
  }

  private renderBody(
    body: string,
    variables: Record<string, string>,
  ): string {
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
      variables[key] ?? '',
    );
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) {
      return true;
    }

    const code = (error as { cause?: { code?: string } } | null)?.cause?.code;

    return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
  }
}
