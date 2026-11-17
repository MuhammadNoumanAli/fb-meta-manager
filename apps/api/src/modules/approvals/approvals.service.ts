import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ApprovalDecision } from '../../common/enums/approval-decision.enum';
import { ApprovalExecutionStatus } from '../../common/enums/approval-execution-status.enum';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { ApprovalDecisionRecord } from '../../database/entities/approval-decision.entity';
import { ApprovalPolicy } from '../../database/entities/approval-policy.entity';
import { ApprovalRequest } from '../../database/entities/approval-request.entity';
import { ApprovalVersion } from '../../database/entities/approval-version.entity';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalExecutionRegistry } from './approval-execution.registry';
import { hashPayload } from './approval-hash';
import {
  toApprovalPolicyView,
  toApprovalRequestView,
  type ApprovalPolicyView,
  type ApprovalRequestView,
  type PagedApprovalResult,
} from './approvals.mappers';

const DEFAULT_EXPIRY_DAYS = 7;
const MAX_EXPIRY_DAYS = 30;

export interface ApprovalGate {
  policyEnabled: boolean;
  canDecide: boolean;
  required: boolean;
}

export interface RequestApprovalInput {
  actorUserId: string;
  businessId: string;
  targetType: ApprovalTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  payload: Record<string, unknown>;
  note?: string | null;
  approverUserId?: string | null;
  expiresAt?: string | null;
  context: RequestContext;
}

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalPolicy)
    private readonly policies: Repository<ApprovalPolicy>,
    @InjectRepository(ApprovalRequest)
    private readonly requests: Repository<ApprovalRequest>,
    @InjectRepository(ApprovalVersion)
    private readonly versions: Repository<ApprovalVersion>,
    @InjectRepository(ApprovalDecisionRecord)
    private readonly decisions: Repository<ApprovalDecisionRecord>,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly registry: ApprovalExecutionRegistry,
  ) {}

  async getPolicies(businessId: string): Promise<ApprovalPolicyView[]> {
    const policies = await this.policies.find({ where: { businessId } });

    return Object.values(ApprovalTargetType).map((targetType) =>
      toApprovalPolicyView(
        targetType,
        policies.find((policy) => policy.targetType === targetType) ?? null,
      ),
    );
  }

  async setPolicy(
    actorUserId: string,
    businessId: string,
    targetType: ApprovalTargetType,
    isEnabled: boolean,
    context: RequestContext,
  ): Promise<ApprovalPolicyView> {
    let policy = await this.policies.findOne({ where: { businessId, targetType } });

    if (!policy) {
      policy = this.policies.create({
        businessId,
        targetType,
        isEnabled,
        updatedByUserId: actorUserId,
      });
    } else {
      policy.isEnabled = isEnabled;
      policy.updatedByUserId = actorUserId;
    }

    const saved = await this.policies.save(policy);

    await this.audit.record({
      action: 'approval_policy.updated',
      actorUserId,
      businessId,
      entityType: 'approval_policy',
      entityId: saved.id,
      metadata: { targetType, isEnabled },
      context,
    });

    return toApprovalPolicyView(targetType, saved);
  }

  /**
   * Decides whether the actor may execute an action directly. Approvers (users
   * with approval.decide) keep direct execution so a client can still act when
   * they own the workspace; everyone else must submit a request.
   */
  async getGate(
    actorUserId: string,
    businessId: string,
    targetType: ApprovalTargetType,
  ): Promise<ApprovalGate> {
    const policy = await this.policies.findOne({ where: { businessId, targetType } });
    const policyEnabled = Boolean(policy?.isEnabled);

    if (!policyEnabled) {
      return { policyEnabled: false, canDecide: false, required: false };
    }

    const access = await this.access.getBusinessAccess(actorUserId, businessId);
    const canDecide = access.permissions.includes('approval.decide');

    return { policyEnabled: true, canDecide, required: !canDecide };
  }

  async createRequest(input: RequestApprovalInput): Promise<ApprovalRequestView> {
    this.registry.validate(input.targetType, input.payload);

    if (input.approverUserId) {
      await this.assertEligibleApprover(
        input.businessId,
        input.approverUserId,
        input.actorUserId,
      );
    }

    const targetId = input.targetId ?? null;
    const existing =
      targetId === null
        ? null
        : await this.requests.findOne({
            where: {
              businessId: input.businessId,
              targetType: input.targetType,
              targetId,
              requestedByUserId: input.actorUserId,
              status: ApprovalStatus.PENDING,
            },
          });

    if (existing) {
      await this.appendVersion(
        existing,
        input.actorUserId,
        input.payload,
        input.note ?? null,
        input.expiresAt ?? null,
      );
      await this.audit.record({
        action: 'approval.version_added',
        actorUserId: input.actorUserId,
        businessId: input.businessId,
        entityType: 'approval_request',
        entityId: existing.id,
        metadata: { targetType: input.targetType, version: existing.currentVersion + 1 },
        context: input.context,
      });

      return this.getRequest(input.businessId, existing.id);
    }

    const payloadHash = hashPayload(input.payload);
    const request = this.requests.create({
      businessId: input.businessId,
      targetType: input.targetType,
      targetId,
      targetLabel: input.targetLabel ?? null,
      requestedByUserId: input.actorUserId,
      approverUserId: input.approverUserId ?? null,
      status: ApprovalStatus.PENDING,
      currentVersion: 1,
      currentPayloadHash: payloadHash,
      executionStatus: ApprovalExecutionStatus.NOT_STARTED,
      expiresAt: this.resolveExpiry(input.expiresAt ?? null),
      requesterNote: input.note ?? null,
    });
    const saved = await this.requests.save(request);

    await this.versions.save(
      this.versions.create({
        approvalRequestId: saved.id,
        version: 1,
        payload: input.payload,
        payloadHash,
        note: input.note ?? null,
        createdByUserId: input.actorUserId,
      }),
    );

    await this.audit.record({
      action: 'approval.requested',
      actorUserId: input.actorUserId,
      businessId: input.businessId,
      entityType: 'approval_request',
      entityId: saved.id,
      metadata: {
        targetType: input.targetType,
        targetId,
        payloadHash,
      },
      context: input.context,
    });

    return this.getRequest(input.businessId, saved.id);
  }

  async listRequests(
    businessId: string,
    query: {
      status?: ApprovalStatus;
      targetType?: ApprovalTargetType;
      targetId?: string;
      mine?: boolean;
    },
    actorUserId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PagedApprovalResult<ApprovalRequestView>> {
    await this.requests.update(
      { businessId, status: ApprovalStatus.PENDING, expiresAt: LessThanOrEqual(new Date()) },
      { status: ApprovalStatus.EXPIRED },
    );

    const builder = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.requestedByUser', 'requestedBy')
      .leftJoinAndSelect('request.approverUser', 'approver')
      .leftJoinAndSelect('request.decidedByUser', 'decidedBy')
      .where('request.businessId = :businessId', { businessId })
      .orderBy('request.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      builder.andWhere('request.status = :status', { status: query.status });
    }

    if (query.targetType) {
      builder.andWhere('request.targetType = :targetType', { targetType: query.targetType });
    }

    if (query.targetId) {
      builder.andWhere('request.targetId = :targetId', { targetId: query.targetId });
    }

    if (query.mine) {
      builder.andWhere('request.requestedByUserId = :actorUserId', { actorUserId });
    }

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map((request) => toApprovalRequestView(request)),
      total,
      page,
      pageSize,
    };
  }

  async getRequest(businessId: string, approvalId: string): Promise<ApprovalRequestView> {
    const request = await this.loadRequest(businessId, approvalId);
    await this.expireIfNeeded(request);

    const [versions, decisions] = await Promise.all([
      this.versions.find({
        where: { approvalRequestId: request.id },
        relations: { createdByUser: true },
        order: { version: 'ASC' },
      }),
      this.decisions.find({
        where: { approvalRequestId: request.id },
        relations: { decidedByUser: true },
        order: { createdAt: 'ASC' },
      }),
    ]);

    return toApprovalRequestView(request, { versions, decisions });
  }

  async addVersion(
    actorUserId: string,
    businessId: string,
    approvalId: string,
    payload: Record<string, unknown>,
    note: string | null,
    context: RequestContext,
  ): Promise<ApprovalRequestView> {
    const request = await this.loadRequest(businessId, approvalId);
    await this.expireIfNeeded(request);

    if (request.requestedByUserId !== actorUserId) {
      throw new ForbiddenException('Only the requester can change this payload');
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be changed');
    }

    this.registry.validate(request.targetType, payload);
    await this.appendVersion(request, actorUserId, payload, note, null);

    await this.audit.record({
      action: 'approval.version_added',
      actorUserId,
      businessId,
      entityType: 'approval_request',
      entityId: request.id,
      metadata: { targetType: request.targetType, version: request.currentVersion + 1 },
      context,
    });

    return this.getRequest(businessId, approvalId);
  }

  async decide(
    actorUserId: string,
    businessId: string,
    approvalId: string,
    decision: ApprovalDecision,
    reason: string | null,
    version: number | undefined,
    context: RequestContext,
  ): Promise<ApprovalRequestView> {
    const request = await this.loadRequest(businessId, approvalId);
    await this.expireIfNeeded(request);

    if (request.status === ApprovalStatus.EXPIRED) {
      throw new BadRequestException('This approval request has expired');
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('This approval request has already been decided');
    }

    if (request.requestedByUserId === actorUserId) {
      throw new BadRequestException('You cannot decide your own approval request');
    }

    if (request.approverUserId && request.approverUserId !== actorUserId) {
      throw new ForbiddenException('This request is assigned to another approver');
    }

    const targetVersion = version ?? request.currentVersion;

    if (targetVersion !== request.currentVersion) {
      throw new ConflictException(
        'A newer payload version was submitted. Review the latest version before deciding.',
      );
    }

    const payloadVersion = await this.versions.findOne({
      where: { approvalRequestId: request.id, version: targetVersion },
    });

    if (!payloadVersion) {
      throw new NotFoundException('Approval payload version not found');
    }

    const now = new Date();
    const update =
      decision === ApprovalDecision.REJECTED
        ? {
            status: ApprovalStatus.REJECTED,
            decidedByUserId: actorUserId,
            decidedAt: now,
            decisionReason: reason,
          }
        : {
            status: ApprovalStatus.APPROVED,
            approvedVersionId: payloadVersion.id,
            approvedPayloadHash: payloadVersion.payloadHash,
            decidedByUserId: actorUserId,
            decidedAt: now,
            decisionReason: reason,
          };

    const result = await this.requests.update(
      { id: request.id, status: ApprovalStatus.PENDING },
      update,
    );

    if (!result.affected) {
      throw new ConflictException('This approval request was decided by someone else');
    }

    await this.decisions.insert({
      approvalRequestId: request.id,
      approvalVersionId: payloadVersion.id,
      decision,
      decidedByUserId: actorUserId,
      reason,
    });

    await this.audit.record({
      action: decision === ApprovalDecision.APPROVED ? 'approval.approved' : 'approval.rejected',
      actorUserId,
      businessId,
      entityType: 'approval_request',
      entityId: request.id,
      metadata: {
        targetType: request.targetType,
        version: targetVersion,
        reason,
      },
      context,
    });

    if (decision === ApprovalDecision.APPROVED) {
      await this.runExecution(businessId, request.id, actorUserId, context);
    }

    return this.getRequest(businessId, request.id);
  }

  async retryExecution(
    actorUserId: string,
    businessId: string,
    approvalId: string,
    context: RequestContext,
  ): Promise<ApprovalRequestView> {
    const request = await this.loadRequest(businessId, approvalId);

    if (request.status !== ApprovalStatus.APPROVED) {
      throw new BadRequestException('Only approved requests can be executed');
    }

    if (request.executionStatus !== ApprovalExecutionStatus.EXECUTED) {
      await this.runExecution(businessId, request.id, actorUserId, context);
    }

    return this.getRequest(businessId, approvalId);
  }

  async cancel(
    actorUserId: string,
    businessId: string,
    approvalId: string,
    context: RequestContext,
  ): Promise<ApprovalRequestView> {
    const request = await this.loadRequest(businessId, approvalId);
    await this.expireIfNeeded(request);

    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    if (request.requestedByUserId !== actorUserId) {
      const access = await this.access.getBusinessAccess(actorUserId, businessId);

      if (!access.permissions.includes('approval.decide')) {
        throw new ForbiddenException('Only the requester or an approver can cancel this request');
      }
    }

    await this.requests.update(
      { id: request.id, status: ApprovalStatus.PENDING },
      { status: ApprovalStatus.CANCELLED },
    );

    await this.audit.record({
      action: 'approval.cancelled',
      actorUserId,
      businessId,
      entityType: 'approval_request',
      entityId: request.id,
      metadata: { targetType: request.targetType },
      context,
    });

    return this.getRequest(businessId, approvalId);
  }

  private async runExecution(
    businessId: string,
    approvalId: string,
    actorUserId: string,
    context: RequestContext,
  ): Promise<void> {
    const request = await this.loadRequest(businessId, approvalId);

    if (request.executionStatus === ApprovalExecutionStatus.EXECUTED) {
      return;
    }

    if (!request.approvedVersionId || !request.approvedPayloadHash) {
      throw new BadRequestException('This request has no approved payload');
    }

    const approvedVersion = await this.versions.findOne({
      where: { id: request.approvedVersionId },
    });

    if (!approvedVersion) {
      throw new BadRequestException('The approved payload version no longer exists');
    }

    if (
      approvedVersion.version !== request.currentVersion ||
      request.currentPayloadHash !== request.approvedPayloadHash
    ) {
      await this.requests.update(request.id, {
        executionStatus: ApprovalExecutionStatus.FAILED,
        executionError: 'The payload changed after approval. Submit a new request.',
      });
      await this.audit.record({
        action: 'approval.execution_failed',
        actorUserId,
        businessId,
        entityType: 'approval_request',
        entityId: request.id,
        metadata: { reason: 'payload_changed' },
        context,
      });
      return;
    }

    await this.requests.update(request.id, {
      executionStatus: ApprovalExecutionStatus.EXECUTING,
      executionError: null,
    });

    try {
      const result = await this.registry.get(request.targetType).execute({
        request,
        payload: approvedVersion.payload,
        actorUserId,
        context,
      });

      await this.requests.update(request.id, {
        executionStatus: ApprovalExecutionStatus.EXECUTED,
        executedAt: new Date(),
        executionError: null,
      });
      await this.audit.record({
        action: 'approval.executed',
        actorUserId,
        businessId,
        entityType: request.targetType,
        entityId: result.entityId,
        metadata: {
          approvalRequestId: request.id,
          summary: result.summary,
          ...(result.metadata ?? {}),
        },
        context,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown execution error';

      await this.requests.update(request.id, {
        executionStatus: ApprovalExecutionStatus.FAILED,
        executedAt: new Date(),
        executionError: message.slice(0, 500),
      });
      await this.audit.record({
        action: 'approval.execution_failed',
        actorUserId,
        businessId,
        entityType: 'approval_request',
        entityId: request.id,
        metadata: { message },
        context,
      });
    }
  }

  private async appendVersion(
    request: ApprovalRequest,
    actorUserId: string,
    payload: Record<string, unknown>,
    note: string | null,
    expiresAt: string | null,
  ): Promise<void> {
    const version = request.currentVersion + 1;
    const payloadHash = hashPayload(payload);

    await this.versions.save(
      this.versions.create({
        approvalRequestId: request.id,
        version,
        payload,
        payloadHash,
        note,
        createdByUserId: actorUserId,
      }),
    );

    await this.requests.update(request.id, {
      currentVersion: version,
      currentPayloadHash: payloadHash,
      status: ApprovalStatus.PENDING,
      approvedVersionId: null,
      approvedPayloadHash: null,
      decidedByUserId: null,
      decidedAt: null,
      decisionReason: null,
      executionStatus: ApprovalExecutionStatus.NOT_STARTED,
      executedAt: null,
      executionError: null,
      requesterNote: note ?? request.requesterNote,
      expiresAt: expiresAt
        ? this.resolveExpiry(expiresAt)
        : request.expiresAt > new Date()
          ? request.expiresAt
          : this.resolveExpiry(null),
    });
  }

  private async loadRequest(
    businessId: string,
    approvalId: string,
  ): Promise<ApprovalRequest> {
    const request = await this.requests.findOne({
      where: { id: approvalId, businessId },
      relations: {
        requestedByUser: true,
        approverUser: true,
        decidedByUser: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    return request;
  }

  private async expireIfNeeded(request: ApprovalRequest): Promise<void> {
    if (request.status === ApprovalStatus.PENDING && request.expiresAt <= new Date()) {
      request.status = ApprovalStatus.EXPIRED;
      await this.requests.update(request.id, { status: ApprovalStatus.EXPIRED });
    }
  }

  private async assertEligibleApprover(
    businessId: string,
    approverUserId: string,
    requesterUserId: string,
  ): Promise<void> {
    if (approverUserId === requesterUserId) {
      throw new BadRequestException('You cannot assign yourself as the approver');
    }

    const access = await this.access.getBusinessAccess(approverUserId, businessId);

    if (!access.permissions.includes('approval.decide')) {
      throw new BadRequestException('The selected approver cannot decide requests');
    }
  }

  private resolveExpiry(value: string | null): Date {
    if (!value) {
      return new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid approval expiry');
    }

    const now = Date.now();
    const max = now + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (date.getTime() <= now || date.getTime() > max) {
      throw new BadRequestException('Approval expiry must be within the next 30 days');
    }

    return date;
  }

  /** Exposed for tests and callers that need the current pending request. */
  async findPending(
    businessId: string,
    targetType: ApprovalTargetType,
    targetId: string,
  ): Promise<ApprovalRequest | null> {
    return this.requests.findOne({
      where: {
        businessId,
        targetType,
        targetId,
        status: ApprovalStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
