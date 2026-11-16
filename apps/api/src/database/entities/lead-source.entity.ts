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
import { LeadSourceType } from '../../common/enums/lead-source-type.enum';
import { Business } from './business.entity';

/**
 * A configured origin of leads. Website sources authenticate submissions with
 * an API key that is stored only as a SHA-256 hash.
 */
@Entity('lead_sources')
@Index('UQ_lead_sources_business_type', ['businessId', 'type'], { unique: true })
@Index('UQ_lead_sources_api_key_hash', ['apiKeyHash'], { unique: true })
export class LeadSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'enum', enum: LeadSourceType })
  type: LeadSourceType;

  @Column({ length: 120 })
  name: string;

  @Column({ name: 'external_id', type: 'varchar', length: 64, nullable: true })
  externalId: string | null;

  @Column({ name: 'api_key_hash', type: 'char', length: 64, nullable: true })
  apiKeyHash: string | null;

  @Column({ name: 'api_key_hint', type: 'varchar', length: 8, nullable: true })
  apiKeyHint: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_received_at', type: 'datetime', precision: 6, nullable: true })
  lastReceivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
