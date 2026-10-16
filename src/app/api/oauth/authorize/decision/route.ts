import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { generateAuthCode, AUTH_CODE_TTL_SECONDS } from '@/lib/oauth';

// Handles the Allow/Deny submission from /oauth/authorize's consent screen.
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth() as any;
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.redirect(new URL('/login', req.url));
  // Connecting an LLM is an admin capability.
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'access_denied', error_description: 'Connecting an LLM is available to admins only.' }, { status: 403 });

  const form = await req.formData();
  const decision            = form.get('decision')?.toString();
  const clientId            = form.get('client_id')?.toString();
  const redirectUri         = form.get('redirect_uri')?.toString();
  const state               = form.get('state')?.toString() ?? '';
  const codeChallenge       = form.get('code_challenge')?.toString();
  const codeChallengeMethod = form.get('code_challenge_method')?.toString() ?? 'S256';

  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Re-validate the client/redirect pair server-side — never trust the form alone.
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: 'invalid_client_or_redirect_uri' }, { status: 400 });
  }

  const destination = new URL(redirectUri);

  if (decision !== 'allow') {
    destination.searchParams.set('error', 'access_denied');
    if (state) destination.searchParams.set('state', state);
    return NextResponse.redirect(destination, { status: 303 });
  }

  const code = generateAuthCode();
  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId,
      userId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    },
  });

  destination.searchParams.set('code', code);
  if (state) destination.searchParams.set('state', state);
  return NextResponse.redirect(destination, { status: 303 });
}
