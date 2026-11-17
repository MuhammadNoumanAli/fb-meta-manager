import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BulkOperationStatus } from '../../common/enums/bulk-operation-status.enum';
import { BulkOperationType } from '../../common/enums/bulk-operation-type.enum';
import { BulkOperationItem } from './bulk-operation-item.entity';
import { Business } from './business.entity';
import { User } from './user.entity';

/**
 * A bulk request split into one item per target campaign. The aggregate counts
 * are recomputed from item statuses so a partial failure is always explicit.
 */
@Entity('bulk_operations')
@Index('IDX_bulk_operations_business_created', ['businessId', 'createdAt'])
export class BulkOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'enum', enum: BulkOperationType })
  operation: BulkOperationType;

  @Column({
    type: 'enum',
    enum: BulkOperationStatus,
    default: BulkOperationStatus.QUEUED,
  })
  status: BulkOperationStatus;

  @Column({ type: 'int', unsigned: true, default: 0 })
  total: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  succeeded: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  failed: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  pending: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ name: 'requested_by_user_id', type: 'char', length: 36, nullable: true })
  requestedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser: User | null;

  @Column({ name: 'approval_request_id', type: 'char', length: 36, nullable: true })
  approvalRequestId: string | null;

  @Column({ name: 'completed_at', type: 'datetime', precision: 6, nullable: true })
  completedAt: Date | null;

  @OneToMany(() => BulkOperationItem, (item) => item.bulkOperation)
  items: BulkOperationItem[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
