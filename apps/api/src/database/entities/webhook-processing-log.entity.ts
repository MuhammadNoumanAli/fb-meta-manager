import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WebhookProcessingStatus } from '../../common/enums/webhook-processing-status.enum';
import { WebhookEvent } from './webhook-event.entity';

/** Append-only trace of every processing attempt for a webhook event. */
@Entity('webhook_processing_logs')
@Index('IDX_webhook_processing_logs_event_created', ['webhookEventId', 'createdAt'])
export class WebhookProcessingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'webhook_event_id', type: 'char', length: 36 })
  webhookEventId: string;

  @ManyToOne(() => WebhookEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhook_event_id' })
  webhookEvent: WebhookEvent;

  @Column({ type: 'enum', enum: WebhookProcessingStatus })
  status: WebhookProcessingStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ type: 'json', nullable: true })
  detail: Record<string, unknown> | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
