import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
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
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import { ApprovalsService } from './approvals.service';
import { AddApprovalVersionDto } from './dto/add-approval-version.dto';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { ListApprovalsQueryDto } from './dto/list-approvals-query.dto';
import { UpdateApprovalPolicyDto } from './dto/update-approval-policy.dto';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('businesses/:businessId/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Query() query: ListApprovalsQueryDto,
  ) {
    return this.approvals.listRequests(
      businessId,
      query,
      user.id,
      query.page ?? 1,
      Math.min(Math.max(query.pageSize ?? 20, 1), 100),
    );
  }

  @Get('policies')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  getPolicies(@Param('businessId') businessId: string) {
    return this.approvals.getPolicies(businessId);
  }

  @Patch('policies/:targetType')
  @RequirePermissions(PERMISSIONS.APPROVAL_DECIDE)
  setPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('targetType', new ParseEnumPipe(ApprovalTargetType))
    targetType: ApprovalTargetType,
    @Body() dto: UpdateApprovalPolicyDto,
    @Req() request: Request,
  ) {
    return this.approvals.setPolicy(
      user.id,
      businessId,
      targetType,
      dto.isEnabled,
      getRequestContext(request),
    );
  }

  @Post()
  @RequirePermissions(PERMISSIONS.APPROVAL_REQUEST)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateApprovalRequestDto,
    @Req() request: Request,
  ) {
    return this.approvals.createRequest({
      actorUserId: user.id,
      businessId,
      targetType: dto.targetType,
      targetId: dto.targetId ?? null,
      targetLabel: dto.targetLabel ?? null,
      payload: dto.payload,
      note: dto.note ?? null,
      approverUserId: dto.approverUserId ?? null,
      expiresAt: dto.expiresAt ?? null,
      context: getRequestContext(request),
    });
  }

  @Get(':approvalId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  get(
    @Param('businessId') businessId: string,
    @Param('approvalId') approvalId: string,
  ) {
    return this.approvals.getRequest(businessId, approvalId);
  }

  @Post(':approvalId/versions')
  @RequirePermissions(PERMISSIONS.APPROVAL_REQUEST)
  addVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('approvalId') approvalId: string,
    @Body() dto: AddApprovalVersionDto,
    @Req() request: Request,
  ) {
    return this.approvals.addVersion(
      user.id,
      businessId,
      approvalId,
      dto.payload,
      dto.note ?? null,
      getRequestContext(request),
    );
  }

  @Post(':approvalId/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.APPROVAL_DECIDE)
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('approvalId') approvalId: string,
    @Body() dto: DecideApprovalDto,
    @Req() request: Request,
  ) {
    return this.approvals.decide(
      user.id,
      businessId,
      approvalId,
      dto.decision,
      dto.reason ?? null,
      dto.version,
      getRequestContext(request),
    );
  }

  @Post(':approvalId/execute')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.APPROVAL_DECIDE)
  execute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('approvalId') approvalId: string,
    @Req() request: Request,
  ) {
    return this.approvals.retryExecution(
      user.id,
      businessId,
      approvalId,
      getRequestContext(request),
    );
  }

  @Post(':approvalId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.APPROVAL_REQUEST)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('approvalId') approvalId: string,
    @Req() request: Request,
  ) {
    return this.approvals.cancel(
      user.id,
      businessId,
      approvalId,
      getRequestContext(request),
    );
  }
}
