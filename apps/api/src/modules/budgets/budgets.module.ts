import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetAlert } from '../../database/entities/budget-alert.entity';
import { BudgetTransaction } from '../../database/entities/budget-transaction.entity';
import { Budget } from '../../database/entities/budget.entity';
import { Business } from '../../database/entities/business.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { SpendSnapshot } from '../../database/entities/spend-snapshot.entity';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { BudgetApprovalHandler } from './budget-approval.handler';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Budget,
      BudgetTransaction,
      SpendSnapshot,
      BudgetAlert,
      Campaign,
      Business,
    ]),
    ApprovalsModule,
    AuditModule,
  ],
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetApprovalHandler],
  exports: [BudgetsService],
})
export class BudgetsModule {}
