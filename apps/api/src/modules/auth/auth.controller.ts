import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { getRequestContext } from '../../common/utilities/request-context';
import { AuthService, type AuthResult } from './auth.service';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';
import { writeRefreshCookie } from './session';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface RefreshCookieRequest extends Omit<Request, 'cookies'> {
  cookies?: Record<string, string | undefined>;
}

const readRefreshCookie = (request: Request): string | undefined => {
  const cookies = (request as RefreshCookieRequest).cookies;
  return cookies?.[REFRESH_COOKIE_NAME];
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto, getRequestContext(request));
    return this.completeSession(result, response);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, getRequestContext(request));
    return this.completeSession(result, response);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawToken = readRefreshCookie(request) ?? dto.refreshToken;

    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const result = await this.authService.refresh(rawToken, getRequestContext(request));
    return this.completeSession(result, response);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawToken = readRefreshCookie(request) ?? dto.refreshToken ?? null;
    await this.authService.logout(rawToken);
    response.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });

    return { success: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(dto, getRequestContext(request));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, getRequestContext(request));
  }

  private completeSession(result: AuthResult, response: Response) {
    writeRefreshCookie(
      response,
      result,
      this.configService.get<string>('nodeEnv'),
    );

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }
}
