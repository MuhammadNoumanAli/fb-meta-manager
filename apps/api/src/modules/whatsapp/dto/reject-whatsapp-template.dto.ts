import { IsString, Length } from 'class-validator';

export class RejectWhatsappTemplateDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}
