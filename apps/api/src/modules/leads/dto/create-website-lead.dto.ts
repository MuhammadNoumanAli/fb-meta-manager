import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Payload accepted by the public website lead intake endpoint. Lead sources
 * authenticate with an API key, so the body never carries a business ID.
 */
export class CreateWebsiteLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  consent?: boolean;

  /** Stable identifier from the client site, used for idempotent retries. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adSetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
