import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { DEFAULT_RETRY_POLICY, jitteredDelay } from '../../common/utilities/retry-policy';

export interface BulkOperationJob {
  operationId: string;
  retryToken?: number;
}

@Injectable()
export class BulkOperationQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.BULK_OPERATIONS)
    private readonly queue: Queue<BulkOperationJob>,
  ) {}

  async enqueueOperation(operationId: string, retryToken = 0): Promise<void> {
    await this.queue.add(
      'process',
      { operationId, retryToken },
      {
        jobId: `bulk:${operationId}:${retryToken}`,
        attempts: DEFAULT_RETRY_POLICY.attempts,
        backoff: { type: 'exponential', delay: jitteredDelay(1) },
      },
    );
  }
}
