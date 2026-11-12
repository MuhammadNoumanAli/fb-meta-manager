import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { AccessModule } from './modules/access/access.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { HealthModule } from './modules/health/health.module';
import { QueuesModule } from './modules/queues/queues.module';
import { RedisModule } from './modules/redis/redis.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      load: [configuration],
      validate: validateEnvironment,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('nodeEnv') === 'production';

        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            autoLogging: true,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const incoming = req.headers['x-request-id'];
              const id =
                typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                  },
                },
          },
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        charset: 'utf8mb4_unicode_ci',
        timezone: 'Z',
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        logging: config.get<boolean>('database.logging'),
        retryAttempts: 3,
        retryDelay: 2000,
        entities: [join(__dirname, '**', '*.entity{.ts,.js}')],
        migrations: [join(__dirname, 'database', 'migrations', '*{.ts,.js}')],
        extra: { connectionLimit: 10 },
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      }),
    }),
    RedisModule,
    QueuesModule,
    HealthModule,
    AccessModule,
    AuditModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    AgenciesModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
