import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { AutomationActionType } from '../../../common/enums/automation-action-type.enum';

export class CreateScheduledActionDto {
  @IsString()
  @MaxLength(36)
  campaignId: string;

  @IsEnum(AutomationActionType)
  actionType: AutomationActionType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notifyMessage?: string;

  @IsISO8601()
  runAt: string;
}
