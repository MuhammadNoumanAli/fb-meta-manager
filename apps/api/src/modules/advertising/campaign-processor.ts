import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import type { CampaignPublishJob } from './campaign-queue.service';
import { CampaignPublishingService } from './campaign-publishing.service';

@Processor(QUEUE_NAMES.CAMPAIGN_OPERATIONS)
export class CampaignProcessor extends WorkerHost {
  constructor(private readonly publishing: CampaignPublishingService) {
    super();
  }

  async process(job: Job<CampaignPublishJob>): Promise<{ campaignId: string }> {
    if (job.name === 'publish') {
      await this.publishing.publishCampaign(job.data);
    }

    return { campaignId: job.data.campaignId };
  }
}
