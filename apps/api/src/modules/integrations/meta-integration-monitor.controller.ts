import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { MetaIntegrationsService } from './meta-integrations.service';

/**
 * Platform-level hook for the scheduled token monitor. A future worker will
 * call the same service method on a queue schedule.
 */
@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations/meta/monitor')
export class MetaIntegrationMonitorController {
  constructor(private readonly integrations: MetaIntegrationsService) {}

  @Post('sweep')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE)
  sweep() {
    return this.integrations.monitorSweep();
  }
}
