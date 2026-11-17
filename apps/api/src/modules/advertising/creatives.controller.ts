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
import { CreateCreativeDto } from './dto/create-creative.dto';
import { ListAdvertisingQueryDto } from './dto/list-advertising-query.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';

@ApiTags('creatives')
@ApiBearerAuth()
@Controller('businesses/:businessId/creatives')
export class CreativesController {
  constructor(private readonly advertising: AdvertisingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(
    @Param('businessId') businessId: string,
    @Query() query: ListAdvertisingQueryDto,
  ) {
    return this.advertising.listCreatives(businessId, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateCreativeDto,
    @Req() request: Request,
  ) {
    return this.advertising.createCreative(
      user.id,
      businessId,
      dto,
      getRequestContext(request),
    );
  }

  @Patch(':creativeId')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('creativeId') creativeId: string,
    @Body() dto: UpdateCreativeDto,
    @Req() request: Request,
  ) {
    return this.advertising.updateCreative(
      user.id,
      businessId,
      creativeId,
      dto,
      getRequestContext(request),
    );
  }

  @Delete(':creativeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_UPDATE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('creativeId') creativeId: string,
    @Req() request: Request,
  ) {
    return this.advertising.deleteCreative(
      user.id,
      businessId,
      creativeId,
      getRequestContext(request),
    );
  }
}
