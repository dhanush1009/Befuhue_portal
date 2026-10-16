import type { NextRequest } from 'next/server';

export const STATE_COOKIE = 'meta-oauth-state';

/** The address this portal is served from, which must match the Redirect URI whitelisted in the Meta app. */
export function siteOrigin(req: NextRequest): string {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? req.nextUrl.origin;
}
