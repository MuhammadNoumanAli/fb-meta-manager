import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { MembershipStatus } from '../../../common/enums/membership-status.enum';

export class AddAgencyMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  roleKey: string;
}

export class UpdateAgencyMemberDto {
  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
