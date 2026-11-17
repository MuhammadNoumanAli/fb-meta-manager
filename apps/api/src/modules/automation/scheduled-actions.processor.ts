import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { AutomationSchedulerService } from './automation-scheduler.service';

@Processor(QUEUE_NAMES.SCHEDULED_ACTIONS)
export class ScheduledActionsProcessor extends WorkerHost {
  constructor(private readonly scheduler: AutomationSchedulerService) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'dispatch') {
      return this.scheduler.dispatchDue();
    }

    return null;
  }
}
