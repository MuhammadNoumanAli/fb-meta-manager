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

const OBJECTIVES = [
  'OUTCOME_AWARENESS',
  'OUTCOME_TRAFFIC',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_SALES',
];
const STATUSES = ['draft', 'publishing', 'active', 'paused', 'archived', 'error'];
const DELIVERY_STATUSES = [
  'unknown',
  'active',
  'paused',
  'archived',
  'deleted',
  'pending_billing_info',
  'in_process',
  'with_issues',
];
const REVIEW_STATUSES = ['unknown', 'in_review', 'approved', 'rejected', 'disabled'];
const OPTIMIZATION_GOALS = [
  'NONE',
  'REACH',
  'IMPRESSIONS',
  'LINK_CLICKS',
  'LANDING_PAGE_VIEWS',
  'POST_ENGAGEMENT',
  'CONVERSATIONS',
  'LEAD_GENERATION',
  'VALUE',
  'OFFSITE_CONVERSIONS',
];
const BILLING_EVENTS = ['IMPRESSIONS', 'LINK_CLICKS', 'POST_ENGAGEMENT', 'THRUPLAY'];
const CREATIVE_STATUSES = ['draft', 'ready', 'error', 'archived'];
const ASSET_STATUSES = ['uploaded', 'ready', 'error'];
const ENTITY_TYPES = ['campaign', 'ad_set', 'advertisement', 'creative', 'asset'];

