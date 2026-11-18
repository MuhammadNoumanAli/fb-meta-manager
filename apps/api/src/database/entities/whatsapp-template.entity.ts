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
import { WhatsappTemplateCategory } from '../../common/enums/whatsapp-template-category.enum';
import { WhatsappTemplateStatus } from '../../common/enums/whatsapp-template-status.enum';
import { Business } from './business.entity';
import { User } from './user.entity';
import { WhatsappAccount } from './whatsapp-account.entity';

/** Provider template configuration. Only approved templates can be sent. */
@Entity('whatsapp_templates')
@Index('UQ_whatsapp_templates_name_language', ['businessId', 'name', 'language'], {
  unique: true,
})
export class WhatsappTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'account_id', type: 'char', length: 36, nullable: true })
  accountId: string | null;

  @ManyToOne(() => WhatsappAccount, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'account_id' })
  account: WhatsappAccount | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  language: string;

  @Column({ type: 'enum', enum: WhatsappTemplateCategory })
  category: WhatsappTemplateCategory;

  @Column({
    type: 'enum',
    enum: WhatsappTemplateStatus,
    default: WhatsappTemplateStatus.DRAFT,
  })
  status: WhatsappTemplateStatus;

  @Column({ name: 'provider_template_id', type: 'varchar', length: 128, nullable: true })
  providerTemplateId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'variable_mapping', type: 'json', nullable: true })
  variableMapping: Record<string, string> | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  /** Marks the template used for automatic lead acknowledgments. */
  @Column({ name: 'is_acknowledgment', type: 'boolean', default: false })
  isAcknowledgment: boolean;

  @Column({ name: 'approved_at', type: 'datetime', precision: 6, nullable: true })
  approvedAt: Date | null;

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
