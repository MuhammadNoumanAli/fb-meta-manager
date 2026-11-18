import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { Business } from '../../database/entities/business.entity';
import { CommunicationSuppression } from '../../database/entities/communication-suppression.entity';
import { LeadConsent } from '../../database/entities/lead-consent.entity';
import { Lead } from '../../database/entities/lead.entity';
import { WhatsappAccount } from '../../database/entities/whatsapp-account.entity';
import { WhatsappMessageEvent } from '../../database/entities/whatsapp-message-event.entity';
import { WhatsappMessage } from '../../database/entities/whatsapp-message.entity';
import { WhatsappPhoneNumber } from '../../database/entities/whatsapp-phone-number.entity';
import { WhatsappTemplate } from '../../database/entities/whatsapp-template.entity';
import { AuditModule } from '../audit/audit.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MetaWhatsappProvider } from './providers/meta-whatsapp.provider';
import { MessagingProviderRegistry } from './providers/messaging-provider.registry';
import { TwilioWhatsappProvider } from './providers/twilio-whatsapp.provider';
import { WhatsappAccountsController } from './whatsapp-accounts.controller';
import { WhatsappAccountsService } from './whatsapp-accounts.service';
import { WhatsappConsentController } from './whatsapp-consent.controller';
import { WhatsappConsentService } from './whatsapp-consent.service';
import { WhatsappMessagesController } from './whatsapp-messages.controller';
import { WhatsappMessagesProcessor } from './whatsapp-messages.processor';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappQueueService } from './whatsapp-queue.service';
import { WhatsappTemplatesController } from './whatsapp-templates.controller';
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import { WhatsappWebhooksController } from './whatsapp-webhooks.controller';
import { WhatsappWebhooksService } from './whatsapp-webhooks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappAccount,
      WhatsappPhoneNumber,
      WhatsappTemplate,
      WhatsappMessage,
      WhatsappMessageEvent,
      LeadConsent,
      CommunicationSuppression,
      Lead,
      Business,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.WHATSAPP_MESSAGES }),
    AuditModule,
    IntegrationsModule,
  ],
  controllers: [
    WhatsappAccountsController,
    WhatsappTemplatesController,
    WhatsappMessagesController,
    WhatsappConsentController,
    WhatsappWebhooksController,
  ],
  providers: [
    MetaWhatsappProvider,
    TwilioWhatsappProvider,
    MessagingProviderRegistry,
    WhatsappAccountsService,
    WhatsappTemplatesService,
    WhatsappConsentService,
    WhatsappMessagingService,
    WhatsappQueueService,
    WhatsappMessagesProcessor,
    WhatsappWebhooksService,
  ],
  exports: [WhatsappMessagingService, WhatsappConsentService],
})
export class WhatsappModule {}
