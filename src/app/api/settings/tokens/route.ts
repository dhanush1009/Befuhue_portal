import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { generateRawToken, hashToken, tokenPrefixFor } from '@/lib/apiTokens';
import { z } from 'zod';

const createTokenSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
});

// List the current user's own tokens — never returns the raw value or hash.
export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const data = await prisma.apiToken.findMany({
      where: {
        userId: user.id,
        // OAuth access tokens rotate on every refresh (a new row each time,
        // the old one revoked) — hide the superseded ones so the list only
        // shows one row per real connection, not every renewal.
        NOT: { source: 'oauth', revokedAt: { isSet: true } },
      },
      select:  { id: true, name: true, tokenPrefix: true, source: true, expiresAt: true, lastUsedAt: true, createdAt: true, revokedAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a new token. The raw value is returned exactly once — only its hash
// and a short display prefix are ever persisted.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  // Connecting an LLM is an admin capability.
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Connecting an LLM is available to admins only.' }, { status: 403 });

  const body   = await req.json() as unknown;
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const rawToken = generateRawToken();
    const created = await prisma.apiToken.create({
      data: {
        userId:      user.id,
        name:        parsed.data.name,
        tokenHash:   hashToken(rawToken),
        tokenPrefix: tokenPrefixFor(rawToken),
      },
      select: { id: true, name: true, tokenPrefix: true, createdAt: true },
    });

    return NextResponse.json({ data: { ...created, token: rawToken } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
