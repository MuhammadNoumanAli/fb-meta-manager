import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Business } from './business.entity';
import { IntegrationAuthorization } from './integration-authorization.entity';
import { MetaPage } from './meta-page.entity';

@Entity('meta_instagram_accounts')
@Index(
  'UQ_meta_instagram_accounts_authorization_external',
  ['authorizationId', 'externalId'],
  { unique: true },
)
export class MetaInstagramAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'authorization_id', type: 'char', length: 36 })
  authorizationId: string;

  @ManyToOne(() => IntegrationAuthorization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorization_id' })
  authorization: IntegrationAuthorization;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'page_id', type: 'char', length: 36, nullable: true })
  pageId: string | null;

  @ManyToOne(() => MetaPage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'page_id' })
  page: MetaPage | null;

  @Column({ name: 'external_id', type: 'varchar', length: 64 })
  externalId: string;

  @Column({ length: 150 })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @CreateDateColumn({ name: 'discovered_at', type: 'datetime', precision: 6 })
  discoveredAt: Date;
}
