import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { accessState, requestAccessSchema } from '@/lib/vault/rules';
import { canViewTask } from '@/lib/taskVisibility';

// A person asks to see one entry once. Admins get a notification (and a Slack message, if connected)
// that names the brand and service but never anything secret.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role === 'ADMIN') return NextResponse.json({ error: 'Admins can open entries directly.' }, { status: 400 });

  const parsed = requestAccessSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });

  const cred = await prisma.credential.findUnique({ where: { id: params.id }, include: { client: { select: { name: true } } } });
  if (!cred) return NextResponse.json({ error: 'That entry no longer exists.' }, { status: 404 });

  let taskLabel: string | null = null;
  if (parsed.data.taskId) {
    const task = await prisma.task.findUnique({ where: { id: parsed.data.taskId }, select: { id: true, humanId: true, title: true, isPrivate: true, assigneeId: true, reporterId: true, participants: { select: { userId: true } }, credentialIds: true } });
    if (!task || !canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (!task.credentialIds.includes(cred.id)) return NextResponse.json({ error: 'That entry is not attached to this task.' }, { status: 400 });
    taskLabel = `${task.humanId} ${task.title}`;
  }

  const mine = await prisma.credentialAccess.findMany({ where: { requesterId: user.id, credentialId: cred.id, status: { in: ['PENDING', 'APPROVED'] } } });
  const now = new Date();
  if (mine.some((r) => r.status === 'PENDING')) return NextResponse.json({ error: 'You already have a request waiting for this entry.' }, { status: 409 });
  if (mine.some((r) => accessState(r, now) === 'READY')) return NextResponse.json({ error: 'You already have approved access. Open it from My requests.' }, { status: 409 });

  const created = await prisma.credentialAccess.create({ data: { credentialId: cred.id, requesterId: user.id, taskId: parsed.data.taskId ?? null, reason: parsed.data.reason } });
  await createAuditLog(user.id, 'CREDENTIAL_ACCESS_REQUESTED', cred.id, 'Credential', { Request: { before: null, after: created.id } });

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification(
    a.id, 'CREDENTIAL_REQUEST', `${user.name} asked for access: ${cred.client.name} · ${cred.service}`,
    `${parsed.data.reason}${taskLabel ? ` (for ${taskLabel})` : ''}`, '/vault?tab=requests',
  )));
  return NextResponse.json({ data: { id: created.id } }, { status: 201 });
}
