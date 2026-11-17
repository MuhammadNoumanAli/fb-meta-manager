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
import { CreativeStatus } from '../../common/enums/creative-status.enum';
import { AdvertisingAsset } from './advertising-asset.entity';
import { Business } from './business.entity';
import { MetaPage } from './meta-page.entity';
import { User } from './user.entity';

@Entity('creatives')
@Index('UQ_creatives_platform_external', ['platform', 'externalId'], { unique: true })
@Index('IDX_creatives_business_created', ['businessId', 'createdAt'])
export class Creative {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'page_id', type: 'char', length: 36, nullable: true })
  pageId: string | null;

  @ManyToOne(() => MetaPage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'page_id' })
  page: MetaPage | null;

  @Column({ name: 'page_external_id', type: 'varchar', length: 64, nullable: true })
  pageExternalId: string | null;

  @Column({ name: 'asset_id', type: 'char', length: 36, nullable: true })
  assetId: string | null;

  @ManyToOne(() => AdvertisingAsset, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'asset_id' })
  asset: AdvertisingAsset | null;

  @Column({ type: 'enum', enum: AdvertisingPlatform, default: AdvertisingPlatform.META })
  platform: AdvertisingPlatform;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  headline: string | null;

  @Column({ name: 'primary_text', type: 'text', nullable: true })
  primaryText: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'call_to_action', type: 'varchar', length: 40, nullable: true })
  callToAction: string | null;

  @Column({ name: 'destination_url', type: 'varchar', length: 500, nullable: true })
  destinationUrl: string | null;

  @Column({ name: 'image_hash', type: 'varchar', length: 100, nullable: true })
  imageHash: string | null;

  @Column({ name: 'external_id', type: 'varchar', length: 64, nullable: true })
  externalId: string | null;

  @Column({ type: 'enum', enum: CreativeStatus, default: CreativeStatus.DRAFT })
  status: CreativeStatus;

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
