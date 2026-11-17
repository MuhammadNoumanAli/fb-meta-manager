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
import { AdvertisingObjective } from '../../common/enums/advertising-objective.enum';
import { AdvertisingPlatform } from '../../common/enums/advertising-platform.enum';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { MetaDeliveryStatus } from '../../common/enums/meta-delivery-status.enum';
import { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';
import { Business } from './business.entity';
import { MetaAdAccount } from './meta-ad-account.entity';
import { User } from './user.entity';

/**
 * An AdPilot-managed Meta campaign. Local lifecycle status, raw Meta status
 * and Meta review state are kept in separate columns so they can never be
 * confused with one another.
 */
@Entity('campaigns')
@Index('UQ_campaigns_platform_external', ['platform', 'externalId'], { unique: true })
@Index('IDX_campaigns_business_status', ['businessId', 'status'])
@Index('IDX_campaigns_business_created', ['businessId', 'createdAt'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

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

  @Column({ type: 'enum', enum: AdvertisingObjective })
  objective: AdvertisingObjective;

  @Column({
    type: 'enum',
    enum: AdvertisingStatus,
    default: AdvertisingStatus.DRAFT,
  })
  status: AdvertisingStatus;

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

  @Column({ name: 'budget_currency', type: 'varchar', length: 3, nullable: true })
  budgetCurrency: string | null;

  @Column({ name: 'special_ad_categories', type: 'json', nullable: true })
  specialAdCategories: string[] | null;

  @Column({ name: 'start_time', type: 'datetime', precision: 6, nullable: true })
  startTime: Date | null;

  @Column({ name: 'stop_time', type: 'datetime', precision: 6, nullable: true })
  stopTime: Date | null;

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
