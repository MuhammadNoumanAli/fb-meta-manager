import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import { BulkOperationItemStatus } from '../../common/enums/bulk-operation-item-status.enum';
import { BulkOperationStatus } from '../../common/enums/bulk-operation-status.enum';
import { BulkOperationType } from '../../common/enums/bulk-operation-type.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { classifyFailure, failureMessage, jitteredDelay } from '../../common/utilities/retry-policy';
import { BulkOperationItem } from '../../database/entities/bulk-operation-item.entity';
import { BulkOperation } from '../../database/entities/bulk-operation.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { AdvertisingService } from '../advertising/advertising.service';
import { CampaignPublishingService } from '../advertising/campaign-publishing.service';
import { ApprovalsService } from '../approvals/approvals.service';
import type { ApprovalRequestView } from '../approvals/approvals.mappers';
import { AuditService } from '../audit/audit.service';
import { BulkOperationQueueService } from './bulk-operation-queue.service';
import {
  toBulkOperationDetailView,
  toBulkOperationView,
  type BulkOperationDetailView,
  type BulkOperationView,
} from './bulk.mappers';
import { CreateBulkOperationDto } from './dto/create-bulk-operation.dto';
import { ListBulkOperationsQueryDto } from './dto/list-bulk-operations-query.dto';
import { ExecutionLockService } from './execution-lock.service';

export interface BulkOperationMutationResult {
  approvalRequired: boolean;
  approval: ApprovalRequestView | null;
  operation: BulkOperationDetailView | null;
}

export interface PagedBulkResult {
  items: BulkOperationView[];
  total: number;
  page: number;
  pageSize: number;
}

const ITEM_ATTEMPTS = 3;
const LOCK_TTL_MS = 10 * 60 * 1000;
const AUTOMATION_CONTEXT: RequestContext = {
  ipAddress: null,
  userAgent: 'adpilot-automation',
};

