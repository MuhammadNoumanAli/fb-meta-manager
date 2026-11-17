import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdvertisingEntityType } from '../../common/enums/advertising-entity-type.enum';
import { SyncDirection } from '../../common/enums/sync-direction.enum';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { Business } from './business.entity';

/** History of outbound publishing calls and inbound status synchronisations. */
@Entity('platform_sync_logs')
@Index('IDX_platform_sync_logs_business_created', ['businessId', 'createdAt'])
@Index('IDX_platform_sync_logs_entity', ['entityType', 'entityId'])
export class PlatformSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'entity_type', type: 'enum', enum: AdvertisingEntityType })
  entityType: AdvertisingEntityType;

  @Column({ name: 'entity_id', type: 'char', length: 36, nullable: true })
  entityId: string | null;

  @Column({ type: 'enum', enum: SyncDirection })
  direction: SyncDirection;

  @Column({ type: 'enum', enum: SyncStatus })
  status: SyncStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
