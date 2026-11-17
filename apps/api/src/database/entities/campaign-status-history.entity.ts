import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { StatusChangeSource } from '../../common/enums/status-change-source.enum';
import { Business } from './business.entity';
import { Campaign } from './campaign.entity';
import { User } from './user.entity';

@Entity('campaign_status_history')
@Index('IDX_campaign_status_history_campaign_created', ['campaignId', 'createdAt'])
export class CampaignStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'campaign_id', type: 'char', length: 36 })
  campaignId: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'from_status', type: 'enum', enum: AdvertisingStatus, nullable: true })
  fromStatus: AdvertisingStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: AdvertisingStatus })
  toStatus: AdvertisingStatus;

  @Column({
    type: 'enum',
    enum: StatusChangeSource,
    default: StatusChangeSource.INTERNAL,
  })
  source: StatusChangeSource;

  @Column({ name: 'actor_user_id', type: 'char', length: 36, nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser: User | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
