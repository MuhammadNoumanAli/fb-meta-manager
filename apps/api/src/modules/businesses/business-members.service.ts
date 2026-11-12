import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { RoleScope } from '../../common/enums/role-scope.enum';
import { BusinessUser } from '../../database/entities/business-user.entity';
import { Role } from '../../database/entities/role.entity';
import { UserBusinessRole } from '../../database/entities/user-business-role.entity';
import { User } from '../../database/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../../common/utilities/request-context';
import { AddBusinessMemberDto, UpdateBusinessMemberDto } from './dto/member.dto';

export interface BusinessMemberView {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: MembershipStatus;
  roles: string[];
  joinedAt: Date;
}

@Injectable()
export class BusinessMembersService {
  constructor(
    @InjectRepository(BusinessUser)
    private readonly businessUsers: Repository<BusinessUser>,
    @InjectRepository(UserBusinessRole)
    private readonly userBusinessRoles: Repository<UserBusinessRole>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  async list(businessId: string): Promise<BusinessMemberView[]> {
    const memberships = await this.businessUsers.find({
      where: { businessId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });

    return Promise.all(
      memberships.map(async (membership) => {
        const assignments = await this.userBusinessRoles.find({
          where: { businessId, userId: membership.userId },
        });
        const roleRows = assignments.length
          ? await this.roles.find({
              where: assignments.map((assignment) => ({ id: assignment.roleId })),
              select: { key: true },
            })
          : [];

        return {
          userId: membership.userId,
          email: membership.user.email,
          firstName: membership.user.firstName,
          lastName: membership.user.lastName,
          status: membership.status,
          roles: roleRows.map((role) => role.key),
          joinedAt: membership.joinedAt,
        };
      }),
    );
  }

  async add(
    actorUserId: string,
    businessId: string,
    dto: AddBusinessMemberDto,
    context: RequestContext,
  ): Promise<BusinessMemberView[]> {
    const user = await this.users.findOne({ where: { email: dto.email.toLowerCase() } });

    if (!user) {
      throw new NotFoundException(
        'No AdPilot account uses this email yet. Invitations arrive in Phase 2.',
      );
    }

    const role = await this.roles.findOne({
      where: { key: dto.roleKey, scope: RoleScope.BUSINESS },
    });

    if (!role) {
      throw new BadRequestException('Unknown business role');
    }

    const existing = await this.businessUsers.findOne({
      where: { businessId, userId: user.id },
    });

    if (existing) {
      throw new BadRequestException('This user is already a member of the business');
    }

    const membership = this.businessUsers.create({
      businessId,
      userId: user.id,
      status: MembershipStatus.ACTIVE,
    });
    await this.businessUsers.save(membership);

    await this.userBusinessRoles.save(
      this.userBusinessRoles.create({ businessId, userId: user.id, roleId: role.id }),
    );

    await this.auditService.record({
      action: 'business.member_added',
      actorUserId,
      businessId,
      entityType: 'business_user',
      entityId: user.id,
      metadata: { roleKey: role.key, email: user.email },
      context,
    });

    return this.list(businessId);
  }

  async update(
    actorUserId: string,
    businessId: string,
    targetUserId: string,
    dto: UpdateBusinessMemberDto,
    context: RequestContext,
  ): Promise<BusinessMemberView[]> {
    const membership = await this.businessUsers.findOne({
      where: { businessId, userId: targetUserId },
    });

    if (!membership) {
      throw new NotFoundException('Business member not found');
    }

    const currentRoles = await this.getRoleKeysForUser(businessId, targetUserId);

    if (dto.roleKey && dto.roleKey !== currentRoles[0]) {
      const role = await this.roles.findOne({
        where: { key: dto.roleKey, scope: RoleScope.BUSINESS },
      });

      if (!role) {
        throw new BadRequestException('Unknown business role');
      }

      await this.assertOwnerRemains(businessId, targetUserId, role.key, membership.status);

      await this.userBusinessRoles.delete({ businessId, userId: targetUserId });
      await this.userBusinessRoles.save(
        this.userBusinessRoles.create({ businessId, userId: targetUserId, roleId: role.id }),
      );
    }

    if (dto.status && dto.status !== membership.status) {
      await this.assertOwnerRemains(businessId, targetUserId, currentRoles[0] ?? '', dto.status);
      membership.status = dto.status;
      await this.businessUsers.save(membership);
    }

    await this.auditService.record({
      action: 'business.member_updated',
      actorUserId,
      businessId,
      entityType: 'business_user',
      entityId: targetUserId,
      metadata: { roleKey: dto.roleKey ?? null, status: dto.status ?? null },
      context,
    });

    return this.list(businessId);
  }

  async remove(
    actorUserId: string,
    businessId: string,
    targetUserId: string,
    context: RequestContext,
  ): Promise<BusinessMemberView[]> {
    const membership = await this.businessUsers.findOne({
      where: { businessId, userId: targetUserId },
    });

    if (!membership) {
      throw new NotFoundException('Business member not found');
    }

    const currentRoles = await this.getRoleKeysForUser(businessId, targetUserId);
    await this.assertOwnerRemains(businessId, targetUserId, '', MembershipStatus.DISABLED);

    await this.userBusinessRoles.delete({ businessId, userId: targetUserId });
    await this.businessUsers.delete({ businessId, userId: targetUserId });

    await this.auditService.record({
      action: 'business.member_removed',
      actorUserId,
      businessId,
      entityType: 'business_user',
      entityId: targetUserId,
      metadata: { previousRoles: currentRoles },
      context,
    });

    return this.list(businessId);
  }

  private async getRoleKeysForUser(businessId: string, userId: string): Promise<string[]> {
    const assignments = await this.userBusinessRoles.find({ where: { businessId, userId } });

    if (assignments.length === 0) {
      return [];
    }

    const roles = await this.roles.find({
      where: assignments.map((assignment) => ({ id: assignment.roleId })),
      select: { key: true },
    });

    return roles.map((role) => role.key);
  }

  private async assertOwnerRemains(
    businessId: string,
    userId: string,
    nextRoleKey: string,
    nextStatus: MembershipStatus,
  ): Promise<void> {
    const currentRoles = await this.getRoleKeysForUser(businessId, userId);
    const currentlyOwner = currentRoles.includes('business_owner');

    if (!currentlyOwner || (nextRoleKey === 'business_owner' && nextStatus === MembershipStatus.ACTIVE)) {
      return;
    }

    const ownerAssignments = await this.userBusinessRoles
      .createQueryBuilder('ubr')
      .innerJoin(Role, 'role', 'role.id = ubr.role_id')
      .innerJoin(BusinessUser, 'bu', 'bu.business_id = ubr.business_id AND bu.user_id = ubr.user_id')
      .where('ubr.business_id = :businessId', { businessId })
      .andWhere('role.key = :key', { key: 'business_owner' })
      .andWhere('bu.status = :status', { status: MembershipStatus.ACTIVE })
      .getMany();

    if (ownerAssignments.length <= 1) {
      throw new BadRequestException('A business must keep at least one active owner');
    }
  }
}
