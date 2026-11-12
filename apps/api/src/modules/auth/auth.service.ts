import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { UserStatus } from '../../common/enums/user-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { generateOpaqueToken } from '../../common/utilities/slug';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { User } from '../../database/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { hashToken, TokensService, type IssuedTokens } from './tokens.service';

export const PASSWORD_COST = 12;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: Date;
}

export interface AuthResult extends IssuedTokens {
  user: PublicUser;
}

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  status: user.status,
  createdAt: user.createdAt,
});

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResets: Repository<PasswordResetToken>,
    private readonly tokensService: TokensService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, context: RequestContext): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.users.create({
      email,
      passwordHash: await bcrypt.hash(dto.password, PASSWORD_COST),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      status: UserStatus.ACTIVE,
    });
    await this.users.save(user);

    await this.auditService.record({
      action: 'auth.registered',
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      context,
    });

    const tokens = await this.tokensService.issueForUser(user, context);

    return { user: toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto, context: RequestContext): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.auditService.record({
        action: 'auth.login_failed',
        entityType: 'user',
        metadata: { email },
        context,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active');
    }

    user.lastLoginAt = new Date();
    await this.users.save(user);

    const tokens = await this.tokensService.issueForUser(user, context);

    await this.auditService.record({
      action: 'auth.login',
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      context,
    });

    return { user: toPublicUser(user), ...tokens };
  }

  async refresh(rawToken: string, context: RequestContext): Promise<AuthResult> {
    const rotated = await this.tokensService.rotate(rawToken, context);
    const user = await this.users.findOne({ where: { id: rotated.userId } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active');
    }

    return {
      user: toPublicUser(user),
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      refreshExpiresAt: rotated.refreshExpiresAt,
    };
  }

  async logout(rawToken: string | null): Promise<void> {
    if (rawToken) {
      await this.tokensService.revoke(rawToken);
    }
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    context: RequestContext,
  ): Promise<{ message: string; resetToken?: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    const message =
      'If an account exists for this email, a password reset link has been created.';

    if (!user) {
      return { message };
    }

    const now = new Date();
    await this.passwordResets.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: now },
    );

    const rawToken = generateOpaqueToken(32);
    await this.passwordResets.insert({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    });

    await this.auditService.record({
      action: 'auth.password_reset_requested',
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      context,
    });

    // In development the API surfaces the token instead of email delivery (Phase 2).
    if (this.configService.get<string>('nodeEnv') !== 'production') {
      return { message, resetToken: rawToken };
    }

    return { message };
  }

  async resetPassword(dto: ResetPasswordDto, context: RequestContext): Promise<{ message: string }> {
    const record = await this.passwordResets
      .createQueryBuilder('reset')
      .addSelect('reset.tokenHash')
      .where('reset.tokenHash = :tokenHash', { tokenHash: hashToken(dto.token) })
      .andWhere('reset.used_at IS NULL')
      .getOne();

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('This password reset link is invalid or has expired');
    }

    const user = await this.users.findOne({ where: { id: record.userId } });

    if (!user) {
      throw new UnauthorizedException('This password reset link is invalid or has expired');
    }

    user.passwordHash = await bcrypt.hash(dto.password, PASSWORD_COST);
    await this.users.save(user);

    record.usedAt = new Date();
    await this.passwordResets.save(record);
    await this.tokensService.revokeAllForUser(user.id);

    await this.auditService.record({
      action: 'auth.password_reset_completed',
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      context,
    });

    return { message: 'Your password has been updated. Sign in with the new password.' };
  }

  async findUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return toPublicUser(user);
  }

  /** Housekeeping hook used by tests and future scheduled cleanup. */
  async purgeExpiredPasswordResets(): Promise<void> {
    await this.passwordResets.delete({
      expiresAt: LessThanOrEqual(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    });
  }
}
