import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a three-letter ISO code' })
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @ValidateIf((dto: UpdateBusinessDto) => dto.contactEmail !== '')
  @IsEmail()
  @MaxLength(150)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;
}
