import { Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('businesses/:businessId/lead-sources')
export class LeadSourcesController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LEAD_READ)
  list(@Param('businessId') businessId: string) {
    return this.leads.listSources(businessId);
  }

  /**
   * Creates or rotates the website API key. The raw key is returned exactly
   * once; only its SHA-256 hash and a four-character hint are stored.
   */
  @Post('website')
  @RequirePermissions(PERMISSIONS.LEAD_MANAGE)
  issueWebsiteKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() request: Request,
  ) {
    return this.leads.issueWebsiteKey(
      user.id,
      businessId,
      getRequestContext(request),
    );
  }

  @Delete('website')
  @RequirePermissions(PERMISSIONS.LEAD_MANAGE)
  revokeWebsiteKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() request: Request,
  ) {
    return this.leads.revokeWebsiteKey(
      user.id,
      businessId,
      getRequestContext(request),
    );
  }
}
