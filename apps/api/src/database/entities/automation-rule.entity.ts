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
import { AutomationTriggerType } from '../../common/enums/automation-trigger-type.enum';
import { Business } from './business.entity';
import { Campaign } from './campaign.entity';
import { User } from './user.entity';

/**
 * A reusable automation rule. Schedule rules fire at a run time or on an
 * interval; event rules are evaluated by the scheduler against campaign review
 * state or open budget alerts.
 */
@Entity('automation_rules')
@Index('IDX_automation_rules_business_active', ['businessId', 'isActive'])
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'trigger_type', type: 'enum', enum: AutomationTriggerType })
  triggerType: AutomationTriggerType;

  @Column({ name: 'action_type', type: 'enum', enum: AutomationActionType })
  actionType: AutomationActionType;

  @Column({ name: 'campaign_id', type: 'char', length: 36, nullable: true })
  campaignId: string | null;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign | null;

  @Column({ name: 'run_at', type: 'datetime', precision: 6, nullable: true })
  runAt: Date | null;

  @Column({ name: 'interval_minutes', type: 'int', unsigned: true, nullable: true })
  intervalMinutes: number | null;

  @Column({ name: 'next_run_at', type: 'datetime', precision: 6, nullable: true })
  nextRunAt: Date | null;

  @Column({ name: 'last_run_at', type: 'datetime', precision: 6, nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'notify_message', type: 'varchar', length: 500, nullable: true })
  notifyMessage: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_user_id', type: 'char', length: 36, nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
