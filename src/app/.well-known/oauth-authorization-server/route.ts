import { NextResponse } from 'next/server';
import { getOrigin } from '@/lib/oauth';

// RFC 8414 — lets any MCP client discover how to talk to this authorization
// server just from the resource URL, no manual configuration required.
export async function GET() {
  const origin = getOrigin();
  return NextResponse.json({
    issuer:                                origin,
    authorization_endpoint:                `${origin}/oauth/authorize`,
    token_endpoint:                        `${origin}/api/oauth/token`,
    registration_endpoint:                 `${origin}/api/oauth/register`,
    response_types_supported:              ['code'],
    grant_types_supported:                 ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported:      ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported:                      ['tasks:read', 'tasks:write'],
  });
}
