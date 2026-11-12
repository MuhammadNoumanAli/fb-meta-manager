import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const PING_TIMEOUT_MS = 1500;

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {
    super();
  }

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const startedAt = Date.now();

    try {
      const pong = await this.pingWithTimeout();
      return this.getStatus(key, pong === 'PONG', {
        responseTimeMs: Date.now() - startedAt,
      });
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown Redis error',
          responseTimeMs: Date.now() - startedAt,
        }),
      );
    }
  }

  private pingWithTimeout(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Redis ping timed out after ${PING_TIMEOUT_MS}ms`)),
        PING_TIMEOUT_MS,
      );

      const ping = async (): Promise<string> => {
        // The shared client is lazy: establish the connection on first probe.
        if (this.client.status === 'wait') {
          await this.client.connect();
        }
        return this.client.ping();
      };

      ping()
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: Error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
