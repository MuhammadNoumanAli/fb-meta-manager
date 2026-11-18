import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WhatsappMessageStatus } from '../../../common/enums/whatsapp-message-status.enum';

export class SendTemplateMessageDto {
  @IsUUID()
  leadId!: string;

  @IsUUID()
  templateId!: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  /** Template parameter values keyed by placeholder index. */
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  /** Optional caller key making repeated submissions idempotent. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  idempotencyKey?: string;
}

export class ListWhatsappMessagesQueryDto {
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsEnum(WhatsappMessageStatus)
  status?: WhatsappMessageStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

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
