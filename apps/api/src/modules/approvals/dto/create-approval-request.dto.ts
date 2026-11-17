import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApprovalTargetType } from '../../../common/enums/approval-target-type.enum';

export class CreateApprovalRequestDto {
  @IsEnum(ApprovalTargetType)
  targetType: ApprovalTargetType;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetLabel?: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  approverUserId?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  expiresAt?: string;
}
