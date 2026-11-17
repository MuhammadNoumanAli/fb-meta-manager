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

const TRIGGER_TYPES = ['schedule', 'campaign_rejected', 'budget_threshold'];
const ACTION_TYPES = [
  'pause_campaign',
  'resume_campaign',
  'archive_campaign',
  'sync_campaign',
  'notify',
];
const EXECUTION_STATUSES = [
  'pending',
  'running',
  'pending_approval',
  'succeeded',
  'failed',
  'skipped',
  'dead_letter',
];
const EXECUTION_TRIGGERS = ['schedule', 'event', 'manual', 'approval'];
const SCHEDULED_ACTION_STATUSES = [
  'scheduled',
  'queued',
  'pending_approval',
  'executed',
  'failed',
  'cancelled',
  'skipped',
];
const BULK_TYPES = [
  'pause_campaigns',
  'resume_campaigns',
  'archive_campaigns',
  'sync_campaigns',
];
const BULK_STATUSES = ['queued', 'running', 'completed', 'partial', 'failed', 'cancelled'];
const BULK_ITEM_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'skipped'];
const APPROVAL_TARGETS_OLD = ['campaign.publish', 'campaign.status', 'budget.change'];
const APPROVAL_TARGETS_NEW = [...APPROVAL_TARGETS_OLD, 'automation.execute', 'bulk.execute'];

