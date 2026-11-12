import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleScope } from '../../common/enums/role-scope.enum';

@Entity('roles')
@Index(['tenantId', 'key'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36, nullable: true })
  tenantId: string | null;

  @Column({ length: 100 })
  key: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'enum', enum: RoleScope })
  scope: RoleScope;

  @Column({ name: 'is_system', type: 'boolean', default: true })
  isSystem: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
