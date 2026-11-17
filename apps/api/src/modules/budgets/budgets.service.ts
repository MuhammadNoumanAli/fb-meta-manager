import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import { BudgetAlertStatus } from '../../common/enums/budget-alert-status.enum';
import { BudgetPeriod } from '../../common/enums/budget-period.enum';
import { BudgetScope } from '../../common/enums/budget-scope.enum';
import { BudgetTransactionType } from '../../common/enums/budget-transaction-type.enum';
import { SpendSnapshotSource } from '../../common/enums/spend-snapshot-source.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { BudgetAlert } from '../../database/entities/budget-alert.entity';
import { BudgetTransaction } from '../../database/entities/budget-transaction.entity';
import { Budget } from '../../database/entities/budget.entity';
import { Business } from '../../database/entities/business.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { SpendSnapshot } from '../../database/entities/spend-snapshot.entity';
import { ApprovalsService } from '../approvals/approvals.service';
import type { ApprovalRequestView } from '../approvals/approvals.mappers';
import { AuditService } from '../audit/audit.service';
import {
  toBudgetAlertView,
  toBudgetTransactionView,
  toBudgetView,
  toSpendSnapshotView,
  type BudgetAlertView,
  type BudgetDetailView,
  type BudgetSpendSummary,
  type BudgetView,
} from './budgets.mappers';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateSpendSnapshotDto } from './dto/create-spend-snapshot.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

export interface BudgetValues {
  scope: BudgetScope;
  campaignId: string | null;
  name: string;
  amount: string;
  currency: string;
  period: BudgetPeriod;
  alertThresholdPercent: number;
  isActive: boolean;
  notes: string | null;
}

export interface BudgetMutationResult {
  approvalRequired: boolean;
  approval: ApprovalRequestView | null;
  budget: BudgetView | null;
}

