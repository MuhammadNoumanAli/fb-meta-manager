import { IsEnum, IsOptional } from 'class-validator';
import { BudgetAlertStatus } from '../../../common/enums/budget-alert-status.enum';
import { BudgetScope } from '../../../common/enums/budget-scope.enum';

export class ListBudgetsQueryDto {
  @IsOptional()
  @IsEnum(BudgetScope)
  scope?: BudgetScope;
}

export class ListBudgetAlertsQueryDto {
  @IsOptional()
  @IsEnum(BudgetAlertStatus)
  status?: BudgetAlertStatus;
}
