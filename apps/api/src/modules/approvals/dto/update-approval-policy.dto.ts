import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateApprovalPolicyDto {
  @Type(() => Boolean)
  @IsBoolean()
  isEnabled: boolean;
}
