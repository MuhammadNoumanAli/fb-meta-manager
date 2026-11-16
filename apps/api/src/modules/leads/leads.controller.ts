import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('businesses/:businessId/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LEAD_READ)
  list(@Param('businessId') businessId: string, @Query() query: ListLeadsQueryDto) {
    return this.leads.list(businessId, query);
  }

  @Get('sync-logs')
  @RequirePermissions(PERMISSIONS.LEAD_READ)
  syncLog(@Param('businessId') businessId: string) {
    return this.leads.syncLog(businessId);
  }

  @Get(':leadId')
  @RequirePermissions(PERMISSIONS.LEAD_READ)
  get(@Param('businessId') businessId: string, @Param('leadId') leadId: string) {
    return this.leads.get(businessId, leadId);
  }

  @Patch(':leadId')
  @RequirePermissions(PERMISSIONS.LEAD_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadDto,
    @Req() request: Request,
  ) {
    return this.leads.update(
      user.id,
      businessId,
      leadId,
      dto,
      getRequestContext(request),
    );
  }
}
