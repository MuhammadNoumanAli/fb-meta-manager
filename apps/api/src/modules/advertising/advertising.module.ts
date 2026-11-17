import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { AdSet } from '../../database/entities/ad-set.entity';
import { Advertisement } from '../../database/entities/advertisement.entity';
import { AdvertisingAsset } from '../../database/entities/advertising-asset.entity';
import { Business } from '../../database/entities/business.entity';
import { CampaignStatusHistory } from '../../database/entities/campaign-status-history.entity';
import { Campaign } from '../../database/entities/campaign.entity';
import { Creative } from '../../database/entities/creative.entity';
import { MetaAdAccount } from '../../database/entities/meta-ad-account.entity';
import { MetaPage } from '../../database/entities/meta-page.entity';
import { MetaReviewStatusHistory } from '../../database/entities/meta-review-status-history.entity';
import { PlatformSyncLog } from '../../database/entities/platform-sync-log.entity';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AdSetsController } from './ad-sets.controller';
import { AdvertisementsController } from './advertisements.controller';
import { AdvertisingAssetsController } from './advertising-assets.controller';
import { AdvertisingAssetsService } from './advertising-assets.service';
import { AdvertisingService } from './advertising.service';
import { CampaignApprovalHandler } from './campaign-approval.handler';
import { CampaignProcessor } from './campaign-processor';
import { CampaignPublishingService } from './campaign-publishing.service';
import { CampaignQueueService } from './campaign-queue.service';
import { CampaignsController } from './campaigns.controller';
import { CreativesController } from './creatives.controller';
import {
  ADVERTISING_PROVIDER,
} from './providers/advertising-provider.interface';
import { MetaAdvertisingProvider } from './providers/meta-advertising.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      AdSet,
      Advertisement,
      Creative,
      AdvertisingAsset,
      CampaignStatusHistory,
      MetaReviewStatusHistory,
      PlatformSyncLog,
      MetaAdAccount,
      MetaPage,
      Business,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.CAMPAIGN_OPERATIONS }),
    AuditModule,
    IntegrationsModule,
    ApprovalsModule,
    BudgetsModule,
  ],
  controllers: [
    CampaignsController,
    AdSetsController,
    AdvertisementsController,
    CreativesController,
    AdvertisingAssetsController,
  ],
  providers: [
    AdvertisingService,
    AdvertisingAssetsService,
    CampaignPublishingService,
    CampaignQueueService,
    CampaignProcessor,
    CampaignApprovalHandler,
    MetaAdvertisingProvider,
    {
      provide: ADVERTISING_PROVIDER,
      useExisting: MetaAdvertisingProvider,
    },
  ],
  exports: [AdvertisingService, CampaignPublishingService, AdvertisingAssetsService],
})
export class AdvertisingModule {}
