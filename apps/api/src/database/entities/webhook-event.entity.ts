import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WebhookEventStatus } from '../../common/enums/webhook-event-status.enum';
import { Business } from './business.entity';
import { IntegrationAuthorization } from './integration-authorization.entity';

/**
 * Immutable record of an inbound webhook delivery. The raw payload is retained
 * for auditing and safe reprocessing; provider credentials never appear here.
 */
@Entity('webhook_events')
@Index('UQ_webhook_events_provider_idempotency', ['provider', 'idempotencyKey'], {
  unique: true,
})
@Index('IDX_webhook_events_business_received', ['businessId', 'receivedAt'])
@Index('IDX_webhook_events_status', ['status'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, default: 'meta' })
  provider: string;

  @Column({ name: 'object_type', type: 'varchar', length: 50 })
  objectType: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  field: string | null;

  @Column({ name: 'business_id', type: 'char', length: 36, nullable: true })
  businessId: string | null;

  @ManyToOne(() => Business, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'business_id' })
  business: Business | null;

  @Column({ name: 'authorization_id', type: 'char', length: 36, nullable: true })
  authorizationId: string | null;

  @ManyToOne(() => IntegrationAuthorization, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'authorization_id' })
  authorization: IntegrationAuthorization | null;

  @Column({ name: 'external_entry_id', type: 'varchar', length: 64, nullable: true })
  externalEntryId: string | null;

  @Column({ name: 'idempotency_key', type: 'char', length: 64 })
  idempotencyKey: string;

  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.RECEIVED,
  })
  status: WebhookEventStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'received_at', type: 'datetime', precision: 6 })
  receivedAt: Date;

  @Column({ name: 'processed_at', type: 'datetime', precision: 6, nullable: true })
  processedAt: Date | null;
}
