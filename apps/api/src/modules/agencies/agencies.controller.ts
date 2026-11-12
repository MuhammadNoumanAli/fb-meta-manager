import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CreateBusinessDto } from '../businesses/dto/create-business.dto';
import { AgenciesService } from './agencies.service';
import { AgencyMembersService } from './agency-members.service';
import { AddAgencyMemberDto, UpdateAgencyMemberDto } from './dto/agency-member.dto';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

@ApiTags('agencies')
@ApiBearerAuth()
@Controller('agencies')
export class AgenciesController {
  constructor(
    private readonly agenciesService: AgenciesService,
    private readonly membersService: AgencyMembersService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAgencyDto, @Req() request: Request) {
    return this.agenciesService.create(user.id, dto, getRequestContext(request));
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.agenciesService.listMine(user.id);
  }

  @Get(':agencyId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('agencyId') agencyId: string) {
    return this.agenciesService.getDetails(user.id, agencyId);
  }

  @Patch(':agencyId')
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Body() dto: UpdateAgencyDto,
    @Req() request: Request,
  ) {
    return this.agenciesService.update(user.id, agencyId, dto, getRequestContext(request));
  }

  @Get(':agencyId/members')
  listMembers(@CurrentUser() user: AuthenticatedUser, @Param('agencyId') agencyId: string) {
    return this.membersService.list(agencyId);
  }

  @Post(':agencyId/members')
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Body() dto: AddAgencyMemberDto,
    @Req() request: Request,
  ) {
    return this.membersService.add(user.id, agencyId, dto, getRequestContext(request));
  }

  @Patch(':agencyId/members/:userId')
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateAgencyMemberDto,
    @Req() request: Request,
  ) {
    return this.membersService.update(
      user.id,
      agencyId,
      targetUserId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':agencyId/members/:userId')
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Param('userId') targetUserId: string,
    @Req() request: Request,
  ) {
    return this.membersService.remove(user.id, agencyId, targetUserId, getRequestContext(request));
  }

  @Get(':agencyId/clients')
  @RequirePermissions(PERMISSIONS.BUSINESS_READ)
  listClients(@Param('agencyId') agencyId: string) {
    return this.agenciesService.listClients(agencyId);
  }

  @Post(':agencyId/clients')
  @RequirePermissions(PERMISSIONS.BUSINESS_CREATE)
  createClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Body() dto: CreateBusinessDto,
    @Req() request: Request,
  ) {
    return this.agenciesService.createClient(user.id, agencyId, dto, getRequestContext(request));
  }

  @Delete(':agencyId/clients/:clientBusinessId')
  @RequirePermissions(PERMISSIONS.AGENCY_MANAGE)
  endClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId') agencyId: string,
    @Param('clientBusinessId') clientBusinessId: string,
    @Req() request: Request,
  ) {
    return this.agenciesService.endClient(
      user.id,
      agencyId,
      clientBusinessId,
      getRequestContext(request),
    );
  }
}
