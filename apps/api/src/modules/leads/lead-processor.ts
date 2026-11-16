import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { LeadIntakeService } from './lead-intake.service';
import { LEAD_PROCESSING_JOB } from './lead-queue.service';

interface LeadJobData {
  eventId: string;
}

/** Consumes queued webhook events and turns leadgen payloads into leads. */
@Processor(QUEUE_NAMES.LEAD_PROCESSING)
export class LeadProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadProcessor.name);

  constructor(private readonly intake: LeadIntakeService) {
    super();
  }

  async process(job: Job<LeadJobData>): Promise<void> {
    if (job.name !== LEAD_PROCESSING_JOB || !job.data?.eventId) {
      return;
    }

    this.logger.debug(
      `Processing webhook event ${job.data.eventId} (attempt ${job.attemptsMade + 1})`,
    );
    await this.intake.processWebhookEvent(job.data.eventId);
  }
}
