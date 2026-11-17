import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { DEFAULT_RETRY_POLICY, jitteredDelay } from '../../common/utilities/retry-policy';

export interface AutomationExecutionJob {
  executionId: string;
}

export interface DeadLetterJob {
  sourceQueue: string;
  jobName: string;
  payload: Record<string, unknown>;
  error: string;
  failedAt: string;
}

@Injectable()
export class AutomationQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.AUTOMATION_EXECUTION)
    private readonly executions: Queue<AutomationExecutionJob>,
    @InjectQueue(QUEUE_NAMES.SCHEDULED_ACTIONS)
    private readonly scheduler: Queue,
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER)
    private readonly deadLetters: Queue<DeadLetterJob>,
  ) {}

  async enqueueExecution(executionId: string, attemptToken = 0): Promise<void> {
    await this.executions.add(
      'execute',
      { executionId },
      {
        jobId: `automation:${executionId}:${attemptToken}`,
        attempts: DEFAULT_RETRY_POLICY.attempts,
        backoff: { type: 'exponential', delay: jitteredDelay(1) },
      },
    );
  }

  async enqueueDispatch(): Promise<void> {
    await this.scheduler.add(
      'dispatch',
      {},
      {
        jobId: `dispatch:${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: jitteredDelay(1) },
        removeOnComplete: 50,
      },
    );
  }

  /** Registers the recurring dispatcher. BullMQ replaces it on restart. */
  async registerDispatchRepeatable(): Promise<void> {
    await this.scheduler.add(
      'dispatch',
      {},
      {
        jobId: 'automation-dispatch',
        repeat: { every: 60_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
  }

  async moveToDeadLetter(job: DeadLetterJob): Promise<void> {
    await this.deadLetters.add('failed', job, {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    });
  }
}
