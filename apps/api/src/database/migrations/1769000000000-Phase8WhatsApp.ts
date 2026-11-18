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

const PROVIDERS = ['meta', 'twilio'];
const ACCOUNT_STATUSES = ['active', 'attention', 'disabled'];
const PHONE_STATUSES = ['active', 'paused', 'disabled'];
const TEMPLATE_CATEGORIES = ['marketing', 'utility', 'authentication'];
const TEMPLATE_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'disabled'];
const MESSAGE_DIRECTIONS = ['outbound', 'inbound'];
const MESSAGE_TYPES = ['template', 'text', 'system'];
const MESSAGE_STATUSES = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'received',
  'skipped',
  'suppressed',
];
const CONSENT_STATUSES = ['unknown', 'granted', 'denied'];
const CONSENT_SOURCES = ['meta_form', 'website_form', 'manual', 'inbound_reply', 'import'];
const SUPPRESSION_REASONS = ['opt_out', 'complaint', 'manual'];

const WHATSAPP_PERMISSIONS = ['whatsapp.read', 'whatsapp.manage'];

const WHATSAPP_GRANTS: Array<[string, string[]]> = [
  ['agency_owner', ['whatsapp.read', 'whatsapp.manage']],
  ['agency_admin', ['whatsapp.read', 'whatsapp.manage']],
  ['agency_staff', ['whatsapp.read']],
  ['business_owner', ['whatsapp.read', 'whatsapp.manage']],
  ['business_admin', ['whatsapp.read', 'whatsapp.manage']],
  ['business_viewer', ['whatsapp.read']],
];

