import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyClient } from '../../database/entities/agency-client.entity';
import { Agency } from '../../database/entities/agency.entity';
import { BusinessUser } from '../../database/entities/business-user.entity';
import { Business } from '../../database/entities/business.entity';
import { Invitation } from '../../database/entities/invitation.entity';
import { Role } from '../../database/entities/role.entity';
import { UserBusinessRole } from '../../database/entities/user-business-role.entity';
import { User } from '../../database/entities/user.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientInvitationsController } from './client-invitations.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invitation,
      Agency,
      AgencyClient,
      Business,
      BusinessUser,
      UserBusinessRole,
      Role,
      User,
    ]),
    ConfigModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [InvitationsController, ClientInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
