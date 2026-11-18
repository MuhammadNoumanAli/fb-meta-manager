import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { DEFAULT_RETRY_POLICY, jitteredDelay } from '../../common/utilities/retry-policy';

export interface WhatsappMessageJob {
  messageId: string;
}

@Injectable()
export class WhatsappQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.WHATSAPP_MESSAGES)
    private readonly messages: Queue<WhatsappMessageJob>,
  ) {}

  /**
   * Each attempt token produces a distinct job id, which lets explicit retries
   * of a failed message run without colliding with completed jobs.
   */
  async enqueue(messageId: string, attemptToken = 0): Promise<void> {
    await this.messages.add(
      'send',
      { messageId },
      {
        jobId: `whatsapp:${messageId}:${attemptToken}`,
        attempts: DEFAULT_RETRY_POLICY.attempts,
        backoff: { type: 'exponential', delay: jitteredDelay(1) },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    );
  }
}
