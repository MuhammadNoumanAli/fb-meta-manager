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
import { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';
import { Business } from './business.entity';

/** Records every transition of Meta's native review state for a record. */
@Entity('meta_review_status_history')
@Index('IDX_meta_review_status_business_created', ['businessId', 'createdAt'])
@Index('IDX_meta_review_status_entity', ['entityType', 'entityId'])
export class MetaReviewStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'entity_type', type: 'enum', enum: AdvertisingEntityType })
  entityType: AdvertisingEntityType;

  @Column({ name: 'entity_id', type: 'char', length: 36 })
  entityId: string;

  @Column({ name: 'from_status', type: 'enum', enum: MetaReviewStatus, nullable: true })
  fromStatus: MetaReviewStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: MetaReviewStatus })
  toStatus: MetaReviewStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
