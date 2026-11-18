import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import {
  ListWhatsappMessagesQueryDto,
  SendTemplateMessageDto,
} from './dto/send-template-message.dto';
import { WhatsappMessagingService } from './whatsapp-messaging.service';

@ApiTags('whatsapp')
@ApiBearerAuth()
@Controller('businesses/:businessId/whatsapp/messages')
export class WhatsappMessagesController {
  constructor(private readonly messaging: WhatsappMessagingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WHATSAPP_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListWhatsappMessagesQueryDto,
  ) {
    return this.messaging.list(businessId, query);
  }

  @Get(':messageId')
  @RequirePermissions(PERMISSIONS.WHATSAPP_READ)
  get(
    @Param('businessId') businessId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messaging.getDetail(businessId, messageId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: SendTemplateMessageDto,
    @Req() request: Request,
  ) {
    return this.messaging.sendTemplate(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Post(':messageId/retry')
  @RequirePermissions(PERMISSIONS.WHATSAPP_MANAGE)
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('messageId') messageId: string,
    @Req() request: Request,
  ) {
    return this.messaging.retry(
      user.id,
      businessId,
      messageId,
      getRequestContext(request),
    );
  }
}
