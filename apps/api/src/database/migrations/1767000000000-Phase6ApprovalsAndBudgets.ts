import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const ID = { name: 'id', type: 'char', length: '36', isPrimary: true } as const;
const CREATED_AT = {
  name: 'created_at',
  type: 'datetime',
  precision: 6,
  default: 'CURRENT_TIMESTAMP(6)',
} as const;
const UPDATED_AT = {
  name: 'updated_at',
  type: 'datetime',
  precision: 6,
  default: 'CURRENT_TIMESTAMP(6)',
  onUpdate: 'CURRENT_TIMESTAMP(6)',
} as const;

const APPROVAL_TARGETS = ['campaign.publish', 'campaign.status', 'budget.change'];
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'cancelled'];
const APPROVAL_DECISIONS = ['approved', 'rejected'];
const EXECUTION_STATUSES = ['not_started', 'executing', 'executed', 'failed'];
const BUDGET_SCOPES = ['business', 'campaign'];
const BUDGET_PERIODS = ['monthly', 'total'];
const SPEND_SOURCES = ['meta_sync', 'manual'];
const ALERT_STATUSES = ['open', 'acknowledged'];
const TRANSACTION_TYPES = ['created', 'updated', 'deleted'];

export class Phase6ApprovalsAndBudgets1767000000000 implements MigrationInterface {
  name = 'Phase6ApprovalsAndBudgets1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'approval_policies',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'target_type', type: 'enum', enum: APPROVAL_TARGETS },
          { name: 'is_enabled', type: 'boolean', default: false },
          {
            name: 'updated_by_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createIndices('approval_policies', [
      new TableIndex({
        name: 'UQ_approval_policies_business_target',
        columnNames: ['business_id', 'target_type'],
        isUnique: true,
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'approval_requests',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'target_type', type: 'enum', enum: APPROVAL_TARGETS },
          { name: 'target_id', type: 'char', length: '36', isNullable: true },
          { name: 'target_label', type: 'varchar', length: '200', isNullable: true },
          { name: 'requested_by_user_id', type: 'char', length: '36' },
          { name: 'approver_user_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'status',
            type: 'enum',
            enum: APPROVAL_STATUSES,
            default: "'pending'",
          },
          { name: 'current_version', type: 'int', default: 1 },
          { name: 'current_payload_hash', type: 'char', length: '64' },
          { name: 'approved_version_id', type: 'char', length: '36', isNullable: true },
          { name: 'approved_payload_hash', type: 'char', length: '64', isNullable: true },
          { name: 'decided_by_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'decided_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'decision_reason', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'execution_status',
            type: 'enum',
            enum: EXECUTION_STATUSES,
            default: "'not_started'",
          },
          { name: 'executed_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'execution_error', type: 'varchar', length: '500', isNullable: true },
          { name: 'expires_at', type: 'datetime', precision: 6 },
          { name: 'requester_note', type: 'varchar', length: '500', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createIndices('approval_requests', [
      new TableIndex({
        name: 'IDX_approval_requests_business_status',
        columnNames: ['business_id', 'status'],
      }),
      new TableIndex({
        name: 'IDX_approval_requests_business_created',
        columnNames: ['business_id', 'created_at'],
      }),
      new TableIndex({
        name: 'IDX_approval_requests_target',
        columnNames: ['target_type', 'target_id'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'approval_versions',
        columns: [
          ID,
          { name: 'approval_request_id', type: 'char', length: '36' },
          { name: 'version', type: 'int' },
          { name: 'payload', type: 'json' },
          { name: 'payload_hash', type: 'char', length: '64' },
          { name: 'note', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36' },
          CREATED_AT,
        ],
      }),
    );

    await queryRunner.createIndices('approval_versions', [
      new TableIndex({
        name: 'UQ_approval_versions_request_version',
        columnNames: ['approval_request_id', 'version'],
        isUnique: true,
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'approval_decisions',
        columns: [
          ID,
          { name: 'approval_request_id', type: 'char', length: '36' },
          { name: 'approval_version_id', type: 'char', length: '36' },
          { name: 'decision', type: 'enum', enum: APPROVAL_DECISIONS },
          { name: 'decided_by_user_id', type: 'char', length: '36' },
          { name: 'reason', type: 'varchar', length: '500', isNullable: true },
          CREATED_AT,
        ],
      }),
    );

    await queryRunner.createIndices('approval_decisions', [
      new TableIndex({
        name: 'IDX_approval_decisions_request',
        columnNames: ['approval_request_id', 'created_at'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'budgets',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'campaign_id', type: 'char', length: '36', isNullable: true },
          { name: 'scope', type: 'enum', enum: BUDGET_SCOPES },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'amount', type: 'decimal', precision: 14, scale: 2 },
          { name: 'currency', type: 'varchar', length: '3' },
          {
            name: 'period',
            type: 'enum',
            enum: BUDGET_PERIODS,
            default: "'monthly'",
          },
          {
            name: 'alert_threshold_percent',
            type: 'tinyint',
            unsigned: true,
            default: 80,
          },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'notes', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createIndices('budgets', [
      new TableIndex({
        name: 'UQ_budgets_business_campaign',
        columnNames: ['business_id', 'campaign_id'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_budgets_business_scope',
        columnNames: ['business_id', 'scope'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'budget_transactions',
        columns: [
          ID,
          { name: 'budget_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'type', type: 'enum', enum: TRANSACTION_TYPES },
          { name: 'amount', type: 'decimal', precision: 14, scale: 2, isNullable: true },
          {
            name: 'previous_amount',
            type: 'decimal',
            precision: 14,
            scale: 2,
            isNullable: true,
          },
          { name: 'currency', type: 'varchar', length: '3' },
          { name: 'actor_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'approval_request_id', type: 'char', length: '36', isNullable: true },
          { name: 'note', type: 'varchar', length: '500', isNullable: true },
          CREATED_AT,
        ],
      }),
    );

    await queryRunner.createIndices('budget_transactions', [
      new TableIndex({
        name: 'IDX_budget_transactions_budget_created',
        columnNames: ['budget_id', 'created_at'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'spend_snapshots',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'campaign_id', type: 'char', length: '36', isNullable: true },
          { name: 'budget_id', type: 'char', length: '36', isNullable: true },
          { name: 'source', type: 'enum', enum: SPEND_SOURCES },
          { name: 'amount', type: 'decimal', precision: 14, scale: 2 },
          { name: 'currency', type: 'varchar', length: '3' },
          { name: 'period_key', type: 'varchar', length: '16' },
          { name: 'period_start', type: 'datetime', precision: 6, isNullable: true },
          { name: 'period_end', type: 'datetime', precision: 6, isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
          {
            name: 'captured_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
    );

    await queryRunner.createIndices('spend_snapshots', [
      new TableIndex({
        name: 'IDX_spend_snapshots_campaign_captured',
        columnNames: ['campaign_id', 'captured_at'],
      }),
      new TableIndex({
        name: 'IDX_spend_snapshots_business_captured',
        columnNames: ['business_id', 'captured_at'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'budget_alerts',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'budget_id', type: 'char', length: '36' },
          { name: 'campaign_id', type: 'char', length: '36', isNullable: true },
          { name: 'spend_snapshot_id', type: 'char', length: '36', isNullable: true },
          { name: 'period_key', type: 'varchar', length: '16' },
          { name: 'threshold_percent', type: 'tinyint', unsigned: true },
          { name: 'spend_amount', type: 'decimal', precision: 14, scale: 2 },
          { name: 'budget_amount', type: 'decimal', precision: 14, scale: 2 },
          { name: 'currency', type: 'varchar', length: '3' },
          { name: 'message', type: 'varchar', length: '255' },
          {
            name: 'status',
            type: 'enum',
            enum: ALERT_STATUSES,
            default: "'open'",
          },
          { name: 'acknowledged_by_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'acknowledged_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createIndices('budget_alerts', [
      new TableIndex({
        name: 'UQ_budget_alerts_budget_period_threshold',
        columnNames: ['budget_id', 'period_key', 'threshold_percent'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_budget_alerts_business_status',
        columnNames: ['business_id', 'status'],
      }),
    ]);

    await queryRunner.createForeignKeys('approval_policies', [
      this.foreignKey('FK_approval_policies_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_approval_policies_updated_by',
        ['updated_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('approval_requests', [
      this.foreignKey('FK_approval_requests_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_approval_requests_requester', ['requested_by_user_id'], 'users', 'CASCADE'),
      this.foreignKey('FK_approval_requests_approver', ['approver_user_id'], 'users', 'SET NULL'),
      this.foreignKey('FK_approval_requests_decider', ['decided_by_user_id'], 'users', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('approval_versions', [
      this.foreignKey(
        'FK_approval_versions_request',
        ['approval_request_id'],
        'approval_requests',
        'CASCADE',
      ),
      this.foreignKey('FK_approval_versions_creator', ['created_by_user_id'], 'users', 'CASCADE'),
    ]);

    await queryRunner.createForeignKeys('approval_decisions', [
      this.foreignKey(
        'FK_approval_decisions_request',
        ['approval_request_id'],
        'approval_requests',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_approval_decisions_version',
        ['approval_version_id'],
        'approval_versions',
        'CASCADE',
      ),
      this.foreignKey('FK_approval_decisions_decider', ['decided_by_user_id'], 'users', 'CASCADE'),
    ]);

    await queryRunner.createForeignKeys('budgets', [
      this.foreignKey('FK_budgets_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_budgets_campaign', ['campaign_id'], 'campaigns', 'CASCADE'),
      this.foreignKey('FK_budgets_creator', ['created_by_user_id'], 'users', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('budget_transactions', [
      this.foreignKey('FK_budget_transactions_budget', ['budget_id'], 'budgets', 'CASCADE'),
      this.foreignKey('FK_budget_transactions_actor', ['actor_user_id'], 'users', 'SET NULL'),
      this.foreignKey(
        'FK_budget_transactions_approval',
        ['approval_request_id'],
        'approval_requests',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('spend_snapshots', [
      this.foreignKey('FK_spend_snapshots_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_spend_snapshots_campaign', ['campaign_id'], 'campaigns', 'CASCADE'),
      this.foreignKey('FK_spend_snapshots_budget', ['budget_id'], 'budgets', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('budget_alerts', [
      this.foreignKey('FK_budget_alerts_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_budget_alerts_budget', ['budget_id'], 'budgets', 'CASCADE'),
      this.foreignKey('FK_budget_alerts_campaign', ['campaign_id'], 'campaigns', 'CASCADE'),
      this.foreignKey(
        'FK_budget_alerts_snapshot',
        ['spend_snapshot_id'],
        'spend_snapshots',
        'SET NULL',
      ),
      this.foreignKey(
        'FK_budget_alerts_acknowledged_by',
        ['acknowledged_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    // Agency staff can draft campaigns and budgets, but publishing and budget
    // changes are then routed through the approval engine.
    await queryRunner.query(`
      INSERT INTO role_permissions (id, role_id, permission_id)
      SELECT UUID(), r.id, p.id
      FROM roles r
      JOIN permissions p ON p.\`key\` IN ('budget.manage', 'approval.request')
      WHERE r.\`key\` = 'agency_staff'
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = r.id AND rp.permission_id = p.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.\`key\` = 'agency_staff'
      AND p.\`key\` IN ('budget.manage', 'approval.request')
    `);

    await queryRunner.dropTable('budget_alerts', true);
    await queryRunner.dropTable('spend_snapshots', true);
    await queryRunner.dropTable('budget_transactions', true);
    await queryRunner.dropTable('budgets', true);
    await queryRunner.dropTable('approval_decisions', true);
    await queryRunner.dropTable('approval_versions', true);
    await queryRunner.dropTable('approval_requests', true);
    await queryRunner.dropTable('approval_policies', true);
  }

  private foreignKey(
    name: string,
    columnNames: string[],
    referencedTableName: string,
    onDelete: 'CASCADE' | 'SET NULL',
  ): TableForeignKey {
    return new TableForeignKey({
      name,
      columnNames,
      referencedTableName,
      referencedColumnNames: ['id'],
      onDelete,
    });
  }
}
