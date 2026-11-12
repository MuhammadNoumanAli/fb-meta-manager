import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SYSTEM_ROLES } from '../../common/constants/permissions';
import { AgencyClientStatus } from '../../common/enums/agency-client-status.enum';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { RoleScope } from '../../common/enums/role-scope.enum';
import { TenantType } from '../../common/enums/tenant-type.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { buildUniqueSlug } from '../../common/utilities/slug';
import { normalizeOptionalText } from '../../common/utilities/text';
import { AgencyClient } from '../../database/entities/agency-client.entity';
import { BusinessUser } from '../../database/entities/business-user.entity';
import { Business } from '../../database/entities/business.entity';
import { Role } from '../../database/entities/role.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { UserBusinessRole } from '../../database/entities/user-business-role.entity';
import { AccessService, type WorkspaceSummary } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

export interface BusinessDetail {
  business: Business;
  accessType: 'platform' | 'direct' | 'agency';
  roles: string[];
  permissions: string[];
  agencyId: string | null;
}

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business) private readonly businesses: Repository<Business>,
    private readonly dataSource: DataSource,
    private readonly accessService: AccessService,
    private readonly auditService: AuditService,
  ) {}

  async createForOwner(
    ownerUserId: string,
    dto: CreateBusinessDto,
    context: RequestContext,
  ): Promise<BusinessDetail> {
    const business = await this.dataSource.transaction(async (manager) => {
      const tenant = manager.create(Tenant, {
        name: dto.name,
        slug: buildUniqueSlug(dto.name),
        type: TenantType.BUSINESS,
      });
      await manager.save(tenant);

      const created = manager.create(Business, {
        tenantId: tenant.id,
        name: dto.name,
        slug: buildUniqueSlug(dto.name),
        timezone: dto.timezone ?? 'UTC',
        currency: dto.currency ?? 'MYR',
        industry: normalizeOptionalText(dto.industry),
        description: normalizeOptionalText(dto.description),
        website: normalizeOptionalText(dto.website),
        contactEmail: normalizeOptionalText(dto.contactEmail),
        contactPhone: normalizeOptionalText(dto.contactPhone),
      });
      await manager.save(created);

      const ownerRole = await manager.findOne(Role, {
        where: { key: SYSTEM_ROLES.BUSINESS_OWNER, scope: RoleScope.BUSINESS },
      });

      if (!ownerRole) {
        throw new Error('The business_owner role is missing. Run the Phase 1 migration.');
      }

      await manager.save(
        manager.create(BusinessUser, {
          businessId: created.id,
          userId: ownerUserId,
          status: MembershipStatus.ACTIVE,
        }),
      );
      await manager.save(
        manager.create(UserBusinessRole, {
          businessId: created.id,
          userId: ownerUserId,
          roleId: ownerRole.id,
        }),
      );

      return created;
    });

    await this.auditService.record({
      action: 'business.created',
      actorUserId: ownerUserId,
      tenantId: business.tenantId,
      businessId: business.id,
      entityType: 'business',
      entityId: business.id,
      metadata: { name: business.name, source: 'self_service' },
      context,
    });

    return this.getDetails(ownerUserId, business.id);
  }

  async createClientBusiness(
    actorUserId: string,
    agencyId: string,
    dto: CreateBusinessDto,
    context: RequestContext,
  ): Promise<BusinessDetail> {
    const business = await this.dataSource.transaction(async (manager) => {
      const tenant = manager.create(Tenant, {
        name: dto.name,
        slug: buildUniqueSlug(dto.name),
        type: TenantType.BUSINESS,
      });
      await manager.save(tenant);

      const created = manager.create(Business, {
        tenantId: tenant.id,
        name: dto.name,
        slug: buildUniqueSlug(dto.name),
        timezone: dto.timezone ?? 'UTC',
        currency: dto.currency ?? 'MYR',
        industry: normalizeOptionalText(dto.industry),
        description: normalizeOptionalText(dto.description),
        website: normalizeOptionalText(dto.website),
        contactEmail: normalizeOptionalText(dto.contactEmail),
        contactPhone: normalizeOptionalText(dto.contactPhone),
      });
      await manager.save(created);

      await manager.save(
        manager.create(AgencyClient, {
          agencyId,
          businessId: created.id,
          status: AgencyClientStatus.ACTIVE,
        }),
      );

      return created;
    });

    await this.auditService.record({
      action: 'business.created_for_client',
      actorUserId,
      tenantId: business.tenantId,
      businessId: business.id,
      entityType: 'business',
      entityId: business.id,
      metadata: { name: business.name, source: 'agency', agencyId },
      context,
    });

    return this.getDetails(actorUserId, business.id);
  }

  async listMine(userId: string): Promise<WorkspaceSummary[]> {
    const workspaces = await this.accessService.listWorkspaces(userId);
    return workspaces.filter((workspace) => workspace.type === 'business');
  }

  async getDetails(userId: string, businessId: string): Promise<BusinessDetail> {
    const access = await this.accessService.getBusinessAccess(userId, businessId);

    return {
      business: access.business,
      accessType: access.accessType,
      roles: access.roles,
      permissions: access.permissions,
      agencyId: access.agencyId,
    };
  }

  async update(
    userId: string,
    businessId: string,
    dto: UpdateBusinessDto,
    context: RequestContext,
  ): Promise<BusinessDetail> {
    const access = await this.accessService.getBusinessAccess(userId, businessId);
    const business = access.business;

    Object.assign(business, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.industry !== undefined
        ? { industry: normalizeOptionalText(dto.industry) }
        : {}),
      ...(dto.description !== undefined
        ? { description: normalizeOptionalText(dto.description) }
        : {}),
      ...(dto.website !== undefined
        ? { website: normalizeOptionalText(dto.website) }
        : {}),
      ...(dto.contactEmail !== undefined
        ? { contactEmail: normalizeOptionalText(dto.contactEmail?.toLowerCase()) }
        : {}),
      ...(dto.contactPhone !== undefined
        ? { contactPhone: normalizeOptionalText(dto.contactPhone) }
        : {}),
    });

    await this.businesses.save(business);

    await this.auditService.record({
      action: 'business.updated',
      actorUserId: userId,
      tenantId: business.tenantId,
      businessId: business.id,
      entityType: 'business',
      entityId: business.id,
      metadata: {
        changed: Object.keys(dto).filter(
          (key) => dto[key as keyof UpdateBusinessDto] !== undefined,
        ),
      },
      context,
    });

    return this.getDetails(userId, business.id);
  }

  async getForAccess(businessId: string): Promise<Business> {
    const business = await this.businesses.findOne({ where: { id: businessId } });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }
}
