import { Injectable, Logger } from '@nestjs/common';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import type { ApprovalRequest } from '../../database/entities/approval-request.entity';

export interface ApprovalExecutionInput {
  request: ApprovalRequest;
  payload: Record<string, unknown>;
  actorUserId: string;
  context: RequestContext;
}

export interface ApprovalExecutionResult {
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Modules that own an approvable action register a handler. The approval
 * module stays independent of advertising and budgets, avoiding a module
 * cycle while keeping execution idempotent and payload-verified.
 */
export interface ApprovalHandler {
  readonly targetType: ApprovalTargetType;
  validatePayload?(payload: Record<string, unknown>): void;
  execute(input: ApprovalExecutionInput): Promise<ApprovalExecutionResult>;
}

@Injectable()
export class ApprovalExecutionRegistry {
  private readonly logger = new Logger(ApprovalExecutionRegistry.name);
  private readonly handlers = new Map<ApprovalTargetType, ApprovalHandler>();

  register(handler: ApprovalHandler): void {
    if (this.handlers.has(handler.targetType)) {
      this.logger.warn(`Approval handler replaced for ${handler.targetType}`);
    }

    this.handlers.set(handler.targetType, handler);
  }

  get(targetType: ApprovalTargetType): ApprovalHandler {
    const handler = this.handlers.get(targetType);

    if (!handler) {
      throw new Error(`No approval handler registered for ${targetType}`);
    }

    return handler;
  }

  validate(targetType: ApprovalTargetType, payload: Record<string, unknown>): void {
    this.get(targetType).validatePayload?.(payload);
  }
}
