import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { LeadConsentStatus } from '../../../common/enums/lead-consent-status.enum';
import { WhatsappConsentSource } from '../../../common/enums/whatsapp-consent-source.enum';

export class RecordConsentDto {
  @IsUUID()
  leadId!: string;

  @IsEnum(LeadConsentStatus)
  status!: LeadConsentStatus;

  @IsOptional()
  @IsEnum(WhatsappConsentSource)
  source?: WhatsappConsentSource;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  consentText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;
}
