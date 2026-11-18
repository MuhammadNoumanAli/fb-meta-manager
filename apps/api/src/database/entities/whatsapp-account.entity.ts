import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsappAccountStatus } from '../../common/enums/whatsapp-account-status.enum';
import { WhatsappProvider } from '../../common/enums/whatsapp-provider.enum';
import { Business } from './business.entity';
import { User } from './user.entity';
import { WhatsappPhoneNumber } from './whatsapp-phone-number.entity';

/**
 * A connected WhatsApp Business account. Provider credentials are stored only
 * as ciphertext and are never returned by the API.
 */
@Entity('whatsapp_accounts')
@Index('UQ_whatsapp_accounts_external', ['businessId', 'provider', 'externalAccountId'], {
  unique: true,
})
export class WhatsappAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'enum', enum: WhatsappProvider })
  provider: WhatsappProvider;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'external_account_id', type: 'varchar', length: 128 })
  externalAccountId: string;

  @Column({ name: 'credentials_encrypted', type: 'varchar', length: 512 })
  credentialsEncrypted: string;

  @Column({ name: 'credentials_expires_at', type: 'datetime', precision: 6, nullable: true })
  credentialsExpiresAt: Date | null;

  @Column({
    type: 'enum',
    enum: WhatsappAccountStatus,
    default: WhatsappAccountStatus.ACTIVE,
  })
  status: WhatsappAccountStatus;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @Column({ name: 'created_by_user_id', type: 'char', length: 36, nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @OneToMany(() => WhatsappPhoneNumber, (phone) => phone.account)
  phoneNumbers: WhatsappPhoneNumber[];

  @Column({ name: 'last_validated_at', type: 'datetime', precision: 6, nullable: true })
  lastValidatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
