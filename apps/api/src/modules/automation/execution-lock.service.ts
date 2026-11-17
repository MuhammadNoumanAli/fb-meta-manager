import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { ExecutionLock } from '../../database/entities/execution-lock.entity';

/**
 * Database-backed distributed lock used by automation and bulk workers.
 * A unique lock key plus an expiry prevents duplicate execution while still
 * allowing recovery after a crashed worker.
 */
@Injectable()
export class ExecutionLockService {
  constructor(
    @InjectRepository(ExecutionLock)
    private readonly locks: Repository<ExecutionLock>,
  ) {}

  async acquire(lockKey: string, ttlMs: number, owner: string): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const existing = await this.locks.findOne({ where: { lockKey } });

    if (!existing) {
      try {
        await this.locks.insert({
          lockKey,
          owner,
          acquiredAt: now,
          expiresAt,
          releasedAt: null,
        });
        return true;
      } catch {
        // Another worker inserted the same key between the read and write.
        return false;
      }
    }

    if (!existing.releasedAt && existing.expiresAt > now) {
      return false;
    }

    const result = await this.locks
      .createQueryBuilder()
      .update(ExecutionLock)
      .set({ owner, acquiredAt: now, expiresAt, releasedAt: null })
      .where('id = :id', { id: existing.id })
      .andWhere('(released_at IS NOT NULL OR expires_at <= :now)', { now })
      .execute();

    return Boolean(result.affected);
  }

  async release(lockKey: string, owner: string): Promise<void> {
    await this.locks.update(
      { lockKey, owner, releasedAt: IsNull() },
      { releasedAt: new Date() },
    );
  }

  /** Removes expired, released rows so the table does not grow without bound. */
  async purgeExpired(): Promise<void> {
    await this.locks.delete({ expiresAt: LessThanOrEqual(new Date()) });
  }
}
