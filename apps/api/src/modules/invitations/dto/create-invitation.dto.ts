import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, Max, MaxLength, Min } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
