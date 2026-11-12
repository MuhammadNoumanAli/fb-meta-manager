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
import { IntegrationConnectionMode } from '../../common/enums/integration-connection-mode.enum';
import { IntegrationStatus } from '../../common/enums/integration-status.enum';
import { Business } from './business.entity';
import { User } from './user.entity';

/**
 * A business-scoped connection to an advertising platform. Provider secrets are
 * stored encrypted in `access_token_encrypted` and are never selected into API
 * responses.
 */
@Entity('integration_authorizations')
@Index('UQ_integration_authorizations_business_provider', ['businessId', 'provider'], {
  unique: true,
})
@Index(['status', 'tokenExpiresAt'])
export class IntegrationAuthorization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ length: 20, default: 'meta' })
  provider: string;

  @Column({
    name: 'connection_mode',
    type: 'enum',
    enum: IntegrationConnectionMode,
    default: IntegrationConnectionMode.CLIENT_OAUTH,
  })
  connectionMode: IntegrationConnectionMode;

  @Column({ type: 'enum', enum: IntegrationStatus, default: IntegrationStatus.PENDING })
  status: IntegrationStatus;

  @Column({ name: 'access_token_encrypted', type: 'text', nullable: true })
  accessTokenEncrypted: string | null;

  @Column({ name: 'token_key_version', type: 'smallint', default: 1 })
  tokenKeyVersion: number;

  @Column({ name: 'token_expires_at', type: 'datetime', precision: 6, nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'json', nullable: true })
  scopes: string[] | null;

  @Column({ name: 'granted_permissions', type: 'json', nullable: true })
  grantedPermissions: string[] | null;

  @Column({ name: 'missing_permissions', type: 'json', nullable: true })
  missingPermissions: string[] | null;

  @Column({ name: 'external_user_id', type: 'varchar', length: 64, nullable: true })
  externalUserId: string | null;

  @Column({ name: 'external_user_name', type: 'varchar', length: 150, nullable: true })
  externalUserName: string | null;

  @Column({ name: 'last_validated_at', type: 'datetime', precision: 6, nullable: true })
  lastValidatedAt: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @Column({ name: 'authorized_by_user_id', type: 'char', length: 36, nullable: true })
  authorizedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'authorized_by_user_id' })
  authorizedByUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
