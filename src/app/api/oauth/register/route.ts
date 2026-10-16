import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateClientId } from '@/lib/oauth';
import { z } from 'zod';

// RFC 7591 — Dynamic Client Registration. MCP clients (Claude.ai, ChatGPT, etc.)
// call this once, automatically, the first time a user adds this server's URL —
// there's no manual "create an app" step the way most OAuth providers require.
const registerSchema = z.object({
  client_name:               z.string().min(1).max(200).optional(),
  redirect_uris:             z.array(z.string().url()).min(1),
  grant_types:                z.array(z.string()).optional(),
  response_types:             z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => null) as unknown;
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_client_metadata', error_description: parsed.error.message }, { status: 400 });
  }

  // Only https (or localhost, for local dev clients) redirect URIs are accepted.
  for (const uri of parsed.data.redirect_uris) {
    const u = new URL(uri);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return NextResponse.json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris must be https, or localhost for local clients' }, { status: 400 });
    }
  }

  const clientId   = generateClientId();
  const clientName = parsed.data.client_name ?? 'Unnamed MCP client';

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientName,
      redirectUris: parsed.data.redirect_uris,
      // Public client (PKCE-only) — the standard for MCP connectors, which can't
      // safely hold a secret. token_endpoint_auth_method "none" signals this.
      clientSecretHash: null,
    },
  });

  return NextResponse.json({
    client_id:                  client.clientId,
    client_id_issued_at:        Math.floor(client.createdAt.getTime() / 1000),
    client_name:                client.clientName,
    redirect_uris:              client.redirectUris,
    grant_types:                ['authorization_code', 'refresh_token'],
    response_types:             ['code'],
    token_endpoint_auth_method: 'none',
  }, { status: 201 });
}
