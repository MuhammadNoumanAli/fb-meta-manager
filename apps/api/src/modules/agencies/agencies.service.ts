import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SYSTEM_ROLES } from '../../common/constants/permissions';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { RoleScope } from '../../common/enums/role-scope.enum';
import { TenantType } from '../../common/enums/tenant-type.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { buildUniqueSlug } from '../../common/utilities/slug';
import { AgencyClient } from '../../database/entities/agency-client.entity';
import { Agency } from '../../database/entities/agency.entity';
import { Role } from '../../database/entities/role.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { TenantUser } from '../../database/entities/tenant-user.entity';
import { AgencyClientStatus } from '../../common/enums/agency-client-status.enum';
import {
  AccessService,
  type WorkspaceSummary,
} from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { BusinessesService, type BusinessDetail } from '../businesses/businesses.service';
import { CreateBusinessDto } from '../businesses/dto/create-business.dto';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

export interface AgencyDetail {
  agency: Agency;
  accessType: 'platform' | 'agency';
  roles: string[];
  permissions: string[];
}

export interface AgencyClientView {
  businessId: string;
  name: string;
  slug: string;
  status: AgencyClientStatus;
  startedAt: Date;
  endedAt: Date | null;
}

@Injectable()
export class AgenciesService {
  constructor(
    @InjectRepository(Agency) private readonly agencies: Repository<Agency>,
    @InjectRepository(AgencyClient)
    private readonly agencyClients: Repository<AgencyClient>,
    private readonly dataSource: DataSource,
    private readonly accessService: AccessService,
    private readonly auditService: AuditService,
    private readonly businessesService: BusinessesService,
  ) {}

  async create(
    ownerUserId: string,
    dto: CreateAgencyDto,
    context: RequestContext,
  ): Promise<AgencyDetail> {
    const agency = await this.dataSource.transaction(async (manager) => {
      const tenant = manager.create(Tenant, {
        name: dto.name,
        slug: buildUniqueSlug(dto.name),
        type: TenantType.AGENCY,
      });
      await manager.save(tenant);

      const created = manager.create(Agency, {
        tenantId: tenant.id,
        name: dto.name,
        slug: buildUniqueSlug(dto.name),
      });
      await manager.save(created);

      const ownerRole = await manager.findOne(Role, {
        where: { key: SYSTEM_ROLES.AGENCY_OWNER, scope: RoleScope.AGENCY },
      });

      if (!ownerRole) {
        throw new Error('The agency_owner role is missing. Run the Phase 1 migration.');
      }

      await manager.save(
        manager.create(TenantUser, {
          tenantId: tenant.id,
          userId: ownerUserId,
          roleId: ownerRole.id,
          status: MembershipStatus.ACTIVE,
        }),
      );

      return created;
    });

    await this.auditService.record({
      action: 'agency.created',
      actorUserId: ownerUserId,
      tenantId: agency.tenantId,
      entityType: 'agency',
      entityId: agency.id,
      metadata: { name: agency.name },
      context,
    });

    return this.getDetails(ownerUserId, agency.id);
  }

  async listMine(userId: string): Promise<WorkspaceSummary[]> {
    const workspaces = await this.accessService.listWorkspaces(userId);
    return workspaces.filter((workspace) => workspace.type === 'agency');
  }

  async getDetails(userId: string, agencyId: string): Promise<AgencyDetail> {
    const access = await this.accessService.getAgencyAccess(userId, agencyId);

    return {
      agency: access.agency,
      accessType: access.accessType,
      roles: access.roles,
      permissions: access.permissions,
    };
  }

  async update(
    userId: string,
    agencyId: string,
    dto: UpdateAgencyDto,
    context: RequestContext,
  ): Promise<AgencyDetail> {
    const access = await this.accessService.getAgencyAccess(userId, agencyId);
    const agency = access.agency;

    if (dto.name !== undefined) {
      agency.name = dto.name;
      await this.agencies.save(agency);

      const tenant = await this.dataSource
        .getRepository(Tenant)
        .findOne({ where: { id: agency.tenantId } });

      if (tenant) {
        tenant.name = dto.name;
        await this.dataSource.getRepository(Tenant).save(tenant);
      }
    }

    await this.auditService.record({
      action: 'agency.updated',
      actorUserId: userId,
      tenantId: agency.tenantId,
      entityType: 'agency',
      entityId: agency.id,
      metadata: { changed: Object.keys(dto).filter((key) => dto[key as keyof UpdateAgencyDto] !== undefined) },
      context,
    });

    return this.getDetails(userId, agency.id);
  }

  async listClients(agencyId: string): Promise<AgencyClientView[]> {
    const links = await this.agencyClients.find({
      where: { agencyId },
      relations: { business: true },
      order: { createdAt: 'ASC' },
    });

    return links.map((link) => ({
      businessId: link.businessId,
      name: link.business.name,
      slug: link.business.slug,
      status: link.status,
      startedAt: link.startedAt,
      endedAt: link.endedAt,
    }));
  }

  async createClient(
    actorUserId: string,
    agencyId: string,
    dto: CreateBusinessDto,
    context: RequestContext,
  ): Promise<BusinessDetail> {
    const agency = await this.agencies.findOne({ where: { id: agencyId } });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return this.businessesService.createClientBusiness(actorUserId, agencyId, dto, context);
  }

  async endClient(
    actorUserId: string,
    agencyId: string,
    businessId: string,
    context: RequestContext,
  ): Promise<AgencyClientView[]> {
    const link = await this.agencyClients.findOne({ where: { agencyId, businessId } });

    if (!link) {
      throw new NotFoundException('Client relationship not found');
    }

    if (link.status === AgencyClientStatus.ACTIVE) {
      link.status = AgencyClientStatus.ENDED;
      link.endedAt = new Date();
      await this.agencyClients.save(link);

      await this.auditService.record({
        action: 'agency.client_ended',
        actorUserId,
        tenantId: (await this.agencies.findOne({ where: { id: agencyId } }))?.tenantId ?? null,
        businessId,
        entityType: 'agency_client',
        entityId: link.id,
        metadata: { agencyId },
        context,
      });
    } else if (link.status !== AgencyClientStatus.ENDED) {
      throw new BadRequestException('Client relationship cannot be ended from its current state');
    }

    return this.listClients(agencyId);
  }
}
