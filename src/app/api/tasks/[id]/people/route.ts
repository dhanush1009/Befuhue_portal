import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { createTaskHistory } from '@/lib/taskHistory';
import { canViewTask } from '@/lib/taskVisibility';
import { modeOf, normalizePeople, type PersonInput } from '@/lib/taskAssignment';
import { syncPartsStatus } from '@/lib/taskAssignmentDb';

const schema = z.object({
  mode:       z.enum(['SINGLE', 'TOGETHER', 'OFFER']),
  people:     z.array(z.object({ userId: z.string().min(1), role: z.string().max(40).optional().nullable() })).max(12).default([]),
  // SINGLE only: who owns it afterwards (omit to keep the current owner)
  assigneeId: z.string().nullable().optional(),
});

// ── PUT — change who is on a task, or how (single / together / anyone) ────────
// Reporter or admin only: deciding who works on something is a manager's call.

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { mode, assigneeId } = parsed.data;

  try {
    const task = await prisma.task.findUnique({
      where:  { id: params.id },
      select: {
        id: true, title: true, deletedAt: true, status: true, assignMode: true, assigneeId: true, reporterId: true, isPrivate: true,
        participants: { select: { id: true, userId: true, kind: true, role: true, partDone: true } },
      },
    });
    if (!task || task.deletedAt || !canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role !== 'ADMIN' && task.reporterId !== user.id) {
      return NextResponse.json({ error: 'Only an admin or whoever created the task can change who is on it.' }, { status: 403 });
    }
    if (task.status === 'CLOSED') return NextResponse.json({ error: 'This task is closed.' }, { status: 400 });

    const before = modeOf(task);
    let people: PersonInput[] = [];
    if (mode !== 'SINGLE') {
      const norm = normalizePeople(parsed.data.people);
      if (!norm.ok) return NextResponse.json({ error: norm.message }, { status: 400 });
      people = norm.people;
      const active = await prisma.user.count({ where: { id: { in: people.map((p) => p.userId) }, isActive: true } });
      if (active !== people.length) return NextResponse.json({ error: 'One of the selected people is not an active user.' }, { status: 400 });
    }
    if (mode === 'OFFER' && task.status !== 'TO_DO') {
      return NextResponse.json({ error: 'Only a task that has not started yet can be offered to a group.' }, { status: 400 });
    }

    const existingIds = new Set(task.participants.map((p) => p.userId));
    const kind = mode === 'TOGETHER' ? ('COLLABORATOR' as const) : ('OFFEREE' as const);

    if (mode === 'SINGLE') {
      await prisma.taskParticipant.deleteMany({ where: { taskId: params.id } });
      await prisma.task.update({
        where: { id: params.id },
        data:  { assignMode: null, ...(assigneeId !== undefined ? { assigneeId } : {}) },
      });
    } else {
      // Keep people who are staying (and their "part done" state); drop the rest; add the new ones.
      const keep = new Set(people.map((p) => p.userId));
      const sameKind = (p: { kind: string }) => p.kind === kind;
      await prisma.taskParticipant.deleteMany({
        where: { taskId: params.id, OR: [{ userId: { notIn: [...keep] } }, { kind: { not: kind } }] },
      });
      for (const p of people) {
        const current = task.participants.find((x) => x.userId === p.userId && sameKind(x));
        if (current) await prisma.taskParticipant.update({ where: { id: current.id }, data: { role: p.role ?? null } });
        else await prisma.taskParticipant.create({ data: { taskId: params.id, userId: p.userId, kind, role: p.role ?? null } });
      }
      await prisma.task.update({
        where: { id: params.id },
        data:  mode === 'TOGETHER'
          // the primary owner stays if still on the task, otherwise the first person
          ? { assignMode: 'TOGETHER', assigneeId: keep.has(task.assigneeId ?? '') ? task.assigneeId : people[0].userId }
          : { assignMode: 'OFFER', assigneeId: null },
      });
    }

    if (mode === 'TOGETHER') await syncPartsStatus(params.id, user.id);

    await createTaskHistory({
      taskId: params.id, actorId: user.id, action: 'PEOPLE_CHANGED',
      fieldName: 'people', oldValue: before, newValue: mode,
      metadata: { people },
    }, prisma);

    // Newly added people hear about it; people already on it don't get pinged again.
    const added = people.filter((p) => !existingIds.has(p.userId) && p.userId !== user.id);
    await Promise.all(added.map((p) =>
      mode === 'TOGETHER'
        ? createNotification(p.userId, 'TASK_ASSIGNED', `You were added to "${task.title}"${p.role ? ` as ${p.role}` : ''}`, `${user.name} added you — you each own a part, and it moves to review when everyone is done.`, `/tasks?task=${params.id}`)
        : createNotification(p.userId, 'TASK_OFFERED', `Offered: "${task.title}"`, `${user.name} offered this to ${people.length} people — the first to accept gets it.`, `/tasks?task=${params.id}`),
    ));

    return NextResponse.json({ data: { id: params.id, mode, people: people.length } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
