import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';

/**
 * Returns the fully qualified public base URL of the portal (e.g. "https://portal.example.com").
 * Safely resolves the live domain whether running locally, in Docker, behind Caddy/Nginx, or on Vercel/VPS.
 *
 * @param req Optional incoming NextRequest or Request. If omitted, dynamically reads from next/headers.
 */
export function getBaseUrl(req?: NextRequest | Request | null): string {
  // 1. Client-side browser execution
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // 2. Explicit production APP_URL (if not pointing to localhost)
  const appUrl = process.env.APP_URL;
  if (appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')) {
    return appUrl.replace(/\/+$/, '');
  }

  // 3. Derive dynamically from incoming request headers or next/headers
  try {
    let reqHeaders: Headers | null = null;
    if (req?.headers) {
      reqHeaders = req.headers as Headers;
    } else {
      try {
        reqHeaders = headers();
      } catch {
        // Headers not accessible in current execution context
      }
    }

    if (reqHeaders) {
      const forwardedHost = reqHeaders.get('x-forwarded-host');
      const host = forwardedHost || reqHeaders.get('host');
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        const proto = reqHeaders.get('x-forwarded-proto') || 'https';
        return `${proto}://${host}`.replace(/\/+$/, '');
      }
    }
  } catch {
    // Ignore header resolution errors
  }

  // 4. NEXTAUTH_URL or AUTH_URL if configured with a real domain
  const nextAuthUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (
    nextAuthUrl &&
    !nextAuthUrl.includes('localhost') &&
    !nextAuthUrl.includes('127.0.0.1')
  ) {
    return nextAuthUrl.replace(/\/+$/, '');
  }

  // 5. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }

  // 6. Origin from req.nextUrl if available and non-local
  if (req && 'nextUrl' in req && req.nextUrl?.origin) {
    const origin = req.nextUrl.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin.replace(/\/+$/, '');
    }
  }

  // 7. Fallback for local development
  return (nextAuthUrl || (req && 'nextUrl' in req && req.nextUrl?.origin) || 'http://localhost:3000').replace(/\/+$/, '');
}
