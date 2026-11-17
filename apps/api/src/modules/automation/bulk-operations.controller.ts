import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { BulkOperationsService } from './bulk-operations.service';
import { CreateBulkOperationDto } from './dto/create-bulk-operation.dto';
import { ListBulkOperationsQueryDto } from './dto/list-bulk-operations-query.dto';

@ApiTags('bulk-operations')
@ApiBearerAuth()
@Controller('businesses/:businessId/bulk-operations')
export class BulkOperationsController {
  constructor(private readonly bulk: BulkOperationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListBulkOperationsQueryDto,
  ) {
    return this.bulk.list(businessId, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateBulkOperationDto,
    @Req() request: Request,
  ) {
    return this.bulk.create(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Get(':operationId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  get(
    @Param('businessId') businessId: string,
    @Param('operationId') operationId: string,
  ) {
    return this.bulk.getOperation(businessId, operationId);
  }

  @Post(':operationId/retry')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('operationId') operationId: string,
    @Req() request: Request,
  ) {
    return this.bulk.retryFailed(
      user.id,
      businessId,
      operationId,
      getRequestContext(request),
    );
  }
}
