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
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import { Business } from './business.entity';
import { User } from './user.entity';

/**
 * Per-business switch that decides whether an action must be approved before
 * it is executed. A missing row means the action is not gated.
 */
@Entity('approval_policies')
@Index('UQ_approval_policies_business_target', ['businessId', 'targetType'], {
  unique: true,
})
export class ApprovalPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: ApprovalTargetType,
  })
  targetType: ApprovalTargetType;

  @Column({ name: 'is_enabled', type: 'boolean', default: false })
  isEnabled: boolean;

  @Column({ name: 'updated_by_user_id', type: 'char', length: 36, nullable: true })
  updatedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
