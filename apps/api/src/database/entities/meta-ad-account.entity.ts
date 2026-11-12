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
import { MetaBusinessPortfolio } from './meta-business-portfolio.entity';

@Entity('meta_ad_accounts')
@Index('UQ_meta_ad_accounts_authorization_external', ['authorizationId', 'externalId'], {
  unique: true,
})
export class MetaAdAccount {
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

  @Column({ name: 'portfolio_id', type: 'char', length: 36, nullable: true })
  portfolioId: string | null;

  @ManyToOne(() => MetaBusinessPortfolio, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: MetaBusinessPortfolio | null;

  @Column({ name: 'external_id', type: 'varchar', length: 64 })
  externalId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'account_status', type: 'int', nullable: true })
  accountStatus: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  @Column({ name: 'timezone_name', type: 'varchar', length: 64, nullable: true })
  timezoneName: string | null;

  @CreateDateColumn({ name: 'discovered_at', type: 'datetime', precision: 6 })
  discoveredAt: Date;
}
