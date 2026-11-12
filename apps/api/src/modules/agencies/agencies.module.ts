import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyClient } from '../../database/entities/agency-client.entity';
import { Agency } from '../../database/entities/agency.entity';
import { Role } from '../../database/entities/role.entity';
import { TenantUser } from '../../database/entities/tenant-user.entity';
import { User } from '../../database/entities/user.entity';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { AgencyMembersService } from './agency-members.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agency, AgencyClient, TenantUser, User, Role]),
    AccessModule,
    AuditModule,
    BusinessesModule,
  ],
  controllers: [AgenciesController],
  providers: [AgenciesService, AgencyMembersService],
  exports: [AgenciesService, AgencyMembersService],
})
export class AgenciesModule {}
