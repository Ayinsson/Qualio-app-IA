import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth.types';
import {
  API_TOKEN_PREFIX,
  type ApiTokenExpiration,
  type ApiTokenScope,
  DEFAULT_API_TOKEN_EXPIRATION,
} from './api-token-scopes';
import { CreateApiTokenDto } from './dto/create-api-token.dto';

/** Lo que se devuelve al listar: nunca incluye el token ni su hash. */
export type ApiTokenEntity = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type CreatedApiToken = {
  /** Valor completo del token. Solo se entrega en esta respuesta. */
  token: string;
  apiToken: ApiTokenEntity;
};

type TokenAuthRow = {
  id: string;
  userId: string;
  email: string;
  isActive: boolean;
  scopes: ApiTokenScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

const MAX_ACTIVE_TOKENS_PER_USER = 20;
const VISIBLE_PREFIX_LENGTH = API_TOKEN_PREFIX.length + 8;
const LAST_USED_REFRESH_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

const EXPIRATION_DAYS: Record<ApiTokenExpiration, number | null> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
  never: null,
};

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isApiToken(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX);
}

@Injectable()
export class ApiTokensService {
  /** Ventana fija en memoria por token. Suficiente para una sola instancia del API. */
  private readonly rateWindows = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateApiTokenDto): Promise<CreatedApiToken> {
    const [{ activeCount }] = await this.prisma.$queryRaw<{ activeCount: number }[]>`
      SELECT COUNT(*)::int AS "activeCount"
      FROM api_tokens
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

    if (activeCount >= MAX_ACTIVE_TOKENS_PER_USER) {
      throw new BadRequestException(
        `Alcanzaste el máximo de ${MAX_ACTIVE_TOKENS_PER_USER} tokens activos. Revoca alguno para crear otro.`,
      );
    }

    const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const days = EXPIRATION_DAYS[dto.expiration ?? DEFAULT_API_TOKEN_EXPIRATION];
    const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<ApiTokenEntity[]>`
      INSERT INTO api_tokens (id, user_id, name, token_prefix, token_hash, scopes, expires_at, created_at)
      VALUES (
        ${randomUUID()},
        ${userId},
        ${dto.name.trim()},
        ${token.slice(0, VISIBLE_PREFIX_LENGTH)},
        ${hashApiToken(token)},
        ${dto.scopes}::text[],
        ${expiresAt},
        NOW()
      )
      RETURNING
        id,
        name,
        token_prefix AS "tokenPrefix",
        scopes,
        expires_at AS "expiresAt",
        last_used_at AS "lastUsedAt",
        revoked_at AS "revokedAt",
        created_at AS "createdAt"
    `;

    return { token, apiToken: rows[0] };
  }

  list(userId: string): Promise<ApiTokenEntity[]> {
    return this.prisma.$queryRaw<ApiTokenEntity[]>`
      SELECT
        id,
        name,
        token_prefix AS "tokenPrefix",
        scopes,
        expires_at AS "expiresAt",
        last_used_at AS "lastUsedAt",
        revoked_at AS "revokedAt",
        created_at AS "createdAt"
      FROM api_tokens
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
  }

  async revoke(userId: string, tokenId: string): Promise<{ success: true }> {
    const updated = await this.prisma.$executeRaw`
      UPDATE api_tokens
      SET revoked_at = NOW()
      WHERE id = ${tokenId} AND user_id = ${userId} AND revoked_at IS NULL
    `;

    if (updated === 0) {
      throw new NotFoundException('Token no encontrado o ya revocado.');
    }

    this.rateWindows.delete(tokenId);
    return { success: true };
  }

  /**
   * Valida un token recibido en el header Authorization y devuelve la identidad
   * del usuario dueño, con los permisos del token.
   */
  async authenticate(token: string): Promise<AuthPayload> {
    const rows = await this.prisma.$queryRaw<TokenAuthRow[]>`
      SELECT
        t.id,
        t.user_id AS "userId",
        u.email,
        u.is_active AS "isActive",
        t.scopes,
        t.expires_at AS "expiresAt",
        t.last_used_at AS "lastUsedAt",
        t.revoked_at AS "revokedAt"
      FROM api_tokens t
      INNER JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ${hashApiToken(token)}
      LIMIT 1
    `;

    const row = rows[0];
    const now = Date.now();

    if (!row || row.revokedAt || !row.isActive || (row.expiresAt && row.expiresAt.getTime() <= now)) {
      throw new UnauthorizedException('Token de API inválido, vencido o revocado.');
    }

    this.consumeRateLimit(row.id, now);

    if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
      await this.prisma.$executeRaw`UPDATE api_tokens SET last_used_at = NOW() WHERE id = ${row.id}`;
    }

    return {
      sub: row.userId,
      email: row.email,
      authType: 'api_token',
      tokenId: row.id,
      scopes: row.scopes,
    };
  }

  private consumeRateLimit(tokenId: string, now: number): void {
    const window = this.rateWindows.get(tokenId);

    if (!window || now - window.startedAt >= RATE_LIMIT_WINDOW_MS) {
      this.rateWindows.set(tokenId, { startedAt: now, count: 1 });
      return;
    }

    window.count += 1;

    if (window.count > RATE_LIMIT_MAX_REQUESTS) {
      throw new HttpException(
        `Límite de ${RATE_LIMIT_MAX_REQUESTS} peticiones por minuto alcanzado para este token.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
