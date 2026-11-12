import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyClient } from '../../database/entities/agency-client.entity';
import { Agency } from '../../database/entities/agency.entity';
import { BusinessUser } from '../../database/entities/business-user.entity';
import { Business } from '../../database/entities/business.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Role } from '../../database/entities/role.entity';
import { TenantUser } from '../../database/entities/tenant-user.entity';
import { UserBusinessRole } from '../../database/entities/user-business-role.entity';
import { AccessService } from './access.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agency,
      AgencyClient,
      Business,
      BusinessUser,
      TenantUser,
      Role,
      RolePermission,
      Permission,
      UserBusinessRole,
    ]),
  ],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
