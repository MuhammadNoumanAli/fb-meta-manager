import { IsEnum, IsOptional } from 'class-validator';
import { LeadStatus } from '../../../common/enums/lead-status.enum';

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
