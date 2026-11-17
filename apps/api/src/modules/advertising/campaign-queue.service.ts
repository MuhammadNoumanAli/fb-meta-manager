import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import type { RequestContext } from '../../common/utilities/request-context';

export interface CampaignPublishJob {
  businessId: string;
  campaignId: string;
  actorUserId: string;
  activate: boolean;
  context: RequestContext;
}

@Injectable()
export class CampaignQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.CAMPAIGN_OPERATIONS)
    private readonly queue: Queue<CampaignPublishJob>,
  ) {}

  async enqueuePublish(job: CampaignPublishJob): Promise<void> {
    await this.queue.add('publish', job, { attempts: 1 });
  }
}
