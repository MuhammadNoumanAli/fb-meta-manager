import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import {
  ApprovalExecutionRegistry,
  type ApprovalExecutionInput,
  type ApprovalExecutionResult,
  type ApprovalHandler,
} from '../approvals/approval-execution.registry';
import { AutomationRunnerService } from './automation-runner.service';

@Injectable()
export class AutomationApprovalHandler implements ApprovalHandler, OnModuleInit {
  readonly targetType = ApprovalTargetType.AUTOMATION_ACTION;

  constructor(
    private readonly registry: ApprovalExecutionRegistry,
    private readonly runner: AutomationRunnerService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  validatePayload(payload: Record<string, unknown>): void {
    if (typeof payload.executionId !== 'string' || payload.executionId.length === 0) {
      throw new BadRequestException('Automation approval payload needs an executionId');
    }
  }

  async execute(input: ApprovalExecutionInput): Promise<ApprovalExecutionResult> {
    const executionId = String(input.payload.executionId);
    const summary = await this.runner.executeApproved(
      executionId,
      input.actorUserId,
      input.context,
    );

    return {
      entityType: 'automation_execution',
      entityId: executionId,
      summary: summary.summary,
      metadata: { status: summary.status },
    };
  }
}
