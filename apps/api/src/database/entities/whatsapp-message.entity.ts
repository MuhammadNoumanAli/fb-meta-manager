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
import { WhatsappMessageDirection } from '../../common/enums/whatsapp-message-direction.enum';
import { WhatsappMessageStatus } from '../../common/enums/whatsapp-message-status.enum';
import { WhatsappMessageType } from '../../common/enums/whatsapp-message-type.enum';
import { Business } from './business.entity';
import { Lead } from './lead.entity';
import { User } from './user.entity';
import { WhatsappAccount } from './whatsapp-account.entity';
import { WhatsappPhoneNumber } from './whatsapp-phone-number.entity';
import { WhatsappTemplate } from './whatsapp-template.entity';

/** Outbound and inbound WhatsApp messages with delivery state. */
@Entity('whatsapp_messages')
@Index('UQ_whatsapp_messages_idempotency', ['idempotencyKey'], { unique: true })
@Index('IDX_whatsapp_messages_business_created', ['businessId', 'createdAt'])
@Index('IDX_whatsapp_messages_business_lead', ['businessId', 'leadId'])
@Index('IDX_whatsapp_messages_external', ['externalMessageId'])
export class WhatsappMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'lead_id', type: 'char', length: 36, nullable: true })
  leadId: string | null;

  @ManyToOne(() => Lead, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ name: 'account_id', type: 'char', length: 36 })
  accountId: string;

  @ManyToOne(() => WhatsappAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: WhatsappAccount;

  @Column({ name: 'phone_number_id', type: 'char', length: 36 })
  phoneNumberId: string;

  @ManyToOne(() => WhatsappPhoneNumber, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phone_number_id' })
  phoneNumber: WhatsappPhoneNumber;

  @Column({ name: 'template_id', type: 'char', length: 36, nullable: true })
  templateId: string | null;

  @ManyToOne(() => WhatsappTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template: WhatsappTemplate | null;

  @Column({ type: 'enum', enum: WhatsappMessageDirection })
  direction: WhatsappMessageDirection;

  @Column({ name: 'message_type', type: 'enum', enum: WhatsappMessageType })
  messageType: WhatsappMessageType;

  @Column({ type: 'enum', enum: WhatsappMessageStatus })
  status: WhatsappMessageStatus;

  @Column({ name: 'to_phone', type: 'varchar', length: 40 })
  toPhone: string;

  @Column({ name: 'from_phone', type: 'varchar', length: 40, nullable: true })
  fromPhone: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'json', nullable: true })
  variables: Record<string, string> | null;

  @Column({ name: 'external_message_id', type: 'varchar', length: 128, nullable: true })
  externalMessageId: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 190 })
  idempotencyKey: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'int', unsigned: true, default: 3 })
  maxAttempts: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error: string | null;

  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ name: 'created_by_user_id', type: 'char', length: 36, nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @Column({ name: 'sent_at', type: 'datetime', precision: 6, nullable: true })
  sentAt: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', precision: 6, nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'read_at', type: 'datetime', precision: 6, nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
