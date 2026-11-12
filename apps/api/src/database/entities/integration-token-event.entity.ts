import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IntegrationTokenEventType } from '../../common/enums/integration-token-event-type.enum';
import { Business } from './business.entity';
import { IntegrationAuthorization } from './integration-authorization.entity';

/** Append-only history used by token monitoring and the integration audit trail. */
@Entity('integration_token_events')
@Index(['businessId', 'createdAt'])
@Index(['authorizationId', 'createdAt'])
export class IntegrationTokenEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'authorization_id', type: 'char', length: 36 })
  authorizationId: string;

  @ManyToOne(() => IntegrationAuthorization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorization_id' })
  authorization: IntegrationAuthorization;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'event_type', type: 'enum', enum: IntegrationTokenEventType })
  eventType: IntegrationTokenEventType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  detail: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
