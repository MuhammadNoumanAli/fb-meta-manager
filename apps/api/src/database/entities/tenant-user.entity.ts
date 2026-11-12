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
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { Role } from './role.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

@Entity('tenant_users')
@Index(['tenantId', 'userId'], { unique: true })
export class TenantUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'role_id', type: 'char', length: 36 })
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'enum', enum: MembershipStatus, default: MembershipStatus.ACTIVE })
  status: MembershipStatus;

  @CreateDateColumn({ name: 'joined_at', type: 'datetime', precision: 6 })
  joinedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
