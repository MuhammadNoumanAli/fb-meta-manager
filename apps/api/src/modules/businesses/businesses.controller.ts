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
import { BusinessMembersService } from './business-members.service';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { AddBusinessMemberDto, UpdateBusinessMemberDto } from './dto/member.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly membersService: BusinessMembersService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBusinessDto, @Req() request: Request) {
    return this.businessesService.createForOwner(user.id, dto, getRequestContext(request));
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.listMine(user.id);
  }

  @Get(':businessId')
  @RequirePermissions(PERMISSIONS.BUSINESS_READ)
  get(@CurrentUser() user: AuthenticatedUser, @Param('businessId') businessId: string) {
    return this.businessesService.getDetails(user.id, businessId);
  }

  @Patch(':businessId')
  @RequirePermissions(PERMISSIONS.BUSINESS_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
    @Req() request: Request,
  ) {
    return this.businessesService.update(user.id, businessId, dto, getRequestContext(request));
  }

  @Get(':businessId/members')
  @RequirePermissions(PERMISSIONS.BUSINESS_READ)
  listMembers(@Param('businessId') businessId: string) {
    return this.membersService.list(businessId);
  }

  @Post(':businessId/members')
  @RequirePermissions(PERMISSIONS.BUSINESS_MANAGE_MEMBERS)
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: AddBusinessMemberDto,
    @Req() request: Request,
  ) {
    return this.membersService.add(user.id, businessId, dto, getRequestContext(request));
  }

  @Patch(':businessId/members/:userId')
  @RequirePermissions(PERMISSIONS.BUSINESS_MANAGE_MEMBERS)
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateBusinessMemberDto,
    @Req() request: Request,
  ) {
    return this.membersService.update(
      user.id,
      businessId,
      targetUserId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':businessId/members/:userId')
  @RequirePermissions(PERMISSIONS.BUSINESS_MANAGE_MEMBERS)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('userId') targetUserId: string,
    @Req() request: Request,
  ) {
    return this.membersService.remove(user.id, businessId, targetUserId, getRequestContext(request));
  }
}
