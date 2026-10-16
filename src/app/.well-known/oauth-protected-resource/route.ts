import { NextResponse } from 'next/server';
import { getOrigin } from '@/lib/oauth';

// RFC 9728 — tells a client that hits /api/mcp without a token (or with an
// expired one) which authorization server to go talk to.
export async function GET() {
  const origin = getOrigin();
  return NextResponse.json({
    resource:               `${origin}/api/mcp`,
    authorization_servers:  [origin],
    bearer_methods_supported: ['header'],
  });
}
