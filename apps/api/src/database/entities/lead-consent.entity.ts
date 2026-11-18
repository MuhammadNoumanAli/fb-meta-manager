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
import { WhatsappConsentSource } from '../../common/enums/whatsapp-consent-source.enum';
import { Business } from './business.entity';
import { Lead } from './lead.entity';
import { User } from './user.entity';

/** Explicit WhatsApp consent record for one lead or phone number. */
@Entity('lead_consents')
@Index('UQ_lead_consents_channel', ['businessId', 'channel', 'leadId'], { unique: true })
@Index('IDX_lead_consents_business_phone', ['businessId', 'phoneNumber'])
export class LeadConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'lead_id', type: 'char', length: 36, nullable: true })
  leadId: string | null;

  @ManyToOne(() => Lead, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ type: 'varchar', length: 20, default: 'whatsapp' })
  channel: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 40, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'enum', enum: LeadConsentStatus })
  status: LeadConsentStatus;

  @Column({ type: 'enum', enum: WhatsappConsentSource })
  source: WhatsappConsentSource;

  @Column({ name: 'consent_text', type: 'varchar', length: 500, nullable: true })
  consentText: string | null;

  @Column({ name: 'captured_at', type: 'datetime', precision: 6 })
  capturedAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 6, nullable: true })
  revokedAt: Date | null;

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
