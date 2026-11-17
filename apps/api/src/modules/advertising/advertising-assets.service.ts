import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { Repository } from 'typeorm';
import { AdvertisingAssetStatus } from '../../common/enums/advertising-asset-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { AdvertisingAsset } from '../../database/entities/advertising-asset.entity';
import { AuditService } from '../audit/audit.service';
import { toAssetView, type AssetView } from './advertising.mappers';

export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_MIME_TYPES = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

@Injectable()
export class AdvertisingAssetsService {
  private readonly logger = new Logger(AdvertisingAssetsService.name);

  constructor(
    @InjectRepository(AdvertisingAsset)
    private readonly assets: Repository<AdvertisingAsset>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  get maxBytes(): number {
    return this.config.get<number>('uploads.maxBytes') ?? DEFAULT_MAX_BYTES;
  }

  async list(businessId: string): Promise<AssetView[]> {
    const assets = await this.assets.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });

    return assets.map(toAssetView);
  }

  async upload(
    actorUserId: string,
    businessId: string,
    file: UploadedImage | undefined,
    context: RequestContext,
  ): Promise<AssetView> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Select an image file to upload');
    }

    const extension = ALLOWED_MIME_TYPES.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException(
        'Only PNG, JPEG and WebP images can be uploaded',
      );
    }

    if (file.size > this.maxBytes) {
      throw new BadRequestException(
        `Images must be smaller than ${Math.round(this.maxBytes / (1024 * 1024))}MB`,
      );
    }

    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `${businessId}/${randomUUID()}${extension}`;
    const absolutePath = this.resolvePath(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    try {
      const asset = await this.assets.save(
        this.assets.create({
          businessId,
          uploadedByUserId: actorUserId,
          originalName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksum,
          storageKey,
          status: AdvertisingAssetStatus.UPLOADED,
        }),
      );
      await this.audit.record({
        action: 'asset.uploaded',
        actorUserId,
        businessId,
        entityType: 'asset',
        entityId: asset.id,
        metadata: { mimeType: file.mimetype, sizeBytes: file.size },
        context,
      });

      return toAssetView(asset);
    } catch (error) {
      await this.removeFile(storageKey);
      throw error;
    }
  }

  async find(businessId: string, assetId: string): Promise<AdvertisingAsset> {
    const asset = await this.assets.findOne({ where: { id: assetId, businessId } });

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    return asset;
  }

  async read(asset: AdvertisingAsset): Promise<Buffer> {
    try {
      return await readFile(this.resolvePath(asset.storageKey));
    } catch {
      throw new NotFoundException('The uploaded media file is no longer available');
    }
  }

  async markImageHash(assetId: string, imageHash: string): Promise<void> {
    await this.assets.update(assetId, {
      metaImageHash: imageHash,
      status: AdvertisingAssetStatus.READY,
      lastError: null,
    });
  }

  async markError(assetId: string, message: string): Promise<void> {
    await this.assets.update(assetId, {
      status: AdvertisingAssetStatus.ERROR,
      lastError: message.slice(0, 500),
    });
  }

  async remove(
    actorUserId: string,
    businessId: string,
    assetId: string,
    context: RequestContext,
  ): Promise<void> {
    const asset = await this.find(businessId, assetId);
    await this.assets.remove(asset);
    await this.removeFile(asset.storageKey);
    await this.audit.record({
      action: 'asset.deleted',
      actorUserId,
      businessId,
      entityType: 'asset',
      entityId: assetId,
      context,
    });
  }

  private resolvePath(storageKey: string): string {
    const directory = this.config.get<string>('uploads.directory') ?? 'var/uploads';

    return join(resolve(process.cwd(), directory), storageKey);
  }

  private async removeFile(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolvePath(storageKey));
    } catch (error) {
      this.logger.warn(
        `Unable to remove media file ${storageKey}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
