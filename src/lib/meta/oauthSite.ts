import type { NextRequest } from 'next/server';
import { getBaseUrl } from '@/lib/baseUrl';

export const STATE_COOKIE = 'meta-oauth-state';

/** The address this portal is served from, which must match the Redirect URI whitelisted in the Meta app. */
export function siteOrigin(req: NextRequest): string {
  return getBaseUrl(req);
}
