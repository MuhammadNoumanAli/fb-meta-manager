import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queues';

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Schedules the recurring Meta token health sweep. The job validates tokens
 * close to expiry or stale, so a revoked credential never sits unnoticed.
 */
@Injectable()
export class TokenMonitoringScheduler implements OnModuleInit {
  private readonly logger = new Logger(TokenMonitoringScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.TOKEN_MONITORING)
    private readonly queue: Queue<{ limit?: number }>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('nodeEnv') === 'test') {
      return;
    }

    try {
      await this.queue.add(
        'sweep',
        { limit: 25 },
        {
          jobId: 'token-monitoring-sweep',
          repeat: { every: SWEEP_INTERVAL_MS },
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Could not register the token monitor: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
