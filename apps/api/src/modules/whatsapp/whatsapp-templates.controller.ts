import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { CreateWhatsappTemplateDto } from './dto/create-whatsapp-template.dto';
import { ListWhatsappTemplatesQueryDto } from './dto/list-whatsapp-templates-query.dto';
import { RejectWhatsappTemplateDto } from './dto/reject-whatsapp-template.dto';
import { UpdateWhatsappTemplateDto } from './dto/update-whatsapp-template.dto';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

@ApiTags('whatsapp')
@ApiBearerAuth()
@Controller('businesses/:businessId/whatsapp/templates')
export class WhatsappTemplatesController {
  constructor(private readonly templates: WhatsappTemplatesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WHATSAPP_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListWhatsappTemplatesQueryDto,
  ) {
    return this.templates.list(businessId, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateWhatsappTemplateDto,
    @Req() request: Request,
  ) {
    return this.templates.create(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Post('seed-defaults')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  seedDefaults(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() request: Request,
  ) {
    return this.templates.seedDefaults(
      user.id,
      businessId,
      getRequestContext(request),
    );
  }

  @Patch(':templateId')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateWhatsappTemplateDto,
    @Req() request: Request,
  ) {
    return this.templates.update(
      user.id,
      businessId,
      templateId,
      dto,
      getRequestContext(request),
    );
  }

  @Post(':templateId/submit')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('templateId') templateId: string,
    @Req() request: Request,
  ) {
    return this.templates.submit(
      user.id,
      businessId,
      templateId,
      getRequestContext(request),
    );
  }

  @Post(':templateId/approve')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('templateId') templateId: string,
    @Req() request: Request,
  ) {
    return this.templates.approve(
      user.id,
      businessId,
      templateId,
      getRequestContext(request),
    );
  }

  @Post(':templateId/reject')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('templateId') templateId: string,
    @Body() dto: RejectWhatsappTemplateDto,
    @Req() request: Request,
  ) {
    return this.templates.reject(
      user.id,
      businessId,
      templateId,
      dto.reason,
      getRequestContext(request),
    );
  }

  @Post(':templateId/disable')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('templateId') templateId: string,
    @Req() request: Request,
  ) {
    return this.templates.disable(
      user.id,
      businessId,
      templateId,
      getRequestContext(request),
    );
  }
}
