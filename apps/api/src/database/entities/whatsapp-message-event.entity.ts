import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WhatsappMessageStatus } from '../../common/enums/whatsapp-message-status.enum';
import { Business } from './business.entity';
import { WhatsappMessage } from './whatsapp-message.entity';

/** Immutable delivery and status history supplied by the provider. */
@Entity('whatsapp_message_events')
@Index('IDX_whatsapp_message_events_message', ['messageId', 'occurredAt'])
export class WhatsappMessageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'message_id', type: 'char', length: 36 })
  messageId: string;

  @ManyToOne(() => WhatsappMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: WhatsappMessage;

  @Column({ type: 'enum', enum: WhatsappMessageStatus })
  status: WhatsappMessageStatus;

  @Column({ name: 'event_type', type: 'varchar', length: 64, nullable: true })
  eventType: string | null;

  @Column({ name: 'external_message_id', type: 'varchar', length: 128, nullable: true })
  externalMessageId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error: string | null;

  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
