import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  MetaWhatsappWebhookPayload,
  WhatsappWebhooksService,
} from './whatsapp-webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks/whatsapp')
export class WhatsappWebhooksController {
  constructor(private readonly webhooks: WhatsappWebhooksService) {}

  /** Meta subscription challenge for the WhatsApp Business webhook. */
  @Public()
  @Get('meta')
  @Header('Content-Type', 'text/plain')
  verify(@Req() request: Request): string {
    const query = request.query as Record<string, string | undefined>;

    return this.webhooks.verifyChallenge(
      query['hub.mode'],
      query['hub.verify_token'],
      query['hub.challenge'],
    );
  }

  @Public()
  @Post('meta')
  @HttpCode(200)
  receiveMeta(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: MetaWhatsappWebhookPayload,
  ) {
    this.webhooks.verifyMetaSignature(request.rawBody, signature);
    return this.webhooks.receiveMeta(body);
  }

  @Public()
  @Post('twilio')
  @HttpCode(200)
  receiveTwilio(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Body() body: Record<string, string>,
  ) {
    const rawBody =
      request.rawBody?.toString('utf8') ?? new URLSearchParams(body ?? {}).toString();
    const protocol =
      (request.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ??
      request.protocol;
    const host = request.headers['x-forwarded-host'] ?? request.headers.host;
    const requestUrl = `${protocol}://${host}${request.originalUrl}`;

    return this.webhooks.receiveTwilio(rawBody, signature, requestUrl);
  }
}
