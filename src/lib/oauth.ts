import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { generateRawToken, hashToken, tokenPrefixFor } from '@/lib/apiTokens';

// ── Constants ─────────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_TTL_SECONDS  = 60 * 60;          // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
export const AUTH_CODE_TTL_SECONDS     = 60 * 5;             // 5 minutes

// ── Origin ────────────────────────────────────────────────────────────────────

export function getOrigin(): string {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? 'https://desk.your-domain.example';
}

// ── PKCE ──────────────────────────────────────────────────────────────────────

/** Verifies a PKCE code_verifier against the code_challenge stored at authorization time. */
export function verifyPkce(verifier: string, challenge: string, method: string): boolean {
  if (method === 'plain') return verifier === challenge;
  if (method === 'S256') {
    const computed = createHash('sha256').update(verifier).digest('base64url');
    return computed === challenge;
  }
  return false;
}

// ── Random id/secret generation ──────────────────────────────────────────────

export function generateClientId(): string {
  return 'mcpc_' + randomBytes(16).toString('hex');
}

export function generateAuthCode(): string {
  return 'ac_' + randomBytes(32).toString('hex');
}

export function generateOpaqueToken(prefix: string): string {
  return prefix + randomBytes(32).toString('hex');
}

// ── Issuing tokens ────────────────────────────────────────────────────────────

/**
 * Issues a fresh access token (as an ApiToken row, source="oauth") + refresh
 * token for a given user/client pair. Used by both the authorization_code
 * and refresh_token grants in /api/oauth/token.
 */
export async function issueTokenPair(userId: string, clientId: string, clientName: string) {
  const rawAccessToken = generateRawToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);

  const apiToken = await prisma.apiToken.create({
    data: {
      userId,
      name:          `${clientName} (OAuth)`,
      tokenHash:     hashToken(rawAccessToken),
      tokenPrefix:   tokenPrefixFor(rawAccessToken),
      source:        'oauth',
      oauthClientId: clientId,
      expiresAt,
    },
  });

  const rawRefreshToken = generateOpaqueToken('dipr_');
  await prisma.oAuthRefreshToken.create({
    data: {
      tokenHash:  hashToken(rawRefreshToken),
      apiTokenId: apiToken.id,
      userId,
      clientId,
      expiresAt:  new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });

  return {
    access_token:  rawAccessToken,
    token_type:    'Bearer',
    expires_in:    ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: rawRefreshToken,
  };
}
