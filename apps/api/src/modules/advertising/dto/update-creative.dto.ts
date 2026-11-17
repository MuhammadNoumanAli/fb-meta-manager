import { IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class UpdateCreativeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  pageId?: string | null;

  @IsOptional()
  @IsUUID()
  assetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  primaryText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  callToAction?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  destinationUrl?: string | null;
}
