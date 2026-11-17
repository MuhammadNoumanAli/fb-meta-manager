import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApprovalDecision } from '../../../common/enums/approval-decision.enum';

export class DecideApprovalDto {
  @IsEnum(ApprovalDecision)
  decision: ApprovalDecision;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Optional guard: the decision must target this exact payload version. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
