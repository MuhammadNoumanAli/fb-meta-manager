import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SpendSnapshotSource } from '../../common/enums/spend-snapshot-source.enum';
import { Budget } from './budget.entity';
import { Campaign } from './campaign.entity';

/**
 * A point-in-time advertising spend figure. Meta snapshots are cumulative for
 * the queried window; manual snapshots are reconciliation entries.
 */
@Entity('spend_snapshots')
@Index('IDX_spend_snapshots_campaign_captured', ['campaignId', 'capturedAt'])
@Index('IDX_spend_snapshots_business_captured', ['businessId', 'capturedAt'])
export class SpendSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @Column({ name: 'campaign_id', type: 'char', length: 36, nullable: true })
  campaignId: string | null;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign | null;

  @Column({ name: 'budget_id', type: 'char', length: 36, nullable: true })
  budgetId: string | null;

  @ManyToOne(() => Budget, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget | null;

  @Column({ type: 'enum', enum: SpendSnapshotSource })
  source: SpendSnapshotSource;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'period_key', type: 'varchar', length: 16 })
  periodKey: string;

  @Column({ name: 'period_start', type: 'datetime', precision: 6, nullable: true })
  periodStart: Date | null;

  @Column({ name: 'period_end', type: 'datetime', precision: 6, nullable: true })
  periodEnd: Date | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'captured_at', type: 'datetime', precision: 6 })
  capturedAt: Date;
}
