import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BulkOperationItemStatus } from '../../common/enums/bulk-operation-item-status.enum';
import { BulkOperation } from './bulk-operation.entity';
import { Campaign } from './campaign.entity';

/**
 * One target of a bulk operation. Items are executed independently so a single
 * failure is recorded and can be retried without re-running successful items.
 */
@Entity('bulk_operation_items')
@Index('UQ_bulk_operation_items_target', ['bulkOperationId', 'campaignId'], { unique: true })
@Index('IDX_bulk_operation_items_status', ['bulkOperationId', 'status'])
export class BulkOperationItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bulk_operation_id', type: 'char', length: 36 })
  bulkOperationId: string;

  @ManyToOne(() => BulkOperation, (operation) => operation.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bulk_operation_id' })
  bulkOperation: BulkOperation;

  @Column({ name: 'campaign_id', type: 'char', length: 36 })
  campaignId: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'campaign_label', type: 'varchar', length: 150 })
  campaignLabel: string;

  @Column({
    type: 'enum',
    enum: BulkOperationItemStatus,
    default: BulkOperationItemStatus.PENDING,
  })
  status: BulkOperationItemStatus;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error: string | null;

  @Column({ type: 'json', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ name: 'started_at', type: 'datetime', precision: 6, nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', precision: 6, nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
