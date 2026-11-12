import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import { ConnectMetaSystemUserDto } from './dto/connect-system-user.dto';
import { StartMetaOAuthDto } from './dto/start-meta-oauth.dto';
import { MetaIntegrationsService } from './meta-integrations.service';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('businesses/:businessId/integrations/meta')
export class MetaIntegrationsController {
  constructor(private readonly integrations: MetaIntegrationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INTEGRATION_READ)
  overview(@Param('businessId') businessId: string) {
    return this.integrations.getOverview(businessId);
  }

  @Get('events')
  @RequirePermissions(PERMISSIONS.INTEGRATION_READ)
  events(@Param('businessId') businessId: string) {
    return this.integrations.listEvents(businessId);
  }

  @Post('oauth/start')
  @RequirePermissions(PERMISSIONS.INTEGRATION_MANAGE)
  startOAuth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: StartMetaOAuthDto,
    @Req() request: Request,
  ) {
    return this.integrations.startOAuth(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Post('system-user')
  @RequirePermissions(PERMISSIONS.INTEGRATION_MANAGE)
  connectSystemUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: ConnectMetaSystemUserDto,
    @Req() request: Request,
  ) {
    return this.integrations.connectSystemUser(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Post('validate')
  @RequirePermissions(PERMISSIONS.INTEGRATION_MANAGE)
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() request: Request,
  ) {
    return this.integrations.validate(
      user.id,
      businessId,
      getRequestContext(request),
    );
  }

  @Post('discover')
  @RequirePermissions(PERMISSIONS.INTEGRATION_MANAGE)
  discover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() request: Request,
  ) {
    return this.integrations.discover(
      user.id,
      businessId,
      getRequestContext(request),
    );
  }

  @Delete()
  @RequirePermissions(PERMISSIONS.INTEGRATION_MANAGE)
  disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() request: Request,
  ) {
    return this.integrations.disconnect(
      user.id,
      businessId,
      getRequestContext(request),
    );
  }
}
