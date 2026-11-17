import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AutomationExecutionStatus } from '../../../common/enums/automation-execution-status.enum';

export class ListExecutionsQueryDto {
  @IsOptional()
  @IsEnum(AutomationExecutionStatus)
  status?: AutomationExecutionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  ruleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  scheduledActionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
