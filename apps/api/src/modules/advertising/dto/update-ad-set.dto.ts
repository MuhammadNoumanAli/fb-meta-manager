import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingEvent } from '../../../common/enums/billing-event.enum';
import { OptimizationGoal } from '../../../common/enums/optimization-goal.enum';

export class UpdateAdSetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(OptimizationGoal)
  optimizationGoal?: OptimizationGoal;

  @IsOptional()
  @IsEnum(BillingEvent)
  billingEvent?: BillingEvent;

  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;

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
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  bidAmount?: number | null;

  @IsOptional()
  @IsISO8601()
  startTime?: string | null;

  @IsOptional()
  @IsISO8601()
  endTime?: string | null;
}
