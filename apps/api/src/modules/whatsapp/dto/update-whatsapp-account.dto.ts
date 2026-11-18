import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { WhatsappAccountStatus } from '../../../common/enums/whatsapp-account-status.enum';

export class UpdateWhatsappAccountDto {
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsOptional()
  @IsEnum(WhatsappAccountStatus)
  status?: WhatsappAccountStatus;

  /** Rotates the stored provider token when supplied. */
  @IsOptional()
  @IsString()
  @Length(8, 512)
  accessToken?: string;
}
