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
import { MetaWebhookPayload, MetaWebhooksService } from './meta-webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks/meta')
export class MetaWebhooksController {
  constructor(private readonly webhooks: MetaWebhooksService) {}

  /** Meta subscription challenge. Must echo `hub.challenge` as plain text. */
  @Public()
  @Get()
  @Header('Content-Type', 'text/plain')
  verify(@Req() request: Request): string {
    const query = request.query as Record<string, string | undefined>;

    return this.webhooks.verifyChallenge(
      query['hub.mode'],
      query['hub.verify_token'],
      query['hub.challenge'],
    );
  }

  /**
   * Receives webhook deliveries. The raw body is required for HMAC validation,
   * so the application must be created with `rawBody: true`.
   */
  @Public()
  @Post()
  @HttpCode(200)
  receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: MetaWebhookPayload,
  ) {
    this.webhooks.verifySignature(request.rawBody, signature);
    return this.webhooks.receive(body);
  }
}
