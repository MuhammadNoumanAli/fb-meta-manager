import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAdvertisementDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsUUID()
  creativeId?: string;
}