export class Phase8WhatsApp1769000000000 implements MigrationInterface {
  name = 'Phase8WhatsApp1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_accounts',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'provider', type: 'enum', enum: PROVIDERS },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'external_account_id', type: 'varchar', length: '128' },
          { name: 'credentials_encrypted', type: 'varchar', length: '512' },
          { name: 'credentials_expires_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'status', type: 'enum', enum: ACCOUNT_STATUSES, default: "'active'" },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'last_validated_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_whatsapp_accounts_external',
            columnNames: ['business_id', 'provider', 'external_account_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_phone_numbers',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'account_id', type: 'char', length: '36' },
          { name: 'external_phone_number_id', type: 'varchar', length: '128' },
          { name: 'display_phone_number', type: 'varchar', length: '40' },
          { name: 'quality_rating', type: 'varchar', length: '40', isNullable: true },
          { name: 'status', type: 'enum', enum: PHONE_STATUSES, default: "'active'" },
          { name: 'is_default', type: 'boolean', default: false },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_whatsapp_phone_numbers_external',
            columnNames: ['account_id', 'external_phone_number_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_templates',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'account_id', type: 'char', length: '36', isNullable: true },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'language', type: 'varchar', length: '10' },
          { name: 'category', type: 'enum', enum: TEMPLATE_CATEGORIES },
          { name: 'status', type: 'enum', enum: TEMPLATE_STATUSES, default: "'draft'" },
          { name: 'provider_template_id', type: 'varchar', length: '128', isNullable: true },
          { name: 'body', type: 'text' },
          { name: 'variable_mapping', type: 'json', isNullable: true },
          { name: 'rejection_reason', type: 'varchar', length: '500', isNullable: true },
          { name: 'is_enabled', type: 'boolean', default: true },
          { name: 'is_acknowledgment', type: 'boolean', default: false },
          { name: 'approved_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_whatsapp_templates_name_language',
            columnNames: ['business_id', 'name', 'language'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_messages',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'lead_id', type: 'char', length: '36', isNullable: true },
          { name: 'account_id', type: 'char', length: '36' },
          { name: 'phone_number_id', type: 'char', length: '36' },
          { name: 'template_id', type: 'char', length: '36', isNullable: true },
          { name: 'direction', type: 'enum', enum: MESSAGE_DIRECTIONS },
          { name: 'message_type', type: 'enum', enum: MESSAGE_TYPES },
          { name: 'status', type: 'enum', enum: MESSAGE_STATUSES },
          { name: 'to_phone', type: 'varchar', length: '40' },
          { name: 'from_phone', type: 'varchar', length: '40', isNullable: true },
          { name: 'body', type: 'text', isNullable: true },
          { name: 'variables', type: 'json', isNullable: true },
          { name: 'external_message_id', type: 'varchar', length: '128', isNullable: true },
          { name: 'idempotency_key', type: 'varchar', length: '190' },
          { name: 'attempts', type: 'int', unsigned: true, default: 0 },
          { name: 'max_attempts', type: 'int', unsigned: true, default: 3 },
          { name: 'error', type: 'varchar', length: '500', isNullable: true },
          { name: 'payload', type: 'json', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'sent_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'delivered_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'read_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_whatsapp_messages_idempotency',
            columnNames: ['idempotency_key'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_whatsapp_messages_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
          new TableIndex({
            name: 'IDX_whatsapp_messages_business_lead',
            columnNames: ['business_id', 'lead_id'],
          }),
          new TableIndex({
            name: 'IDX_whatsapp_messages_external',
            columnNames: ['external_message_id'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_message_events',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'message_id', type: 'char', length: '36' },
          { name: 'status', type: 'enum', enum: MESSAGE_STATUSES },
          { name: 'event_type', type: 'varchar', length: '64', isNullable: true },
          { name: 'external_message_id', type: 'varchar', length: '128', isNullable: true },
          { name: 'error', type: 'varchar', length: '500', isNullable: true },
          { name: 'payload', type: 'json', isNullable: true },
          { name: 'occurred_at', type: 'datetime', precision: 6 },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_whatsapp_message_events_message',
            columnNames: ['message_id', 'occurred_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'lead_consents',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'lead_id', type: 'char', length: '36', isNullable: true },
          { name: 'channel', type: 'varchar', length: '20', default: "'whatsapp'" },
          { name: 'phone_number', type: 'varchar', length: '40', isNullable: true },
          { name: 'status', type: 'enum', enum: CONSENT_STATUSES },
          { name: 'source', type: 'enum', enum: CONSENT_SOURCES },
          { name: 'consent_text', type: 'varchar', length: '500', isNullable: true },
          { name: 'captured_at', type: 'datetime', precision: 6 },
          { name: 'revoked_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_lead_consents_channel',
            columnNames: ['business_id', 'channel', 'lead_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_lead_consents_business_phone',
            columnNames: ['business_id', 'phone_number'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'communication_suppressions',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'phone_number', type: 'varchar', length: '40' },
          { name: 'reason', type: 'enum', enum: SUPPRESSION_REASONS },
          { name: 'source', type: 'varchar', length: '40' },
          { name: 'notes', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_communication_suppressions_phone',
            columnNames: ['business_id', 'phone_number'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createForeignKeys('whatsapp_accounts', [
      this.foreignKey('FK_whatsapp_accounts_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_whatsapp_accounts_creator',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('whatsapp_phone_numbers', [
      this.foreignKey(
        'FK_whatsapp_phone_numbers_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_whatsapp_phone_numbers_account',
        ['account_id'],
        'whatsapp_accounts',
        'CASCADE',
      ),
    ]);

    await queryRunner.createForeignKeys('whatsapp_templates', [
      this.foreignKey('FK_whatsapp_templates_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_whatsapp_templates_account',
        ['account_id'],
        'whatsapp_accounts',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_whatsapp_templates_creator',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('whatsapp_messages', [
      this.foreignKey('FK_whatsapp_messages_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_whatsapp_messages_lead', ['lead_id'], 'leads', 'SET NULL'),
      this.foreignKey(
        'FK_whatsapp_messages_account',
        ['account_id'],
        'whatsapp_accounts',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_whatsapp_messages_phone_number',
        ['phone_number_id'],
        'whatsapp_phone_numbers',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_whatsapp_messages_template',
        ['template_id'],
        'whatsapp_templates',
        'SET NULL',
      ),
      this.foreignKey('FK_whatsapp_messages_creator', ['created_by_user_id'], 'users', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('whatsapp_message_events', [
      this.foreignKey(
        'FK_whatsapp_message_events_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_whatsapp_message_events_message',
        ['message_id'],
        'whatsapp_messages',
        'CASCADE',
      ),
    ]);

    await queryRunner.createForeignKeys('lead_consents', [
      this.foreignKey('FK_lead_consents_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_lead_consents_lead', ['lead_id'], 'leads', 'CASCADE'),
      this.foreignKey('FK_lead_consents_creator', ['created_by_user_id'], 'users', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('communication_suppressions', [
      this.foreignKey(
        'FK_communication_suppressions_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_communication_suppressions_creator',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await this.seedPermissions(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.revokePermissions(queryRunner);

    await queryRunner.dropTable('communication_suppressions', true);
    await queryRunner.dropTable('lead_consents', true);
    await queryRunner.dropTable('whatsapp_message_events', true);
    await queryRunner.dropTable('whatsapp_messages', true);
    await queryRunner.dropTable('whatsapp_templates', true);
    await queryRunner.dropTable('whatsapp_phone_numbers', true);
    await queryRunner.dropTable('whatsapp_accounts', true);
  }

  private async seedPermissions(queryRunner: QueryRunner): Promise<void> {
    const definitions: Array<[string, string]> = [
      ['whatsapp.read', 'View WhatsApp accounts, templates and message history'],
      ['whatsapp.manage', 'Manage WhatsApp accounts, templates and outbound messages'],
    ];

    const values = definitions
      .map(([key, description]) => `(UUID(), '${key}', '${description}', 'whatsapp', NOW(6), NOW(6))`)
      .join(',\n');

    await queryRunner.query(
      `INSERT INTO permissions (id, \`key\`, description, module, created_at, updated_at) VALUES ${values}`,
    );

    for (const [roleKey, permissionKeys] of WHATSAPP_GRANTS) {
      const keys = permissionKeys.map((key) => `'${key}'`).join(', ');

      await queryRunner.query(`
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT UUID(), r.id, p.id
        FROM roles r
        JOIN permissions p ON p.\`key\` IN (${keys})
        WHERE r.\`key\` = '${roleKey}'
      `);
    }
  }

  private async revokePermissions(queryRunner: QueryRunner): Promise<void> {
    const keys = WHATSAPP_PERMISSIONS.map((key) => `'${key}'`).join(', ');

    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.\`key\` IN (${keys})
    `);
    await queryRunner.query(`DELETE FROM permissions WHERE \`key\` IN (${keys})`);
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
