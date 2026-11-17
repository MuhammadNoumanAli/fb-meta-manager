import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BudgetTransactionType } from '../../common/enums/budget-transaction-type.enum';
import { ApprovalRequest } from './approval-request.entity';
import { Budget } from './budget.entity';
import { User } from './user.entity';

/** Change ledger for budget configuration, including approved changes. */
@Entity('budget_transactions')
@Index('IDX_budget_transactions_budget_created', ['budgetId', 'createdAt'])
export class BudgetTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'budget_id', type: 'char', length: 36 })
  budgetId: string;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget;

  @Column({ name: 'business_id', type: 'char', length: 36 })
  businessId: string;

  @Column({ type: 'enum', enum: BudgetTransactionType })
  type: BudgetTransactionType;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  amount: string | null;

  @Column({ name: 'previous_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  previousAmount: string | null;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'actor_user_id', type: 'char', length: 36, nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser: User | null;

  @Column({ name: 'approval_request_id', type: 'char', length: 36, nullable: true })
  approvalRequestId: string | null;

  @ManyToOne(() => ApprovalRequest, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest: ApprovalRequest | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
