import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BulkOperationStatus } from '../../../common/enums/bulk-operation-status.enum';

export class ListBulkOperationsQueryDto {
  @IsOptional()
  @IsEnum(BulkOperationStatus)
  status?: BulkOperationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
