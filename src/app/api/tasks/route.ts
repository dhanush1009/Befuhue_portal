import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { createTaskHistory } from '@/lib/taskHistory';
import { toTotalMinutes, formatEffort } from '@/lib/effortUtils';
import { validateBugFields, SEVERITY_CONFIG } from '@/lib/bugUtils';
import { getDefaultStatus } from '@/lib/taskStatusConfig';
import { taskVisibilityFilter, canViewTask } from '@/lib/taskVisibility';
import { normalizePeople, type PersonInput } from '@/lib/taskAssignment';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import type { TaskStatus, Priority, ItemType, BugSeverity, Team, AssignMode } from '@prisma/client';

// ── Server-side create schema (task) ─────────────────────────────────────────

const serverCreateTaskSchema = z.object({
  title:            z.string().min(1).max(200),
  description:      z.string().optional(),
  status:           z.enum(['TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED']).optional(),
  priority:         z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
  clientId:         z.string().min(1),
  projectId:        z.string().optional().transform((v) => v || undefined),
  assigneeId:       z.string().optional(),
  dueDate:          z.string().optional(),
  parentId:         z.string().optional(),
  estimatedHours:   z.number().min(0).max(999).default(0),
  estimatedMinutes: z.number().min(0).max(59).default(0),
  itemType:         z.literal('TASK').optional(),
  team:                z.enum(['MARKETING', 'DESIGN', 'DEV']).optional(),
  phase:               z.enum(['RESEARCH', 'FORECAST', 'BUILD', 'LAUNCH', 'OPTIMIZE']).optional(),
  dependsOn:           z.array(z.string()).default([]),
  isGate:              z.boolean().default(false),
  isPrivate:           z.boolean().default(false),
  needsClientApproval: z.boolean().default(false),
  // Shared work: TOGETHER = each person owns a part, OFFER = first to accept takes it.
  assignMode:          z.enum(['SINGLE', 'TOGETHER', 'OFFER']).default('SINGLE'),
  people:              z.array(z.object({ userId: z.string().min(1), role: z.string().max(40).optional().nullable() })).max(12).default([]),
  agencyName:          z.string().optional(),
  amount:              z.number().min(0).nullable().optional(),
  currency:            z.string().optional(),
  billingReference:    z.string().optional(),
}).refine(
  (d) => (d.estimatedHours * 60 + d.estimatedMinutes) > 0,
  { message: 'Estimated effort is required.', path: ['estimatedHours'] },
);

// ── Server-side create schema (bug) ──────────────────────────────────────────

const serverCreateBugSchema = z.object({
  title:            z.string().min(1).max(200),
  description:      z.string().optional(),
  status:           z.enum(['TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED']).optional(),
  priority:         z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
  clientId:         z.string().min(1),
  projectId:        z.string().optional().transform((v) => v || undefined),
  assigneeId:       z.string().optional(),
  dueDate:          z.string().optional(),
  estimatedHours:   z.number().min(0).max(999),
  estimatedMinutes: z.number().min(0).max(59),
  itemType:         z.literal('BUG'),
  severity:         z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  stepsToReproduce: z.array(z.string()).min(1),
  expectedBehavior: z.string().min(1).max(1000),
  actualBehavior:   z.string().min(1).max(1000),
  environment:      z.object({
    browser:    z.string().optional(),
    os:         z.string().optional(),
    appVersion: z.string().optional(),
    device:     z.string().optional(),
  }).optional(),
  affectedVersion:  z.string().max(50).optional(),
  team:                z.enum(['MARKETING', 'DESIGN', 'DEV']).optional(),
  phase:               z.enum(['RESEARCH', 'FORECAST', 'BUILD', 'LAUNCH', 'OPTIMIZE']).optional(),
  dependsOn:           z.array(z.string()).default([]),
  isGate:              z.boolean().default(false),
  isPrivate:           z.boolean().default(false),
  needsClientApproval: z.boolean().default(false),
}).refine(
  (d) => (d.estimatedHours * 60 + d.estimatedMinutes) > 0,
  { message: 'Estimated effort is required.', path: ['estimatedHours'] },
);

// ── humanId generator ─────────────────────────────────────────────────────────
// A document count (the old approach) silently collides whenever a row is
// deleted or ends up with a malformed projectId (this happened once — the
// count no longer matches the highest number actually in use). Reading a max
// and writing max+1 as two separate steps has the same problem under real
// concurrency: two requests can both read the same max before either writes.
// An atomic $inc on a per-prefix Counter document is the only version of
// this that is actually race-free.

