import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';

export const LEAD_PROCESSING_JOB = 'process-webhook-event';

/**
 * Producer for asynchronous lead processing. Webhook intake only stores the
 * event and hands it off here so Meta receives a fast response.
 */
@Injectable()
export class LeadQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.LEAD_PROCESSING)
    private readonly queue: Queue,
  ) {}

  async enqueueWebhookEvent(eventId: string, retry = false): Promise<void> {
    await this.queue.add(
      LEAD_PROCESSING_JOB,
      { eventId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        // Unique IDs prevent duplicate deliveries from queueing twice while a
        // retry gets its own job so a retained failed job is not reused.
        jobId: retry ? `${eventId}-retry-${Date.now()}` : `${eventId}-initial`,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    );
  }
}
