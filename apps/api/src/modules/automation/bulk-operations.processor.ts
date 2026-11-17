import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';
import { BulkOperationsService } from './bulk-operations.service';
import type { BulkOperationJob } from './bulk-operation-queue.service';

@Processor(QUEUE_NAMES.BULK_OPERATIONS)
export class BulkOperationsProcessor extends WorkerHost {
  constructor(private readonly bulk: BulkOperationsService) {
    super();
  }

  async process(job: Job<BulkOperationJob>) {
    await this.bulk.process(job.data.operationId);

    return { operationId: job.data.operationId };
  }
}
