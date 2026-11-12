import type { Response } from 'express';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';
import type { IssuedTokens } from './tokens.service';

/**
 * Write the rotating refresh token as an httpOnly cookie. Only production
 * requires HTTPS, which keeps local http development usable.
 */
export const writeRefreshCookie = (
  response: Response,
  tokens: IssuedTokens,
  nodeEnv: string | undefined,
): void => {
  response.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
  });
};
