import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BulkOperationType } from '../../../common/enums/bulk-operation-type.enum';

export class CreateBulkOperationDto {
  @IsEnum(BulkOperationType)
  operation: BulkOperationType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  campaignIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
