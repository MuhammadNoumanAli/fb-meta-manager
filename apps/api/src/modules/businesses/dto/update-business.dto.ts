import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
}
