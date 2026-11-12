import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAgencyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;
}
