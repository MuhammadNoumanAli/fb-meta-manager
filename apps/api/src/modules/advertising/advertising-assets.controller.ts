import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { getRequestContext } from '../../common/utilities/request-context';
import { AdvertisingAssetsService, type UploadedImage } from './advertising-assets.service';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

@ApiTags('advertising assets')
@ApiBearerAuth()
@Controller('businesses/:businessId/assets')
export class AdvertisingAssetsController {
  constructor(private readonly assets: AdvertisingAssetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  list(@Param('businessId') businessId: string) {
    return this.assets.list(businessId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CAMPAIGN_CREATE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @UploadedFile() file: UploadedImage | undefined,
    @Req() request: Request,
  ) {
    return this.assets.upload(
      user.id,
      businessId,
      file,
      getRequestContext(request),
    );
  }

  @Get(':assetId/content')
  @RequirePermissions(PERMISSIONS.CAMPAIGN_READ)
  async content(
    @Param('businessId') businessId: string,
    @Param('assetId') assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const asset = await this.assets.find(businessId, assetId);
    const buffer = await this.assets.read(asset);

    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Content-Length', buffer.length);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${asset.originalName.replace(/["\\]/g, '')}"`,
    );
    response.send(buffer);
  }

  @Delete(':assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CAMPAIGN_CREATE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId') businessId: string,
    @Param('assetId') assetId: string,
    @Req() request: Request,
  ) {
    return this.assets.remove(
      user.id,
      businessId,
      assetId,
      getRequestContext(request),
    );
  }
}