export class Phase5Campaigns1766000000000 implements MigrationInterface {
  name = 'Phase5Campaigns1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'assets',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'platform', type: 'varchar', length: '20', default: "'meta'" },
          {
            name: 'uploaded_by_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          { name: 'original_name', type: 'varchar', length: '255' },
          { name: 'mime_type', type: 'varchar', length: '100' },
          { name: 'size_bytes', type: 'int' },
          { name: 'checksum', type: 'char', length: '64' },
          { name: 'storage_key', type: 'varchar', length: '255' },
          {
            name: 'meta_image_hash',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ASSET_STATUSES,
            default: "'uploaded'",
          },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_assets_storage_key',
            columnNames: ['storage_key'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_assets_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'creatives',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'page_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'page_external_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'asset_id', type: 'char', length: '36', isNullable: true },
          { name: 'platform', type: 'varchar', length: '20', default: "'meta'" },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'headline', type: 'varchar', length: '200', isNullable: true },
          { name: 'primary_text', type: 'text', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'call_to_action', type: 'varchar', length: '40', isNullable: true },
          { name: 'destination_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'image_hash', type: 'varchar', length: '100', isNullable: true },
          { name: 'external_id', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'status',
            type: 'enum',
            enum: CREATIVE_STATUSES,
            default: "'draft'",
          },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          { name: 'data', type: 'json', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_creatives_platform_external',
            columnNames: ['platform', 'external_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_creatives_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'campaigns',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'ad_account_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'ad_account_external_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'platform', type: 'varchar', length: '20', default: "'meta'" },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'objective', type: 'enum', enum: OBJECTIVES },
          {
            name: 'status',
            type: 'enum',
            enum: STATUSES,
            default: "'draft'",
          },
          { name: 'external_id', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'external_status',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'delivery_status',
            type: 'enum',
            enum: DELIVERY_STATUSES,
            default: "'unknown'",
          },
          {
            name: 'meta_review_status',
            type: 'enum',
            enum: REVIEW_STATUSES,
            default: "'unknown'",
          },
          {
            name: 'daily_budget',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'lifetime_budget',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          { name: 'budget_currency', type: 'varchar', length: '3', isNullable: true },
          { name: 'special_ad_categories', type: 'json', isNullable: true },
          {
            name: 'start_time',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          { name: 'stop_time', type: 'datetime', precision: 6, isNullable: true },
          {
            name: 'last_synced_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          { name: 'published_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          { name: 'data', type: 'json', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_campaigns_platform_external',
            columnNames: ['platform', 'external_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_campaigns_business_status',
            columnNames: ['business_id', 'status'],
          }),
          new TableIndex({
            name: 'IDX_campaigns_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'ad_sets',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'campaign_id', type: 'char', length: '36' },
          { name: 'ad_account_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'ad_account_external_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'platform', type: 'varchar', length: '20', default: "'meta'" },
          { name: 'name', type: 'varchar', length: '200' },
          {
            name: 'status',
            type: 'enum',
            enum: STATUSES,
            default: "'draft'",
          },
          {
            name: 'optimization_goal',
            type: 'enum',
            enum: OPTIMIZATION_GOALS,
            default: "'LINK_CLICKS'",
          },
          {
            name: 'billing_event',
            type: 'enum',
            enum: BILLING_EVENTS,
            default: "'IMPRESSIONS'",
          },
          { name: 'targeting', type: 'json', isNullable: true },
          {
            name: 'daily_budget',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'lifetime_budget',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'bid_amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          { name: 'budget_currency', type: 'varchar', length: '3', isNullable: true },
          { name: 'start_time', type: 'datetime', precision: 6, isNullable: true },
          { name: 'end_time', type: 'datetime', precision: 6, isNullable: true },
          { name: 'external_id', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'external_status',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'delivery_status',
            type: 'enum',
            enum: DELIVERY_STATUSES,
            default: "'unknown'",
          },
          {
            name: 'meta_review_status',
            type: 'enum',
            enum: REVIEW_STATUSES,
            default: "'unknown'",
          },
          {
            name: 'last_synced_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          { name: 'published_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          { name: 'data', type: 'json', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_ad_sets_platform_external',
            columnNames: ['platform', 'external_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_ad_sets_business_campaign',
            columnNames: ['business_id', 'campaign_id'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'advertisements',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'ad_set_id', type: 'char', length: '36' },
          { name: 'creative_id', type: 'char', length: '36', isNullable: true },
          { name: 'ad_account_id', type: 'char', length: '36', isNullable: true },
          {
            name: 'ad_account_external_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'platform', type: 'varchar', length: '20', default: "'meta'" },
          { name: 'name', type: 'varchar', length: '200' },
          {
            name: 'status',
            type: 'enum',
            enum: STATUSES,
            default: "'draft'",
          },
          { name: 'external_id', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'external_status',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'delivery_status',
            type: 'enum',
            enum: DELIVERY_STATUSES,
            default: "'unknown'",
          },
          {
            name: 'meta_review_status',
            type: 'enum',
            enum: REVIEW_STATUSES,
            default: "'unknown'",
          },
          {
            name: 'last_synced_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          { name: 'published_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'last_error', type: 'varchar', length: '500', isNullable: true },
          { name: 'data', type: 'json', isNullable: true },
          { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
          CREATED_AT,
          UPDATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'UQ_advertisements_platform_external',
            columnNames: ['platform', 'external_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_advertisements_business_adset',
            columnNames: ['business_id', 'ad_set_id'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'campaign_status_history',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'campaign_id', type: 'char', length: '36' },
          {
            name: 'from_status',
            type: 'enum',
            enum: STATUSES,
            isNullable: true,
          },
          { name: 'to_status', type: 'enum', enum: STATUSES },
          {
            name: 'source',
            type: 'enum',
            enum: ['internal', 'meta', 'system'],
            default: "'internal'",
          },
          { name: 'actor_user_id', type: 'char', length: '36', isNullable: true },
          { name: 'message', type: 'varchar', length: '500', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_campaign_status_history_campaign_created',
            columnNames: ['campaign_id', 'created_at'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'meta_review_status_history',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'entity_type', type: 'enum', enum: ENTITY_TYPES },
          { name: 'entity_id', type: 'char', length: '36' },
          {
            name: 'from_status',
            type: 'enum',
            enum: REVIEW_STATUSES,
            isNullable: true,
          },
          { name: 'to_status', type: 'enum', enum: REVIEW_STATUSES },
          { name: 'message', type: 'varchar', length: '500', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_meta_review_status_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
          new TableIndex({
            name: 'IDX_meta_review_status_entity',
            columnNames: ['entity_type', 'entity_id'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'platform_sync_logs',
        columns: [
          ID,
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'entity_type', type: 'enum', enum: ENTITY_TYPES },
          { name: 'entity_id', type: 'char', length: '36', isNullable: true },
          { name: 'direction', type: 'enum', enum: ['push', 'pull'] },
          { name: 'status', type: 'enum', enum: ['success', 'failed', 'skipped'] },
          { name: 'message', type: 'varchar', length: '500', isNullable: true },
          { name: 'metadata', type: 'json', isNullable: true },
          CREATED_AT,
        ],
        indices: [
          new TableIndex({
            name: 'IDX_platform_sync_logs_business_created',
            columnNames: ['business_id', 'created_at'],
          }),
          new TableIndex({
            name: 'IDX_platform_sync_logs_entity',
            columnNames: ['entity_type', 'entity_id'],
          }),
        ],
      }),
    );

    await queryRunner.createForeignKeys('assets', [
      this.foreignKey('FK_assets_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_assets_uploaded_by',
        ['uploaded_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('creatives', [
      this.foreignKey(
        'FK_creatives_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey('FK_creatives_page', ['page_id'], 'meta_pages', 'SET NULL'),
      this.foreignKey('FK_creatives_asset', ['asset_id'], 'assets', 'SET NULL'),
      this.foreignKey(
        'FK_creatives_created_by',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('campaigns', [
      this.foreignKey(
        'FK_campaigns_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_campaigns_ad_account',
        ['ad_account_id'],
        'meta_ad_accounts',
        'SET NULL',
      ),
      this.foreignKey(
        'FK_campaigns_created_by',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('ad_sets', [
      this.foreignKey('FK_ad_sets_business', ['business_id'], 'businesses', 'CASCADE'),
      this.foreignKey(
        'FK_ad_sets_campaign',
        ['campaign_id'],
        'campaigns',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_ad_sets_ad_account',
        ['ad_account_id'],
        'meta_ad_accounts',
        'SET NULL',
      ),
      this.foreignKey(
        'FK_ad_sets_created_by',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('advertisements', [
      this.foreignKey(
        'FK_advertisements_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_advertisements_ad_set',
        ['ad_set_id'],
        'ad_sets',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_advertisements_creative',
        ['creative_id'],
        'creatives',
        'SET NULL',
      ),
      this.foreignKey(
        'FK_advertisements_ad_account',
        ['ad_account_id'],
        'meta_ad_accounts',
        'SET NULL',
      ),
      this.foreignKey(
        'FK_advertisements_created_by',
        ['created_by_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('campaign_status_history', [
      this.foreignKey(
        'FK_campaign_status_history_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_campaign_status_history_campaign',
        ['campaign_id'],
        'campaigns',
        'CASCADE',
      ),
      this.foreignKey(
        'FK_campaign_status_history_actor',
        ['actor_user_id'],
        'users',
        'SET NULL',
      ),
    ]);

    await queryRunner.createForeignKeys('meta_review_status_history', [
      this.foreignKey(
        'FK_meta_review_status_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
    ]);

    await queryRunner.createForeignKeys('platform_sync_logs', [
      this.foreignKey(
        'FK_platform_sync_logs_business',
        ['business_id'],
        'businesses',
        'CASCADE',
      ),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('platform_sync_logs', true);
    await queryRunner.dropTable('meta_review_status_history', true);
    await queryRunner.dropTable('campaign_status_history', true);
    await queryRunner.dropTable('advertisements', true);
    await queryRunner.dropTable('ad_sets', true);
    await queryRunner.dropTable('campaigns', true);
    await queryRunner.dropTable('creatives', true);
    await queryRunner.dropTable('assets', true);
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
