import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';

/**
 * Queue registration foundation. Phase 0 only registers the notification
 * queue; Phase 7 adds the remaining queues together with their workers.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS })],
  exports: [BullModule],
})
export class QueuesModule {}
