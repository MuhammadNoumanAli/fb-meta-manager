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
import { MetaDeliveryStatus } from '../../common/enums/meta-delivery-status.enum';
import { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';
import { AdSet } from './ad-set.entity';
import { Business } from './business.entity';
import { Creative } from './creative.entity';
import { MetaAdAccount } from './meta-ad-account.entity';
import { User } from './user.entity';

@Entity('advertisements')
@Index('UQ_advertisements_platform_external', ['platform', 'externalId'], { unique: true })
@Index('IDX_advertisements_business_adset', ['businessId', 'adSetId'])
export class Advertisement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'ad_set_id', type: 'char', length: 36 })
  adSetId: string;

  @ManyToOne(() => AdSet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ad_set_id' })
  adSet: AdSet;

  @Column({ name: 'creative_id', type: 'char', length: 36, nullable: true })
  creativeId: string | null;

  @ManyToOne(() => Creative, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'creative_id' })
  creative: Creative | null;

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
