import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalDecisionRecord } from '../../database/entities/approval-decision.entity';
import { ApprovalPolicy } from '../../database/entities/approval-policy.entity';
import { ApprovalRequest } from '../../database/entities/approval-request.entity';
import { ApprovalVersion } from '../../database/entities/approval-version.entity';
import { AuditModule } from '../audit/audit.module';
import { ApprovalExecutionRegistry } from './approval-execution.registry';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalPolicy,
      ApprovalRequest,
      ApprovalVersion,
      ApprovalDecisionRecord,
    ]),
    AuditModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalExecutionRegistry],
  exports: [ApprovalsService, ApprovalExecutionRegistry],
})
export class ApprovalsModule {}
