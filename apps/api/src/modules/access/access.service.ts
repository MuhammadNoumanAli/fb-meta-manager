import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SYSTEM_ROLES } from '../../common/constants/permissions';
import { AgencyClientStatus } from '../../common/enums/agency-client-status.enum';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { RoleScope } from '../../common/enums/role-scope.enum';
import { AgencyClient } from '../../database/entities/agency-client.entity';
import { Agency } from '../../database/entities/agency.entity';
import { BusinessUser } from '../../database/entities/business-user.entity';
import { Business } from '../../database/entities/business.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Role } from '../../database/entities/role.entity';
import { TenantUser } from '../../database/entities/tenant-user.entity';
import { UserBusinessRole } from '../../database/entities/user-business-role.entity';

export interface BusinessAccess {
  business: Business;
  accessType: 'platform' | 'direct' | 'agency';
  roles: string[];
  permissions: string[];
  agencyId: string | null;
}

export interface AgencyAccess {
  agency: Agency;
  accessType: 'platform' | 'agency';
  roles: string[];
  permissions: string[];
}

export interface WorkspaceSummary {
  type: 'agency' | 'business';
  id: string;
  tenantId: string;
  name: string;
  accessType: 'platform' | 'direct' | 'agency';
  roles: string[];
  permissions: string[];
}

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(Agency) private readonly agencies: Repository<Agency>,
    @InjectRepository(AgencyClient) private readonly agencyClients: Repository<AgencyClient>,
    @InjectRepository(Business) private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessUser) private readonly businessUsers: Repository<BusinessUser>,
    @InjectRepository(TenantUser) private readonly tenantUsers: Repository<TenantUser>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(RolePermission) private readonly rolePermissions: Repository<RolePermission>,
    @InjectRepository(Permission) private readonly permissions: Repository<Permission>,
    @InjectRepository(UserBusinessRole)
    private readonly userBusinessRoles: Repository<UserBusinessRole>,
  ) {}

  async getBusinessAccess(userId: string, businessId: string): Promise<BusinessAccess> {
    const business = await this.businesses.findOne({ where: { id: businessId } });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (await this.isPlatformAdmin(userId)) {
      return {
        business,
        accessType: 'platform',
        roles: [SYSTEM_ROLES.PLATFORM_ADMIN],
        permissions: await this.getAllPermissionKeys(),
        agencyId: null,
      };
    }

    const roleIds = new Set<string>();
    let accessType: BusinessAccess['accessType'] | null = null;
    let agencyId: string | null = null;

    const directMembership = await this.businessUsers.findOne({
      where: { businessId, userId, status: MembershipStatus.ACTIVE },
    });

    if (directMembership) {
      accessType = 'direct';
      const assignments = await this.userBusinessRoles.find({ where: { businessId, userId } });
      assignments.forEach((assignment) => roleIds.add(assignment.roleId));
    }

    const links = await this.agencyClients.find({
      where: { businessId, status: AgencyClientStatus.ACTIVE },
    });

    for (const link of links) {
      const agency = await this.agencies.findOne({ where: { id: link.agencyId } });

      if (!agency || agency.status !== 'active') {
        continue;
      }

      const membership = await this.tenantUsers.findOne({
        where: {
          tenantId: agency.tenantId,
          userId,
          status: MembershipStatus.ACTIVE,
        },
      });

      if (!membership) {
        continue;
      }

      const role = await this.roles.findOne({ where: { id: membership.roleId } });

      if (!role || role.scope !== RoleScope.AGENCY) {
        continue;
      }

      accessType = accessType ?? 'agency';
      agencyId = agency.id;
      roleIds.add(role.id);
    }

    if (!accessType) {
      throw new NotFoundException('Business not found');
    }

    return {
      business,
      accessType,
      roles: await this.getRoleKeys([...roleIds]),
      permissions: await this.getRolePermissions([...roleIds]),
      agencyId,
    };
  }

  async getAgencyAccess(userId: string, agencyId: string): Promise<AgencyAccess> {
    const agency = await this.agencies.findOne({ where: { id: agencyId } });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    if (await this.isPlatformAdmin(userId)) {
      return {
        agency,
        accessType: 'platform',
        roles: [SYSTEM_ROLES.PLATFORM_ADMIN],
        permissions: await this.getAllPermissionKeys(),
      };
    }

    const membership = await this.tenantUsers.findOne({
      where: {
        tenantId: agency.tenantId,
        userId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new NotFoundException('Agency not found');
    }

    const role = await this.roles.findOne({ where: { id: membership.roleId } });

    if (!role || role.scope !== RoleScope.AGENCY) {
      throw new NotFoundException('Agency not found');
    }

    return {
      agency,
      accessType: 'agency',
      roles: [role.key],
      permissions: await this.getRolePermissions([role.id]),
    };
  }

  async getPlatformPermissions(userId: string): Promise<string[]> {
    return (await this.isPlatformAdmin(userId)) ? this.getAllPermissionKeys() : [];
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const membership = await this.tenantUsers
      .createQueryBuilder('tu')
      .innerJoin(Role, 'role', 'role.id = tu.role_id')
      .where('tu.user_id = :userId', { userId })
      .andWhere('tu.status = :status', { status: MembershipStatus.ACTIVE })
      .andWhere('role.key = :key', { key: SYSTEM_ROLES.PLATFORM_ADMIN })
      .getOne();

    return Boolean(membership);
  }

  async getAllPermissionKeys(): Promise<string[]> {
    const rows = await this.permissions.find({ select: { key: true } });
    return rows.map((row) => row.key);
  }

  async getRoleKeys(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const rows = await this.roles.find({
      where: { id: In(roleIds) },
      select: { key: true },
    });

    return rows.map((row) => row.key);
  }

  async getRolePermissions(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const rows = await this.rolePermissions
      .createQueryBuilder('rp')
      .innerJoin(Permission, 'permission', 'permission.id = rp.permission_id')
      .select('DISTINCT permission.key', 'key')
      .where('rp.role_id IN (:...roleIds)', { roleIds })
      .getRawMany<{ key: string }>();

    return rows.map((row) => row.key);
  }

  async listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const platformAdmin = await this.isPlatformAdmin(userId);
    const allPermissions = platformAdmin ? await this.getAllPermissionKeys() : [];
    const summaries = new Map<string, WorkspaceSummary>();

    const agencyMemberships = await this.tenantUsers
      .createQueryBuilder('tu')
      .innerJoin('tenants', 'tenant', 'tenant.id = tu.tenant_id')
      .where('tu.user_id = :userId', { userId })
      .andWhere('tu.status = :status', { status: MembershipStatus.ACTIVE })
      .andWhere('tenant.type = :type', { type: 'agency' })
      .select(['tu.tenant_id AS tenantId', 'tu.role_id AS roleId'])
      .getRawMany<{ tenantId: string; roleId: string }>();

    for (const membership of agencyMemberships) {
      const agency = await this.agencies.findOne({ where: { tenantId: membership.tenantId } });

      if (!agency) {
        continue;
      }

      const workspace = this.ensureBusinessSummary(
        summaries,
        agency.id,
        agency.tenantId,
        agency.name,
        'agency',
      );
      workspace.accessType = platformAdmin ? 'platform' : 'direct';
      workspace.roles.push(...(await this.getRoleKeys([membership.roleId])));
      workspace.permissions.push(...(await this.getRolePermissions([membership.roleId])));
    }

    const directMemberships = await this.businessUsers.find({
      where: { userId, status: MembershipStatus.ACTIVE },
    });

    for (const membership of directMemberships) {
      const business = await this.businesses.findOne({ where: { id: membership.businessId } });

      if (!business) {
        continue;
      }

      const workspace = this.ensureBusinessSummary(
        summaries,
        business.id,
        business.tenantId,
        business.name,
        'business',
      );
      workspace.accessType = platformAdmin ? 'platform' : 'direct';

      const assignments = await this.userBusinessRoles.find({
        where: { businessId: business.id, userId },
      });
      const roleIds = assignments.map((assignment) => assignment.roleId);
      workspace.roles.push(...(await this.getRoleKeys(roleIds)));
      workspace.permissions.push(...(await this.getRolePermissions(roleIds)));
    }

    const agencyLinked = await this.agencyClients
      .createQueryBuilder('ac')
      .innerJoin(Agency, 'agency', 'agency.id = ac.agency_id')
      .innerJoin(TenantUser, 'tu', 'tu.tenant_id = agency.tenant_id')
      .where('ac.status = :status', { status: AgencyClientStatus.ACTIVE })
      .andWhere('tu.user_id = :userId', { userId })
      .andWhere('tu.status = :membershipStatus', { membershipStatus: MembershipStatus.ACTIVE })
      .andWhere('agency.status = :agencyStatus', { agencyStatus: 'active' })
      .select([
        'ac.business_id AS businessId',
        'agency.id AS agencyId',
        'tu.role_id AS roleId',
      ])
      .getRawMany<{ businessId: string; agencyId: string; roleId: string }>();

    for (const link of agencyLinked) {
      const business = await this.businesses.findOne({ where: { id: link.businessId } });

      if (!business) {
        continue;
      }

      const workspace = this.ensureBusinessSummary(
        summaries,
        business.id,
        business.tenantId,
        business.name,
        'business',
      );

      if (workspace.accessType !== 'direct') {
        workspace.accessType = platformAdmin ? 'platform' : 'agency';
      }

      workspace.roles.push(...(await this.getRoleKeys([link.roleId])));
      workspace.permissions.push(...(await this.getRolePermissions([link.roleId])));
    }

    const result = [...summaries.values()].map((workspace) => ({
      ...workspace,
      roles: [...new Set(workspace.roles)],
      permissions: platformAdmin ? allPermissions : [...new Set(workspace.permissions)],
    }));

    return result.sort((left, right) => left.name.localeCompare(right.name));
  }

  private ensureBusinessSummary(
    summaries: Map<string, WorkspaceSummary>,
    id: string,
    tenantId: string,
    name: string,
    type: WorkspaceSummary['type'],
  ): WorkspaceSummary {
    const existing = summaries.get(id);

    if (existing) {
      return existing;
    }

    const workspace: WorkspaceSummary = {
      type,
      id,
      tenantId,
      name,
      accessType: 'direct',
      roles: [],
      permissions: [],
    };
    summaries.set(id, workspace);

    return workspace;
  }
}