const MAX_ERROR_LENGTH = 500;

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    @InjectRepository(Budget) private readonly budgets: Repository<Budget>,
    @InjectRepository(BudgetTransaction)
    private readonly transactions: Repository<BudgetTransaction>,
    @InjectRepository(SpendSnapshot)
    private readonly snapshots: Repository<SpendSnapshot>,
    @InjectRepository(BudgetAlert) private readonly alerts: Repository<BudgetAlert>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Business) private readonly businesses: Repository<Business>,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
  ) {}

  async listBudgets(businessId: string, scope?: BudgetScope): Promise<BudgetView[]> {
    const budgets = await this.budgets.find({
      where: { businessId, ...(scope ? { scope } : {}) },
      relations: { campaign: true },
      order: { createdAt: 'DESC' },
    });

    return Promise.all(budgets.map((budget) => this.toView(budget)));
  }

  async getDetail(businessId: string, budgetId: string): Promise<BudgetDetailView> {
    const budget = await this.requireBudget(businessId, budgetId);
    const [view, snapshots, alerts, transactions] = await Promise.all([
      this.toView(budget),
      this.snapshots.find({
        where: { budgetId: budget.id },
        order: { capturedAt: 'DESC' },
        take: 25,
      }),
      this.alerts.find({
        where: { budgetId: budget.id },
        relations: { budget: true, campaign: true },
        order: { createdAt: 'DESC' },
        take: 25,
      }),
      this.transactions.find({
        where: { budgetId: budget.id },
        order: { createdAt: 'DESC' },
        take: 25,
      }),
    ]);

    return {
      ...view,
      snapshots: snapshots.map(toSpendSnapshotView),
      alerts: alerts.map(toBudgetAlertView),
      transactions: transactions.map(toBudgetTransactionView),
    };
  }

  async createBudget(
    actorUserId: string,
    businessId: string,
    dto: CreateBudgetDto,
    context: RequestContext,
  ): Promise<BudgetMutationResult> {
    const values = await this.resolveCreateValues(businessId, dto);
    const gate = await this.approvals.getGate(
      actorUserId,
      businessId,
      ApprovalTargetType.BUDGET_CHANGE,
    );

    if (gate.required) {
      const approval = await this.approvals.createRequest({
        actorUserId,
        businessId,
        targetType: ApprovalTargetType.BUDGET_CHANGE,
        targetId: values.campaignId,
        targetLabel: values.name,
        payload: { action: 'create', values },
        note: `Create budget ${values.name}`,
        context,
      });

      return { approvalRequired: true, approval, budget: null };
    }

    const budget = await this.applyCreate(
      actorUserId,
      businessId,
      values,
      null,
      null,
      context,
    );

    return { approvalRequired: false, approval: null, budget };
  }

  async updateBudget(
    actorUserId: string,
    businessId: string,
    budgetId: string,
    dto: UpdateBudgetDto,
    context: RequestContext,
  ): Promise<BudgetMutationResult> {
    const budget = await this.requireBudget(businessId, budgetId);
    const values = this.mergeValues(budget, dto);
    const gate = await this.approvals.getGate(
      actorUserId,
      businessId,
      ApprovalTargetType.BUDGET_CHANGE,
    );

    if (gate.required) {
      const approval = await this.approvals.createRequest({
        actorUserId,
        businessId,
        targetType: ApprovalTargetType.BUDGET_CHANGE,
        targetId: budget.id,
        targetLabel: budget.name,
        payload: { action: 'update', budgetId: budget.id, values },
        note: `Update budget ${budget.name}`,
        context,
      });

      return { approvalRequired: true, approval, budget: null };
    }

    const updated = await this.applyUpdate(
      actorUserId,
      businessId,
      budget.id,
      values,
      null,
      context,
    );

    return { approvalRequired: false, approval: null, budget: updated };
  }

  async deleteBudget(
    actorUserId: string,
    businessId: string,
    budgetId: string,
    context: RequestContext,
  ): Promise<BudgetMutationResult> {
    const budget = await this.requireBudget(businessId, budgetId);
    const gate = await this.approvals.getGate(
      actorUserId,
      businessId,
      ApprovalTargetType.BUDGET_CHANGE,
    );

    if (gate.required) {
      const approval = await this.approvals.createRequest({
        actorUserId,
        businessId,
        targetType: ApprovalTargetType.BUDGET_CHANGE,
        targetId: budget.id,
        targetLabel: budget.name,
        payload: { action: 'delete', budgetId: budget.id },
        note: `Delete budget ${budget.name}`,
        context,
      });

      return { approvalRequired: true, approval, budget: null };
    }

    await this.applyDelete(actorUserId, businessId, budget.id, null, context);

    return { approvalRequired: false, approval: null, budget: null };
  }

  /** Executed by the approval handler after payload verification. */
  async applyCreate(
    actorUserId: string,
    businessId: string,
    values: BudgetValues,
    approvalRequestId: string | null,
    note: string | null,
    context: RequestContext,
  ): Promise<BudgetView> {
    await this.assertBudgetSlotFree(businessId, values);

    const budget = this.budgets.create({
      businessId,
      campaignId: values.campaignId,
      scope: values.scope,
      name: values.name,
      amount: values.amount,
      currency: values.currency,
      period: values.period,
      alertThresholdPercent: values.alertThresholdPercent,
      isActive: values.isActive,
      notes: values.notes,
      createdByUserId: actorUserId,
    });
    const saved = await this.budgets.save(budget);

    await this.recordTransaction(
      saved,
      BudgetTransactionType.CREATED,
      saved.amount,
      null,
      actorUserId,
      approvalRequestId,
      note,
    );
    await this.audit.record({
      action: 'budget.created',
      actorUserId,
      businessId,
      entityType: 'budget',
      entityId: saved.id,
      metadata: {
        scope: saved.scope,
        campaignId: saved.campaignId,
        amount: saved.amount,
        currency: saved.currency,
        approvalRequestId,
      },
      context,
    });
    await this.evaluateBudget(saved);

    return this.toView(await this.requireBudget(businessId, saved.id));
  }

  async applyUpdate(
    actorUserId: string,
    businessId: string,
    budgetId: string,
    values: BudgetValues,
    approvalRequestId: string | null,
    context: RequestContext,
  ): Promise<BudgetView> {
    const budget = await this.requireBudget(businessId, budgetId);
    const previousAmount = budget.amount;

    budget.name = values.name;
    budget.amount = values.amount;
    budget.currency = values.currency;
    budget.period = values.period;
    budget.alertThresholdPercent = values.alertThresholdPercent;
    budget.isActive = values.isActive;
    budget.notes = values.notes;

    const saved = await this.budgets.save(budget);

    await this.recordTransaction(
      saved,
      BudgetTransactionType.UPDATED,
      saved.amount,
      previousAmount,
      actorUserId,
      approvalRequestId,
      null,
    );
    await this.audit.record({
      action: 'budget.updated',
      actorUserId,
      businessId,
      entityType: 'budget',
      entityId: saved.id,
      metadata: {
        previousAmount,
        amount: saved.amount,
        approvalRequestId,
      },
      context,
    });
    await this.evaluateBudget(saved);

    return this.toView(await this.requireBudget(businessId, saved.id));
  }

  async applyDelete(
    actorUserId: string,
    businessId: string,
    budgetId: string,
    approvalRequestId: string | null,
    context: RequestContext,
  ): Promise<void> {
    const budget = await this.requireBudget(businessId, budgetId);
    await this.budgets.remove(budget);
    await this.audit.record({
      action: 'budget.deleted',
      actorUserId,
      businessId,
      entityType: 'budget',
      entityId: budgetId,
      metadata: {
        name: budget.name,
        amount: budget.amount,
        currency: budget.currency,
        approvalRequestId,
      },
      context,
    });
  }

  async recordManualSnapshot(
    actorUserId: string,
    businessId: string,
    budgetId: string,
    dto: CreateSpendSnapshotDto,
    context: RequestContext,
  ): Promise<BudgetDetailView> {
    const budget = await this.requireBudget(businessId, budgetId);
    const currency = this.normalizeCurrency(dto.currency ?? budget.currency);

    if (currency !== budget.currency) {
      throw new BadRequestException(
        `Spend snapshots for this budget must use ${budget.currency}`,
      );
    }

    await this.snapshots.insert({
      businessId,
      campaignId: budget.campaignId,
      budgetId: budget.id,
      source: SpendSnapshotSource.MANUAL,
      amount: Number(dto.amount).toFixed(2),
      currency,
      periodKey: this.periodKey(budget.period),
      metadata: dto.note ? { note: dto.note } : null,
    });

    await this.evaluateBudget(budget);
    await this.audit.record({
      action: 'budget.snapshot_recorded',
      actorUserId,
      businessId,
      entityType: 'budget',
      entityId: budget.id,
      metadata: { amount: Number(dto.amount).toFixed(2), currency, source: 'manual' },
      context,
    });

    return this.getDetail(businessId, budgetId);
  }

  /**
   * Stores a Meta-derived spend figure for a campaign and evaluates every
   * budget that covers it. Callers treat this as best effort.
   */
  async recordCampaignSpend(
    businessId: string,
    campaignId: string,
    amount: string | number,
    currency: string,
    metadata: Record<string, unknown> | null = null,
    periodStart: Date | null = null,
    periodEnd: Date | null = null,
  ): Promise<void> {
    const numeric = Number(amount);

    if (!Number.isFinite(numeric) || numeric < 0) {
      return;
    }

    const budget = await this.budgets.findOne({
      where: { businessId, campaignId, isActive: true },
    });
    const period = budget?.period ?? BudgetPeriod.MONTHLY;
    const normalizedCurrency = this.normalizeCurrency(currency);

    await this.snapshots.save(
      this.snapshots.create({
        businessId,
        campaignId,
        budgetId: budget?.id ?? null,
        source: SpendSnapshotSource.META_SYNC,
        amount: numeric.toFixed(2),
        currency: normalizedCurrency,
        periodKey: this.periodKey(period),
        periodStart,
        periodEnd,
        metadata,
      }),
    );

    if (budget) {
      await this.evaluateBudget(budget);
    }

    const businessBudgets = await this.budgets.find({
      where: { businessId, scope: BudgetScope.BUSINESS, isActive: true },
    });

    for (const businessBudget of businessBudgets) {
      await this.evaluateBudget(businessBudget);
    }
  }

  async listAlerts(
    businessId: string,
    status?: BudgetAlertStatus,
  ): Promise<BudgetAlertView[]> {
    const alerts = await this.alerts.find({
      where: { businessId, ...(status ? { status } : {}) },
      relations: { budget: true, campaign: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return alerts.map(toBudgetAlertView);
  }

  async acknowledgeAlert(
    actorUserId: string,
    businessId: string,
    alertId: string,
    context: RequestContext,
  ): Promise<BudgetAlertView> {
    const alert = await this.alerts.findOne({
      where: { id: alertId, businessId },
      relations: { budget: true, campaign: true },
    });

    if (!alert) {
      throw new NotFoundException('Budget alert not found');
    }

    if (alert.status !== BudgetAlertStatus.ACKNOWLEDGED) {
      alert.status = BudgetAlertStatus.ACKNOWLEDGED;
      alert.acknowledgedByUserId = actorUserId;
      alert.acknowledgedAt = new Date();
      await this.alerts.save(alert);

      await this.audit.record({
        action: 'budget.alert_acknowledged',
        actorUserId,
        businessId,
        entityType: 'budget_alert',
        entityId: alert.id,
        metadata: { budgetId: alert.budgetId, thresholdPercent: alert.thresholdPercent },
        context,
      });
    }

    return toBudgetAlertView(alert);
  }

  async requireBudget(businessId: string, budgetId: string): Promise<Budget> {
    const budget = await this.budgets.findOne({
      where: { id: budgetId, businessId },
      relations: { campaign: true },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return budget;
  }

  private async toView(budget: Budget): Promise<BudgetView> {
    const [spend, openAlerts] = await Promise.all([
      this.latestSpend(budget),
      this.alerts.count({
        where: { budgetId: budget.id, status: BudgetAlertStatus.OPEN },
      }),
    ]);

    return toBudgetView(budget, spend, openAlerts);
  }

  private async latestSpend(budget: Budget): Promise<BudgetSpendSummary | null> {
    // Lifetime budgets accumulate every captured snapshot, monthly budgets only
    // consider the current month.
    const rows = await this.snapshots.find({
      where:
        budget.period === BudgetPeriod.TOTAL
          ? { businessId: budget.businessId }
          : { businessId: budget.businessId, periodKey: this.periodKey(budget.period) },
      order: { capturedAt: 'DESC' },
    });

    if (rows.length === 0) {
      return null;
    }

    // A business-scope manual snapshot represents the client total directly.
    const manual = rows.find(
      (row) =>
        row.budgetId === budget.id && row.campaignId === null && row.source === SpendSnapshotSource.MANUAL,
    );

    if (manual) {
      return {
        amount: Number(manual.amount),
        currency: manual.currency,
        snapshotId: manual.id,
        capturedAt: manual.capturedAt,
      };
    }

    const relevant = rows.filter((row) =>
      budget.scope === BudgetScope.CAMPAIGN
        ? row.campaignId === budget.campaignId
        : row.campaignId !== null,
    );
    const seen = new Set<string>();
    let total = 0;
    let matched = false;
    let first: SpendSnapshot | null = null;

    for (const row of relevant) {
      if (row.currency !== budget.currency) {
        continue;
      }

      const campaignKey = row.campaignId ?? row.id;

      if (seen.has(campaignKey)) {
        continue;
      }

      seen.add(campaignKey);
      total += Number(row.amount);
      matched = true;
      first = first ?? row;
    }

    return matched && first
      ? {
          amount: total,
          currency: budget.currency,
          snapshotId: first.id,
          capturedAt: first.capturedAt,
        }
      : null;
  }

  private async evaluateBudget(budget: Budget): Promise<void> {
    if (!budget.isActive) {
      return;
    }

    const spend = await this.latestSpend(budget);
    const amount = Number(budget.amount);

    if (!spend || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const percent = (spend.amount / amount) * 100;

    if (percent + 1e-9 < budget.alertThresholdPercent) {
      return;
    }

    const periodKey = this.periodKey(budget.period);

    try {
      const existing = await this.alerts.findOne({
        where: {
          budgetId: budget.id,
          periodKey,
          thresholdPercent: budget.alertThresholdPercent,
        },
      });
      const message =
        `${budget.name} has spent ${budget.currency} ${spend.amount.toFixed(2)} ` +
        `of ${budget.currency} ${amount.toFixed(2)} (${percent.toFixed(1)}%).`;

      if (existing) {
        existing.spendAmount = spend.amount.toFixed(2);
        existing.budgetAmount = amount.toFixed(2);
        existing.spendSnapshotId = spend.snapshotId;
        existing.message = message.slice(0, 255);
        await this.alerts.save(existing);
        return;
      }

      await this.alerts.insert({
        businessId: budget.businessId,
        budgetId: budget.id,
        campaignId: budget.campaignId,
        spendSnapshotId: spend.snapshotId,
        periodKey,
        thresholdPercent: budget.alertThresholdPercent,
        spendAmount: spend.amount.toFixed(2),
        budgetAmount: amount.toFixed(2),
        currency: budget.currency,
        message: message.slice(0, 255),
        status: BudgetAlertStatus.OPEN,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to evaluate budget ${budget.id}: ${
          error instanceof Error ? error.message.slice(0, MAX_ERROR_LENGTH) : 'unknown error'
        }`,
      );
    }
  }

  private async resolveCreateValues(
    businessId: string,
    dto: CreateBudgetDto,
  ): Promise<BudgetValues> {
    const business = await this.businesses.findOne({ where: { id: businessId } });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    let campaign: Campaign | null = null;

    if (dto.scope === BudgetScope.CAMPAIGN) {
      if (!dto.campaignId) {
        throw new BadRequestException('A campaign budget needs a campaign');
      }

      campaign = await this.campaigns.findOne({
        where: { id: dto.campaignId, businessId },
      });

      if (!campaign) {
        throw new BadRequestException('Campaign not found in this business');
      }
    } else if (dto.campaignId) {
      throw new BadRequestException('Client-level budgets cannot target a campaign');
    }

    return {
      scope: dto.scope,
      campaignId: campaign?.id ?? null,
      name: dto.name.trim(),
      amount: Number(dto.amount).toFixed(2),
      currency: this.normalizeCurrency(
        dto.currency ?? campaign?.budgetCurrency ?? business.currency,
      ),
      period: dto.period ?? BudgetPeriod.MONTHLY,
      alertThresholdPercent: dto.alertThresholdPercent ?? 80,
      isActive: dto.isActive ?? true,
      notes: dto.notes?.trim() || null,
    };
  }

  private mergeValues(budget: Budget, dto: UpdateBudgetDto): BudgetValues {
    return {
      scope: budget.scope,
      campaignId: budget.campaignId,
      name: dto.name?.trim() ?? budget.name,
      amount:
        dto.amount !== undefined ? Number(dto.amount).toFixed(2) : budget.amount,
      currency: this.normalizeCurrency(dto.currency ?? budget.currency),
      period: dto.period ?? budget.period,
      alertThresholdPercent:
        dto.alertThresholdPercent ?? budget.alertThresholdPercent,
      isActive: dto.isActive ?? budget.isActive,
      notes: dto.notes !== undefined ? dto.notes.trim() || null : budget.notes,
    };
  }

  private async assertBudgetSlotFree(
    businessId: string,
    values: BudgetValues,
  ): Promise<void> {
    if (values.scope === BudgetScope.CAMPAIGN) {
      if (!values.campaignId) {
        throw new BadRequestException('A campaign budget needs a campaign');
      }

      const existing = await this.budgets.findOne({
        where: { businessId, campaignId: values.campaignId },
      });

      if (existing) {
        throw new BadRequestException('This campaign already has a budget');
      }

      return;
    }

    const existing = await this.budgets.findOne({
      where: { businessId, scope: BudgetScope.BUSINESS },
    });

    if (existing) {
      throw new BadRequestException('This business already has a client-level budget');
    }
  }

  private normalizeCurrency(value: string): string {
    const currency = value.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('Currency must be a three-letter code');
    }

    return currency;
  }

  private periodKey(period: BudgetPeriod): string {
    if (period === BudgetPeriod.TOTAL) {
      return 'total';
    }

    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private async recordTransaction(
    budget: Budget,
    type: BudgetTransactionType,
    amount: string | null,
    previousAmount: string | null,
    actorUserId: string,
    approvalRequestId: string | null,
    note: string | null,
  ): Promise<void> {
    await this.transactions.insert({
      budgetId: budget.id,
      businessId: budget.businessId,
      type,
      amount,
      previousAmount,
      currency: budget.currency,
      actorUserId,
      approvalRequestId,
      note,
    });
  }
}
