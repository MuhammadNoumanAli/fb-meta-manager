import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { MembershipStatus } from '../../../common/enums/membership-status.enum';

export class AddBusinessMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'business_viewer' })
  @IsString()
  @Length(2, 100)
  roleKey: string;
}

export class UpdateBusinessMemberDto {
  @ApiPropertyOptional({ example: 'business_admin' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  roleKey?: string;

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
