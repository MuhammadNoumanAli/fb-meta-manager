import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { AdvertisingObjective } from '../../../common/enums/advertising-objective.enum';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(AdvertisingObjective)
  objective?: AdvertisingObjective;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  dailyBudget?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  lifetimeBudget?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialAdCategories?: string[];

  @IsOptional()
  @IsISO8601()
  startTime?: string | null;

  @IsOptional()
  @IsISO8601()
  stopTime?: string | null;
}
