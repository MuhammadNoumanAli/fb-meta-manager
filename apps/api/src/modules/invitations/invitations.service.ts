import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import {
  DataSource,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { SYSTEM_ROLES } from '../../common/constants/permissions';
import { AgencyClientStatus } from '../../common/enums/agency-client-status.enum';
import { InvitationStatus } from '../../common/enums/invitation-status.enum';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { RoleScope } from '../../common/enums/role-scope.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { generateOpaqueToken } from '../../common/utilities/slug';
import { normalizeOptionalText } from '../../common/utilities/text';
import { AgencyClient } from '../../database/entities/agency-client.entity';
import { Agency } from '../../database/entities/agency.entity';
import { BusinessUser } from '../../database/entities/business-user.entity';
import { Business } from '../../database/entities/business.entity';
import { Invitation } from '../../database/entities/invitation.entity';
import { Role } from '../../database/entities/role.entity';
import { UserBusinessRole } from '../../database/entities/user-business-role.entity';
import { User } from '../../database/entities/user.entity';
import {
  PASSWORD_COST,
  toPublicUser,
  type AuthResult,
} from '../auth/auth.service';
import { hashToken, TokensService } from '../auth/tokens.service';
import { AuditService } from '../audit/audit.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

const DEFAULT_EXPIRY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface InvitationView {
  id: string;
  email: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  /** Only exposed outside production until email delivery is implemented. */
  token?: string;
  acceptanceUrl?: string;
}

export interface InvitationPreview {
  email: string;
  agencyName: string;
  businessName: string;
  businessSlug: string;
  expiresAt: Date;
  hasAccount: boolean;
}

export interface InvitationAcceptance extends AuthResult {
  businessId: string;
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitations: Repository<Invitation>,
    @InjectRepository(Agency) private readonly agencies: Repository<Agency>,
    @InjectRepository(AgencyClient)
    private readonly agencyClients: Repository<AgencyClient>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly tokensService: TokensService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    actorUserId: string,
    agencyId: string,
    clientBusinessId: string,
    dto: CreateInvitationDto,
    context: RequestContext,
  ): Promise<InvitationView> {
    await this.assertClientRelationship(agencyId, clientBusinessId, true);

    const email = dto.email.trim().toLowerCase();
    const expiresInDays = dto.expiresInDays ?? DEFAULT_EXPIRY_DAYS;

    // Issuing a new invitation supersedes earlier pending links for the same
    // client and email so only the most recent link can be used.
    await this.invitations.update(
      {
        agencyId,
        businessId: clientBusinessId,
        invitedEmail: email,
        status: InvitationStatus.PENDING,
      },
      { status: InvitationStatus.REVOKED },
    );

    const rawToken = generateOpaqueToken(32);
    const invitation = await this.invitations.save(
      this.invitations.create({
        agencyId,
        businessId: clientBusinessId,
        invitedEmail: email,
        tokenHash: hashToken(rawToken),
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
        invitedByUserId: actorUserId,
      }),
    );

    const agency = await this.agencies.findOne({ where: { id: agencyId } });

    await this.auditService.record({
      action: 'invitation.created',
      actorUserId,
      tenantId: agency?.tenantId ?? null,
      businessId: clientBusinessId,
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: { email, expiresInDays },
      context,
    });

    return this.toView(invitation, rawToken);
  }

  async listForClient(
    agencyId: string,
    clientBusinessId: string,
  ): Promise<InvitationView[]> {
    await this.assertClientRelationship(agencyId, clientBusinessId, false);

    await this.invitations.update(
      {
        agencyId,
        businessId: clientBusinessId,
        status: InvitationStatus.PENDING,
        expiresAt: LessThanOrEqual(new Date()),
      },
      { status: InvitationStatus.EXPIRED },
    );

    const rows = await this.invitations.find({
      where: { agencyId, businessId: clientBusinessId },
      order: { createdAt: 'DESC' },
    });

    return rows.map((row) => this.toView(row));
  }

  async revoke(
    actorUserId: string,
    agencyId: string,
    clientBusinessId: string,
    invitationId: string,
    context: RequestContext,
  ): Promise<InvitationView> {
    const invitation = await this.invitations.findOne({
      where: { id: invitationId, agencyId, businessId: clientBusinessId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    invitation.status = InvitationStatus.REVOKED;
    await this.invitations.save(invitation);

    const agency = await this.agencies.findOne({ where: { id: agencyId } });

    await this.auditService.record({
      action: 'invitation.revoked',
      actorUserId,
      tenantId: agency?.tenantId ?? null,
      businessId: clientBusinessId,
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: { email: invitation.invitedEmail },
      context,
    });

    return this.toView(invitation);
  }

  async preview(rawToken: string): Promise<InvitationPreview> {
    const invitation = await this.findByRawToken(rawToken);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.assertUsable(invitation, this.invitations);

    const [agency, business, account] = await Promise.all([
      this.agencies.findOne({ where: { id: invitation.agencyId } }),
      this.businesses.findOne({ where: { id: invitation.businessId } }),
      this.users.findOne({ where: { email: invitation.invitedEmail } }),
    ]);

    if (!agency || !business) {
      throw new NotFoundException('Invitation not found');
    }

    return {
      email: invitation.invitedEmail,
      agencyName: agency.name,
      businessName: business.name,
      businessSlug: business.slug,
      expiresAt: invitation.expiresAt,
      hasAccount: Boolean(account),
    };
  }

  async accept(
    rawToken: string,
    dto: AcceptInvitationDto,
    context: RequestContext,
  ): Promise<InvitationAcceptance> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const invitation = await manager
        .getRepository(Invitation)
        .createQueryBuilder('invitation')
        .where('invitation.token_hash = :tokenHash', {
          tokenHash: hashToken(rawToken),
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      await this.assertUsable(invitation, manager.getRepository(Invitation));

      const userRepository = manager.getRepository(User);
      let user = await userRepository
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email: invitation.invitedEmail })
        .getOne();

      const isNewAccount = !user;

      if (user) {
        if (user.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException('This account is not active');
        }

        if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
          throw new UnauthorizedException(
            'An account already exists for this email. Enter its password to accept.',
          );
        }
      } else {
        const firstName = dto.firstName?.trim();
        const lastName = dto.lastName?.trim();

        if (!firstName || !lastName) {
          throw new BadRequestException(
            'First name and last name are required to create your account',
          );
        }

        user = await userRepository.save(
          userRepository.create({
            email: invitation.invitedEmail,
            passwordHash: await bcrypt.hash(dto.password, PASSWORD_COST),
            firstName,
            lastName,
            status: UserStatus.ACTIVE,
          }),
        );
      }

      const business = await manager.findOne(Business, {
        where: { id: invitation.businessId },
      });

      if (!business) {
        throw new NotFoundException('Invitation not found');
      }

      const membership = await manager.findOne(BusinessUser, {
        where: { businessId: business.id, userId: user.id },
      });
      const hadMembership = Boolean(membership);

      if (membership) {
        if (membership.status !== MembershipStatus.ACTIVE) {
          membership.status = MembershipStatus.ACTIVE;
          await manager.save(membership);
        }
      } else {
        await manager.save(
          manager.create(BusinessUser, {
            businessId: business.id,
            userId: user.id,
            status: MembershipStatus.ACTIVE,
          }),
        );
      }

      const assignments = await manager.find(UserBusinessRole, {
        where: { businessId: business.id, userId: user.id },
      });

      if (assignments.length === 0) {
        const ownerRole = await manager.findOne(Role, {
          where: {
            key: SYSTEM_ROLES.BUSINESS_OWNER,
            scope: RoleScope.BUSINESS,
          },
        });

        if (!ownerRole) {
          throw new Error(
            'The business_owner role is missing. Run the Phase 1 migration.',
          );
        }

        await manager.save(
          manager.create(UserBusinessRole, {
            businessId: business.id,
            userId: user.id,
            roleId: ownerRole.id,
          }),
        );
      }

      // First-time onboarding may configure regional and profile defaults;
      // existing members keep the workspace configuration unchanged.
      if (!hadMembership) {
        if (dto.timezone !== undefined) {
          business.timezone = dto.timezone;
        }
        if (dto.currency !== undefined) {
          business.currency = dto.currency;
        }
        if (dto.industry !== undefined) {
          business.industry = normalizeOptionalText(dto.industry);
        }
        if (dto.description !== undefined) {
          business.description = normalizeOptionalText(dto.description);
        }
        if (dto.website !== undefined) {
          business.website = normalizeOptionalText(dto.website);
        }
        if (dto.contactEmail !== undefined) {
          business.contactEmail = normalizeOptionalText(
            dto.contactEmail?.toLowerCase(),
          );
        }
        if (dto.contactPhone !== undefined) {
          business.contactPhone = normalizeOptionalText(dto.contactPhone);
        }

        await manager.save(business);
      }

      user.lastLoginAt = new Date();
      await userRepository.save(user);

      invitation.status = InvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      invitation.acceptedByUserId = user.id;
      await manager.save(invitation);

      return { invitation, user, business, isNewAccount };
    });

    const tokens = await this.tokensService.issueForUser(outcome.user, context);

    await this.auditService.record({
      action: 'invitation.accepted',
      actorUserId: outcome.user.id,
      tenantId: outcome.business.tenantId,
      businessId: outcome.business.id,
      entityType: 'invitation',
      entityId: outcome.invitation.id,
      metadata: {
        email: outcome.invitation.invitedEmail,
        agencyId: outcome.invitation.agencyId,
        newAccount: outcome.isNewAccount,
      },
      context,
    });

    return {
      user: toPublicUser(outcome.user),
      ...tokens,
      businessId: outcome.business.id,
    };
  }

  private async assertClientRelationship(
    agencyId: string,
    businessId: string,
    requireActive: boolean,
  ): Promise<AgencyClient> {
    const link = await this.agencyClients.findOne({
      where: { agencyId, businessId },
    });

    if (!link) {
      throw new NotFoundException('Client relationship not found');
    }

    if (requireActive && link.status !== AgencyClientStatus.ACTIVE) {
      throw new BadRequestException(
        'This client relationship is not active',
      );
    }

    return link;
  }

  private async findByRawToken(rawToken: string): Promise<Invitation | null> {
    return this.invitations.findOne({
      where: { tokenHash: hashToken(rawToken) },
    });
  }

  private async assertUsable(
    invitation: Invitation,
    repository: Repository<Invitation>,
  ): Promise<void> {
    if (
      invitation.status === InvitationStatus.PENDING &&
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      invitation.status = InvitationStatus.EXPIRED;
      await repository.save(invitation);
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new GoneException('This invitation has already been used');
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      throw new GoneException('This invitation has been revoked');
    }

    if (invitation.status === InvitationStatus.EXPIRED) {
      throw new GoneException('This invitation has expired');
    }
  }

  private toView(invitation: Invitation, rawToken?: string): InvitationView {
    const view: InvitationView = {
      id: invitation.id,
      email: invitation.invitedEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
    };

    // Email delivery is not wired yet, so non-production surfaces the link.
    if (rawToken && this.configService.get<string>('nodeEnv') !== 'production') {
      const origin =
        this.configService.get<string>('frontendOrigin') ??
        'http://localhost:5173';
      view.token = rawToken;
      view.acceptanceUrl = `${origin}/invitations/${rawToken}`;
    }

    return view;
  }
}