async function nextCounterSeq(key: string): Promise<number> {
  // Ensure the counter document exists — safe to race, at most one of many
  // concurrent first-callers "wins"; the rest just no-op update it.
  await prisma.counter.upsert({
    where:  { id: key },
    update: {},
    create: { id: key, seq: 0 },
  }).catch(() => {});
  const updated = await prisma.counter.update({
    where: { id: key },
    data:  { seq: { increment: 1 } },
  });
  return updated.seq;
}

async function generateHumanId(projectId?: string | null): Promise<string> {
  if (!projectId) {
    return `TASK-${String(await nextCounterSeq('TASK')).padStart(3, '0')}`;
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const prefix  = project?.prefix ?? 'TASK';
  return `${prefix}-${String(await nextCounterSeq(prefix)).padStart(3, '0')}`;
}

const TASK_LIST_SELECT = {
  id: true, humanId: true, title: true, description: true,
  status: true, priority: true,
  assigneeId: true, reporterId: true, dueDate: true,
  parentId: true, deletedAt: true, createdAt: true, updatedAt: true,
  estimatedMinutes: true, actualMinutes: true, effortVariance: true,
  closedAt: true, closedById: true,
  // Timer & Performance Scoring fields
  inProgressAt: true, timerStartedAt: true,
  internalReviewAt: true, timerStoppedAt: true,
  timeTakenMinutes: true, performancePoints: true, performanceOutcome: true,
  // Bug fields
  itemType: true, severity: true, stepsToReproduce: true,
  expectedBehavior: true, actualBehavior: true, environment: true,
  affectedVersion: true, fixedInVersion: true,
  isBugVerified: true, verifiedById: true, verifiedAt: true,
  isPrivate: true,
  // Agency work-management and billing fields
  agencyName: true,
  amount: true,
  currency: true,
  billingReference: true,
  clientId: true, projectId: true, team: true, phase: true,
  dependsOn: true, isGate: true, needsClientApproval: true, reviewerChain: true,
  deliverableLinks: true, deliverableVersion: true,
  assignMode: true,
  participants: {
    select: {
      userId: true, kind: true, role: true, partDone: true, partDoneAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  project:     { select: { id: true, name: true, prefix: true } },
  client:      { select: { id: true, name: true } },
  assignee:    { select: { id: true, name: true, avatarUrl: true } },
  reporter:    { select: { id: true, name: true, avatarUrl: true } },
  _count:      { select: { comments: true, subTasks: true } },
} as const;

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const sp           = req.nextUrl.searchParams;
  const projectId    = sp.get('projectId')    ?? undefined;
  const statusRaw    = sp.get('status')       ?? undefined;
  const assigneeId   = sp.get('assigneeId')   ?? undefined;
  const priority     = sp.get('priority')     as Priority   | null;
  const myTasks      = sp.get('myTasks') === 'true';
  const search       = sp.get('search')       ?? undefined;
  const itemType     = sp.get('itemType')     as ItemType   | null;
  const severity     = sp.get('severity')     as BugSeverity | null;
  const clientId     = sp.get('clientId')     ?? undefined;
  const team         = sp.get('team') as Team | null;
  const blockedOnly  = sp.get('blocked') === 'true';
  const dueRange     = sp.get('dueRange') as 'overdue' | 'this_week' | null;
  const limit        = Math.min(500, parseInt(sp.get('limit') ?? '500'));

  // Support comma-separated status list: ?status=TO_DO,IN_PROGRESS
  const statusFilter: TaskStatus[] | undefined = statusRaw
    ? (statusRaw.split(',') as TaskStatus[])
    : undefined;

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // "Mine" / "assigned to X" also covers tasks X shares with others or has been offered.
  const involved = (uid: string): Prisma.TaskWhereInput => ({
    OR: [{ assigneeId: uid }, { participants: { some: { userId: uid } } }],
  });
  const and: Prisma.TaskWhereInput[] = [];
  if (myTasks) and.push(involved(user.id));
  else if (assigneeId && assigneeId !== 'unassigned') and.push(involved(assigneeId));

  try {
    const data = await prisma.task.findMany({
      where: {
        deletedAt:  { isSet: false },
        ...(and.length ? { AND: and } : {}),
        ...taskVisibilityFilter(user.id, user.role),
        ...(projectId    ? { projectId }                                              : {}),
        ...(statusFilter ? { status: { in: statusFilter } }                           : {}),
        ...(priority     ? { priority }                                               : {}),
        ...(itemType     ? { itemType }                                               : {}),
        ...(severity     ? { severity }                                               : {}),
        ...(clientId     ? { clientId }                                               : {}),
        ...(team         ? { team }                                                   : {}),
        ...(dueRange === 'overdue'   ? { dueDate: { lt: now }, status: { notIn: ['DONE', 'CLOSED'] } } : {}),
        ...(dueRange === 'this_week' ? { dueDate: { gte: now, lte: weekFromNow } }                     : {}),
        ...(assigneeId === 'unassigned'                  ? { assigneeId: null }       : {}),
        ...(search       ? { title: { contains: search, mode: 'insensitive' } }       : {}),
      },
      select:  TASK_LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
      take:    limit,
    });

    const sanitizeTask = <T extends { amount?: number | null }>(t: T) => {
      if (user.role === 'ADMIN') return t;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { amount, ...rest } = t;
      return rest;
    };

    if (!blockedOnly) return NextResponse.json({ data: data.map(sanitizeTask) });

    // "Blocked" is computed, not stored — resolve against the fuller task set
    // (deps may sit outside the current filter) before narrowing to blocked-only.
    const depIds = [...new Set(data.flatMap((t) => t.dependsOn))];
    const depTasks = depIds.length
      ? await prisma.task.findMany({ where: { id: { in: depIds } }, select: { id: true, status: true } })
      : [];
    const scope = [...data.map((t) => ({ id: t.id, status: t.status })), ...depTasks];
    const doneLike = new Set(['DONE', 'CLOSED', 'VERIFIED']);
    const blocked = data.filter((t) =>
      t.dependsOn.length > 0 &&
      t.dependsOn.some((depId) => {
        const dep = scope.find((s) => s.id === depId);
        return !dep || !doneLike.has(dep.status);
      }),
    );
    return NextResponse.json({ data: blocked.map(sanitizeTask) });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body   = await req.json() as Record<string, unknown>;
  const isBug  = body.itemType === 'BUG';
  const schema = isBug ? serverCreateBugSchema : serverCreateTaskSchema;

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Extra server-side validation for bugs
  if (isBug) {
    const bugData = parsed.data as z.infer<typeof serverCreateBugSchema>;
    const bugValidation = validateBugFields({
      severity:         bugData.severity,
      stepsToReproduce: bugData.stepsToReproduce,
      expectedBehavior: bugData.expectedBehavior,
      actualBehavior:   bugData.actualBehavior,
    });
    if (!bugValidation.valid) {
      return NextResponse.json({ error: bugValidation.errors }, { status: 400 });
    }
  }

  const estimatedTotal = toTotalMinutes(parsed.data.estimatedHours, parsed.data.estimatedMinutes);

  // ── Shared work: validate the people up front ──────────────────────────────
  const taskInput = parsed.data as z.infer<typeof serverCreateTaskSchema>;
  const mode: AssignMode = isBug ? 'SINGLE' : taskInput.assignMode;
  let people: PersonInput[] = [];
  if (mode !== 'SINGLE') {
    const norm = normalizePeople(taskInput.people);
    if (!norm.ok) return NextResponse.json({ error: norm.message }, { status: 400 });
    people = norm.people;
    const active = await prisma.user.count({ where: { id: { in: people.map((p) => p.userId) }, isActive: true } });
    if (active !== people.length) {
      return NextResponse.json({ error: 'One of the selected people is not an active user.' }, { status: 400 });
    }
  }

  try {
    const { estimatedHours: _h, estimatedMinutes: _m, ...restAll } = parsed.data;
    // The shared-work fields only exist on tasks; they are not columns of Task itself.
    const { people: _people, assignMode: _assignMode, ...rest } = restAll as typeof restAll & { people?: unknown; assignMode?: unknown };

    const bugData = isBug ? (parsed.data as z.infer<typeof serverCreateBugSchema>) : null;

    const itemTypeFinal = (parsed.data.itemType ?? 'TASK') as ItemType;

    // Concurrent creates (e.g. an LLM agent firing several requests close
    // together) can both compute the same next humanId before either has
    // written — retry with a freshly generated id if the unique index catches it.
    const MAX_HUMAN_ID_ATTEMPTS = 5;
    let data: Prisma.TaskGetPayload<{ select: typeof TASK_LIST_SELECT }> | undefined;
    for (let attempt = 1; attempt <= MAX_HUMAN_ID_ATTEMPTS; attempt++) {
      const humanId = await generateHumanId(parsed.data.projectId);
      try {
        data = await prisma.task.create({
          data: {
            ...rest,
            // Only admin can set task amount
            amount:           user.role === 'ADMIN' ? ((parsed.data as Record<string, unknown>).amount as number | null | undefined) ?? null : null,
            agencyName:       ((parsed.data as Record<string, unknown>).agencyName as string | null | undefined) ?? null,
            currency:         ((parsed.data as Record<string, unknown>).currency as string | undefined) ?? 'INR',
            billingReference: ((parsed.data as Record<string, unknown>).billingReference as string | null | undefined) ?? null,
            // TOGETHER: the first person is the "primary" owner so existing views keep working.
            // OFFER: nobody owns it until someone accepts.
            assigneeId:       mode === 'TOGETHER' ? people[0].userId : mode === 'OFFER' ? undefined : parsed.data.assigneeId,
            assignMode:       mode === 'SINGLE' ? undefined : mode,
            humanId,
            reporterId:       user.id,
            status:           (parsed.data as { status?: TaskStatus }).status ?? getDefaultStatus(itemTypeFinal),
            inProgressAt:     ((parsed.data as { status?: TaskStatus }).status === 'IN_PROGRESS') ? new Date() : undefined,
            timerStartedAt:   ((parsed.data as { status?: TaskStatus }).status === 'IN_PROGRESS') ? new Date() : undefined,
            reopenCount:      0,
            dueDate:          parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
            estimatedMinutes: estimatedTotal,
            itemType:         itemTypeFinal,
            // Bug-specific fields
            severity:         bugData?.severity ?? null,
            stepsToReproduce: bugData ? (bugData.stepsToReproduce ?? null) : undefined,
            expectedBehavior: bugData?.expectedBehavior ?? null,
            actualBehavior:   bugData?.actualBehavior ?? null,
            environment:      bugData?.environment ? bugData.environment : undefined,
            affectedVersion:  bugData?.affectedVersion ?? null,
          },
          select: TASK_LIST_SELECT,
        });
        break;
      } catch (e) {
        const isHumanIdCollision =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          (e.meta?.target as string[] | undefined)?.includes('humanId');
        if (!isHumanIdCollision || attempt === MAX_HUMAN_ID_ATTEMPTS) throw e;
      }
    }
    if (!data) throw new Error('Failed to create task after retries.');

    if (mode !== 'SINGLE') {
      await prisma.taskParticipant.createMany({
        data: people.map((p) => ({
          taskId: data!.id,
          userId: p.userId,
          kind:   mode === 'TOGETHER' ? ('COLLABORATOR' as const) : ('OFFEREE' as const),
          role:   p.role ?? null,
        })),
      });
      data = (await prisma.task.findUnique({ where: { id: data.id }, select: TASK_LIST_SELECT })) ?? data;
    }

    // History: BUG_CREATED or TASK_CREATED
    await createTaskHistory(
      {
        taskId:   data.id,
        actorId:  user.id,
        action:   isBug ? 'BUG_CREATED' : 'TASK_CREATED',
        metadata: {
          title:            data.title,
          itemType:         data.itemType,
          priority:         data.priority,
          estimatedMinutes: estimatedTotal,
          assigneeId:       data.assigneeId,
          ...(mode !== 'SINGLE' ? { assignMode: mode, people } : {}),
          ...(isBug ? { severity: data.severity } : {}),
        },
      },
      prisma,
    );

    await createTaskHistory(
      {
        taskId:      data.id,
        actorId:     user.id,
        action:      'ESTIMATED_EFFORT_SET',
        fieldName:   'estimatedMinutes',
        newValue:    formatEffort(estimatedTotal),
        newRawValue: String(estimatedTotal),
      },
      prisma,
    );

    // Shared work: tell every person what they're being asked to do
    if (mode !== 'SINGLE') {
      const reporter = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
      const who = reporter?.name ?? 'Someone';
      await Promise.all(people.filter((p) => p.userId !== user.id).map((p) =>
        mode === 'TOGETHER'
          ? createNotification(
              p.userId, 'TASK_ASSIGNED',
              `You were added to "${data!.title}"${p.role ? ` as ${p.role}` : ''}`,
              `${who} set this up as shared work — you each own a part, and it moves to review when everyone is done.`,
              `/tasks?task=${data!.id}`,
            )
          : createNotification(
              p.userId, 'TASK_OFFERED',
              `Offered: "${data!.title}"`,
              `${who} offered this to ${people.length} people — the first to accept gets it.`,
              `/tasks?task=${data!.id}`,
            ),
      ));
    }

    // Notify assignee
    if (mode === 'SINGLE' && data.assigneeId && data.assigneeId !== user.id) {
      const reporter = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
      if (isBug && bugData) {
        const severityLabel = SEVERITY_CONFIG[bugData.severity as BugSeverity]?.label ?? bugData.severity;
        await createNotification(
          data.assigneeId,
          'TASK_ASSIGNED',
          `You've been assigned a ${severityLabel} bug`,
          `"${data.title}" in ${data.projectId}`,
          `/tasks?task=${data.id}`,
        );
      } else {
        await createNotification(
          data.assigneeId,
          'TASK_ASSIGNED',
          `You were assigned "${data.title}"`,
          `${reporter?.name ?? 'Someone'} assigned you a task.`,
          `/tasks?task=${data.id}`,
        );
      }
    }

    const returnData = user.role === 'ADMIN' ? data : (() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { amount, ...restSafe } = data as typeof data & { amount?: number | null };
      return restSafe;
    })();

    return NextResponse.json({ data: returnData }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
