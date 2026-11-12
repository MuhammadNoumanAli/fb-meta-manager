import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'List audit logs for a business' })
  async list(
    @Query('businessId') businessId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId query parameter is required');
    }

    const parsedLimit = limit ? Number(limit) : 100;
    return this.auditService.listForBusiness(
      businessId,
      Number.isFinite(parsedLimit) ? parsedLimit : 100,
    );
  }
}
