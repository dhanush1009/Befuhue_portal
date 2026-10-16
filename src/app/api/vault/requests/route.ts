import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { accessState } from '@/lib/vault/rules';

// Access requests. Admins see everyone's (pending first); everyone else sees only their own.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const isAdmin = user.role === 'ADMIN';
  const onlyPending = req.nextUrl.searchParams.get('status') === 'pending';

  const rows = await prisma.credentialAccess.findMany({
    where: { ...(isAdmin ? {} : { requesterId: user.id }), ...(onlyPending ? { status: 'PENDING' as const } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const [creds, users, tasks] = await Promise.all([
    prisma.credential.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.credentialId))] } }, include: { client: { select: { name: true } } } }),
    prisma.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => [r.requesterId, r.decidedById].filter(Boolean) as string[]))] } }, select: { id: true, name: true, avatarUrl: true } }),
    prisma.task.findMany({ where: { id: { in: rows.map((r) => r.taskId).filter(Boolean) as string[] } }, select: { id: true, humanId: true, title: true } }),
  ]);
  const cMap = new Map(creds.map((c) => [c.id, c])), uMap = new Map(users.map((u) => [u.id, u])), tMap = new Map(tasks.map((t) => [t.id, t]));
  const now = new Date();

  const items = rows.map((r) => {
    const c = cMap.get(r.credentialId);
    return {
      id: r.id, credentialId: r.credentialId, state: accessState(r, now), reason: r.reason, createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null, decisionNote: r.decisionNote, expiresAt: r.expiresAt?.toISOString() ?? null, usedAt: r.usedAt?.toISOString() ?? null,
      credential: c ? { brand: c.client.name, service: c.service, domain: c.domain } : null,
      requester: uMap.get(r.requesterId) ?? { id: r.requesterId, name: 'Unknown', avatarUrl: null },
      decidedBy: r.decidedById ? uMap.get(r.decidedById)?.name ?? null : null,
      task: r.taskId ? tMap.get(r.taskId) ?? null : null,
    };
  });
  return NextResponse.json({ data: { items, isAdmin } });
}
