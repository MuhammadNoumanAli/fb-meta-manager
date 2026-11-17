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
import { AutomationExecutionStatus } from '../../common/enums/automation-execution-status.enum';
import { AutomationExecutionTrigger } from '../../common/enums/automation-execution-trigger.enum';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { Business } from './business.entity';
import { AutomationRule } from './automation-rule.entity';
import { ScheduledAction } from './scheduled-action.entity';
import { User } from './user.entity';

/**
 * One attempted automation action. The idempotency key makes duplicate
 * scheduling harmless, and the record keeps the attempt count, error and
 * result so retries are bounded and observable.
 */
@Entity('automation_executions')
@Index('UQ_automation_executions_idempotency', ['idempotencyKey'], { unique: true })
@Index('IDX_automation_executions_business_created', ['businessId', 'createdAt'])
@Index('IDX_automation_executions_rule_created', ['ruleId', 'createdAt'])
export class AutomationExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'rule_id', type: 'char', length: 36, nullable: true })
  ruleId: string | null;

  @ManyToOne(() => AutomationRule, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'rule_id' })
  rule: AutomationRule | null;

  @Column({ name: 'scheduled_action_id', type: 'char', length: 36, nullable: true })
  scheduledActionId: string | null;

  @ManyToOne(() => ScheduledAction, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'scheduled_action_id' })
  scheduledAction: ScheduledAction | null;

  @Column({ name: 'actor_user_id', type: 'char', length: 36, nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser: User | null;

  @Column({ type: 'enum', enum: AutomationExecutionTrigger })
  trigger: AutomationExecutionTrigger;

  @Column({
    type: 'enum',
    enum: AutomationExecutionStatus,
    default: AutomationExecutionStatus.PENDING,
  })
  status: AutomationExecutionStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 150 })
  idempotencyKey: string;

  @Column({ name: 'approval_request_id', type: 'char', length: 36, nullable: true })
  approvalRequestId: string | null;

  @Column({ name: 'approval_status', type: 'enum', enum: ApprovalStatus, nullable: true })
  approvalStatus: ApprovalStatus | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'int', unsigned: true, default: 3 })
  maxAttempts: number;

  @Column({ type: 'json', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error: string | null;

  @Column({ name: 'started_at', type: 'datetime', precision: 6, nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', precision: 6, nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
