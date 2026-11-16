import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import { MetaWebhooksService } from './meta-webhooks.service';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('businesses/:businessId/integrations/meta/webhook-events')
export class MetaWebhookEventsController {
  constructor(private readonly webhooks: MetaWebhooksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INTEGRATION_READ)
  list(
    @Param('businessId') businessId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = Number(limit);
    return this.webhooks.listEvents(
      businessId,
      Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined,
    );
  }

  @Post(':eventId/retry')
  @RequirePermissions(PERMISSIONS.INTEGRATION_MANAGE)
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('eventId') eventId: string,
    @Req() request: Request,
  ) {
    return this.webhooks.retryEvent(
      user.id,
      businessId,
      eventId,
      getRequestContext(request),
    );
  }

  @Get(':eventId')
  @RequirePermissions(PERMISSIONS.INTEGRATION_READ)
  detail(
    @Param('businessId') businessId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.webhooks.getEvent(businessId, eventId);
  }
}
