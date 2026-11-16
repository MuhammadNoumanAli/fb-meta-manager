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

export class Phase4LeadWebhooks1765000000000 implements MigrationInterface {
  name = 'Phase4LeadWebhooks1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'lead_sources',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          {
            name: 'type',
            type: 'enum',
            enum: ['meta_lead_ads', 'website_api', 'whatsapp'],
          },
          { name: 'name', type: 'varchar', length: '120' },
          { name: 'external_id', type: 'varchar', length: '64', isNullable: true },
          { name: 'api_key_hash', type: 'char', length: '64', isNullable: true },
          { name: 'api_key_hint', type: 'varchar', length: '8', isNullable: true },
          { name: 'is_active', type: 'tinyint', width: 1, default: 1 },
          {
            name: 'last_received_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_lead_sources_business_type',
            columnNames: ['business_id', 'type'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'UQ_lead_sources_api_key_hash',
            columnNames: ['api_key_hash'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'leads',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'lead_source_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'source_platform',
            type: 'enum',
            enum: ['meta_lead_ads', 'website_api', 'whatsapp'],
          },
          {
            name: 'external_lead_id',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          { name: 'form_id', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'campaign_external_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'ad_set_external_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'ad_external_id', type: 'varchar', length: '64', isNullable: true },
          { name: 'page_external_id', type: 'varchar', length: '64', isNullable: true },
          { name: 'full_name', type: 'varchar', length: '200', isNullable: true },
          { name: 'phone', type: 'varchar', length: '40', isNullable: true },
          { name: 'email', type: 'varchar', length: '254', isNullable: true },
          { name: 'language', type: 'varchar', length: '16', isNullable: true },
          {
            name: 'consent_status',
            type: 'enum',
            enum: ['unknown', 'granted', 'denied'],
            default: "'unknown'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['new', 'contacted', 'qualified', 'converted', 'disqualified'],
            default: "'new'",
          },
          {
            name: 'assigned_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          { name: 'message', type: 'text', isNullable: true },
          { name: 'raw_payload', type: 'json', isNullable: true },
          { name: 'dedupe_hash', type: 'char', length: '64', isNullable: true },
          { name: 'captured_at', type: 'datetime', precision: 6 },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_leads_dedupe_hash',
            columnNames: ['dedupe_hash'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_leads_business_captured',
            columnNames: ['business_id', 'captured_at'],
          }),
          new TableIndex({
            name: 'IDX_leads_business_status',
            columnNames: ['business_id', 'status'],
          }),
          new TableIndex({
            name: 'IDX_leads_business_email',
            columnNames: ['business_id', 'email'],
          }),
          new TableIndex({
            name: 'IDX_leads_business_phone',
            columnNames: ['business_id', 'phone'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'lead_sync_logs',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          {
            name: 'source_platform',
            type: 'enum',
            enum: ['meta_lead_ads', 'website_api', 'whatsapp'],
          },
          {
            name: 'external_lead_id',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['received', 'fetched', 'created', 'duplicate', 'failed', 'ignored'],
          },
          { name: 'message', type: 'varchar', length: '500', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_lead_sync_logs_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          ID,
          { name: 'provider', type: 'varchar', length: '20', default: "'meta'" },
          { name: 'object_type', type: 'varchar', length: '50' },
          { name: 'field', type: 'varchar', length: '64', isNullable: true },
          { name: 'business_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'authorization_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'external_entry_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'idempotency_key', type: 'char', length: '64' },
          {
            name: 'status',
            type: 'enum',
            enum: ['received', 'processing', 'processed', 'failed', 'ignored'],
            default: "'received'",
          },
          { name: 'attempts', type: 'int', default: 0 },
          { name: 'payload', type: 'json' },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'received_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'processed_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_webhook_events_provider_idempotency',
            columnNames: ['provider', 'idempotency_key'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_webhook_events_business_received',
            columnNames: ['business_id', 'received_at'],
          }),
          new TableIndex({
            name: 'IDX_webhook_events_status',
            columnNames: ['status'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'webhook_processing_logs',
        columns: [
          ID,
          { name: 'webhook_event_id', type: 'char', length: '36' },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'received',
              'queued',
              'processing',
              'processed',
              'failed',
              'ignored',
              'retry_queued',
            ],
          },
          { name: 'message', type: 'varchar', length: '500', isNullable: true },
          { name: 'detail', type: 'json', isNullable: true },
          { name: 'duration_ms', type: 'int', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_webhook_processing_logs_event_created',
            columnNames: ['webhook_event_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createForeignKeys('lead_sources', [
      this.foreignKey('FK_lead_sources_business', ['business_id'], 'businesses', 'CASCADE'),
    ]);

    await queryRunner.createForeignKeys('leads', [
      this.foreignKey('FK_leads_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_leads_source', ['lead_source_id'], 'lead_sources', 'SET NULL'),
      this.foreignKey('FK_leads_assigned_user', ['assigned_user_id'], 'users', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('lead_sync_logs', [
      this.foreignKey(
        'FK_lead_sync_logs_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
    ]);

    await queryRunner.createForeignKeys('webhook_events', [
      this.foreignKey('FK_webhook_events_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_webhook_events_authorization',
        ['authorization_id'],
        'integration_authorizations',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('webhook_processing_logs', [
      this.foreignKey(
        'FK_webhook_processing_logs_event',
        ['webhook_event_id'],
        'webhook_events',
        'CASCADE',
      ),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_processing_logs', true);
    await queryRunner.dropTable('webhook_events', true);
    await queryRunner.dropTable('lead_sync_logs', true);
    await queryRunner.dropTable('leads', true);
    await queryRunner.dropTable('lead_sources', true);
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
