import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { MetaIntegrationsService } from './meta-integrations.service';

@Processor(QUEUE_NAMES.TOKEN_MONITORING)
export class TokenMonitoringProcessor extends WorkerHost {
  constructor(private readonly integrations: MetaIntegrationsService) {
    super();
  }

  async process(job: Job<{ limit?: number }>) {
    return this.integrations.monitorSweep(job.data?.limit ?? 25);
  }
}
