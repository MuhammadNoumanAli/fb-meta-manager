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
import { SuppressionReason } from '../../common/enums/suppression-reason.enum';
import { Business } from './business.entity';
import { User } from './user.entity';

/** Opt-out and suppression list entry that blocks all outbound messages. */
@Entity('communication_suppressions')
@Index('UQ_communication_suppressions_phone', ['businessId', 'phoneNumber'], {
  unique: true,
})
export class CommunicationSuppression {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'phone_number', type: 'varchar', length: 40 })
  phoneNumber: string;

  @Column({ type: 'enum', enum: SuppressionReason })
  reason: SuppressionReason;

  @Column({ type: 'varchar', length: 40 })
  source: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

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
