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
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@ApiBearerAuth()
@Controller('agencies/:agencyId/clients/:clientBusinessId/invitations')
export class ClientInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  list(
    @Param('agencyId') agencyId: string,
    @Param('clientBusinessId') clientBusinessId: string,
  ) {
    return this.invitationsService.listForClient(agencyId, clientBusinessId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Param('clientBusinessId') clientBusinessId: string,
    @Body() dto: CreateInvitationDto,
    @Req() request: Request,
  ) {
    return this.invitationsService.create(
      user.id,
      agencyId,
      clientBusinessId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':invitationId')
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Param('clientBusinessId') clientBusinessId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: Request,
  ) {
    return this.invitationsService.revoke(
      user.id,
      agencyId,
      clientBusinessId,
      invitationId,
      getRequestContext(request),
    );
  }
}
