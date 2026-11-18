import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CreateSuppressionDto } from './dto/create-suppression.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { WhatsappConsentService } from './whatsapp-consent.service';

@ApiTags('whatsapp')
@ApiBearerAuth()
@Controller('businesses/:businessId/whatsapp')
export class WhatsappConsentController {
  constructor(private readonly consent: WhatsappConsentService) {}

  @Get('consents')
  @RequirePermissions(PERMISSIONS.WHATSAPP_READ)
  listConsents(
    @Param('businessId') businessId: string,
    @Query('leadId') leadId?: string,
    @Query('phoneNumber') phoneNumber?: string,
  ) {
    return this.consent.list(businessId, { leadId, phoneNumber });
  }

  @Post('consents')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: RecordConsentDto,
    @Req() request: Request,
  ) {
    return this.consent.record(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Get('suppressions')
  @RequirePermissions(PERMISSIONS.WHATSAPP_READ)
  listSuppressions(@Param('businessId') businessId: string) {
    return this.consent.listSuppressions(businessId);
  }

  @Post('suppressions')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  addSuppression(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateSuppressionDto,
    @Req() request: Request,
  ) {
    return this.consent.addSuppression(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete('suppressions/:suppressionId')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  @HttpCode(204)
  async removeSuppression(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('suppressionId') suppressionId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.consent.removeSuppression(
      user.id,
      businessId,
      suppressionId,
      getRequestContext(request),
    );
  }
}
