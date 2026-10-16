import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/requireAuth';

const TOKEN_PREFIX = 'dip_';

/** Generates a new raw token. Shown to the user exactly once — never stored. */
export function generateRawToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString('hex');
}

/** Deterministic, one-way hash — tokens are high-entropy random values, so a fast hash is fine (this isn't a password). */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** First few characters of the raw token, kept for display so a user can tell tokens apart without ever seeing the full value again. */
export function tokenPrefixFor(rawToken: string): string {
  return rawToken.slice(0, TOKEN_PREFIX.length + 8);
}

/**
 * Resolves a raw Bearer token to the user it belongs to, or null if the
 * token is unknown, revoked, or the owning account has been deactivated.
 * Updates lastUsedAt on success (fire-and-forget).
 */
export async function resolveApiToken(rawToken: string): Promise<AuthenticatedUser | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;

  const tokenHash = hashToken(rawToken);
  const record = await prisma.apiToken.findUnique({
    where:   { tokenHash },
    include: {
      user: {
        select: {
          id: true, name: true, role: true, managerId: true,
          designation: true, department: true, avatarUrl: true, isActive: true,
        },
      },
    },
  });

  if (!record || record.revokedAt || !record.user.isActive) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;

  prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return {
    id:          record.user.id,
    name:        record.user.name,
    role:        record.user.role,
    managerId:   record.user.managerId,
    designation: record.user.designation,
    department:  record.user.department,
    avatarUrl:   record.user.avatarUrl,
  };
}
