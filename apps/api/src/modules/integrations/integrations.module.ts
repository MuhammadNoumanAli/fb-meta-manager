import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { Business } from '../../database/entities/business.entity';
import { IntegrationAuthorization } from '../../database/entities/integration-authorization.entity';
import { IntegrationTokenEvent } from '../../database/entities/integration-token-event.entity';
import { MetaAdAccount } from '../../database/entities/meta-ad-account.entity';
import { MetaBusinessPortfolio } from '../../database/entities/meta-business-portfolio.entity';
import { MetaInstagramAccount } from '../../database/entities/meta-instagram-account.entity';
import { MetaOAuthState } from '../../database/entities/meta-oauth-state.entity';
import { MetaPage } from '../../database/entities/meta-page.entity';
import { AuditModule } from '../audit/audit.module';
import { IntegrationCryptoService } from './integration-crypto.service';
import { MetaGraphClient } from './meta-graph.client';
import { MetaIntegrationMonitorController } from './meta-integration-monitor.controller';
import { MetaIntegrationsController } from './meta-integrations.controller';
import { MetaIntegrationsService } from './meta-integrations.service';
import { MetaOAuthCallbackController } from './meta-oauth-callback.controller';
import { TokenMonitoringProcessor } from './token-monitoring.processor';
import { TokenMonitoringScheduler } from './token-monitoring.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationAuthorization,
      IntegrationTokenEvent,
      MetaOAuthState,
      MetaBusinessPortfolio,
      MetaPage,
      MetaInstagramAccount,
      MetaAdAccount,
      Business,
    ]),
    AuditModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.TOKEN_MONITORING }),
  ],
  controllers: [
    MetaIntegrationsController,
    MetaOAuthCallbackController,
    MetaIntegrationMonitorController,
  ],
  providers: [
    MetaIntegrationsService,
    MetaGraphClient,
    IntegrationCryptoService,
    TokenMonitoringProcessor,
    TokenMonitoringScheduler,
  ],
  exports: [MetaIntegrationsService, MetaGraphClient, IntegrationCryptoService],
})
export class IntegrationsModule {}
