import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessUser } from '../../database/entities/business-user.entity';
import { Business } from '../../database/entities/business.entity';
import { Role } from '../../database/entities/role.entity';
import { UserBusinessRole } from '../../database/entities/user-business-role.entity';
import { User } from '../../database/entities/user.entity';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { BusinessMembersService } from './business-members.service';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, BusinessUser, UserBusinessRole, User, Role]),
    AccessModule,
    AuditModule,
  ],
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessMembersService],
  exports: [BusinessesService, BusinessMembersService],
})
export class BusinessesModule {}
