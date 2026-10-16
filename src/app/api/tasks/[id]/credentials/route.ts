import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { canViewTask } from '@/lib/taskVisibility';
import { canAttachToTask, windowEnd } from '@/lib/vault/rules';
import { accessFor, toMeta } from '@/lib/vault/service';

// Vault entries attached to a task. Attaching only links the entry (brand, service, domain are shown);
// seeing the username and password still needs an admin's approval, unless an admin attaches it with
// "let the assignee view it once", which opens one viewing for each person on the task.

type Ctx = { params: { id: string } };
const GRANT_HOURS = 24;

async function loadTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    select: { id: true, humanId: true, title: true, isPrivate: true, reporterId: true, assigneeId: true, credentialIds: true, participants: { select: { userId: true } } },
  });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const task = await loadTask(params.id);
  if (!task || !canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const rows = await prisma.credential.findMany({ where: { id: { in: task.credentialIds } }, include: { client: { select: { name: true, logoUrl: true } } } });
  const items = rows.map(toMeta);
  const access = user.role === 'ADMIN' ? {} : await accessFor(user.id, items.map((i) => i.id));
  return NextResponse.json({ data: { items, access, canAttach: canAttachToTask(task, user.id, user.role === 'ADMIN') } });
}

const attachSchema = z.object({ credentialId: z.string().min(1), grantAssignees: z.boolean().optional() });

export async function POST(req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const isAdmin = user.role === 'ADMIN';

  const task = await loadTask(params.id);
  if (!task || !canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (!canAttachToTask(task, user.id, isAdmin)) return NextResponse.json({ error: 'Only an admin, the task creator or the assignee can attach passwords.' }, { status: 403 });

  const parsed = attachSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a password entry' }, { status: 400 });
  const cred = await prisma.credential.findUnique({ where: { id: parsed.data.credentialId }, include: { client: { select: { name: true } } } });
  if (!cred) return NextResponse.json({ error: 'That entry no longer exists.' }, { status: 404 });

  if (!task.credentialIds.includes(cred.id)) {
    await prisma.task.update({ where: { id: task.id }, data: { credentialIds: [...task.credentialIds, cred.id] } });
    await createAuditLog(user.id, 'TASK_CREDENTIAL_ATTACHED', task.id, 'Task', { Entry: { before: null, after: `${cred.client.name} · ${cred.service}` } });
  }

  // Admins can open one viewing for the people working on the task, so nobody has to ask.
  let granted = 0;
  if (parsed.data.grantAssignees && isAdmin) {
    const people = new Set<string>([...(task.assigneeId ? [task.assigneeId] : []), ...task.participants.map((p) => p.userId)]);
    people.delete(user.id);
    const now = new Date();
    for (const uid of people) {
      const person = await prisma.user.findUnique({ where: { id: uid }, select: { role: true, isActive: true } });
      if (!person?.isActive || person.role === 'ADMIN') continue;
      const open = await prisma.credentialAccess.findFirst({ where: { requesterId: uid, credentialId: cred.id, status: 'APPROVED', expiresAt: { gt: now } } });
      if (open) continue;
      await prisma.credentialAccess.create({
        data: { credentialId: cred.id, requesterId: uid, taskId: task.id, reason: `Shared with the task ${task.humanId} by an admin`, status: 'APPROVED', decidedById: user.id, decidedAt: now, expiresAt: windowEnd(now, GRANT_HOURS) },
      });
      await createNotification(uid, 'CREDENTIAL_DECIDED', `You can open ${cred.client.name} · ${cred.service}`, `Shared with ${task.humanId} ${task.title}. You can view it once in the next ${GRANT_HOURS} hours.`, `/tasks?task=${task.id}`);
      granted += 1;
    }
    if (granted) await createAuditLog(user.id, 'CREDENTIAL_ACCESS_GRANTED_WITH_TASK', cred.id, 'Credential', { Task: { before: null, after: task.humanId } });
  }
  return NextResponse.json({ data: { attached: true, granted } }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const task = await loadTask(params.id);
  if (!task || !canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (!canAttachToTask(task, user.id, user.role === 'ADMIN')) return NextResponse.json({ error: 'Only an admin, the task creator or the assignee can remove passwords.' }, { status: 403 });

  const credentialId = req.nextUrl.searchParams.get('credentialId') ?? '';
  if (!task.credentialIds.includes(credentialId)) return NextResponse.json({ error: 'Not attached' }, { status: 404 });
  await prisma.task.update({ where: { id: task.id }, data: { credentialIds: task.credentialIds.filter((c) => c !== credentialId) } });
  await createAuditLog(user.id, 'TASK_CREDENTIAL_DETACHED', task.id, 'Task');
  return NextResponse.json({ data: { ok: true } });
}