const STATUS_FOR_OPERATION: Record<BulkOperationType, AdvertisingStatus | null> = {
  [BulkOperationType.PAUSE_CAMPAIGNS]: AdvertisingStatus.PAUSED,
  [BulkOperationType.RESUME_CAMPAIGNS]: AdvertisingStatus.ACTIVE,
  [BulkOperationType.ARCHIVE_CAMPAIGNS]: AdvertisingStatus.ARCHIVED,
  [BulkOperationType.SYNC_CAMPAIGNS]: null,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bulk campaign operations. Each target is an independent item, so partial
 * failures are recorded per campaign and a retry only re-runs failed items.
 */
@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);

  constructor(
    @InjectRepository(BulkOperation)
    private readonly operations: Repository<BulkOperation>,
    @InjectRepository(BulkOperationItem)
    private readonly items: Repository<BulkOperationItem>,
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    private readonly advertising: AdvertisingService,
    private readonly publishing: CampaignPublishingService,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
    private readonly queue: BulkOperationQueueService,
    private readonly locks: ExecutionLockService,
  ) {}

  async create(
    actorUserId: string,
    businessId: string,
    dto: CreateBulkOperationDto,
    context: RequestContext,
  ): Promise<BulkOperationMutationResult> {
    const campaignIds = [...new Set(dto.campaignIds)];
    const campaigns = await this.campaigns.find({
      where: { businessId, id: In(campaignIds) },
    });

    if (campaigns.length !== campaignIds.length) {
      throw new BadRequestException(
        `${campaignIds.length - campaigns.length} target campaign(s) were not found in this business`,
      );
    }

    const order = new Map(campaignIds.map((id, index) => [id, index]));
    campaigns.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));

    const operation = await this.operations.save(
      this.operations.create({
        businessId,
        operation: dto.operation,
        status: BulkOperationStatus.QUEUED,
        total: campaigns.length,
        succeeded: 0,
        failed: 0,
        pending: campaigns.length,
        reason: dto.reason?.trim() || null,
        requestedByUserId: actorUserId,
      }),
    );

    await this.items.save(
      campaigns.map((campaign) =>
        this.items.create({
          bulkOperationId: operation.id,
          campaignId: campaign.id,
          campaignLabel: campaign.name,
          status: BulkOperationItemStatus.PENDING,
          attempts: 0,
        }),
      ),
    );

    await this.audit.record({
      action: 'bulk_operation.created',
      actorUserId,
      businessId,
      entityType: 'bulk_operation',
      entityId: operation.id,
      metadata: { operation: operation.operation, total: operation.total },
      context,
    });

    const gate = await this.approvals.getGate(
      actorUserId,
      businessId,
      ApprovalTargetType.BULK_OPERATION,
    );

    if (gate.required) {
      const approval = await this.approvals.createRequest({
        actorUserId,
        businessId,
        targetType: ApprovalTargetType.BULK_OPERATION,
        targetId: operation.id,
        targetLabel: `${operation.operation} (${operation.total} campaigns)`,
        payload: { operationId: operation.id },
        note: `Bulk ${operation.operation} requires approval`,
        context,
      });

      await this.operations.update(operation.id, { approvalRequestId: approval.id });

      return {
        approvalRequired: true,
        approval,
        operation: await this.getOperation(businessId, operation.id),
      };
    }

    await this.queue.enqueueOperation(operation.id);

    return {
      approvalRequired: false,
      approval: null,
      operation: await this.getOperation(businessId, operation.id),
    };
  }

  /** Called by the approval handler once an approver released the request. */
  async startApproved(operationId: string): Promise<BulkOperationView> {
    const operation = await this.operations.findOne({
      where: { id: operationId },
      relations: { requestedByUser: true },
    });

    if (!operation) {
      throw new NotFoundException('Bulk operation not found');
    }

    if (operation.status !== BulkOperationStatus.CANCELLED) {
      await this.operations.update(operation.id, { status: BulkOperationStatus.QUEUED });
      await this.queue.enqueueOperation(operation.id, Date.now());
      await this.audit.record({
        action: 'bulk_operation.approved',
        actorUserId: operation.requestedByUserId,
        businessId: operation.businessId,
        entityType: 'bulk_operation',
        entityId: operation.id,
        metadata: { operation: operation.operation },
        context: AUTOMATION_CONTEXT,
      });
    }

    return toBulkOperationView(operation);
  }

  async list(
    businessId: string,
    query: ListBulkOperationsQueryDto,
  ): Promise<PagedBulkResult> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
    const builder = this.operations
      .createQueryBuilder('operation')
      .leftJoinAndSelect('operation.requestedByUser', 'requestedBy')
      .where('operation.businessId = :businessId', { businessId })
      .orderBy('operation.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      builder.andWhere('operation.status = :status', { status: query.status });
    }

    const [items, total] = await builder.getManyAndCount();

    return { items: items.map(toBulkOperationView), total, page, pageSize };
  }

  async getOperation(
    businessId: string,
    operationId: string,
  ): Promise<BulkOperationDetailView> {
    return toBulkOperationDetailView(
      await this.requireOperation(businessId, operationId),
    );
  }

  /** Worker entry point. Safe to run twice thanks to the per-operation lock. */
  async process(operationId: string): Promise<void> {
    const operation = await this.operations.findOne({
      where: { id: operationId },
      relations: { items: true },
    });

    if (!operation) {
      this.logger.warn(`Bulk operation ${operationId} no longer exists`);
      return;
    }

    if (
      operation.status === BulkOperationStatus.CANCELLED ||
      operation.status === BulkOperationStatus.COMPLETED
    ) {
      return;
    }

    const owner = randomUUID();
    const lockKey = `bulk-operation:${operation.id}`;

    if (!(await this.locks.acquire(lockKey, LOCK_TTL_MS, owner))) {
      return;
    }

    try {
      await this.operations.update(operation.id, { status: BulkOperationStatus.RUNNING });
      const actorUserId = operation.requestedByUserId;

      for (const item of operation.items) {
        if (item.status !== BulkOperationItemStatus.PENDING) {
          continue;
        }

        const claim = await this.items
          .createQueryBuilder()
          .update(BulkOperationItem)
          .set({
            status: BulkOperationItemStatus.RUNNING,
            startedAt: new Date(),
            finishedAt: null,
            error: null,
            attempts: () => 'attempts + 1',
          })
          .where('id = :id', { id: item.id })
          .andWhere('status = :pending', { pending: BulkOperationItemStatus.PENDING })
          .execute();

        if (!claim.affected) {
          continue;
        }

        if (!actorUserId) {
          await this.markItemFailed(item.id, 'The requester is no longer available');
          continue;
        }

        await this.runItem(operation, item, actorUserId);
      }

      await this.finalize(operation.id);
    } finally {
      await this.locks.release(lockKey, owner);
    }
  }

  async retryFailed(
    actorUserId: string,
    businessId: string,
    operationId: string,
    context: RequestContext,
  ): Promise<BulkOperationDetailView> {
    const operation = await this.requireOperation(businessId, operationId);

    if (
      operation.status !== BulkOperationStatus.PARTIAL &&
      operation.status !== BulkOperationStatus.FAILED
    ) {
      throw new BadRequestException(
        'Only partially failed or failed bulk operations can be retried',
      );
    }

    const failed = operation.items.filter(
      (item) => item.status === BulkOperationItemStatus.FAILED,
    );

    if (failed.length === 0) {
      throw new BadRequestException('This bulk operation has no failed items');
    }

    await this.items.update(
      { id: In(failed.map((item) => item.id)) },
      {
        status: BulkOperationItemStatus.PENDING,
        error: null,
        result: null,
        startedAt: null,
        finishedAt: null,
      },
    );
    await this.operations.update(operation.id, {
      status: BulkOperationStatus.QUEUED,
      failed: 0,
      pending: failed.length,
      completedAt: null,
    });
    await this.queue.enqueueOperation(operation.id, Date.now());
    await this.audit.record({
      action: 'bulk_operation.retry_requested',
      actorUserId,
      businessId,
      entityType: 'bulk_operation',
      entityId: operation.id,
      metadata: { retried: failed.length },
      context,
    });

    return this.getOperation(businessId, operationId);
  }

  private async runItem(
    operation: BulkOperation,
    item: BulkOperationItem,
    actorUserId: string,
  ): Promise<void> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= ITEM_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.executeItem(
          operation.operation,
          operation.businessId,
          item.campaignId,
          actorUserId,
        );
        await this.items.update(item.id, {
          status: BulkOperationItemStatus.SUCCEEDED,
          finishedAt: new Date(),
          error: null,
          result: result as never,
        });
        return;
      } catch (error) {
        lastError = error;

        if (classifyFailure(error) === 'permanent' || attempt === ITEM_ATTEMPTS) {
          break;
        }

        await this.items.update(item.id, {
          attempts: attempt,
          error: failureMessage(error).slice(0, 500),
        });
        await sleep(Math.min(jitteredDelay(attempt), 1000));
      }
    }

    await this.markItemFailed(item.id, failureMessage(lastError).slice(0, 500));
  }

  private async executeItem(
    operation: BulkOperationType,
    businessId: string,
    campaignId: string,
    actorUserId: string,
  ): Promise<Record<string, unknown>> {
    if (operation === BulkOperationType.SYNC_CAMPAIGNS) {
      await this.publishing.syncCampaign(
        actorUserId,
        businessId,
        campaignId,
        AUTOMATION_CONTEXT,
      );

      return { action: operation, summary: 'Campaign synchronised with Meta' };
    }

    const status = STATUS_FOR_OPERATION[operation];

    if (!status) {
      throw new Error('Unsupported bulk operation');
    }

    const campaign = await this.advertising.applyStatusChange(
      actorUserId,
      businessId,
      campaignId,
      status,
      AUTOMATION_CONTEXT,
    );

    return { action: operation, campaignStatus: campaign.status, summary: campaign.name };
  }

  private async markItemFailed(itemId: string, message: string): Promise<void> {
    await this.items.update(itemId, {
      status: BulkOperationItemStatus.FAILED,
      error: message,
      finishedAt: new Date(),
    });
  }

  private async finalize(operationId: string): Promise<void> {
    const operation = await this.operations.findOne({
      where: { id: operationId },
      relations: { items: true },
    });

    if (!operation) {
      return;
    }

    const succeeded = operation.items.filter(
      (item) => item.status === BulkOperationItemStatus.SUCCEEDED,
    ).length;
    const failed = operation.items.filter(
      (item) => item.status === BulkOperationItemStatus.FAILED,
    ).length;
    const pending = operation.items.filter(
      (item) =>
        item.status === BulkOperationItemStatus.PENDING ||
        item.status === BulkOperationItemStatus.RUNNING,
    ).length;
    const status =
      pending > 0
        ? BulkOperationStatus.RUNNING
        : failed === 0
          ? BulkOperationStatus.COMPLETED
          : succeeded === 0
            ? BulkOperationStatus.FAILED
            : BulkOperationStatus.PARTIAL;

    await this.operations.update(operation.id, {
      status,
      succeeded,
      failed,
      pending,
      completedAt: pending > 0 ? null : new Date(),
    });

    await this.audit.record({
      action: 'bulk_operation.processed',
      actorUserId: operation.requestedByUserId,
      businessId: operation.businessId,
      entityType: 'bulk_operation',
      entityId: operation.id,
      metadata: { status, succeeded, failed, pending, total: operation.total },
      context: AUTOMATION_CONTEXT,
    });
  }

  private async requireOperation(
    businessId: string,
    operationId: string,
  ): Promise<BulkOperation> {
    const operation = await this.operations.findOne({
      where: { id: operationId, businessId },
      relations: { items: true, requestedByUser: true },
    });

    if (!operation) {
      throw new NotFoundException('Bulk operation not found');
    }

    return operation;
  }
}
