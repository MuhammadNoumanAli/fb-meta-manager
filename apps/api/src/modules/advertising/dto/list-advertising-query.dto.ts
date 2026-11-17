import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdvertisingStatus } from '../../../common/enums/advertising-status.enum';

export class ListAdvertisingQueryDto {
  @IsOptional()
  @IsEnum(AdvertisingStatus)
  status?: AdvertisingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  adSetId?: string;

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
