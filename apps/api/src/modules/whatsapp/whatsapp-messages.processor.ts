import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import type { WhatsappMessageJob } from './whatsapp-queue.service';

@Processor(QUEUE_NAMES.WHATSAPP_MESSAGES)
export class WhatsappMessagesProcessor extends WorkerHost {
  constructor(private readonly messaging: WhatsappMessagingService) {
    super();
  }

  async process(job: Job<WhatsappMessageJob>): Promise<void> {
    await this.messaging.deliver(job.data.messageId);
  }
}
