import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessTtl', '15m') as never,
        },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokensService],
  exports: [AuthService, TokensService, JwtModule],
})
export class AuthModule {}
