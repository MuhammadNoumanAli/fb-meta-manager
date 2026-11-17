import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AdvertisingObjective } from '../../../common/enums/advertising-objective.enum';

export class CreateCampaignDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(AdvertisingObjective)
  objective: AdvertisingObjective;

  @IsOptional()
  @IsUUID()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adAccountExternalId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  dailyBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  lifetimeBudget?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialAdCategories?: string[];

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  stopTime?: string;
}
