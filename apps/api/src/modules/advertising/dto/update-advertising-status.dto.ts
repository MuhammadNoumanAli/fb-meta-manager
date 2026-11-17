import { IsIn } from 'class-validator';
import { AdvertisingStatus } from '../../../common/enums/advertising-status.enum';

const EDITABLE_STATUSES = [
  AdvertisingStatus.ACTIVE,
  AdvertisingStatus.PAUSED,
  AdvertisingStatus.ARCHIVED,
] as const;

export type EditableAdvertisingStatus = (typeof EDITABLE_STATUSES)[number];

export class UpdateAdvertisingStatusDto {
  @IsIn(EDITABLE_STATUSES)
  status: EditableAdvertisingStatus;
}
