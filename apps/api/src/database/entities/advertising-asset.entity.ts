import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdvertisingAssetStatus } from '../../common/enums/advertising-asset-status.enum';
import { AdvertisingPlatform } from '../../common/enums/advertising-platform.enum';
import { Business } from './business.entity';
import { User } from './user.entity';

/**
 * A media file uploaded for use in an advertisement. The binary lives on disk
 * under the configured upload directory; only its storage key and checksum are
 * persisted here.
 */
@Entity('assets')
@Index('UQ_assets_storage_key', ['storageKey'], { unique: true })
@Index('IDX_assets_business_created', ['businessId', 'createdAt'])
export class AdvertisingAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'enum', enum: AdvertisingPlatform, default: AdvertisingPlatform.META })
  platform: AdvertisingPlatform;

  @Column({ name: 'uploaded_by_user_id', type: 'char', length: 36, nullable: true })
  uploadedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser: User | null;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ type: 'char', length: 64 })
  checksum: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 255 })
  storageKey: string;

  @Column({ name: 'meta_image_hash', type: 'varchar', length: 100, nullable: true })
  metaImageHash: string | null;

  @Column({
    type: 'enum',
    enum: AdvertisingAssetStatus,
    default: AdvertisingAssetStatus.UPLOADED,
  })
  status: AdvertisingAssetStatus;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
