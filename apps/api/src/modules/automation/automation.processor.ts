import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { AutomationRunnerService } from './automation-runner.service';
import type { AutomationExecutionJob } from './automation-queue.service';

@Processor(QUEUE_NAMES.AUTOMATION_EXECUTION)
export class AutomationProcessor extends WorkerHost {
  constructor(private readonly runner: AutomationRunnerService) {
    super();
  }

  async process(job: Job<AutomationExecutionJob>) {
    const outcome = await this.runner.runPending(job.data.executionId);

    // Throwing lets BullMQ apply the queue retry policy with jittered backoff.
    if (outcome.retry) {
      throw new Error(outcome.error ?? 'Automation execution failed and will retry');
    }

    return outcome;
  }
}
