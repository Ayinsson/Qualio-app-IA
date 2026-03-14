import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthPayload, AuthResponse, RefreshTokenRecord, UserRecord } from './auth.types';

@Injectable()
export class AuthService {
  private readonly accessTokenTtl = '15m';
  private readonly refreshTokenTtlMs = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string, ipAddress?: string): Promise<AuthResponse> {
    const existingUser = await this.findUserByEmail(dto.email);

    if (existingUser) {
      throw new BadRequestException('El correo ya esta registrado.');
    }

    const userId = randomUUID();
    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          name,
          is_active,
          email_verified,
          failed_login_attempts,
          locked_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      userId,
      dto.email,
      passwordHash,
      dto.name ?? null,
      true,
      false,
      0,
      null,
    );

    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('No fue posible crear el usuario.');
    }

    return this.issueTokens(user, userAgent, ipAddress);
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string): Promise<AuthResponse> {
    const user = await this.findUserByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    if (!this.isTruthy(user.isActive)) {
      throw new UnauthorizedException('La cuenta esta inactiva.');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?',
        user.id,
      );

      throw new UnauthorizedException('Credenciales invalidas.');
    }

    await this.prisma.$executeRawUnsafe(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      user.id,
    );

    return this.issueTokens(user, userAgent, ipAddress);
  }

  async refresh(dto: RefreshTokenDto, userAgent?: string, ipAddress?: string): Promise<AuthResponse> {
    const refreshTokenHash = this.hashToken(dto.refreshToken);
    const refreshRecord = await this.findRefreshToken(refreshTokenHash);

    if (!refreshRecord) {
      throw new UnauthorizedException('Refresh token invalido o expirado.');
    }

    const user = await this.findUserById(refreshRecord.userId);

    if (!user || !this.isTruthy(user.isActive)) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    await this.revokeRefreshTokenById(refreshRecord.id);

    return this.issueTokens(user, userAgent, ipAddress);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.prisma.$executeRawUnsafe(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
      refreshTokenHash,
    );

    return { success: true };
  }

  private async issueTokens(
    user: UserRecord,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    const payload: AuthPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.accessTokenTtl,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: Math.floor(this.refreshTokenTtlMs / 1000),
    });

    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshTokenId = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO refresh_tokens (
          id,
          user_id,
          token_hash,
          user_agent,
          ip_address,
          expires_at,
          revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      refreshTokenId,
      user.id,
      refreshTokenHash,
      userAgent ?? null,
      ipAddress ?? null,
      expiresAt,
      null,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: this.isTruthy(user.emailVerified),
      },
    };
  }

  private async findUserByEmail(email: string): Promise<UserRecord | null> {
    const users = (await this.prisma.$queryRawUnsafe(
      `
        SELECT
          id,
          email,
          password_hash AS passwordHash,
          name,
          is_active AS isActive,
          email_verified AS emailVerified
        FROM users
        WHERE email = ?
        LIMIT 1
      `,
      email,
    )) as UserRecord[];

    return users[0] ?? null;
  }

  private async findUserById(id: string): Promise<UserRecord | null> {
    const users = (await this.prisma.$queryRawUnsafe(
      `
        SELECT
          id,
          email,
          password_hash AS passwordHash,
          name,
          is_active AS isActive,
          email_verified AS emailVerified
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      id,
    )) as UserRecord[];

    return users[0] ?? null;
  }

  private async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const records = (await this.prisma.$queryRawUnsafe(
      `
        SELECT
          id,
          user_id AS userId,
          expires_at AS expiresAt
        FROM refresh_tokens
        WHERE token_hash = ?
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `,
      tokenHash,
    )) as RefreshTokenRecord[];

    return records[0] ?? null;
  }

  private async revokeRefreshTokenById(tokenId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?',
      tokenId,
    );
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private isTruthy(value: number | boolean): boolean {
    return value === true || value === 1;
  }
}
