import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { IntegrationAuthorization } from '../../database/entities/integration-authorization.entity';
import { LeadSource } from '../../database/entities/lead-source.entity';
import { LeadSyncLog } from '../../database/entities/lead-sync-log.entity';
import { Lead } from '../../database/entities/lead.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';
import { WebhookProcessingLog } from '../../database/entities/webhook-processing-log.entity';
import { AuditModule } from '../audit/audit.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LeadIntakeService } from './lead-intake.service';
import { LeadProcessor } from './lead-processor';
import { LeadQueueService } from './lead-queue.service';
import { LeadSourcesController } from './lead-sources.controller';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { WebsiteLeadController } from './website-lead.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lead,
      LeadSource,
      LeadSyncLog,
      WebhookEvent,
      WebhookProcessingLog,
      IntegrationAuthorization,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.LEAD_PROCESSING }),
    AuditModule,
    IntegrationsModule,
  ],
  controllers: [
    LeadsController,
    LeadSourcesController,
    WebsiteLeadController,
  ],
  providers: [
    LeadsService,
    LeadIntakeService,
    LeadQueueService,
    LeadProcessor,
  ],
  exports: [LeadQueueService],
})
export class LeadsModule {}
