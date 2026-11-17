import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { AdvertisingService } from './advertising.service';
import { ListAdvertisingQueryDto } from './dto/list-advertising-query.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import { UpdateAdvertisingStatusDto } from './dto/update-advertising-status.dto';

@ApiTags('advertisements')
@ApiBearerAuth()
@Controller('businesses/:businessId/advertisements')
export class AdvertisementsController {
  constructor(private readonly advertising: AdvertisingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListAdvertisingQueryDto,
  ) {
    return this.advertising.listAdvertisements(businessId, query);
  }

  @Get(':advertisementId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  get(
    @Param('businessId') businessId: string,
    @Param('advertisementId') advertisementId: string,
  ) {
    return this.advertising.getAdvertisement(businessId, advertisementId);
  }

  @Patch(':advertisementId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('advertisementId') advertisementId: string,
    @Body() dto: UpdateAdvertisementDto,
    @Req() request: Request,
  ) {
    return this.advertising.updateAdvertisement(
      user.id,
      businessId,
      advertisementId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':advertisementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('advertisementId') advertisementId: string,
    @Req() request: Request,
  ) {
    return this.advertising.deleteAdvertisement(
      user.id,
      businessId,
      advertisementId,
      getRequestContext(request),
    );
  }

  @Patch(':advertisementId/status')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('advertisementId') advertisementId: string,
    @Body() dto: UpdateAdvertisingStatusDto,
    @Req() request: Request,
  ) {
    return this.advertising.updateAdvertisementStatus(
      user.id,
      businessId,
      advertisementId,
      dto,
      getRequestContext(request),
    );
  }
}
