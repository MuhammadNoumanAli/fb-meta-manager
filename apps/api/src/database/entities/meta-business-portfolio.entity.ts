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

@Entity('meta_business_portfolios')
@Index('UQ_meta_business_portfolios_authorization_external', ['authorizationId', 'externalId'], {
  unique: true,
})
export class MetaBusinessPortfolio {
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

  @Column({ name: 'external_id', type: 'varchar', length: 64 })
  externalId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'verification_status', type: 'varchar', length: 64, nullable: true })
  verificationStatus: string | null;

  @CreateDateColumn({ name: 'discovered_at', type: 'datetime', precision: 6 })
  discoveredAt: Date;
}
