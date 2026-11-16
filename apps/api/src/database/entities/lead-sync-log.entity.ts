import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LeadSourceType } from '../../common/enums/lead-source-type.enum';
import { LeadSyncStatus } from '../../common/enums/lead-sync-status.enum';
import { Business } from './business.entity';

/** Append-only history of lead intake attempts for operations and support. */
@Entity('lead_sync_logs')
@Index('IDX_lead_sync_logs_business_created', ['businessId', 'createdAt'])
export class LeadSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'source_platform', type: 'enum', enum: LeadSourceType })
  sourcePlatform: LeadSourceType;

  @Column({ name: 'external_lead_id', type: 'varchar', length: 128, nullable: true })
  externalLeadId: string | null;

  @Column({ type: 'enum', enum: LeadSyncStatus })
  status: LeadSyncStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
