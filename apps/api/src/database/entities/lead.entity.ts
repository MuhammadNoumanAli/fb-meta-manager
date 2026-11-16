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
import { LeadConsentStatus } from '../../common/enums/lead-consent-status.enum';
import { LeadSourceType } from '../../common/enums/lead-source-type.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { Business } from './business.entity';
import { LeadSource } from './lead-source.entity';
import { User } from './user.entity';

/**
 * Normalised lead captured from Meta Lead Ads or the website API. Provider
 * identifiers are retained alongside the internal record for attribution.
 */
@Entity('leads')
@Index('UQ_leads_dedupe_hash', ['dedupeHash'], { unique: true })
@Index('IDX_leads_business_captured', ['businessId', 'capturedAt'])
@Index('IDX_leads_business_status', ['businessId', 'status'])
@Index('IDX_leads_business_email', ['businessId', 'email'])
@Index('IDX_leads_business_phone', ['businessId', 'phone'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'lead_source_id', type: 'char', length: 36, nullable: true })
  leadSourceId: string | null;

  @ManyToOne(() => LeadSource, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'lead_source_id' })
  leadSource: LeadSource | null;

  @Column({ name: 'source_platform', type: 'enum', enum: LeadSourceType })
  sourcePlatform: LeadSourceType;

  @Column({ name: 'external_lead_id', type: 'varchar', length: 128, nullable: true })
  externalLeadId: string | null;

  @Column({ name: 'form_id', type: 'varchar', length: 64, nullable: true })
  formId: string | null;

  @Column({ name: 'campaign_external_id', type: 'varchar', length: 64, nullable: true })
  campaignExternalId: string | null;

  @Column({ name: 'ad_set_external_id', type: 'varchar', length: 64, nullable: true })
  adSetExternalId: string | null;

  @Column({ name: 'ad_external_id', type: 'varchar', length: 64, nullable: true })
  adExternalId: string | null;

  @Column({ name: 'page_external_id', type: 'varchar', length: 64, nullable: true })
  pageExternalId: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 200, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  language: string | null;

  @Column({
    name: 'consent_status',
    type: 'enum',
    enum: LeadConsentStatus,
    default: LeadConsentStatus.UNKNOWN,
  })
  consentStatus: LeadConsentStatus;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Column({ name: 'assigned_user_id', type: 'char', length: 36, nullable: true })
  assignedUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser: User | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'raw_payload', type: 'json', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ name: 'dedupe_hash', type: 'char', length: 64, nullable: true })
  dedupeHash: string | null;

  @Column({ name: 'captured_at', type: 'datetime', precision: 6 })
  capturedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
