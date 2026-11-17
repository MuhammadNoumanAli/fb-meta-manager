import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { User } from './user.entity';

/** An immutable snapshot of a submitted payload for one approval request. */
@Entity('approval_versions')
@Index('UQ_approval_versions_request_version', ['approvalRequestId', 'version'], {
  unique: true,
})
export class ApprovalVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'approval_request_id', type: 'char', length: 36 })
  approvalRequestId: string;

  @ManyToOne(() => ApprovalRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest: ApprovalRequest;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({ name: 'payload_hash', type: 'char', length: 64 })
  payloadHash: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ name: 'created_by_user_id', type: 'char', length: 36 })
  createdByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
