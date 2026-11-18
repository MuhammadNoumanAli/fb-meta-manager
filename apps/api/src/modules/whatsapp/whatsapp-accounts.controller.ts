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
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { UpdateWhatsappAccountDto } from './dto/update-whatsapp-account.dto';
import { WhatsappAccountsService } from './whatsapp-accounts.service';

@ApiTags('whatsapp')
@ApiBearerAuth()
@Controller('businesses/:businessId/whatsapp/accounts')
export class WhatsappAccountsController {
  constructor(private readonly accounts: WhatsappAccountsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WHATSAPP_READ)
  list(@Param('businessId') businessId: string) {
    return this.accounts.list(businessId);
  }

  @Get(':accountId')
  @RequirePermissions(PERMISSIONS.WHATSAPP_READ)
  get(@Param('businessId') businessId: string, @Param('accountId') accountId: string) {
    return this.accounts.get(businessId, accountId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateWhatsappAccountDto,
    @Req() request: Request,
  ) {
    return this.accounts.create(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Patch(':accountId')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateWhatsappAccountDto,
    @Req() request: Request,
  ) {
    return this.accounts.update(
      user.id,
      businessId,
      accountId,
      dto,
      getRequestContext(request),
    );
  }

  @Post(':accountId/validate')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('accountId') accountId: string,
    @Req() request: Request,
  ) {
    return this.accounts.validate(
      user.id,
      businessId,
      accountId,
      getRequestContext(request),
    );
  }

  @Delete(':accountId')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('accountId') accountId: string,
    @Req() request: Request,
  ) {
    return this.accounts.disable(
      user.id,
      businessId,
      accountId,
      getRequestContext(request),
    );
  }
}
