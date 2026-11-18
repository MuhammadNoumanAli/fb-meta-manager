import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { WhatsappTemplateCategory } from '../../../common/enums/whatsapp-template-category.enum';

export class UpdateWhatsappTemplateDto {
  @IsOptional()
  @IsString()
  @Length(1, 1024)
  body?: string;

  @IsOptional()
  @IsEnum(WhatsappTemplateCategory)
  category?: WhatsappTemplateCategory;

  @IsOptional()
  @IsObject()
  variableMapping?: Record<string, string>;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  providerTemplateId?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isAcknowledgment?: boolean;
}
