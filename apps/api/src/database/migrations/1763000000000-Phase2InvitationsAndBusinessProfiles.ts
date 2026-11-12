import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class Phase2InvitationsAndBusinessProfiles1763000000000
  implements MigrationInterface
{
  name = 'Phase2InvitationsAndBusinessProfiles1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE businesses
        ADD COLUMN industry varchar(80) NULL,
        ADD COLUMN description varchar(500) NULL,
        ADD COLUMN website varchar(255) NULL,
        ADD COLUMN contact_email varchar(150) NULL,
        ADD COLUMN contact_phone varchar(32) NULL
    `);

    await queryRunner.createTable(
      new Table({
        name: 'invitations',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'agency_id', type: 'char', length: '36' },
          { name: 'business_id', type: 'char', length: '36' },
          { name: 'invited_email', type: 'varchar', length: '255' },
          { name: 'token_hash', type: 'char', length: '64', isUnique: true },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'accepted', 'expired', 'revoked'],
            default: "'pending'",
          },
          { name: 'expires_at', type: 'datetime', precision: 6 },
          { name: 'accepted_at', type: 'datetime', precision: 6, isNullable: true },
          {
            name: 'accepted_by_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          { name: 'invited_by_user_id', type: 'char', length: '36' },
          {
            name: 'created_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_invitations_business_status',
            columnNames: ['business_id', 'status'],
          }),
          new TableIndex({
            name: 'IDX_invitations_email_status',
            columnNames: ['invited_email', 'status'],
          }),
        ],
      }),
    );

    await queryRunner.createForeignKeys('invitations', [
      new TableForeignKey({
        name: 'FK_invitations_agency',
        columnNames: ['agency_id'],
        referencedTableName: 'agencies',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_invitations_business',
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_invitations_accepted_by',
        columnNames: ['accepted_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_invitations_invited_by',
        columnNames: ['invited_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('invitations');
    await queryRunner.query(`
      ALTER TABLE businesses
        DROP COLUMN industry,
        DROP COLUMN description,
        DROP COLUMN website,
        DROP COLUMN contact_email,
        DROP COLUMN contact_phone
    `);
  }
}
