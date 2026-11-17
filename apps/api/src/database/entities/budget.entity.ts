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
import { BudgetPeriod } from '../../common/enums/budget-period.enum';
import { BudgetScope } from '../../common/enums/budget-scope.enum';
import { Business } from './business.entity';
import { Campaign } from './campaign.entity';
import { User } from './user.entity';

/**
 * A configured spending limit. Business-scope budgets cover the client;
 * campaign-scope budgets cover one campaign. These are AdPilot controls and do
 * not mutate the Meta campaign budget.
 */
@Entity('budgets')
@Index('UQ_budgets_business_campaign', ['businessId', 'campaignId'], { unique: true })
@Index('IDX_budgets_business_scope', ['businessId', 'scope'])
export class Budget {
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

  @Column({ type: 'enum', enum: BudgetScope })
  scope: BudgetScope;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'enum', enum: BudgetPeriod, default: BudgetPeriod.MONTHLY })
  period: BudgetPeriod;

  @Column({ name: 'alert_threshold_percent', type: 'tinyint', unsigned: true, default: 80 })
  alertThresholdPercent: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

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
