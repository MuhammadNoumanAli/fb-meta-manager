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
import { AutomationActionType } from '../../common/enums/automation-action-type.enum';
import { ScheduledActionStatus } from '../../common/enums/scheduled-action-status.enum';
import { Business } from './business.entity';
import { Campaign } from './campaign.entity';
import { User } from './user.entity';

/**
 * A one-off campaign action that runs at a future time. The scheduler claims
 * due rows with a conditional update so a scheduled action dispatches once.
 */
@Entity('scheduled_actions')
@Index('IDX_scheduled_actions_business_run', ['businessId', 'status', 'runAt'])
export class ScheduledAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'campaign_id', type: 'char', length: 36, nullable: true })
  campaignId: string | null;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign | null;

  @Column({ name: 'action_type', type: 'enum', enum: AutomationActionType })
  actionType: AutomationActionType;

  @Column({ name: 'notify_message', type: 'varchar', length: 500, nullable: true })
  notifyMessage: string | null;

  @Column({ name: 'run_at', type: 'datetime', precision: 6 })
  runAt: Date;

  @Column({
    type: 'enum',
    enum: ScheduledActionStatus,
    default: ScheduledActionStatus.SCHEDULED,
  })
  status: ScheduledActionStatus;

  @Column({ name: 'created_by_user_id', type: 'char', length: 36, nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @Column({ name: 'dispatched_at', type: 'datetime', precision: 6, nullable: true })
  dispatchedAt: Date | null;

  @Column({ name: 'executed_at', type: 'datetime', precision: 6, nullable: true })
  executedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
