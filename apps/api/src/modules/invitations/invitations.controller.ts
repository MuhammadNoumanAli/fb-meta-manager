import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { getRequestContext } from '../../common/utilities/request-context';
import { writeRefreshCookie } from '../auth/session';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@Public()
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitationsService.preview(token);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitationsService.accept(
      token,
      dto,
      getRequestContext(request),
    );

    writeRefreshCookie(
      response,
      result,
      this.configService.get<string>('nodeEnv'),
    );

    return {
      user: result.user,
      accessToken: result.accessToken,
      businessId: result.businessId,
    };
  }
}
