import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { WhatsappMessageStatus } from '../../common/enums/whatsapp-message-status.enum';
import { normalisePhone } from '../../common/utilities/phone';
import { WhatsappAccount } from '../../database/entities/whatsapp-account.entity';
import { WhatsappPhoneNumber } from '../../database/entities/whatsapp-phone-number.entity';
import { IntegrationCryptoService } from '../integrations/integration-crypto.service';
import { WhatsappConsentService, isOptOutMessage } from './whatsapp-consent.service';
import { WhatsappMessagingService } from './whatsapp-messaging.service';

interface MetaWebhookValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  messages?: Array<{
    from?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
    button?: { text?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  }>;
  statuses?: Array<{
    id?: string;
    status?: string;
    timestamp?: string;
    recipient_id?: string;
    errors?: Array<{ code?: number; title?: string; message?: string }>;
  }>;
}

export interface MetaWhatsappWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: MetaWebhookValue }>;
  }>;
}

const META_STATUSES: Record<string, WhatsappMessageStatus | undefined> = {
  sent: WhatsappMessageStatus.SENT,
  delivered: WhatsappMessageStatus.DELIVERED,
  read: WhatsappMessageStatus.READ,
  failed: WhatsappMessageStatus.FAILED,
};

const TWILIO_STATUSES: Record<string, WhatsappMessageStatus | undefined> = {
  queued: WhatsappMessageStatus.QUEUED,
  sending: WhatsappMessageStatus.SENDING,
  sent: WhatsappMessageStatus.SENT,
  delivered: WhatsappMessageStatus.DELIVERED,
  read: WhatsappMessageStatus.READ,
  failed: WhatsappMessageStatus.FAILED,
  undelivered: WhatsappMessageStatus.FAILED,
};

@Injectable()
export class WhatsappWebhooksService {
  private readonly logger = new Logger(WhatsappWebhooksService.name);

  constructor(
    @InjectRepository(WhatsappAccount)
    private readonly accounts: Repository<WhatsappAccount>,
    @InjectRepository(WhatsappPhoneNumber)
    private readonly phoneNumbers: Repository<WhatsappPhoneNumber>,
    private readonly config: ConfigService,
    private readonly crypto: IntegrationCryptoService,
    private readonly messaging: WhatsappMessagingService,
    private readonly consent: WhatsappConsentService,
  ) {}

  verifyChallenge(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): string {
    const expected =
      this.config.get<string>('whatsapp.webhookVerifyToken') ||
      this.config.get<string>('meta.webhookVerifyToken');

    if (!expected) {
      throw new ServiceUnavailableException(
        'WhatsApp webhook verification is not configured',
      );
    }

    if (mode !== 'subscribe' || !token || token !== expected) {
      throw new ForbiddenException('Invalid WhatsApp webhook verification token');
    }

    return challenge ?? '';
  }

  /** Validates Meta's X-Hub-Signature-256 over the raw request body. */
  verifyMetaSignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    const secret = this.config.get<string>('meta.appSecret');

    if (!secret) {
      throw new ServiceUnavailableException(
        'Meta app secret is not configured for webhook verification',
      );
    }

    if (!rawBody || !signature) {
      throw new ForbiddenException('Missing WhatsApp webhook signature');
    }

