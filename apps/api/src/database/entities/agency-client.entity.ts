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
import { AgencyClientStatus } from '../../common/enums/agency-client-status.enum';
import { Agency } from './agency.entity';
import { Business } from './business.entity';

@Entity('agency_clients')
@Index(['agencyId', 'businessId'], { unique: true })
export class AgencyClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agency_id', type: 'char', length: 36 })
  agencyId: string;

  @ManyToOne(() => Agency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'enum', enum: AgencyClientStatus, default: AgencyClientStatus.ACTIVE })
  status: AgencyClientStatus;

  @CreateDateColumn({ name: 'started_at', type: 'datetime', precision: 6 })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', precision: 6, nullable: true })
  endedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
