import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalDecision } from '../../common/enums/approval-decision.enum';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalVersion } from './approval-version.entity';
import { User } from './user.entity';

/** Reviewer outcomes, retained even when a request is later re-versioned. */
@Entity('approval_decisions')
@Index('IDX_approval_decisions_request', ['approvalRequestId', 'createdAt'])
export class ApprovalDecisionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'approval_request_id', type: 'char', length: 36 })
  approvalRequestId: string;

  @ManyToOne(() => ApprovalRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest: ApprovalRequest;

  @Column({ name: 'approval_version_id', type: 'char', length: 36 })
  approvalVersionId: string;

  @ManyToOne(() => ApprovalVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approval_version_id' })
  approvalVersion: ApprovalVersion;

  @Column({ type: 'enum', enum: ApprovalDecision })
  decision: ApprovalDecision;

  @Column({ name: 'decided_by_user_id', type: 'char', length: 36 })
  decidedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'decided_by_user_id' })
  decidedByUser: User;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
