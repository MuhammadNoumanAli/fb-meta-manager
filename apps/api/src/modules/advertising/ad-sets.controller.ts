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
import { AdvertisingService } from './advertising.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { ListAdvertisingQueryDto } from './dto/list-advertising-query.dto';
import { UpdateAdSetDto } from './dto/update-ad-set.dto';
import { UpdateAdvertisingStatusDto } from './dto/update-advertising-status.dto';

@ApiTags('ad sets')
@ApiBearerAuth()
@Controller('businesses/:businessId/ad-sets')
export class AdSetsController {
  constructor(private readonly advertising: AdvertisingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListAdvertisingQueryDto,
  ) {
    return this.advertising.listAdSets(businessId, query);
  }

  @Patch(':adSetId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('adSetId') adSetId: string,
    @Body() dto: UpdateAdSetDto,
    @Req() request: Request,
  ) {
    return this.advertising.updateAdSet(
      user.id,
      businessId,
      adSetId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':adSetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('adSetId') adSetId: string,
    @Req() request: Request,
  ) {
    return this.advertising.deleteAdSet(
      user.id,
      businessId,
      adSetId,
      getRequestContext(request),
    );
  }

  @Patch(':adSetId/status')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('adSetId') adSetId: string,
    @Body() dto: UpdateAdvertisingStatusDto,
    @Req() request: Request,
  ) {
    return this.advertising.updateAdSetStatus(
      user.id,
      businessId,
      adSetId,
      dto,
      getRequestContext(request),
    );
  }

  @Get(':adSetId/advertisements')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  listAdvertisements(
    @Param('businessId') businessId: string,
    @Param('adSetId') adSetId: string,
    @Query() query: ListAdvertisingQueryDto,
  ) {
    return this.advertising.listAdvertisements(businessId, { ...query, adSetId });
  }

  @Post(':adSetId/advertisements')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_CREATE)
  createAdvertisement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('adSetId') adSetId: string,
    @Body() dto: CreateAdvertisementDto,
    @Req() request: Request,
  ) {
    return this.advertising.createAdvertisement(
      user.id,
      businessId,
      adSetId,
      dto,
      getRequestContext(request),
    );
  }
}
