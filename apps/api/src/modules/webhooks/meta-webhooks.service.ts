import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { WebhookEventStatus } from '../../common/enums/webhook-event-status.enum';
import { WebhookProcessingStatus } from '../../common/enums/webhook-processing-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { MetaPage } from '../../database/entities/meta-page.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';
import { WebhookProcessingLog } from '../../database/entities/webhook-processing-log.entity';
import { AuditService } from '../audit/audit.service';
import { LeadQueueService } from '../leads/lead-queue.service';

const PROVIDER = 'meta';

interface MetaWebhookChange {
  field?: string;
  value?: unknown;
}

interface MetaWebhookEntry {
  id?: string;
  time?: number;
  changes?: MetaWebhookChange[];
}

export interface MetaWebhookPayload {
  object?: string;
  entry?: MetaWebhookEntry[];
}

export interface MetaWebhookReceiveResult {
  received: number;
  duplicates: number;
}

export interface WebhookEventView {
  id: string;
  objectType: string;
  field: string | null;
  status: WebhookEventStatus;
  attempts: number;
  lastError: string | null;
  externalEntryId: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

export interface WebhookEventDetailView extends WebhookEventView {
  logs: Array<{
    id: string;
    status: WebhookProcessingStatus;
    message: string | null;
    createdAt: Date;
  }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/**
 * Verifies and stores Meta webhook deliveries. Signature validation uses the
 * exact raw request body, and every stored change gets a deterministic
 * idempotency key so repeated deliveries never create duplicate work.
 */
@Injectable()
export class MetaWebhooksService {
  private readonly logger = new Logger(MetaWebhooksService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly events: Repository<WebhookEvent>,
    @InjectRepository(WebhookProcessingLog)
    private readonly processingLogs: Repository<WebhookProcessingLog>,
    @InjectRepository(MetaPage)
    private readonly pages: Repository<MetaPage>,
    private readonly queue: LeadQueueService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {}

  verifyChallenge(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): string {
    const expected = this.configService.get<string>('meta.webhookVerifyToken');

    if (!expected) {
      throw new ServiceUnavailableException(
        'Meta webhook verification is not configured on this deployment',
      );
    }

    if (mode !== 'subscribe' || !token || !safeEqual(token, expected) || !challenge) {
      throw new ForbiddenException('Webhook verification failed');
    }

    this.logger.log('Meta webhook subscription challenge verified');
    return challenge;
  }

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    const secret = this.configService.get<string>('meta.appSecret');

    if (!secret) {
      throw new ServiceUnavailableException(
        'Meta webhook signatures cannot be validated without META_APP_SECRET',
      );
    }

    if (!rawBody || !signature?.startsWith('sha256=')) {
      throw new ForbiddenException('Missing or malformed webhook signature');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signature.slice('sha256='.length).trim().toLowerCase();

    if (!/^[a-f0-9]{64}$/.test(provided) || !safeEqual(provided, expected)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
  }

  async receive(payload: MetaWebhookPayload): Promise<MetaWebhookReceiveResult> {
    if (!payload || typeof payload.object !== 'string' || typeof payload.entry !== 'object') {
      throw new BadRequestException('Malformed Meta webhook payload');
    }

    if (!Array.isArray(payload.entry)) {
      throw new BadRequestException('Meta webhook payload is missing entries');
    }

    let received = 0;
    let duplicates = 0;

    for (const entry of payload.entry) {
      const changes = entry.changes?.length
        ? entry.changes
        : [{ field: undefined, value: undefined }];

      for (const change of changes) {
        const result = await this.storeChange(payload.object, entry, change);
        if (result === 'duplicate') {
          duplicates += 1;
        } else {
          received += 1;
        }
      }
    }

    return { received, duplicates };
  }

  async listEvents(businessId: string, limit = 50): Promise<WebhookEventView[]> {
    const events = await this.events.find({
      where: { businessId, provider: PROVIDER },
      order: { receivedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    return events.map((event) => this.toView(event));
  }

  async getEvent(businessId: string, eventId: string): Promise<WebhookEventDetailView> {
    const event = await this.events.findOne({
      where: { id: eventId, businessId, provider: PROVIDER },
    });

    if (!event) {
      throw new NotFoundException('Webhook event not found');
    }

    const logs = await this.processingLogs.find({
      where: { webhookEventId: event.id },
      order: { createdAt: 'ASC' },
    });

    return {
      ...this.toView(event),
      logs: logs.map((log) => ({
        id: log.id,
        status: log.status,
        message: log.message,
        createdAt: log.createdAt,
      })),
    };
  }

  async retryEvent(
    userId: string,
    businessId: string,
    eventId: string,
    context?: RequestContext,
  ): Promise<WebhookEventView> {
    const event = await this.events.findOne({
      where: { id: eventId, businessId, provider: PROVIDER },
    });

    if (!event) {
      throw new NotFoundException('Webhook event not found');
    }

    if (event.status === WebhookEventStatus.PROCESSED) {
      throw new BadRequestException('Webhook event has already been processed');
    }

    if (event.status === WebhookEventStatus.IGNORED) {
      throw new BadRequestException('Webhook event was ignored and cannot be retried');
    }

    await this.events.update(event.id, {
      status: WebhookEventStatus.RECEIVED,
      lastError: null,
    });
    await this.log(event.id, WebhookProcessingStatus.RETRY_QUEUED, 'Retry requested');

    try {
      await this.queue.enqueueWebhookEvent(event.id, true);
    } catch (error) {
      const message = this.describeError(error);
      await this.events.update(event.id, {
        status: WebhookEventStatus.FAILED,
        lastError: message,
      });
      await this.log(event.id, WebhookProcessingStatus.FAILED, message);
      throw new ServiceUnavailableException('Unable to queue the webhook event');
    }

    await this.audit.record({
      action: 'webhook_event.retried',
      actorUserId: userId,
      businessId,
      entityType: 'webhook_event',
      entityId: event.id,
      context,
    });

    const updated = await this.events.findOneOrFail({ where: { id: event.id } });
    return this.toView(updated);
  }

  private async storeChange(
    objectType: string,
    entry: MetaWebhookEntry,
    change: MetaWebhookChange,
  ): Promise<'received' | 'duplicate'> {
    const field = stringValue(change.field) ?? null;
    const value = isRecord(change.value) ? change.value : {};
    const pageId =
      stringValue(value.page_id) ?? stringValue(entry.id);
    const page = pageId
      ? await this.pages.findOne({ where: { externalId: pageId } })
      : null;
    const idempotencyKey = this.idempotencyKey(objectType, entry, field, value);
    const businessId = page?.businessId ?? null;
    const isLeadgen = field === 'leadgen';
    const status =
      isLeadgen && businessId ? WebhookEventStatus.RECEIVED : WebhookEventStatus.IGNORED;
    const payload = {
      object: objectType,
      entryId: entry.id ?? null,
      entryTime: entry.time ?? null,
      field,
      value,
    };

    try {
      const result = await this.events.insert({
        provider: PROVIDER,
        objectType,
        field,
        businessId,
        authorizationId: page?.authorizationId ?? null,
        externalEntryId: pageId ?? null,
        idempotencyKey,
        status,
        payload: payload as never,
        processedAt: status === WebhookEventStatus.IGNORED ? new Date() : null,
      });
      const eventId = result.identifiers[0]?.id as string;

      await this.log(eventId, WebhookProcessingStatus.RECEIVED, 'Webhook delivered');

      if (status === WebhookEventStatus.IGNORED) {
        await this.log(
          eventId,
          WebhookProcessingStatus.IGNORED,
          businessId
            ? `No processor registered for field ${field ?? 'unknown'}`
            : 'Event source is not linked to a known business',
        );
        return 'received';
      }

      try {
        await this.queue.enqueueWebhookEvent(eventId);
        await this.log(eventId, WebhookProcessingStatus.QUEUED, 'Queued for processing');
      } catch (error) {
        const message = this.describeError(error);
        await this.events.update(eventId, {
          status: WebhookEventStatus.FAILED,
          lastError: message,
        });
        await this.log(eventId, WebhookProcessingStatus.FAILED, message);
      }

      return 'received';
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        const existing = await this.events.findOne({
          where: { provider: PROVIDER, idempotencyKey },
        });

        if (existing && existing.status === WebhookEventStatus.FAILED) {
          // A duplicate delivery is a free retry opportunity.
          try {
            await this.queue.enqueueWebhookEvent(existing.id, true);
            await this.events.update(existing.id, {
              status: WebhookEventStatus.RECEIVED,
              lastError: null,
            });
            await this.log(
              existing.id,
              WebhookProcessingStatus.RETRY_QUEUED,
              'Duplicate delivery requeued a failed event',
            );
          } catch {
            // Keep the original failure; an operator can still retry manually.
          }
        }

        return 'duplicate';
      }

      throw error;
    }
  }

  private idempotencyKey(
    objectType: string,
    entry: MetaWebhookEntry,
    field: string | null,
    value: Record<string, unknown>,
  ): string {
    if (field === 'leadgen') {
      const leadgenId = stringValue(value.leadgen_id);

      if (leadgenId) {
        return sha256(`meta:leadgen:${leadgenId}`);
      }
    }

    return sha256(
      JSON.stringify({
        objectType,
        entryId: entry.id ?? null,
        entryTime: entry.time ?? null,
        field,
        value,
      }),
    );
  }

  private async log(
    eventId: string,
    status: WebhookProcessingStatus,
    message: string,
  ): Promise<void> {
    await this.processingLogs
      .insert({ webhookEventId: eventId, status, message })
      .catch(() => undefined);
  }

  private toView(event: WebhookEvent): WebhookEventView {
    return {
      id: event.id,
      objectType: event.objectType,
      field: event.field,
      status: event.status,
      attempts: event.attempts,
      lastError: event.lastError,
      externalEntryId: event.externalEntryId,
      receivedAt: event.receivedAt,
      processedAt: event.processedAt,
    };
  }

  private describeError(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown webhook error').slice(0, 500);
  }
}