    const expected = `sha256=${createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;
    const provided = Buffer.from(signature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');

    if (
      provided.length !== computed.length ||
      !timingSafeEqual(provided, computed)
    ) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature');
    }
  }

  async receiveMeta(payload: MetaWhatsappWebhookPayload): Promise<{ received: true }> {
    if (payload.object !== 'whatsapp_business_account') {
      return { received: true };
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages' || !change.value) {
          continue;
        }

        await this.handleMetaValue(change.value);
      }
    }

    return { received: true };
  }

  async receiveTwilio(
    rawBody: string | undefined,
    signature: string | undefined,
    requestUrl: string,
  ): Promise<{ received: true }> {
    const params = new URLSearchParams(rawBody ?? '');
    const accountSid = params.get('AccountSid');

    if (!accountSid) {
      return { received: true };
    }

    const account = await this.accounts.findOne({
      where: { externalAccountId: accountSid },
    });

    if (!account) {
      this.logger.warn(`Twilio webhook for unknown account ${accountSid}`);
      return { received: true };
    }

    await this.verifyTwilioSignature(account, params, signature, requestUrl);

    const messageSid = params.get('MessageSid');
    const body = params.get('Body');
    const status = params.get('MessageStatus') ?? params.get('SmsStatus');

    if (!messageSid) {
      return { received: true };
    }

    if (body !== null && body !== undefined) {
      const phone = await this.matchTwilioPhone(account, params.get('To'));

      if (!phone) {
        this.logger.warn('Twilio inbound message without a matching sender number');
        return { received: true };
      }

      await this.messaging.recordInbound({
        account,
        phone,
        fromPhone: params.get('From') ?? '',
        body,
        externalMessageId: messageSid,
        occurredAt: new Date(),
        payload: this.paramsToRecord(params),
      });

      if (isOptOutMessage(body)) {
        await this.consent.recordInboundOptOut(account.businessId, params.get('From') ?? '');
      }

      return { received: true };
    }

    const mapped = status ? TWILIO_STATUSES[status] : undefined;

    if (mapped) {
      await this.messaging.recordStatusUpdate({
        externalMessageId: messageSid,
        status: mapped,
        occurredAt: new Date(),
        error: params.get('ErrorMessage'),
        eventType: `twilio_${status}`,
        payload: this.paramsToRecord(params),
      });
    }

    return { received: true };
  }

  private async handleMetaValue(value: MetaWebhookValue): Promise<void> {
    const phoneNumberId = value.metadata?.phone_number_id;

    if (!phoneNumberId) {
      return;
    }

    const phone = await this.phoneNumbers.findOne({
      where: { externalPhoneNumberId: phoneNumberId },
    });

    if (!phone) {
      this.logger.warn(`Meta WhatsApp webhook for unknown number ${phoneNumberId}`);
      return;
    }

    const account = await this.accounts.findOne({ where: { id: phone.accountId } });

    if (!account) {
      return;
    }

    for (const status of value.statuses ?? []) {
      const mapped = status.status ? META_STATUSES[status.status] : undefined;

      if (!mapped || !status.id) {
        continue;
      }

      const error = status.errors?.length
        ? [status.errors[0].title, status.errors[0].message]
            .filter(Boolean)
            .join(': ')
        : null;

      await this.messaging.recordStatusUpdate({
        externalMessageId: status.id,
        status: mapped,
        occurredAt: this.metaTimestamp(status.timestamp),
        error,
        eventType: `meta_${status.status}`,
        payload: status as Record<string, unknown>,
      });
    }

    for (const message of value.messages ?? []) {
      if (!message.id) {
        continue;
      }

      const body = this.metaMessageBody(message);

      await this.messaging.recordInbound({
        account,
        phone,
        fromPhone: message.from ?? '',
        body,
        externalMessageId: message.id,
        occurredAt: this.metaTimestamp(message.timestamp),
        payload: message as Record<string, unknown>,
      });

      if (isOptOutMessage(body)) {
        await this.consent.recordInboundOptOut(account.businessId, message.from ?? '');
      }
    }
  }

  private async matchTwilioPhone(
    account: WhatsappAccount,
    to: string | null,
  ): Promise<WhatsappPhoneNumber | null> {
    const digits = normalisePhone(to);

    if (!digits) {
      return null;
    }

    const phones = await this.phoneNumbers.find({
      where: { accountId: account.id },
    });

    return (
      phones.find(
        (phone) =>
          normalisePhone(phone.displayPhoneNumber) === digits ||
          normalisePhone(phone.externalPhoneNumberId) === digits,
      ) ?? null
    );
  }

  /**
   * Twilio signs requests with HMAC-SHA1 over the URL followed by every form
   * parameter appended as sorted key/value pairs.
   */
  private async verifyTwilioSignature(
    account: WhatsappAccount,
    params: URLSearchParams,
    signature: string | undefined,
    requestUrl: string,
  ): Promise<void> {
    const credentials = this.decryptTwilioToken(account);

    if (!credentials) {
      throw new ServiceUnavailableException(
        'Twilio credentials are unavailable for webhook verification',
      );
    }

    if (!signature) {
      throw new ForbiddenException('Missing Twilio webhook signature');
    }

    const configuredUrl = this.config.get<string>('whatsapp.twilioWebhookUrl');
    const url = configuredUrl || requestUrl;
    const payload = [...params.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce((accumulator, [key, value]) => `${accumulator}${key}${value}`, url);
    const expected = createHmac('sha1', credentials).update(payload).digest('base64');
    const provided = Buffer.from(signature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');

    if (
      provided.length !== computed.length ||
      !timingSafeEqual(provided, computed)
    ) {
      throw new ForbiddenException('Invalid Twilio webhook signature');
    }
  }

  private decryptTwilioToken(account: WhatsappAccount): string | null {
    try {
      const credentials = JSON.parse(
        this.crypto.decrypt(account.credentialsEncrypted),
      ) as { authToken?: string };

      return credentials.authToken?.trim() || null;
    } catch {
      return null;
    }
  }

  private metaMessageBody(message: {
    type?: string;
    text?: { body?: string };
    button?: { text?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  }): string {
    if (message.text?.body) {
      return message.text.body;
    }

    if (message.button?.text) {
      return message.button.text;
    }

    if (message.interactive?.button_reply?.title) {
      return message.interactive.button_reply.title;
    }

    if (message.interactive?.list_reply?.title) {
      return message.interactive.list_reply.title;
    }

    return `[${message.type ?? 'unknown'} message]`;
  }

  private metaTimestamp(value: string | undefined): Date {
    if (value) {
      const seconds = Number(value);

      if (Number.isFinite(seconds)) {
        return new Date(seconds * 1000);
      }
    }

    return new Date();
  }

  private paramsToRecord(params: URLSearchParams): Record<string, unknown> {
    return Object.fromEntries(params.entries());
  }
}
