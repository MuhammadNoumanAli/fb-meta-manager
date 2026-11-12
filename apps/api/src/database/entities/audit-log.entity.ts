import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
@Index(['businessId', 'createdAt'])
@Index(['actorUserId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36, nullable: true })
  tenantId: string | null;

  @Column({ name: 'business_id', type: 'char', length: 36, nullable: true })
  businessId: string | null;

  @Column({ name: 'actor_user_id', type: 'char', length: 36, nullable: true })
  actorUserId: string | null;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'char', length: 36, nullable: true })
  entityId: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
