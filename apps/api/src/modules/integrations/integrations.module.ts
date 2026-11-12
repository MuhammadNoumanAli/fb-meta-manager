import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  ],
  controllers: [
    MetaIntegrationsController,
    MetaOAuthCallbackController,
    MetaIntegrationMonitorController,
  ],
  providers: [MetaIntegrationsService, MetaGraphClient, IntegrationCryptoService],
  exports: [MetaIntegrationsService],
})
export class IntegrationsModule {}
