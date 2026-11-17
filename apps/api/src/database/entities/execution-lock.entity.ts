import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Database-backed distributed lock. A unique lock key prevents two workers
 * from acting on the same automation, bulk item or scheduled action at once;
 * expired locks can be taken over so a crashed worker never blocks forever.
 */
@Entity('execution_locks')
@Index('UQ_execution_locks_key', ['lockKey'], { unique: true })
@Index('IDX_execution_locks_expires', ['expiresAt'])
export class ExecutionLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lock_key', type: 'varchar', length: 150 })
  lockKey: string;

  @Column({ length: 120 })
  owner: string;

  @Column({ name: 'acquired_at', type: 'datetime', precision: 6 })
  acquiredAt: Date;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'released_at', type: 'datetime', precision: 6, nullable: true })
  releasedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
