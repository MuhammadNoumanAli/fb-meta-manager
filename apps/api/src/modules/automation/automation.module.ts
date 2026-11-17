import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { AutomationExecution } from '../../database/entities/automation-execution.entity';
import { AutomationRule } from '../../database/entities/automation-rule.entity';
import { BudgetAlert } from '../../database/entities/budget-alert.entity';
import { BulkOperationItem } from '../../database/entities/bulk-operation-item.entity';
import { BulkOperation } from '../../database/entities/bulk-operation.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { ExecutionLock } from '../../database/entities/execution-lock.entity';
import { ScheduledAction } from '../../database/entities/scheduled-action.entity';
import { AdvertisingModule } from '../advertising/advertising.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { AutomationApprovalHandler } from './automation-approval.handler';
import { AutomationController } from './automation.controller';
import { AutomationProcessor } from './automation.processor';
import { AutomationQueueService } from './automation-queue.service';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationRunnerService } from './automation-runner.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { BulkApprovalHandler } from './bulk-approval.handler';
import { BulkOperationQueueService } from './bulk-operation-queue.service';
import { BulkOperationsController } from './bulk-operations.controller';
import { BulkOperationsProcessor } from './bulk-operations.processor';
import { BulkOperationsService } from './bulk-operations.service';
import { ExecutionLockService } from './execution-lock.service';
import { ScheduledActionsProcessor } from './scheduled-actions.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AutomationRule,
      AutomationExecution,
      ScheduledAction,
      ExecutionLock,
      BulkOperation,
      BulkOperationItem,
      Campaign,
      BudgetAlert,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AUTOMATION_EXECUTION },
      { name: QUEUE_NAMES.SCHEDULED_ACTIONS },
      { name: QUEUE_NAMES.DEAD_LETTER },
      { name: QUEUE_NAMES.BULK_OPERATIONS },
    ),
    AdvertisingModule,
    ApprovalsModule,
    AuditModule,
  ],
  controllers: [AutomationController, BulkOperationsController],
  providers: [
    ExecutionLockService,
    AutomationQueueService,
    BulkOperationQueueService,
    AutomationSchedulerService,
    AutomationRulesService,
    AutomationRunnerService,
    BulkOperationsService,
    AutomationProcessor,
    ScheduledActionsProcessor,
    BulkOperationsProcessor,
    AutomationApprovalHandler,
    BulkApprovalHandler,
  ],
  exports: [AutomationRulesService, AutomationRunnerService, BulkOperationsService],
})
export class AutomationModule {}
