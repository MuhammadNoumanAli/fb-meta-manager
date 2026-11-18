import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { WhatsappTemplateCategory } from '../../../common/enums/whatsapp-template-category.enum';

export class CreateWhatsappTemplateDto {
  /** Meta template name or Twilio content template name. */
  @IsString()
  @Matches(/^[a-z0-9_]{2,150}$/, {
    message: 'name must use lowercase letters, digits and underscores',
  })
  name!: string;

  /** Language code such as `en` or `ms`. */
  @IsString()
  @Matches(/^[a-zA-Z]{2,3}([_-][a-zA-Z0-9]{2,5})?$/, {
    message: 'language must be a locale code such as en, en_US or ms',
  })
  language!: string;

  @IsEnum(WhatsappTemplateCategory)
  category!: WhatsappTemplateCategory;

  @IsString()
  @Length(1, 1024)
  body!: string;

  /** Maps placeholder indexes to lead/business fields, e.g. {"1":"lead.fullName"}. */
  @IsOptional()
  @IsObject()
  variableMapping?: Record<string, string>;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  /** Twilio ContentSid for the approved provider template. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  providerTemplateId?: string;

  @IsOptional()
  @IsBoolean()
  isAcknowledgment?: boolean;
}
