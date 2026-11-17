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
import { AutomationRulesService } from './automation-rules.service';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { CreateScheduledActionDto } from './dto/create-scheduled-action.dto';
import { ListAutomationRulesQueryDto } from './dto/list-automation-rules-query.dto';
import { ListExecutionsQueryDto } from './dto/list-executions-query.dto';
import { ListScheduledActionsQueryDto } from './dto/list-scheduled-actions-query.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

@ApiTags('automation')
@ApiBearerAuth()
@Controller('businesses/:businessId/automation')
export class AutomationController {
  constructor(
    private readonly rules: AutomationRulesService,
    private readonly scheduler: AutomationSchedulerService,
  ) {}

  @Get('rules')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  listRules(
    @Param('businessId') businessId: string,
    @Query() query: ListAutomationRulesQueryDto,
  ) {
    return this.rules.listRules(businessId, query);
  }

  @Post('rules')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateAutomationRuleDto,
    @Req() request: Request,
  ) {
    return this.rules.createRule(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Get('rules/:ruleId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  getRule(
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.rules.getRule(businessId, ruleId);
  }

  @Patch('rules/:ruleId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAutomationRuleDto,
    @Req() request: Request,
  ) {
    return this.rules.updateRule(
      user.id,
      businessId,
      ruleId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  deleteRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
    @Req() request: Request,
  ) {
    return this.rules.deleteRule(
      user.id,
      businessId,
      ruleId,
      getRequestContext(request),
    );
  }

  @Post('rules/:ruleId/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  runRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('ruleId') ruleId: string,
    @Req() request: Request,
  ) {
    return this.rules.runRuleNow(
      user.id,
      businessId,
      ruleId,
      getRequestContext(request),
    );
  }

  @Get('scheduled-actions')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  listScheduledActions(
    @Param('businessId') businessId: string,
    @Query() query: ListScheduledActionsQueryDto,
  ) {
    return this.rules.listScheduledActions(businessId, query);
  }

  @Post('scheduled-actions')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  createScheduledAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateScheduledActionDto,
    @Req() request: Request,
  ) {
    return this.rules.createScheduledAction(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Post('scheduled-actions/:actionId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  cancelScheduledAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('actionId') actionId: string,
    @Req() request: Request,
  ) {
    return this.rules.cancelScheduledAction(
      user.id,
      businessId,
      actionId,
      getRequestContext(request),
    );
  }

  @Get('executions')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  listExecutions(
    @Param('businessId') businessId: string,
    @Query() query: ListExecutionsQueryDto,
  ) {
    return this.rules.listExecutions(businessId, query);
  }

  @Get('executions/:executionId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  getExecution(
    @Param('businessId') businessId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.rules.getExecution(businessId, executionId);
  }

  @Post('executions/:executionId/retry')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  retryExecution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('executionId') executionId: string,
    @Req() request: Request,
  ) {
    return this.rules.retryExecution(
      user.id,
      businessId,
      executionId,
      getRequestContext(request),
    );
  }

  /**
   * On-demand dispatcher for operators and tests. Production also runs the
   * repeatable queue job; duplicate execution is prevented by idempotency keys.
   */
  @Post('dispatch')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  dispatch(@Param('businessId') businessId: string) {
    return this.scheduler.dispatchDue(businessId);
  }
}
