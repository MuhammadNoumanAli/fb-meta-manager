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

export class CreateAdSetDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(OptimizationGoal)
  optimizationGoal: OptimizationGoal;

  @IsEnum(BillingEvent)
  billingEvent: BillingEvent;

  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;

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
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  bidAmount?: number;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;
}
