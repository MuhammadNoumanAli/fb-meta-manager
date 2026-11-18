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
import { WhatsappPhoneNumberStatus } from '../../common/enums/whatsapp-phone-number-status.enum';
import { WhatsappAccount } from './whatsapp-account.entity';
import { Business } from './business.entity';

/** Business sender numbers attached to a WhatsApp account. */
@Entity('whatsapp_phone_numbers')
@Index('UQ_whatsapp_phone_numbers_external', ['accountId', 'externalPhoneNumberId'], {
  unique: true,
})
export class WhatsappPhoneNumber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'account_id', type: 'char', length: 36 })
  accountId: string;

  @ManyToOne(() => WhatsappAccount, (account) => account.phoneNumbers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account: WhatsappAccount;

  @Column({ name: 'external_phone_number_id', type: 'varchar', length: 128 })
  externalPhoneNumberId: string;

  @Column({ name: 'display_phone_number', type: 'varchar', length: 40 })
  displayPhoneNumber: string;

  @Column({ name: 'quality_rating', type: 'varchar', length: 40, nullable: true })
  qualityRating: string | null;

  @Column({
    type: 'enum',
    enum: WhatsappPhoneNumberStatus,
    default: WhatsappPhoneNumberStatus.ACTIVE,
  })
  status: WhatsappPhoneNumberStatus;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
