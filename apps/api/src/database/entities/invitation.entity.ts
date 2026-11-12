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
import { InvitationStatus } from '../../common/enums/invitation-status.enum';
import { Agency } from './agency.entity';
import { Business } from './business.entity';
import { User } from './user.entity';

@Entity('invitations')
@Index(['businessId', 'status'])
@Index(['invitedEmail', 'status'])
export class Invitation {
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

  @Column({ name: 'invited_email', length: 255 })
  invitedEmail: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'datetime', precision: 6, nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'accepted_by_user_id', type: 'char', length: 36, nullable: true })
  acceptedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'accepted_by_user_id' })
  acceptedByUser: User | null;

  @Column({ name: 'invited_by_user_id', type: 'char', length: 36 })
  invitedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedByUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
