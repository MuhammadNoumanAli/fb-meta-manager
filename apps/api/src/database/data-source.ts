import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

const requiredVariables = [
  'DATABASE_HOST',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
] as const;

const missing = requiredVariables.filter((name) => process.env[name] === undefined);

if (missing.length > 0) {
  throw new Error(
    `Missing database environment variables: ${missing.join(', ')}. ` +
      'Copy apps/api/.env.example to apps/api/.env before running TypeORM commands.',
  );
}

/**
 * CLI datasource used by TypeORM migrations (`npm run migration:*`).
 * The application itself configures TypeORM through Nest's ConfigService.
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  entities: [join(__dirname, 'entities', '**', '*{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
});

export default AppDataSource;
