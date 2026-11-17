import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import {
  ApprovalExecutionRegistry,
  type ApprovalExecutionInput,
  type ApprovalExecutionResult,
  type ApprovalHandler,
} from '../approvals/approval-execution.registry';
import { BulkOperationsService } from './bulk-operations.service';

@Injectable()
export class BulkApprovalHandler implements ApprovalHandler, OnModuleInit {
  readonly targetType = ApprovalTargetType.BULK_OPERATION;

  constructor(
    private readonly registry: ApprovalExecutionRegistry,
    private readonly bulk: BulkOperationsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  validatePayload(payload: Record<string, unknown>): void {
    if (typeof payload.operationId !== 'string' || payload.operationId.length === 0) {
      throw new BadRequestException('Bulk approval payload needs an operationId');
    }
  }

  async execute(input: ApprovalExecutionInput): Promise<ApprovalExecutionResult> {
    const operationId = String(input.payload.operationId);
    const operation = await this.bulk.startApproved(operationId);

    return {
      entityType: 'bulk_operation',
      entityId: operationId,
      summary: `Queued ${operation.operation} for ${operation.total} campaign(s)`,
      metadata: { total: operation.total, operation: operation.operation },
    };
  }
}
