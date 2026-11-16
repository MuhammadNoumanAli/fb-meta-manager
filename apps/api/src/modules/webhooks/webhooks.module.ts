import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetaPage } from '../../database/entities/meta-page.entity';
import { WebhookEvent } from '../../database/entities/webhook-event.entity';
import { WebhookProcessingLog } from '../../database/entities/webhook-processing-log.entity';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { MetaWebhookEventsController } from './meta-webhook-events.controller';
import { MetaWebhooksController } from './meta-webhooks.controller';
import { MetaWebhooksService } from './meta-webhooks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent, WebhookProcessingLog, MetaPage]),
    LeadsModule,
    AuditModule,
  ],
  controllers: [MetaWebhooksController, MetaWebhookEventsController],
  providers: [MetaWebhooksService],
})
export class WebhooksModule {}
