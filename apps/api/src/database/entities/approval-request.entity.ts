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
import { ApprovalExecutionStatus } from '../../common/enums/approval-execution-status.enum';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import { Business } from './business.entity';
import { User } from './user.entity';

/**
 * A reviewable request for a restricted action. Each request owns an immutable
 * version chain so a decision always refers to one exact payload.
 */
@Entity('approval_requests')
@Index('IDX_approval_requests_business_status', ['businessId', 'status'])
@Index('IDX_approval_requests_business_created', ['businessId', 'createdAt'])
@Index('IDX_approval_requests_target', ['targetType', 'targetId'])
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'target_type', type: 'enum', enum: ApprovalTargetType })
  targetType: ApprovalTargetType;

  @Column({ name: 'target_id', type: 'char', length: 36, nullable: true })
  targetId: string | null;

  @Column({ name: 'target_label', type: 'varchar', length: 200, nullable: true })
  targetLabel: string | null;

  @Column({ name: 'requested_by_user_id', type: 'char', length: 36 })
  requestedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser: User;

  @Column({ name: 'approver_user_id', type: 'char', length: 36, nullable: true })
  approverUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approver_user_id' })
  approverUser: User | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion: number;

  @Column({ name: 'current_payload_hash', type: 'char', length: 64 })
  currentPayloadHash: string;

  @Column({ name: 'approved_version_id', type: 'char', length: 36, nullable: true })
  approvedVersionId: string | null;

  @Column({ name: 'approved_payload_hash', type: 'char', length: 64, nullable: true })
  approvedPayloadHash: string | null;

  @Column({ name: 'decided_by_user_id', type: 'char', length: 36, nullable: true })
  decidedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'decided_by_user_id' })
  decidedByUser: User | null;

  @Column({ name: 'decided_at', type: 'datetime', precision: 6, nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_reason', type: 'varchar', length: 500, nullable: true })
  decisionReason: string | null;

  @Column({
    name: 'execution_status',
    type: 'enum',
    enum: ApprovalExecutionStatus,
    default: ApprovalExecutionStatus.NOT_STARTED,
  })
  executionStatus: ApprovalExecutionStatus;

  @Column({ name: 'executed_at', type: 'datetime', precision: 6, nullable: true })
  executedAt: Date | null;

  @Column({ name: 'execution_error', type: 'varchar', length: 500, nullable: true })
  executionError: string | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'requester_note', type: 'varchar', length: 500, nullable: true })
  requesterNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
