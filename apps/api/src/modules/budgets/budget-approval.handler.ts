import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import {
  ApprovalExecutionRegistry,
  type ApprovalExecutionInput,
  type ApprovalExecutionResult,
  type ApprovalHandler,
} from '../approvals/approval-execution.registry';
import { BudgetsService, type BudgetValues } from './budgets.service';

@Injectable()
export class BudgetApprovalHandler implements ApprovalHandler, OnModuleInit {
  readonly targetType = ApprovalTargetType.BUDGET_CHANGE;

  constructor(
    private readonly registry: ApprovalExecutionRegistry,
    private readonly budgets: BudgetsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  validatePayload(payload: Record<string, unknown>): void {
    const action = payload.action;

    if (action !== 'create' && action !== 'update' && action !== 'delete') {
      throw new BadRequestException('Budget approval payload needs a valid action');
    }

    if (action === 'delete') {
      if (typeof payload.budgetId !== 'string') {
        throw new BadRequestException('Budget approval payload needs a budgetId');
      }

      return;
    }

    if (action === 'update' && typeof payload.budgetId !== 'string') {
      throw new BadRequestException('Budget update payload needs a budgetId');
    }

    const values = payload.values;

    if (!values || typeof values !== 'object') {
      throw new BadRequestException('Budget approval payload needs values');
    }

    const candidate = values as Partial<BudgetValues>;

    if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
      throw new BadRequestException('Budget approval payload needs a name');
    }

    if (typeof candidate.amount !== 'string' || Number(candidate.amount) <= 0) {
      throw new BadRequestException('Budget approval payload needs a positive amount');
    }

    if (typeof candidate.currency !== 'string') {
      throw new BadRequestException('Budget approval payload needs a currency');
    }
  }

  async execute(input: ApprovalExecutionInput): Promise<ApprovalExecutionResult> {
    const { payload, request } = input;
    const action = payload.action;

    if (action === 'create') {
      const budget = await this.budgets.applyCreate(
        input.actorUserId,
        request.businessId,
        payload.values as unknown as BudgetValues,
        request.id,
        request.requesterNote,
        input.context,
      );

      return {
        entityType: 'budget',
        entityId: budget.id,
        summary: `Created budget ${budget.name}`,
        metadata: { amount: budget.amount, currency: budget.currency },
      };
    }

    if (action === 'update') {
      const budget = await this.budgets.applyUpdate(
        input.actorUserId,
        request.businessId,
        String(payload.budgetId),
        payload.values as unknown as BudgetValues,
        request.id,
        input.context,
      );

      return {
        entityType: 'budget',
        entityId: budget.id,
        summary: `Updated budget ${budget.name}`,
        metadata: { amount: budget.amount, currency: budget.currency },
      };
    }

    await this.budgets.applyDelete(
      input.actorUserId,
      request.businessId,
      String(payload.budgetId),
      request.id,
      input.context,
    );

    return {
      entityType: 'budget',
      entityId: String(payload.budgetId),
      summary: 'Deleted budget',
    };
  }
}
