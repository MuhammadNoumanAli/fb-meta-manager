import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { SuppressionReason } from '../../../common/enums/suppression-reason.enum';

export class CreateSuppressionDto {
  @IsString()
  @Length(6, 40)
  phoneNumber!: string;

  @IsOptional()
  @IsEnum(SuppressionReason)
  reason?: SuppressionReason;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
