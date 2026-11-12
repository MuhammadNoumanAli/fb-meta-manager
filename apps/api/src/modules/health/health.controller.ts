import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ description: 'Process is running' })
  live() {
    return {
      status: 'ok',
      service: 'adpilot-api',
      version: process.env.npm_package_version ?? '0.1.0',
      environment: process.env.NODE_ENV ?? 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes-style liveness probe' })
  liveness() {
    return this.live();
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe including MySQL and Redis' })
  readiness() {
    return this.health.check([
      () => this.database.pingCheck('database', { timeout: 2000 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
