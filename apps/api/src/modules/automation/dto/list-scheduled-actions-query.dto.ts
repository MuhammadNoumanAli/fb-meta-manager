import { IsEnum, IsOptional } from 'class-validator';
import { ScheduledActionStatus } from '../../../common/enums/scheduled-action-status.enum';

export class ListScheduledActionsQueryDto {
  @IsOptional()
  @IsEnum(ScheduledActionStatus)
  status?: ScheduledActionStatus;
}
