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
const TENANT_ID = { name: 'tenant_id', type: 'char', length: '36' } as const;
const USER_ID = { name: 'user_id', type: 'char', length: '36' } as const;
const ROLE_ID = { name: 'role_id', type: 'char', length: '36' } as const;

export class Phase1IdentityAndTenancy1762900000000 implements MigrationInterface {
  name = 'Phase1IdentityAndTenancy1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          ID,
          { name: 'email', type: 'varchar', length: '255', isUnique: true },
          { name: 'password_hash', type: 'varchar', length: '255' },
          { name: 'first_name', type: 'varchar', length: '100' },
          { name: 'last_name', type: 'varchar', length: '100' },
          { name: 'status', type: 'enum', enum: ['active', 'suspended'], default: "'active'" },
          { name: 'last_login_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'tenants',
        columns: [
          ID,
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'slug', type: 'varchar', length: '80', isUnique: true },
          { name: 'type', type: 'enum', enum: ['agency', 'business'] },
          { name: 'status', type: 'varchar', length: '20', default: "'active'" },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          ID,
          { ...TENANT_ID, isNullable: true },
          { name: 'key', type: 'varchar', length: '100' },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'scope', type: 'enum', enum: ['system', 'agency', 'business'] },
          { name: 'is_system', type: 'boolean', default: 1 },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_roles_tenant_key',
            columnNames: ['tenant_id', 'key'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          ID,
          { name: 'key', type: 'varchar', length: '100', isUnique: true },
          { name: 'description', type: 'varchar', length: '255' },
          { name: 'module', type: 'varchar', length: '50' },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'role_permissions',
        columns: [
          ID,
          ROLE_ID,
          { name: 'permission_id', type: 'char', length: '36' },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_role_permissions_pair',
            columnNames: ['role_id', 'permission_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'tenant_users',
        columns: [
          ID,
          TENANT_ID,
          USER_ID,
          ROLE_ID,
          { name: 'status', type: 'enum', enum: ['active', 'invited', 'disabled'], default: "'active'" },
          { name: 'joined_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_tenant_users_pair',
            columnNames: ['tenant_id', 'user_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'agencies',
        columns: [
          ID,
          { ...TENANT_ID, isUnique: true },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'slug', type: 'varchar', length: '80', isUnique: true },
          { name: 'status', type: 'varchar', length: '20', default: "'active'" },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'businesses',
        columns: [
          ID,
          { ...TENANT_ID, isUnique: true },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'slug', type: 'varchar', length: '80', isUnique: true },
          { name: 'timezone', type: 'varchar', length: '64', default: "'UTC'" },
          { name: 'currency', type: 'varchar', length: '3', default: "'MYR'" },
          { name: 'status', type: 'varchar', length: '20', default: "'active'" },
          CREATED_AT,
          UPDATED_AT,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'business_users',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          USER_ID,
          { name: 'status', type: 'enum', enum: ['active', 'invited', 'disabled'], default: "'active'" },
          { name: 'joined_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_business_users_pair',
            columnNames: ['business_id', 'user_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_business_roles',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          USER_ID,
          ROLE_ID,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_user_business_roles_triple',
            columnNames: ['business_id', 'user_id', 'role_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'agency_clients',
        columns: [
          ID,
          { name: 'agency_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'status', type: 'enum', enum: ['active', 'pending', 'ended'], default: "'active'" },
          { name: 'started_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          { name: 'ended_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_agency_clients_pair',
            columnNames: ['agency_id', 'business_id'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          ID,
          USER_ID,
          { name: 'token_hash', type: 'char', length: '64', isUnique: true },
          { name: 'expires_at', type: 'datetime', precision: 6 },
          { name: 'revoked_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'replaced_by_token_hash', type: 'char', length: '64', isNullable: true },
          { name: 'user_agent', type: 'varchar', length: '255', isNullable: true },
          { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
          CREATED_AT,
        ],
        indices: [new TableIndex({ name: 'IDX_refresh_tokens_user', columnNames: ['user_id'] })],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
        columns: [
          ID,
          USER_ID,
          { name: 'token_hash', type: 'char', length: '64', isUnique: true },
          { name: 'expires_at', type: 'datetime', precision: 6 },
          { name: 'used_at', type: 'datetime', precision: 6, isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({ name: 'IDX_password_reset_tokens_user', columnNames: ['user_id'] }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          ID,
          { ...TENANT_ID, isNullable: true },
          { name: 'business_id', type: 'char', length: '36', isNullable: true },
          { name: 'actor_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'action', type: 'varchar', length: '100' },
          { name: 'entity_type', type: 'varchar', length: '100', isNullable: true },
          { name: 'entity_id', type: 'char', length: '36', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
          { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
          { name: 'user_agent', type: 'varchar', length: '255', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_audit_logs_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
          new TableIndex({ name: 'IDX_audit_logs_actor', columnNames: ['actor_user_id'] }),
        ],
      }),
    );

    const foreignKeys: Array<{ table: string; foreignKey: TableForeignKey }> = [
      {
        table: 'role_permissions',
        foreignKey: new TableForeignKey({
          name: 'FK_role_permissions_role',
          columnNames: ['role_id'],
          referencedTableName: 'roles',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'role_permissions',
        foreignKey: new TableForeignKey({
          name: 'FK_role_permissions_permission',
          columnNames: ['permission_id'],
          referencedTableName: 'permissions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'tenant_users',
        foreignKey: new TableForeignKey({
          name: 'FK_tenant_users_tenant',
          columnNames: ['tenant_id'],
          referencedTableName: 'tenants',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'tenant_users',
        foreignKey: new TableForeignKey({
          name: 'FK_tenant_users_user',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'tenant_users',
        foreignKey: new TableForeignKey({
          name: 'FK_tenant_users_role',
          columnNames: ['role_id'],
          referencedTableName: 'roles',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      },
      {
        table: 'agencies',
        foreignKey: new TableForeignKey({
          name: 'FK_agencies_tenant',
          columnNames: ['tenant_id'],
          referencedTableName: 'tenants',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'businesses',
        foreignKey: new TableForeignKey({
          name: 'FK_businesses_tenant',
          columnNames: ['tenant_id'],
          referencedTableName: 'tenants',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'business_users',
        foreignKey: new TableForeignKey({
          name: 'FK_business_users_business',
          columnNames: ['business_id'],
          referencedTableName: 'businesses',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'business_users',
        foreignKey: new TableForeignKey({
          name: 'FK_business_users_user',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'user_business_roles',
        foreignKey: new TableForeignKey({
          name: 'FK_user_business_roles_business',
          columnNames: ['business_id'],
          referencedTableName: 'businesses',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'user_business_roles',
        foreignKey: new TableForeignKey({
          name: 'FK_user_business_roles_user',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'user_business_roles',
        foreignKey: new TableForeignKey({
          name: 'FK_user_business_roles_role',
          columnNames: ['role_id'],
          referencedTableName: 'roles',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      },
      {
        table: 'agency_clients',
        foreignKey: new TableForeignKey({
          name: 'FK_agency_clients_agency',
          columnNames: ['agency_id'],
          referencedTableName: 'agencies',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'agency_clients',
        foreignKey: new TableForeignKey({
          name: 'FK_agency_clients_business',
          columnNames: ['business_id'],
          referencedTableName: 'businesses',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'refresh_tokens',
        foreignKey: new TableForeignKey({
          name: 'FK_refresh_tokens_user',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
      {
        table: 'password_reset_tokens',
        foreignKey: new TableForeignKey({
          name: 'FK_password_reset_tokens_user',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      },
    ];

    for (const { table, foreignKey } of foreignKeys) {
      await queryRunner.createForeignKey(table, foreignKey);
    }

    await this.seedRbac(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableOrder = [
      'audit_logs',
      'password_reset_tokens',
      'refresh_tokens',
      'agency_clients',
      'user_business_roles',
      'business_users',
      'businesses',
      'agencies',
      'tenant_users',
      'role_permissions',
      'permissions',
      'roles',
      'tenants',
      'users',
    ];

    for (const table of tableOrder) {
      await queryRunner.dropTable(table, true);
    }
  }

  private async seedRbac(queryRunner: QueryRunner): Promise<void> {
    const permissions: Array<[string, string, string]> = [
      ['platform.manage', 'Full platform administration', 'platform'],
      ['agency.manage', 'Manage agency settings and agency members', 'agency'],
      ['business.create', 'Create business workspaces and client businesses', 'business'],
      ['business.read', 'View business workspace details', 'business'],
      ['business.update', 'Update business workspace settings', 'business'],
      ['business.manage_members', 'Invite, remove and re-role business members', 'business'],
      ['campaign.read', 'View campaigns', 'campaign'],
      ['campaign.create', 'Create campaigns', 'campaign'],
      ['campaign.update', 'Update campaigns', 'campaign'],
      ['campaign.publish', 'Publish campaigns to advertising platforms', 'campaign'],
      ['budget.manage', 'Configure and change budgets', 'budget'],
      ['approval.request', 'Submit approval requests', 'approval'],
      ['approval.decide', 'Approve or reject requests', 'approval'],
      ['lead.read', 'View leads', 'lead'],
      ['lead.manage', 'Assign and update leads', 'lead'],
      ['report.read', 'View reports and analytics', 'report'],
      ['integration.manage', 'Connect and manage platform integrations', 'integration'],
      ['audit.read', 'View audit logs', 'audit'],
      ['billing.manage', 'Manage billing and subscriptions', 'billing'],
    ];

    const permissionValues = permissions
      .map(
        ([key, description, module]) =>
          `(UUID(), '${key}', '${description}', '${module}', NOW(6), NOW(6))`,
      )
      .join(',\n');

    await queryRunner.query(
      `INSERT INTO permissions (id, \`key\`, description, module, created_at, updated_at) VALUES ${permissionValues}`,
    );

    const roles: Array<[string, string, string]> = [
      ['platform_admin', 'Platform Administrator', 'system'],
      ['agency_owner', 'Agency Owner', 'agency'],
      ['agency_admin', 'Agency Administrator', 'agency'],
      ['agency_staff', 'Agency Staff', 'agency'],
      ['business_owner', 'Business Owner', 'business'],
      ['business_admin', 'Business Administrator', 'business'],
      ['business_viewer', 'Business Viewer', 'business'],
    ];

    const roleValues = roles
      .map(([key, name, scope]) => `(UUID(), NULL, '${key}', '${name}', '${scope}', 1, NOW(6), NOW(6))`)
      .join(',\n');

    await queryRunner.query(
      `INSERT INTO roles (id, tenant_id, \`key\`, name, scope, is_system, created_at, updated_at) VALUES ${roleValues}`,
    );

    await queryRunner.query(`
      INSERT INTO role_permissions (id, role_id, permission_id)
      SELECT UUID(), r.id, p.id
      FROM roles r
      JOIN permissions p ON p.\`key\` = 'platform.manage'
      WHERE r.\`key\` = 'platform_admin'
    `);

    const grants: Array<[string, string[]]> = [
      [
        'agency_owner',
        [
          'agency.manage',
          'business.create',
          'business.read',
          'business.update',
          'business.manage_members',
          'campaign.read',
          'campaign.create',
          'campaign.update',
          'campaign.publish',
          'budget.manage',
          'approval.request',
          'approval.decide',
          'lead.read',
          'lead.manage',
          'report.read',
          'integration.manage',
          'audit.read',
        ],
      ],
      [
        'agency_admin',
        [
          'business.create',
          'business.read',
          'business.update',
          'business.manage_members',
          'campaign.read',
          'campaign.create',
          'campaign.update',
          'campaign.publish',
          'budget.manage',
          'approval.request',
          'approval.decide',
          'lead.read',
          'lead.manage',
          'report.read',
          'integration.manage',
          'audit.read',
        ],
      ],
      [
        'agency_staff',
        [
          'business.read',
          'campaign.read',
          'campaign.create',
          'campaign.update',
          'lead.read',
          'report.read',
        ],
      ],
      [
        'business_owner',
        [
          'business.read',
          'business.update',
          'business.manage_members',
          'campaign.read',
          'campaign.create',
          'campaign.update',
          'campaign.publish',
          'budget.manage',
          'approval.request',
          'approval.decide',
          'lead.read',
          'lead.manage',
          'report.read',
          'integration.manage',
          'audit.read',
          'billing.manage',
        ],
      ],
      [
        'business_admin',
        [
          'business.read',
          'business.update',
          'business.manage_members',
          'campaign.read',
          'campaign.create',
          'campaign.update',
          'campaign.publish',
          'budget.manage',
          'approval.request',
          'approval.decide',
          'lead.read',
          'lead.manage',
          'report.read',
          'audit.read',
        ],
      ],
      [
        'business_viewer',
        ['business.read', 'campaign.read', 'report.read', 'lead.read'],
      ],
    ];

    for (const [roleKey, permissionKeys] of grants) {
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
}
