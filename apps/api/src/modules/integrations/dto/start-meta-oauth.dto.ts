import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class StartMetaOAuthDto {
  /**
   * Same-origin path the browser returns to after the OAuth callback. Only a
   * relative pathname is accepted so the callback cannot be used as an open
   * redirect.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^\/(?!\/)[A-Za-z0-9\-._~/]*$/, {
    message: 'redirectPath must be a relative pathname',
  })
  redirectPath?: string;
}
