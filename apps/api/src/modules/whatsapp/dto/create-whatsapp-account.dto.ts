import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { WhatsappProvider } from '../../../common/enums/whatsapp-provider.enum';

export class WhatsappPhoneNumberDto {
  /** Meta phone_number_id or Twilio sender number (E.164 digits). */
  @IsString()
  @Length(3, 128)
  externalPhoneNumberId!: string;

  @IsString()
  @Length(3, 40)
  displayPhoneNumber!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateWhatsappAccountDto {
  @IsEnum(WhatsappProvider)
  provider!: WhatsappProvider;

  @IsString()
  @Length(2, 150)
  name!: string;

  /** Meta WhatsApp Business Account ID or Twilio Account SID. */
  @IsString()
  @Length(3, 128)
  externalAccountId!: string;

  /** Meta access token or Twilio auth token. Stored encrypted, never returned. */
  @IsString()
  @Length(8, 512)
  accessToken!: string;

  @IsOptional()
  @IsString()
  @Length(3, 128)
  businessAccountId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WhatsappPhoneNumberDto)
  phoneNumbers!: WhatsappPhoneNumberDto[];
}
