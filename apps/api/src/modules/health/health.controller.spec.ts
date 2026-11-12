import { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  const healthCheckService = {
    check: jest.fn<Promise<HealthCheckResult>, [unknown[]]>(),
  };
  const database = { pingCheck: jest.fn() };
  const redis = { isHealthy: jest.fn() };

  beforeEach(() => {
    healthCheckService.check.mockReset();
    controller = new HealthController(
      healthCheckService as unknown as HealthCheckService,
      database as unknown as TypeOrmHealthIndicator,
      redis as unknown as RedisHealthIndicator,
    );
  });

  it('reports a live process', () => {
    const result = controller.live();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('adpilot-api');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('delegates readiness checks for database and redis', async () => {
    const expected: HealthCheckResult = {
      status: 'ok',
      info: { database: { status: 'up' }, redis: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' }, redis: { status: 'up' } },
    };
    healthCheckService.check.mockResolvedValue(expected);

    await expect(controller.readiness()).resolves.toEqual(expected);
    expect(healthCheckService.check).toHaveBeenCalledTimes(1);
  });
});
