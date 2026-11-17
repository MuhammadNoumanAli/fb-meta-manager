import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateSpendSnapshotDto } from './dto/create-spend-snapshot.dto';
import {
  ListBudgetAlertsQueryDto,
  ListBudgetsQueryDto,
} from './dto/list-budgets-query.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('businesses/:businessId/budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListBudgetsQueryDto,
  ) {
    return this.budgets.listBudgets(businessId, query.scope);
  }

  @Get('alerts')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  listAlerts(
    @Param('businessId') businessId: string,
    @Query() query: ListBudgetAlertsQueryDto,
  ) {
    return this.budgets.listAlerts(businessId, query.status);
  }

  @Patch('alerts/:alertId/acknowledge')
  @RequirePermissions(PERMISSIONS.BUDGET_MANAGE)
  acknowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('alertId') alertId: string,
    @Req() request: Request,
  ) {
    return this.budgets.acknowledgeAlert(
      user.id,
      businessId,
      alertId,
      getRequestContext(request),
    );
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BUDGET_MANAGE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateBudgetDto,
    @Req() request: Request,
  ) {
    return this.budgets.createBudget(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Get(':budgetId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  get(
    @Param('businessId') businessId: string,
    @Param('budgetId') budgetId: string,
  ) {
    return this.budgets.getDetail(businessId, budgetId);
  }

  @Patch(':budgetId')
  @RequirePermissions(PERMISSIONS.BUDGET_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('budgetId') budgetId: string,
    @Body() dto: UpdateBudgetDto,
    @Req() request: Request,
  ) {
    return this.budgets.updateBudget(
      user.id,
      businessId,
      budgetId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':budgetId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.BUDGET_MANAGE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('budgetId') budgetId: string,
    @Req() request: Request,
  ) {
    return this.budgets.deleteBudget(
      user.id,
      businessId,
      budgetId,
      getRequestContext(request),
    );
  }

  @Post(':budgetId/snapshots')
  @RequirePermissions(PERMISSIONS.BUDGET_MANAGE)
  recordSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('budgetId') budgetId: string,
    @Body() dto: CreateSpendSnapshotDto,
    @Req() request: Request,
  ) {
    return this.budgets.recordManualSnapshot(
      user.id,
      businessId,
      budgetId,
      dto,
      getRequestContext(request),
    );
  }
}