export class Phase7AutomationReliability1768000000000 implements MigrationInterface {
  name = 'Phase7AutomationReliability1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'automation_rules',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'description', type: 'varchar', length: '500', isNullable: true },
          { name: 'trigger_type', type: 'enum', enum: TRIGGER_TYPES },
          { name: 'action_type', type: 'enum', enum: ACTION_TYPES },
          { name: 'campaign_id', type: 'char', length: '36', isNullable: true },
          { name: 'run_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'interval_minutes', type: 'int', unsigned: true, isNullable: true },
          { name: 'next_run_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'last_run_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'notify_message', type: 'varchar', length: '500', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_automation_rules_business_active',
            columnNames: ['business_id', 'is_active'],
          }),
          new TableIndex({
            name: 'IDX_automation_rules_due',
            columnNames: ['is_active', 'trigger_type', 'next_run_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'scheduled_actions',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'campaign_id', type: 'char', length: '36', isNullable: true },
          { name: 'action_type', type: 'enum', enum: ACTION_TYPES },
          { name: 'notify_message', type: 'varchar', length: '500', isNullable: true },
          { name: 'run_at', type: 'datetime', precision: 6 },
          {
            name: 'status',
            type: 'enum',
            enum: SCHEDULED_ACTION_STATUSES,
            default: "'scheduled'",
          },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'dispatched_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'executed_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'error', type: 'varchar', length: '500', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_scheduled_actions_business_run',
            columnNames: ['business_id', 'status', 'run_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'automation_executions',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'rule_id', type: 'char', length: '36', isNullable: true },
          { name: 'scheduled_action_id', type: 'char', length: '36', isNullable: true },
          { name: 'actor_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'trigger', type: 'enum', enum: EXECUTION_TRIGGERS },
          {
            name: 'status',
            type: 'enum',
            enum: EXECUTION_STATUSES,
            default: "'pending'",
          },
          { name: 'idempotency_key', type: 'varchar', length: '150' },
          { name: 'approval_request_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'approval_status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled'],
            isNullable: true,
          },
          { name: 'attempts', type: 'int', unsigned: true, default: 0 },
          { name: 'max_attempts', type: 'int', unsigned: true, default: 3 },
          { name: 'result', type: 'json', isNullable: true },
          { name: 'error', type: 'varchar', length: '500', isNullable: true },
          { name: 'started_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'finished_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_automation_executions_idempotency',
            columnNames: ['idempotency_key'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_automation_executions_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
          new TableIndex({
            name: 'IDX_automation_executions_rule_created',
            columnNames: ['rule_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'execution_locks',
        columns: [
          ID,
          { name: 'lock_key', type: 'varchar', length: '150' },
          { name: 'owner', type: 'varchar', length: '120' },
          { name: 'acquired_at', type: 'datetime', precision: 6 },
          { name: 'expires_at', type: 'datetime', precision: 6 },
          { name: 'released_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_execution_locks_key',
            columnNames: ['lock_key'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_execution_locks_expires',
            columnNames: ['expires_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'bulk_operations',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'operation', type: 'enum', enum: BULK_TYPES },
          {
            name: 'status',
            type: 'enum',
            enum: BULK_STATUSES,
            default: "'queued'",
          },
          { name: 'total', type: 'int', unsigned: true, default: 0 },
          { name: 'succeeded', type: 'int', unsigned: true, default: 0 },
          { name: 'failed', type: 'int', unsigned: true, default: 0 },
          { name: 'pending', type: 'int', unsigned: true, default: 0 },
          { name: 'reason', type: 'varchar', length: '500', isNullable: true },
          { name: 'requested_by_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'approval_request_id', type: 'char', length: '36', isNullable: true },
          { name: 'completed_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_bulk_operations_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'bulk_operation_items',
        columns: [
          ID,
          { name: 'bulk_operation_id', type: 'char', length: '36' },
          { name: 'campaign_id', type: 'char', length: '36' },
          { name: 'campaign_label', type: 'varchar', length: '150' },
          {
            name: 'status',
            type: 'enum',
            enum: BULK_ITEM_STATUSES,
            default: "'pending'",
          },
          { name: 'attempts', type: 'int', unsigned: true, default: 0 },
          { name: 'error', type: 'varchar', length: '500', isNullable: true },
          { name: 'result', type: 'json', isNullable: true },
          { name: 'started_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'finished_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_bulk_operation_items_target',
            columnNames: ['bulk_operation_id', 'campaign_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_bulk_operation_items_status',
            columnNames: ['bulk_operation_id', 'status'],
          }),
        ],
      }),
    );

    await queryRunner.createForeignKeys('automation_rules', [
      this.foreignKey('FK_automation_rules_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_automation_rules_campaign', ['campaign_id'], 'campaigns', 'CASCADE'),
      this.foreignKey('FK_automation_rules_creator', ['created_by_user_id'], 'users', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('scheduled_actions', [
      this.foreignKey('FK_scheduled_actions_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_scheduled_actions_campaign', ['campaign_id'], 'campaigns', 'CASCADE'),
      this.foreignKey(
        'FK_scheduled_actions_creator',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('automation_executions', [
      this.foreignKey(
        'FK_automation_executions_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey('FK_automation_executions_rule', ['rule_id'], 'automation_rules', 'CASCADE'),
      this.foreignKey(
        'FK_automation_executions_scheduled',
        ['scheduled_action_id'],
        'scheduled_actions',
        'CASCADE',
      ),
      this.foreignKey('FK_automation_executions_actor', ['actor_user_id'], 'users', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('bulk_operations', [
      this.foreignKey('FK_bulk_operations_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_bulk_operations_requester',
        ['requested_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('bulk_operation_items', [
      this.foreignKey(
        'FK_bulk_operation_items_operation',
        ['bulk_operation_id'],
        'bulk_operations',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_bulk_operation_items_campaign',
        ['campaign_id'],
        'campaigns',
        'CASCADE',
      ),
    ]);

    await this.setApprovalTargets(queryRunner, APPROVAL_TARGETS_NEW);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM approval_requests WHERE target_type IN ('automation.execute', 'bulk.execute')`,
    );
    await queryRunner.query(
      `DELETE FROM approval_policies WHERE target_type IN ('automation.execute', 'bulk.execute')`,
    );
    await this.setApprovalTargets(queryRunner, APPROVAL_TARGETS_OLD);

    await queryRunner.dropTable('bulk_operation_items', true);
    await queryRunner.dropTable('bulk_operations', true);
    await queryRunner.dropTable('execution_locks', true);
    await queryRunner.dropTable('automation_executions', true);
    await queryRunner.dropTable('scheduled_actions', true);
    await queryRunner.dropTable('automation_rules', true);
  }

  private async setApprovalTargets(
    queryRunner: QueryRunner,
    targets: string[],
  ): Promise<void> {
    const values = targets.map((target) => `'${target}'`).join(', ');

    await queryRunner.query(
      `ALTER TABLE approval_policies MODIFY COLUMN target_type ENUM(${values}) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE approval_requests MODIFY COLUMN target_type ENUM(${values}) NOT NULL`,
    );
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
