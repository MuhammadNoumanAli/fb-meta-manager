import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AutomationActionType } from '../../../common/enums/automation-action-type.enum';
import { AutomationTriggerType } from '../../../common/enums/automation-trigger-type.enum';

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(AutomationTriggerType)
  triggerType?: AutomationTriggerType;

  @IsOptional()
  @IsEnum(AutomationActionType)
  actionType?: AutomationActionType;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  campaignId?: string;

  @IsOptional()
  @IsISO8601()
  runAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(43200)
  intervalMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notifyMessage?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
