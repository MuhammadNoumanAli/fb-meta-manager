import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { RoleScope } from '../../common/enums/role-scope.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { Agency } from '../../database/entities/agency.entity';
import { Role } from '../../database/entities/role.entity';
import { TenantUser } from '../../database/entities/tenant-user.entity';
import { User } from '../../database/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AddAgencyMemberDto, UpdateAgencyMemberDto } from './dto/agency-member.dto';

export interface AgencyMemberView {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: MembershipStatus;
  roles: string[];
  joinedAt: Date;
}

@Injectable()
export class AgencyMembersService {
  constructor(
    @InjectRepository(TenantUser) private readonly tenantUsers: Repository<TenantUser>,
    @InjectRepository(Agency) private readonly agencies: Repository<Agency>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  async list(agencyId: string): Promise<AgencyMemberView[]> {
    const agency = await this.requireAgency(agencyId);
    const memberships = await this.tenantUsers.find({
      where: { tenantId: agency.tenantId },
      relations: { user: true, role: true },
      order: { joinedAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      userId: membership.userId,
      email: membership.user.email,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      status: membership.status,
      roles: [membership.role.key],
      joinedAt: membership.joinedAt,
    }));
  }

  async add(
    actorUserId: string,
    agencyId: string,
    dto: AddAgencyMemberDto,
    context: RequestContext,
  ): Promise<AgencyMemberView[]> {
    const agency = await this.requireAgency(agencyId);
    const user = await this.users.findOne({ where: { email: dto.email.toLowerCase() } });

    if (!user) {
      throw new NotFoundException(
        'No AdPilot account uses this email yet. Invitations arrive in Phase 2.',
      );
    }

    const role = await this.roles.findOne({
      where: { key: dto.roleKey, scope: RoleScope.AGENCY },
    });

    if (!role) {
      throw new BadRequestException('Unknown agency role');
    }

    const existing = await this.tenantUsers.findOne({
      where: { tenantId: agency.tenantId, userId: user.id },
    });

    if (existing) {
      throw new BadRequestException('This user is already a member of the agency');
    }

    await this.tenantUsers.save(
      this.tenantUsers.create({
        tenantId: agency.tenantId,
        userId: user.id,
        roleId: role.id,
        status: MembershipStatus.ACTIVE,
      }),
    );

    await this.auditService.record({
      action: 'agency.member_added',
      actorUserId,
      tenantId: agency.tenantId,
      entityType: 'tenant_user',
      entityId: user.id,
      metadata: { agencyId, roleKey: role.key, email: user.email },
      context,
    });

    return this.list(agencyId);
  }

  async update(
    actorUserId: string,
    agencyId: string,
    targetUserId: string,
    dto: UpdateAgencyMemberDto,
    context: RequestContext,
  ): Promise<AgencyMemberView[]> {
    const agency = await this.requireAgency(agencyId);
    const membership = await this.tenantUsers.findOne({
      where: { tenantId: agency.tenantId, userId: targetUserId },
      relations: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Agency member not found');
    }

    if (dto.roleKey && dto.roleKey !== membership.role.key) {
      const role = await this.roles.findOne({
        where: { key: dto.roleKey, scope: RoleScope.AGENCY },
      });

      if (!role) {
        throw new BadRequestException('Unknown agency role');
      }

      await this.assertOwnerRemains(agency.tenantId, targetUserId, role.key, membership.status);
      membership.roleId = role.id;
      membership.role = role;
    }

    if (dto.status && dto.status !== membership.status) {
      await this.assertOwnerRemains(
        agency.tenantId,
        targetUserId,
        membership.role.key,
        dto.status,
      );
      membership.status = dto.status;
    }

    await this.tenantUsers.save(membership);

    await this.auditService.record({
      action: 'agency.member_updated',
      actorUserId,
      tenantId: agency.tenantId,
      entityType: 'tenant_user',
      entityId: targetUserId,
      metadata: { agencyId, roleKey: dto.roleKey ?? null, status: dto.status ?? null },
      context,
    });

    return this.list(agencyId);
  }

  async remove(
    actorUserId: string,
    agencyId: string,
    targetUserId: string,
    context: RequestContext,
  ): Promise<AgencyMemberView[]> {
    const agency = await this.requireAgency(agencyId);
    const membership = await this.tenantUsers.findOne({
      where: { tenantId: agency.tenantId, userId: targetUserId },
      relations: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Agency member not found');
    }

    await this.assertOwnerRemains(
      agency.tenantId,
      targetUserId,
      membership.role.key,
      MembershipStatus.DISABLED,
    );
    await this.tenantUsers.delete({ id: membership.id });

    await this.auditService.record({
      action: 'agency.member_removed',
      actorUserId,
      tenantId: agency.tenantId,
      entityType: 'tenant_user',
      entityId: targetUserId,
      metadata: { agencyId, roleKey: membership.role.key },
      context,
    });

    return this.list(agencyId);
  }

  private async requireAgency(agencyId: string): Promise<Agency> {
    const agency = await this.agencies.findOne({ where: { id: agencyId } });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return agency;
  }

  private async assertOwnerRemains(
    tenantId: string,
    userId: string,
    nextRoleKey: string,
    nextStatus: MembershipStatus,
  ): Promise<void> {
    if (nextRoleKey === 'agency_owner' && nextStatus === MembershipStatus.ACTIVE) {
      return;
    }

    const membership = await this.tenantUsers.findOne({
      where: { tenantId, userId },
      relations: { role: true },
    });

    if (!membership || membership.role.key !== 'agency_owner') {
      return;
    }

    const owners = await this.tenantUsers
      .createQueryBuilder('tu')
      .innerJoin(Role, 'role', 'role.id = tu.role_id')
      .where('tu.tenant_id = :tenantId', { tenantId })
      .andWhere('role.key = :key', { key: 'agency_owner' })
      .andWhere('tu.status = :status', { status: MembershipStatus.ACTIVE })
      .getMany();

    if (owners.length <= 1) {
      throw new BadRequestException('An agency must keep at least one active owner');
    }
  }
}
