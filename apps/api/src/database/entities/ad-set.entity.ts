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
import { AdvertisingPlatform } from '../../common/enums/advertising-platform.enum';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { BillingEvent } from '../../common/enums/billing-event.enum';
import { MetaDeliveryStatus } from '../../common/enums/meta-delivery-status.enum';
import { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';
import { OptimizationGoal } from '../../common/enums/optimization-goal.enum';
import { Business } from './business.entity';
import { Campaign } from './campaign.entity';
import { MetaAdAccount } from './meta-ad-account.entity';
import { User } from './user.entity';

@Entity('ad_sets')
@Index('UQ_ad_sets_platform_external', ['platform', 'externalId'], { unique: true })
@Index('IDX_ad_sets_business_campaign', ['businessId', 'campaignId'])
export class AdSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'campaign_id', type: 'char', length: 36 })
  campaignId: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'ad_account_id', type: 'char', length: 36, nullable: true })
  adAccountId: string | null;

  @ManyToOne(() => MetaAdAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ad_account_id' })
  adAccount: MetaAdAccount | null;

  @Column({ name: 'ad_account_external_id', type: 'varchar', length: 64, nullable: true })
  adAccountExternalId: string | null;

  @Column({ type: 'enum', enum: AdvertisingPlatform, default: AdvertisingPlatform.META })
  platform: AdvertisingPlatform;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'enum', enum: AdvertisingStatus, default: AdvertisingStatus.DRAFT })
  status: AdvertisingStatus;

  @Column({
    name: 'optimization_goal',
    type: 'enum',
    enum: OptimizationGoal,
    default: OptimizationGoal.LINK_CLICKS,
  })
  optimizationGoal: OptimizationGoal;

  @Column({ name: 'billing_event', type: 'enum', enum: BillingEvent, default: BillingEvent.IMPRESSIONS })
  billingEvent: BillingEvent;

  @Column({ type: 'json', nullable: true })
  targeting: Record<string, unknown> | null;

  @Column({
    name: 'daily_budget',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  dailyBudget: string | null;

  @Column({
    name: 'lifetime_budget',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  lifetimeBudget: string | null;

  @Column({ name: 'bid_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  bidAmount: string | null;

  @Column({ name: 'budget_currency', type: 'varchar', length: 3, nullable: true })
  budgetCurrency: string | null;

  @Column({ name: 'start_time', type: 'datetime', precision: 6, nullable: true })
  startTime: Date | null;

  @Column({ name: 'end_time', type: 'datetime', precision: 6, nullable: true })
  endTime: Date | null;

  @Column({ name: 'external_id', type: 'varchar', length: 64, nullable: true })
  externalId: string | null;

  @Column({ name: 'external_status', type: 'varchar', length: 100, nullable: true })
  externalStatus: string | null;

  @Column({
    name: 'delivery_status',
    type: 'enum',
    enum: MetaDeliveryStatus,
    default: MetaDeliveryStatus.UNKNOWN,
  })
  deliveryStatus: MetaDeliveryStatus;

  @Column({
    name: 'meta_review_status',
    type: 'enum',
    enum: MetaReviewStatus,
    default: MetaReviewStatus.UNKNOWN,
  })
  metaReviewStatus: MetaReviewStatus;

  @Column({ name: 'last_synced_at', type: 'datetime', precision: 6, nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'published_at', type: 'datetime', precision: 6, nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @Column({ type: 'json', nullable: true })
  data: Record<string, unknown> | null;

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
