import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import type { RequestContext } from '../../common/utilities/request-context';
import { generateOpaqueToken } from '../../common/utilities/slug';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface RotatedTokens extends IssuedTokens {
  userId: string;
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const parseDurationToMs = (value: string, fallbackMs: number): number => {
  const match = /^(\d+)\s*([smhd])$/i.exec(value.trim());

  if (!match) {
    return fallbackMs;
  }

  return Number(match[1]) * DURATION_UNITS[match[2].toLowerCase()];
};

@Injectable()
export class TokensService {
  private readonly refreshTtlMs: number;

  constructor(
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.refreshTtlMs = parseDurationToMs(
      this.configService.get<string>('jwt.refreshTtl', '7d'),
      7 * 24 * 60 * 60 * 1000,
    );
  }

  async issueForUser(user: User, context: RequestContext): Promise<IssuedTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessTtl', '15m') as never,
      },
    );
    const refresh = await this.createRefreshToken(user.id, context);

    return {
      accessToken,
      refreshToken: refresh.rawToken,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  async rotate(rawToken: string, context: RequestContext): Promise<RotatedTokens> {
    const stored = await this.findByRawToken(rawToken);
    const now = new Date();

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // A rotated token being replayed indicates possible theft: revoke the family.
      await this.revokeAllForUser(stored.userId, now);
      throw new UnauthorizedException('Refresh token has already been used');
    }

    if (stored.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const next = await this.createRefreshToken(stored.userId, context);
    stored.revokedAt = now;
    stored.replacedByTokenHash = hashToken(next.rawToken);
    await this.refreshTokens.save(stored);

    const user = await this.refreshTokens.manager.getRepository(User).findOne({
      where: { id: stored.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessTtl', '15m') as never,
      },
    );

    return {
      userId: user.id,
      accessToken,
      refreshToken: next.rawToken,
      refreshExpiresAt: next.expiresAt,
    };
  }

  async revoke(rawToken: string): Promise<void> {
    const stored = await this.findByRawToken(rawToken);

    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokens.save(stored);
    }
  }

  async revokeAllForUser(userId: string, at = new Date()): Promise<void> {
    await this.refreshTokens
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: at })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async createRefreshToken(
    userId: string,
    context: RequestContext,
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = generateOpaqueToken(48);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    await this.refreshTokens.insert({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    return { rawToken, expiresAt };
  }

  private async findByRawToken(rawToken: string): Promise<RefreshToken | null> {
    return this.refreshTokens
      .createQueryBuilder('rt')
      .addSelect('rt.tokenHash')
      .where('rt.tokenHash = :tokenHash', { tokenHash: hashToken(rawToken) })
      .getOne();
  }
}
