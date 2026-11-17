import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class PublishCampaignDto {
  /** When true the Meta entities are created ACTIVE, otherwise PAUSED. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activate?: boolean;
}
