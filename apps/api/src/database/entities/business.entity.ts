import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36, unique: true })
  tenantId: string;

  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true, length: 80 })
  slug: string;

  @Column({ length: 64, default: 'UTC' })
  timezone: string;

  @Column({ length: 3, default: 'MYR' })
  currency: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  industry: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 150, nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true })
  contactPhone: string | null;

  @Column({ length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
