import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPkce, issueTokenPair } from '@/lib/oauth';
import { hashToken } from '@/lib/apiTokens';

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return await req.json().catch(() => ({})) as Record<string, string>;
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) out[k] = v.toString();
  return out;
}

export async function POST(req: NextRequest) {
  const params = await readParams(req);
  const grantType = params.grant_type;

  if (grantType === 'authorization_code') {
    const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier } = params;
    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return oauthError('invalid_request', 'Missing code, redirect_uri, client_id, or code_verifier');
    }

    const authCode = await prisma.oAuthAuthorizationCode.findUnique({ where: { code } });
    if (!authCode || authCode.usedAt || authCode.expiresAt < new Date()) {
      return oauthError('invalid_grant', 'Authorization code is invalid, expired, or already used');
    }
    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      return oauthError('invalid_grant', 'client_id or redirect_uri does not match the authorization request');
    }
    if (!verifyPkce(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
      return oauthError('invalid_grant', 'PKCE verification failed');
    }

    // Single-use — mark it burned before issuing tokens.
    await prisma.oAuthAuthorizationCode.update({ where: { code }, data: { usedAt: new Date() } });

    const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
    const tokens = await issueTokenPair(authCode.userId, clientId, client?.clientName ?? 'MCP client');
    return NextResponse.json(tokens);
  }

  if (grantType === 'refresh_token') {
    const { refresh_token: refreshToken, client_id: clientId } = params;
    if (!refreshToken || !clientId) return oauthError('invalid_request', 'Missing refresh_token or client_id');

    const record = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!record || record.revokedAt || record.expiresAt < new Date() || record.clientId !== clientId) {
      return oauthError('invalid_grant', 'Refresh token is invalid, expired, or revoked');
    }

    // Rotate: revoke the old refresh token and issue a fresh access+refresh pair.
    await prisma.oAuthRefreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    await prisma.apiToken.update({ where: { id: record.apiTokenId }, data: { revokedAt: new Date() } }).catch(() => {});

    const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
    const tokens = await issueTokenPair(record.userId, clientId, client?.clientName ?? 'MCP client');
    return NextResponse.json(tokens);
  }

  return oauthError('unsupported_grant_type', `grant_type "${grantType}" is not supported`);
}
