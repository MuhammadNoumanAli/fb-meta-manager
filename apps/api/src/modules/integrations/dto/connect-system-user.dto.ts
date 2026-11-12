import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class ConnectMetaSystemUserDto {
  @IsString()
  @Length(20, 4096)
  accessToken: string;

  @IsOptional()
  @IsISO8601()
  tokenExpiresAt?: string;
}
