import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateTaskSchema, updateBugSchema } from '@/lib/validations/task';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { recordTaskChanges, createTaskHistory } from '@/lib/taskHistory';
import { formatEffort } from '@/lib/effortUtils';
import { SEVERITY_CONFIG } from '@/lib/bugUtils';
import { isTaskBlocked, wouldCreateCycle } from '@/lib/dependencies';
import { canViewTask } from '@/lib/taskVisibility';
import { checkStatusMove, modeOf, type ParticipantLite } from '@/lib/taskAssignment';
import { calculatePerformanceFromTimer, calculateTaskScore } from '@/lib/taskScoring';
import type { BugSeverity } from '@prisma/client';

const TASK_DETAIL_SELECT = {
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
  project:    { select: { id: true, name: true, prefix: true } },
  client:     { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  reporter: { select: { id: true, name: true, avatarUrl: true } },
  closedBy: { select: { id: true, name: true } },
  subTasks: {
    where:  { deletedAt: { isSet: false } },
    select: { id: true, humanId: true, title: true, status: true },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true, taskId: true, authorId: true,
      body: true, bodyText: true, deletedAt: true,
      createdAt: true, updatedAt: true,
      author:   { select: { id: true, name: true, avatarUrl: true, designation: true } },
      mentions: { select: { userId: true, user: { select: { id: true, name: true } } } },
    },
  },
  history: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true, taskId: true, actorId: true, action: true,
      fieldName: true, oldValue: true, newValue: true,
      oldRawValue: true, newRawValue: true, metadata: true, createdAt: true,
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
  _count: { select: { comments: true, subTasks: true } },
} as const;

const BEFORE_SELECT = {
  status: true, priority: true, title: true, description: true,
  dueDate: true, assigneeId: true, estimatedMinutes: true, actualMinutes: true,
  itemType: true, severity: true, dependsOn: true, doneAt: true, closedAt: true,
  createdAt: true,
  inProgressAt: true, timerStartedAt: true,
  internalReviewAt: true, timerStoppedAt: true,
  timeTakenMinutes: true, performancePoints: true, performanceOutcome: true,
  assignee: { select: { name: true } },
} as const;

const STATUS_LABEL: Record<string, string> = {
  TO_DO: 'To Do', IN_PROGRESS: 'In Progress', INTERNAL_REVIEW: 'Internal Review',
  CLIENT_REVIEW: 'Client Review', DONE: 'Done', CLOSED: 'Closed',
  PENDING: 'Pending', IN_REVIEW: 'In Review', OPEN: 'Open', VERIFIED: 'Verified',
};

