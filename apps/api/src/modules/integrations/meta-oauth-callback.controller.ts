import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { getRequestContext } from '../../common/utilities/request-context';
import { MetaIntegrationsService } from './meta-integrations.service';

interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

@ApiExcludeController()
@Controller('integrations/meta')
export class MetaOAuthCallbackController {
  constructor(private readonly integrations: MetaIntegrationsService) {}

  /**
   * Meta redirects the browser here. The callback is intentionally public: it
   * proves possession of a single-use state created by an authenticated user.
   */
  @Public()
  @Get('oauth/callback')
  async callback(
    @Query() query: OAuthCallbackQuery,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.integrations.handleOAuthCallback(
      query.code,
      query.state,
      query.error,
      getRequestContext(request),
    );

    response.redirect(302, result.redirectUrl);
  }
}
