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
import { CampaignPublishingService } from './campaign-publishing.service';
import { CreateAdSetDto } from './dto/create-ad-set.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListAdvertisingQueryDto } from './dto/list-advertising-query.dto';
import { PublishCampaignDto } from './dto/publish-campaign.dto';
import { UpdateAdvertisingStatusDto } from './dto/update-advertising-status.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('businesses/:businessId/campaigns')
export class CampaignsController {
  constructor(
    private readonly advertising: AdvertisingService,
    private readonly publishing: CampaignPublishingService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListAdvertisingQueryDto,
  ) {
    return this.advertising.listCampaigns(businessId, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateCampaignDto,
    @Req() request: Request,
  ) {
    return this.advertising.createCampaign(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  syncAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Req() request: Request,
  ) {
    return this.publishing.syncAllCampaigns(
      user.id,
      businessId,
      getRequestContext(request),
    );
  }

  @Get(':campaignId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  get(
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.advertising.getCampaign(businessId, campaignId);
  }

  @Patch(':campaignId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignDto,
    @Req() request: Request,
  ) {
    return this.advertising.updateCampaign(
      user.id,
      businessId,
      campaignId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':campaignId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Req() request: Request,
  ) {
    return this.advertising.deleteCampaign(
      user.id,
      businessId,
      campaignId,
      getRequestContext(request),
    );
  }

  @Patch(':campaignId/status')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateAdvertisingStatusDto,
    @Req() request: Request,
  ) {
    return this.advertising.updateCampaignStatus(
      user.id,
      businessId,
      campaignId,
      dto,
      getRequestContext(request),
    );
  }

  @Post(':campaignId/publish')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_PUBLISH)
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: PublishCampaignDto,
    @Req() request: Request,
  ) {
    return this.publishing.startPublish(
      user.id,
      businessId,
      campaignId,
      dto.activate ?? false,
      getRequestContext(request),
    );
  }

  @Post(':campaignId/sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Req() request: Request,
  ) {
    return this.publishing.syncCampaign(
      user.id,
      businessId,
      campaignId,
      getRequestContext(request),
    );
  }

  @Get(':campaignId/ad-sets')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  listAdSets(
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Query() query: ListAdvertisingQueryDto,
  ) {
    return this.advertising.listAdSets(businessId, { ...query, campaignId });
  }

  @Post(':campaignId/ad-sets')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_CREATE)
  createAdSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAdSetDto,
    @Req() request: Request,
  ) {
    return this.advertising.createAdSet(
      user.id,
      businessId,
      campaignId,
      dto,
      getRequestContext(request),
    );
  }
}