async function getLunchPauseMinutes(userId: string, start: Date, end: Date): Promise<number> {
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      attendance: { userId },
      AND: [
        { lunchBreakStartAt: { not: null } },
        { lunchBreakEndAt: { not: null } },
        { lunchBreakStartAt: { lt: end } },
        { lunchBreakEndAt: { gt: start } },
      ],
    },
    select: { lunchBreakStartAt: true, lunchBreakEndAt: true },
  });

  return sessions.reduce((total, session) => {
    const pauseStart = Math.max(start.getTime(), session.lunchBreakStartAt!.getTime());
    const pauseEnd = Math.min(end.getTime(), session.lunchBreakEndAt!.getTime());
    return total + Math.max(0, Math.round((pauseEnd - pauseStart) / 60000));
  }, 0);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const data = await prisma.task.findUnique({ where: { id: params.id }, select: TASK_DETAIL_SELECT });
    if (!data || data.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canViewTask(data, user.id, user.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const returnData = user.role === 'ADMIN' ? data : (() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { amount, ...restSafe } = data as typeof data & { amount?: number | null };
      return restSafe;
    })();
    return NextResponse.json({ data: returnData });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body = await req.json() as Record<string, unknown>;

  // Determine which schema to use based on the stored item type
  const existing = await prisma.task.findUnique({
    where:  { id: params.id },
    select: {
      itemType: true, isPrivate: true, assigneeId: true, reporterId: true, assignMode: true,
      participants: { select: { userId: true, kind: true, role: true, partDone: true, user: { select: { name: true } } } },
    },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canViewTask(existing, user.id, user.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const schema = existing.itemType === 'BUG' ? updateBugSchema : updateTaskSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  // An empty string means "no project" — normalize to null so it can never
  // collide with a real project id (only when the field was actually sent;
  // undefined still means "leave it alone").
  if (parsed.data.projectId === '') parsed.data.projectId = null;

  try {
    const before = await prisma.task.findUnique({ where: { id: params.id }, select: BEFORE_SELECT });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Shared work rules: a TOGETHER task can't reach review until every part is done,
    // and an open OFFER can't move until somebody accepts it.
    const mode = modeOf(existing);
    const people: ParticipantLite[] = existing.participants.map((p) => ({
      userId: p.userId, kind: p.kind, role: p.role, partDone: p.partDone, name: p.user.name,
    }));
    if (parsed.data.status && parsed.data.status !== before.status) {
      const check = checkStatusMove({ assignMode: existing.assignMode, assigneeId: before.assigneeId }, people, parsed.data.status);
      if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 400 });
    }

    const COMPLETED_STATUSES = ['DONE', 'CLOSED', 'VERIFIED'];
    const wasCompleted = COMPLETED_STATUSES.includes(before.status);
    const isNowCompleted = parsed.data.status ? COMPLETED_STATUSES.includes(parsed.data.status) : wasCompleted;

    const isMovingToDone = parsed.data.status === 'DONE' && before.status !== 'DONE';
    const isClosing      = parsed.data.status === 'CLOSED' && before.status !== 'CLOSED';
    const isReopening    = wasCompleted && !isNowCompleted;

    // Server-side guard: actual effort required to close
    if (isClosing && (!parsed.data.actualMinutes || parsed.data.actualMinutes < 1)) {
      return NextResponse.json(
        { error: 'Actual effort is required to close a task.', code: 'ACTUAL_EFFORT_REQUIRED' },
        { status: 400 },
      );
    }

    // Server-side guard: a blocked task (unmet dependency) cannot start.
    if (parsed.data.status === 'IN_PROGRESS' && user.role !== 'ADMIN') {
      const depTasks = before.dependsOn.length
        ? await prisma.task.findMany({ where: { id: { in: before.dependsOn } }, select: { id: true, status: true } })
        : [];
      if (isTaskBlocked({ dependsOn: before.dependsOn }, depTasks)) {
        return NextResponse.json(
          { error: 'This task is blocked by an unfinished dependency and cannot move to In Progress.', code: 'TASK_BLOCKED' },
          { status: 400 },
        );
      }
    }

    // Server-side guard: reject dependency changes that would create a cycle.
    if (parsed.data.dependsOn) {
      const allTasks = await prisma.task.findMany({
        where:  { deletedAt: { isSet: false } },
        select: { id: true, dependsOn: true },
      });
      for (const depId of parsed.data.dependsOn) {
        if (wouldCreateCycle(params.id, depId, allTasks)) {
          return NextResponse.json(
            { error: `Adding this dependency would create a cycle.`, code: 'DEPENDENCY_CYCLE' },
            { status: 400 },
          );
        }
      }
    }

    // Strip completionNote + bug-specific fields from base update
    const { completionNote, severity, stepsToReproduce, expectedBehavior, actualBehavior, environment, affectedVersion, fixedInVersion, isBugVerified, ...taskFields } = parsed.data as Record<string, unknown> & { completionNote?: string; severity?: BugSeverity; stepsToReproduce?: string[]; expectedBehavior?: string; actualBehavior?: string; environment?: Record<string, string>; affectedVersion?: string; fixedInVersion?: string; isBugVerified?: boolean };

    const updateData: Parameters<typeof prisma.task.update>[0]['data'] = {
      ...taskFields,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    };

    // Strict security: non-admins cannot change task amount
    if (user.role !== 'ADMIN') {
      delete (updateData as Record<string, unknown>).amount;
    }

    // Who owns a shared task is managed through its people list, not the assignee field.
    if (mode === 'TOGETHER') delete updateData.assigneeId;
    // An admin assigning an open offer by hand settles it: that person now owns it.
    const closesOffer = mode === 'OFFER' && !before.assigneeId && !!parsed.data.assigneeId;
    if (closesOffer) updateData.assignMode = 'SINGLE';

    // ── Task Timer & Performance Points logic (In Progress -> Internal Review) ──
    // 1. When an employee moves a task to IN_PROGRESS, the timer starts
    if (parsed.data.status === 'IN_PROGRESS' && before.status !== 'IN_PROGRESS') {
      const timerStart = new Date();
      updateData.timerStartedAt = timerStart;
      updateData.inProgressAt   = timerStart;
    }

    // 2. When an employee moves a task to INTERNAL_REVIEW, the timer stops and points are awarded
    if (parsed.data.status === 'INTERNAL_REVIEW' && before.status !== 'INTERNAL_REVIEW') {
      const timerStop = new Date();
      updateData.timerStoppedAt   = timerStop;
      updateData.internalReviewAt = timerStop;

      const startTime = before.timerStartedAt ?? before.inProgressAt ?? before.createdAt;
      const elapsedMs = Math.max(0, timerStop.getTime() - new Date(startTime).getTime());
      const elapsedMinutes = Math.round(elapsedMs / 60000);
      const lunchPauseMinutes = before.assigneeId
        ? await getLunchPauseMinutes(before.assigneeId, new Date(startTime), timerStop)
        : 0;
      const timeTakenMinutes = Math.max(1, elapsedMinutes - lunchPauseMinutes);
      updateData.timeTakenMinutes = timeTakenMinutes;

      if (!before.actualMinutes && !parsed.data.actualMinutes) {
        updateData.actualMinutes = timeTakenMinutes;
      }

      // Calculate employee's performance & automatically assign points based on completion time
      const perf = calculatePerformanceFromTimer(
        timeTakenMinutes,
        before.estimatedMinutes,
        before.dueDate,
        timerStop,
      );
      updateData.performancePoints = perf.points;
      updateData.performanceOutcome = perf.outcome;
    }

    // Changing the assigned time limit must not affect a running timer. If a
    // task was already scored, refresh only its stored score using the new
    // limit and the existing measured duration.
    if (
      parsed.data.estimatedMinutes !== undefined &&
      parsed.data.estimatedMinutes !== before.estimatedMinutes &&
      before.performancePoints != null &&
      before.timeTakenMinutes != null
    ) {
      const completionTime = before.internalReviewAt ?? before.timerStoppedAt ?? before.doneAt ?? before.closedAt ?? new Date();
      const perf = calculatePerformanceFromTimer(
        before.timeTakenMinutes,
        parsed.data.estimatedMinutes,
        before.dueDate,
        completionTime,
      );
      updateData.performancePoints = perf.points;
      updateData.performanceOutcome = perf.outcome;
    }

    if (isMovingToDone) {
      updateData.doneAt   = new Date();
      updateData.doneById = user.id;
    }

    if (isClosing) {
      updateData.closedAt       = new Date();
      updateData.closedById     = user.id;
      updateData.effortVariance = (parsed.data.actualMinutes ?? 0) - (before.estimatedMinutes ?? 0);
      if (!before.doneAt) {
        updateData.doneAt   = new Date();
        updateData.doneById = user.id;
      }
    }

    // Fallback: If moving to DONE or CLOSED and points were not yet calculated, calculate them now
    if ((isMovingToDone || isClosing) && before.performancePoints == null && updateData.performancePoints == null) {
      const compDate = new Date();
      const startTime = before.timerStartedAt ?? before.inProgressAt ?? before.createdAt;
      const elapsedMs = Math.max(0, compDate.getTime() - new Date(startTime).getTime());
      const elapsedMinutes = Math.round(elapsedMs / 60000);
      const lunchPauseMinutes = before.timeTakenMinutes == null && before.assigneeId
        ? await getLunchPauseMinutes(before.assigneeId, new Date(startTime), compDate)
        : 0;
      const timeTakenMinutes = before.timeTakenMinutes ?? Math.max(1, elapsedMinutes - lunchPauseMinutes);
      updateData.timeTakenMinutes = timeTakenMinutes;

      const perf = calculatePerformanceFromTimer(
        timeTakenMinutes,
        before.estimatedMinutes,
        before.dueDate,
        compDate,
      );
      updateData.performancePoints = perf.points;
      updateData.performanceOutcome = perf.outcome;
    }

    if (isReopening) {
      updateData.doneAt         = null;
      updateData.doneById       = null;
      updateData.closedAt       = null;
      updateData.closedById     = null;
      updateData.effortVariance = null;
      updateData.actualMinutes  = null;
    }

    // ── Bug-specific field updates ────────────────────────────────────────────
    if (before.itemType === 'BUG') {
      if (severity !== undefined && severity !== before.severity) {
        updateData.severity = severity;
        await createTaskHistory(
          {
            taskId:      params.id,
            actorId:     user.id,
            action:      'SEVERITY_CHANGED',
            fieldName:   'severity',
            oldValue:    before.severity ? (SEVERITY_CONFIG[before.severity as BugSeverity]?.label ?? String(before.severity)) : 'None',
            newValue:    SEVERITY_CONFIG[severity as BugSeverity]?.label ?? String(severity),
            oldRawValue: before.severity ?? undefined,
            newRawValue: String(severity),
          },
          prisma,
        );
        // Notify assignee + all admins when severity escalates to CRITICAL or HIGH
        if (severity === 'CRITICAL' || severity === 'HIGH') {
          const severityLabel = SEVERITY_CONFIG[severity as BugSeverity]?.label ?? severity;
          const taskForNotif = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true, assigneeId: true } });
          if (taskForNotif?.assigneeId && taskForNotif.assigneeId !== user.id) {
            await createNotification(
              taskForNotif.assigneeId,
              'BUG_SEVERITY_CHANGED',
              `Bug severity escalated to ${severityLabel}`,
              taskForNotif.title,
              `/tasks?task=${params.id}`,
            );
          }
          const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
          for (const admin of admins) {
            if (admin.id !== user.id) {
              await createNotification(
                admin.id,
                'BUG_SEVERITY_CHANGED',
                `Bug severity escalated to ${severityLabel}`,
                taskForNotif?.title ?? 'A bug',
                `/tasks?task=${params.id}`,
              );
            }
          }
        }
      }
      if (stepsToReproduce !== undefined) {
        updateData.stepsToReproduce = stepsToReproduce;
        await createTaskHistory(
          { taskId: params.id, actorId: user.id, action: 'STEPS_UPDATED', metadata: { stepsCount: stepsToReproduce.length } },
          prisma,
        );
      }
      if (environment !== undefined) {
        updateData.environment = environment;
        await createTaskHistory(
          { taskId: params.id, actorId: user.id, action: 'ENVIRONMENT_UPDATED', metadata: { environment } },
          prisma,
        );
      }
      if (fixedInVersion !== undefined) {
        updateData.fixedInVersion = fixedInVersion;
        await createTaskHistory(
          { taskId: params.id, actorId: user.id, action: 'FIXED_VERSION_SET', newValue: fixedInVersion },
          prisma,
        );
      }
      if (affectedVersion !== undefined) {
        updateData.affectedVersion = affectedVersion;
        await createTaskHistory(
          { taskId: params.id, actorId: user.id, action: 'AFFECTED_VERSION_SET', newValue: affectedVersion },
          prisma,
        );
      }
      if (expectedBehavior !== undefined) updateData.expectedBehavior = expectedBehavior;
      if (actualBehavior   !== undefined) updateData.actualBehavior   = actualBehavior;
    }

    const data = await prisma.task.update({
      where:  { id: params.id },
      data:   updateData,
      select: TASK_DETAIL_SELECT,
    });

    if (closesOffer) {
      await prisma.taskParticipant.deleteMany({ where: { taskId: params.id, kind: 'OFFEREE' } });
    }

    // Resolve new assignee name for history diff
    let afterAssigneeName: string | null = null;
    if (parsed.data.assigneeId && parsed.data.assigneeId !== before.assigneeId) {
      const emp = await prisma.user.findUnique({
        where:  { id: parsed.data.assigneeId },
        select: { name: true },
      });
      afterAssigneeName = emp?.name ?? null;
    }

    // Record all field-level changes
    await recordTaskChanges({
      taskId:  params.id,
      actorId: user.id,
      before: {
        status:           before.status,
        assigneeId:       before.assigneeId,
        assigneeName:     before.assignee?.name ?? null,
        priority:         before.priority,
        title:            before.title,
        description:      before.description,
        dueDate:          before.dueDate,
        estimatedMinutes: before.estimatedMinutes,
        actualMinutes:    before.actualMinutes,
      },
      after: {
        status:           data.status,
        assigneeId:       data.assigneeId,
        assigneeName:     afterAssigneeName ?? before.assignee?.name ?? null,
        priority:         data.priority,
        title:            data.title,
        description:      data.description,
        dueDate:          data.dueDate,
        estimatedMinutes: data.estimatedMinutes,
        actualMinutes:    data.actualMinutes,
      },
      prisma,
    });

    // Milestone: TASK_CLOSED
    if (isClosing) {
      const actualMins = parsed.data.actualMinutes ?? 0;
      await createTaskHistory(
        {
          taskId:   params.id,
          actorId:  user.id,
          action:   'TASK_CLOSED',
          metadata: {
            estimatedMinutes: before.estimatedMinutes,
            actualMinutes:    actualMins,
            effortVariance:   actualMins - (before.estimatedMinutes ?? 0),
            completionNote:   completionNote ?? null,
          },
        },
        prisma,
      );

      // Post completion note as a comment
      if (completionNote?.trim()) {
        await prisma.comment.create({
          data: {
            taskId:   params.id,
            authorId: user.id,
            body:     {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: completionNote.trim() }] }],
            },
            bodyText: completionNote.trim(),
          },
        });
      }
    }

    // Milestone: TASK_REOPENED
    if (isReopening && parsed.data.status) {
      await createTaskHistory(
        {
          taskId:      params.id,
          actorId:     user.id,
          action:      'TASK_REOPENED',
          fieldName:   'status',
          oldValue:    STATUS_LABEL[before.status] ?? before.status,
          newValue:    STATUS_LABEL[parsed.data.status] ?? parsed.data.status,
          oldRawValue: before.status,
          newRawValue: parsed.data.status,
        },
        prisma,
      );
    }

    // Notify new assignee
    const newAssigneeId = parsed.data.assigneeId;
    if (newAssigneeId && newAssigneeId !== before.assigneeId && newAssigneeId !== user.id) {
      const actor = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
      await createNotification(
        newAssigneeId,
        'TASK_ASSIGNED',
        `You were assigned "${data.title}"`,
        `${actor?.name ?? 'Someone'} assigned you a task.`,
        `/tasks?task=${data.id}`,
      );
    }

    // Recompute blocked flag for dependents and notify newly-unblocked assignees.
    if (data.status === 'DONE' && before.status !== 'DONE') {
      const dependents = await prisma.task.findMany({
        where:  { dependsOn: { has: params.id }, deletedAt: { isSet: false } },
        select: { id: true, title: true, assigneeId: true, dependsOn: true },
      });
      if (dependents.length > 0) {
        const depIds = [...new Set(dependents.flatMap((t) => t.dependsOn))];
        const depTasks = await prisma.task.findMany({ where: { id: { in: depIds } }, select: { id: true, status: true } });
        for (const dep of dependents) {
          // "Newly" unblocked: was blocked before this write (using the old status
          // for params.id), and is fully unblocked now (using the fresh statuses).
          const scopeBefore = depTasks.map((t) => t.id === params.id ? { ...t, status: before.status } : t);
          const wasBlocked  = isTaskBlocked(dep, scopeBefore);
          const isBlockedNow = isTaskBlocked(dep, depTasks);
          if (wasBlocked && !isBlockedNow && dep.assigneeId) {
            await createNotification(
              dep.assigneeId,
              'SYSTEM',
              `"${dep.title}" is no longer blocked`,
              `"${data.title}" was marked Done, so this task is now ready to start.`,
              `/tasks?task=${dep.id}`,
            );
          }
        }
      }
    }

    const returnData = user.role === 'ADMIN' ? data : (() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { amount, ...restSafe } = data as typeof data & { amount?: number | null };
      return restSafe;
    })();

    return NextResponse.json({ data: returnData });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const task = await prisma.task.findUnique({
      where:  { id: params.id },
      select: { reporterId: true, assigneeId: true, isPrivate: true, participants: { select: { userId: true } } },
    });
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (task.reporterId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.task.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
