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

export class Phase3MetaIntegrations1764000000000 implements MigrationInterface {
  name = 'Phase3MetaIntegrations1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'integration_authorizations',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'provider', type: 'varchar', length: '20', default: "'meta'" },
          {
            name: 'connection_mode',
            type: 'enum',
            enum: ['client_oauth', 'system_user'],
            default: "'client_oauth'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'active', 'expired', 'revoked', 'error'],
            default: "'pending'",
          },
          { name: 'access_token_encrypted', type: 'text', isNullable: true },
          { name: 'token_key_version', type: 'smallint', default: 1 },
          {
            name: 'token_expires_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          { name: 'scopes', type: 'json', isNullable: true },
          { name: 'granted_permissions', type: 'json', isNullable: true },
          { name: 'missing_permissions', type: 'json', isNullable: true },
          {
            name: 'external_user_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'external_user_name',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'last_validated_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'authorized_by_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_integration_authorizations_business_provider',
            columnNames: ['business_id', 'provider'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_integration_authorizations_status_expiry',
            columnNames: ['status', 'token_expires_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'meta_oauth_states',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'user_id', type: 'char', length: '36' },
          { name: 'state_hash', type: 'char', length: '64', isUnique: true },
          {
            name: 'redirect_path',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'expires_at', type: 'datetime', precision: 6 },
          {
            name: 'consumed_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_meta_oauth_states_expiry',
            columnNames: ['expires_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'meta_business_portfolios',
        columns: [
          ID,
          { name: 'authorization_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'external_id', type: 'varchar', length: '64' },
          { name: 'name', type: 'varchar', length: '255' },
          {
            name: 'verification_status',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'discovered_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_meta_business_portfolios_authorization_external',
            columnNames: ['authorization_id', 'external_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'meta_pages',
        columns: [
          ID,
          { name: 'authorization_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          {
            name: 'portfolio_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          { name: 'external_id', type: 'varchar', length: '64' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'username', type: 'varchar', length: '150', isNullable: true },
          { name: 'category', type: 'varchar', length: '150', isNullable: true },
          { name: 'tasks', type: 'json', isNullable: true },
          {
            name: 'instagram_business_account_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'discovered_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_meta_pages_authorization_external',
            columnNames: ['authorization_id', 'external_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'meta_instagram_accounts',
        columns: [
          ID,
          { name: 'authorization_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'page_id', type: 'char', length: '36', isNullable: true },
          { name: 'external_id', type: 'varchar', length: '64' },
          { name: 'username', type: 'varchar', length: '150' },
          { name: 'name', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'discovered_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_meta_instagram_accounts_authorization_external',
            columnNames: ['authorization_id', 'external_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'meta_ad_accounts',
        columns: [
          ID,
          { name: 'authorization_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          {
            name: 'portfolio_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          { name: 'external_id', type: 'varchar', length: '64' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'account_status', type: 'int', isNullable: true },
          { name: 'currency', type: 'varchar', length: '3', isNullable: true },
          {
            name: 'timezone_name',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'discovered_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_meta_ad_accounts_authorization_external',
            columnNames: ['authorization_id', 'external_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'integration_token_events',
        columns: [
          ID,
          { name: 'authorization_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          {
            name: 'event_type',
            type: 'enum',
            enum: [
              'authorized',
              'system_user_connected',
              'reauthorized',
              'validated',
              'permissions_changed',
              'expired',
              'revoked',
              'error',
              'discovered',
              'disconnected',
            ],
          },
          { name: 'detail', type: 'varchar', length: '255', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_integration_token_events_business',
            columnNames: ['business_id', 'created_at'],
          }),
          new TableIndex({
            name: 'IDX_integration_token_events_authorization',
            columnNames: ['authorization_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createForeignKeys('integration_authorizations', [
      this.foreignKey(
        'FK_integration_authorizations_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_integration_authorizations_authorized_by',
        ['authorized_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('meta_oauth_states', [
      this.foreignKey('FK_meta_oauth_states_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey('FK_meta_oauth_states_user', ['user_id'], 'users', 'CASCADE'),
    ]);

    await queryRunner.createForeignKeys('meta_business_portfolios', [
      this.foreignKey(
        'FK_meta_business_portfolios_authorization',
        ['authorization_id'],
        'integration_authorizations',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_meta_business_portfolios_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
    ]);

    await queryRunner.createForeignKeys('meta_pages', [
      this.foreignKey(
        'FK_meta_pages_authorization',
        ['authorization_id'],
        'integration_authorizations',
        'CASCADE',
      ),
      this.foreignKey('FK_meta_pages_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_meta_pages_portfolio',
        ['portfolio_id'],
        'meta_business_portfolios',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('meta_instagram_accounts', [
      this.foreignKey(
        'FK_meta_instagram_accounts_authorization',
        ['authorization_id'],
        'integration_authorizations',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_meta_instagram_accounts_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey('FK_meta_instagram_accounts_page', ['page_id'], 'meta_pages', 'SET NULL'),
    ]);

    await queryRunner.createForeignKeys('meta_ad_accounts', [
      this.foreignKey(
        'FK_meta_ad_accounts_authorization',
        ['authorization_id'],
        'integration_authorizations',
        'CASCADE',
      ),
      this.foreignKey('FK_meta_ad_accounts_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_meta_ad_accounts_portfolio',
        ['portfolio_id'],
        'meta_business_portfolios',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('integration_token_events', [
      this.foreignKey(
        'FK_integration_token_events_authorization',
        ['authorization_id'],
        'integration_authorizations',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_integration_token_events_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
    ]);

    await queryRunner.query(
      `INSERT INTO permissions (id, \`key\`, description, module, created_at, updated_at)
       SELECT UUID(), 'integration.read', 'View integration connections and discovered assets', 'integration', NOW(6), NOW(6)
       WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE \`key\` = 'integration.read')`,
    );

    await queryRunner.query(`
      INSERT INTO role_permissions (id, role_id, permission_id)
      SELECT UUID(), r.id, p.id
      FROM roles r
      JOIN permissions p ON p.\`key\` = 'integration.read'
      WHERE r.\`key\` IN ('agency_owner', 'agency_admin', 'agency_staff', 'business_owner', 'business_admin')
        AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.\`key\` = 'integration.read'
    `);
    await queryRunner.query("DELETE FROM permissions WHERE `key` = 'integration.read'");

    await queryRunner.dropTable('integration_token_events', true);
    await queryRunner.dropTable('meta_instagram_accounts', true);
    await queryRunner.dropTable('meta_ad_accounts', true);
    await queryRunner.dropTable('meta_pages', true);
    await queryRunner.dropTable('meta_business_portfolios', true);
    await queryRunner.dropTable('meta_oauth_states', true);
    await queryRunner.dropTable('integration_authorizations', true);
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
