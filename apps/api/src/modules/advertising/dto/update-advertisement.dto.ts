import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateAdvertisementDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  creativeId?: string | null;
}
