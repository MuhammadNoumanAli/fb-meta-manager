import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddApprovalVersionDto {
  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
