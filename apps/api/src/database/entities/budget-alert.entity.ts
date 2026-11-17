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
import { BudgetAlertStatus } from '../../common/enums/budget-alert-status.enum';
import { Budget } from './budget.entity';
import { Campaign } from './campaign.entity';
import { SpendSnapshot } from './spend-snapshot.entity';
import { User } from './user.entity';

/** Threshold breach raised when spend reaches the configured budget percentage. */
@Entity('budget_alerts')
@Index('UQ_budget_alerts_budget_period_threshold', ['budgetId', 'periodKey', 'thresholdPercent'], {
  unique: true,
})
@Index('IDX_budget_alerts_business_status', ['businessId', 'status'])
export class BudgetAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @Column({ name: 'budget_id', type: 'char', length: 36 })
  budgetId: string;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget;

  @Column({ name: 'campaign_id', type: 'char', length: 36, nullable: true })
  campaignId: string | null;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign | null;

  @Column({ name: 'spend_snapshot_id', type: 'char', length: 36, nullable: true })
  spendSnapshotId: string | null;

  @ManyToOne(() => SpendSnapshot, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'spend_snapshot_id' })
  spendSnapshot: SpendSnapshot | null;

  @Column({ name: 'period_key', type: 'varchar', length: 16 })
  periodKey: string;

  @Column({ name: 'threshold_percent', type: 'tinyint', unsigned: true })
  thresholdPercent: number;

  @Column({ name: 'spend_amount', type: 'decimal', precision: 14, scale: 2 })
  spendAmount: string;

  @Column({ name: 'budget_amount', type: 'decimal', precision: 14, scale: 2 })
  budgetAmount: string;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 255 })
  message: string;

  @Column({ type: 'enum', enum: BudgetAlertStatus, default: BudgetAlertStatus.OPEN })
  status: BudgetAlertStatus;

  @Column({ name: 'acknowledged_by_user_id', type: 'char', length: 36, nullable: true })
  acknowledgedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'acknowledged_by_user_id' })
  acknowledgedByUser: User | null;

  @Column({ name: 'acknowledged_at', type: 'datetime', precision: 6, nullable: true })
  acknowledgedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
