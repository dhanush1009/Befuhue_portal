import { PrismaClient, TaskStatus } from '@prisma/client';
import {
  startOfMonth,
  endOfMonth,
  format,
  getDaysInMonth,
  getDay,
  differenceInMinutes,
  isWithinInterval,
} from 'date-fns';
import type {
  ProjectReportData,
  ReportMember,
  ReportTask,
  ReportStageBreakdown,
  ReportBugSummary,
  ReportEffortSummary,
} from '@/types/report';
import { TASK_STATUS_CONFIG } from '@/lib/taskStatusConfig';

const STATUS_STAGE_COLORS: Record<TaskStatus, string> = {
  TO_DO: '#64748B',
  OPEN: '#64748B',
  IN_PROGRESS: '#2563EB',
  INTERNAL_REVIEW: '#D97706',
  CLIENT_REVIEW: '#0D9488',
  READY_FOR_QA: '#D97706',
  IN_TESTING: '#0D9488',
  DONE: '#16A34A',
  VERIFIED: '#16A34A',
  CLOSED: '#475569',
};

function getStatusLabel(status: TaskStatus | string): string {
  if (status in TASK_STATUS_CONFIG) {
    return TASK_STATUS_CONFIG[status as TaskStatus].label;
  }
  return status;
}

export async function generateProjectReport(
  projectId: string,
  month: number,
  year: number,
  prisma: PrismaClient,
  generatedByName: string
): Promise<ProjectReportData> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthLabel = format(monthStart, 'MMMM yyyy');

  // ── 1. Fetch project ──
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new Error('Project not found.');

  // Fetch all users to have potential project members available
  const allUsers = await prisma.user.findMany({
    where: { isActive: true, deletedAt: { isSet: false } },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      designation: true,
      department: true,
    },
  });

  // ── 2. Fetch all tasks active in this month ──
  // A task is "active this month" if:
  // - created in this month, OR
  // - has a history entry (stage transition/comment) in this month, OR
  // - was completed/closed in this month
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: { isSet: false },
      OR: [
        // Created this month
        { createdAt: { gte: monthStart, lte: monthEnd } },
        // Had a stage transition this month
        {
          history: {
            some: {
              createdAt: { gte: monthStart, lte: monthEnd },
              action: 'STATUS_CHANGED',
            },
          },
        },
        // Was completed this month
        { doneAt: { gte: monthStart, lte: monthEnd } },
        // Was closed this month
        { closedAt: { gte: monthStart, lte: monthEnd } },
        // Had comments this month
        {
          comments: {
            some: { createdAt: { gte: monthStart, lte: monthEnd } },
          },
        },
      ],
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true, designation: true, department: true } },
      reporter: { select: { id: true, name: true } },
      history: {
        where: {
          action: 'STATUS_CHANGED',
        },
        include: {
          actor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      comments: {
        where: { deletedAt: { isSet: false } },
        select: { id: true },
      },
      closedBy: { select: { id: true, name: true } },
      doneBy: { select: { id: true, name: true } },
    },
  });

  // ── 3. Fetch company settings for PDF branding ──
  const companySettings = await prisma.companySettings.findFirst();

  // ── 4. Build ReportTask array ──
  const reportTasks: ReportTask[] = tasks.map((task) => {
    const startStage = getStageAtStartOfMonth(task, monthStart);
    const endStage = getStatusLabel(task.status);

    const monthTransitions = task.history
      .filter(
        (h) =>
          h.action === 'STATUS_CHANGED' &&
          isWithinInterval(new Date(h.createdAt), { start: monthStart, end: monthEnd })
      )
      .map((h) => ({
        from: h.oldValue ? getStatusLabel(h.oldValue) : '',
        to: h.newValue ? getStatusLabel(h.newValue) : '',
        by: h.actor.name,
        at: new Date(h.createdAt),
      }));

    return {
      id: task.id,
      taskId: task.humanId || generateTaskId(task, project),
      title: task.title,
      itemType: task.itemType,
      priority: task.priority,
      severity: task.severity ?? undefined,
      assignee: task.assignee
        ? {
            id: task.assignee.id,
            name: task.assignee.name,
            avatarUrl: task.assignee.avatarUrl,
          }
        : null,
      reporter: task.reporter,
      startStage,
      endStage,
      estimatedMinutes: task.estimatedMinutes ?? 0,
      actualMinutes: task.actualMinutes,
      completedAt: task.doneAt,
      closedAt: task.closedAt,
      stageTransitions: monthTransitions,
      commentCount: task.comments.length,
      wasCreatedThisMonth: isWithinInterval(new Date(task.createdAt), {
        start: monthStart,
        end: monthEnd,
      }),
      wasCompletedThisMonth: task.doneAt
        ? isWithinInterval(new Date(task.doneAt), { start: monthStart, end: monthEnd })
        : false,
      wasClosedThisMonth: task.closedAt
        ? isWithinInterval(new Date(task.closedAt), { start: monthStart, end: monthEnd })
        : false,
    };
  });

  // ── 5. Build ReportMember array ──
  const memberMap = new Map<string, ReportMember>();

  // Add all users to the candidate map
  for (const u of allUsers) {
    memberMap.set(u.id, {
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      designation: u.designation ?? '',
      department: u.department ?? '',
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksInProgress: 0,
      estimatedMinutes: 0,
      actualMinutes: 0,
      contributionPercent: 0,
    });
  }

  // Accumulate task data into member stats
  const totalActualMinutes = reportTasks.reduce(
    (sum, t) => sum + (t.actualMinutes ?? 0),
    0
  );

  for (const task of reportTasks) {
    if (!task.assignee) continue;
    let member = memberMap.get(task.assignee.id);
    if (!member) {
      member = {
        userId: task.assignee.id,
        name: task.assignee.name,
        avatarUrl: task.assignee.avatarUrl,
        designation: '',
        department: '',
        tasksAssigned: 0,
        tasksCompleted: 0,
        tasksInProgress: 0,
        estimatedMinutes: 0,
        actualMinutes: 0,
        contributionPercent: 0,
      };
      memberMap.set(task.assignee.id, member);
    }

    member.tasksAssigned++;
    member.estimatedMinutes += task.estimatedMinutes;
    member.actualMinutes += task.actualMinutes ?? 0;

    const isCompleted =
      task.endStage.toLowerCase().includes('done') ||
      task.endStage.toLowerCase().includes('verified') ||
      task.endStage.toLowerCase().includes('closed');

    if (isCompleted) {
      member.tasksCompleted++;
    } else {
      member.tasksInProgress++;
    }
  }

  // Calculate contribution percent
  for (const member of memberMap.values()) {
    member.contributionPercent =
      totalActualMinutes > 0
        ? Math.round((member.actualMinutes / totalActualMinutes) * 100)
        : 0;
  }

  const members = Array.from(memberMap.values())
    .filter(
      (m) => m.tasksAssigned > 0 || tasks.some((t) => t.assignee?.id === m.userId)
    )
    .sort((a, b) => b.actualMinutes - a.actualMinutes);

  // ── 6. Stage breakdown ──
  const allStages = [
    { name: 'To Do', color: STATUS_STAGE_COLORS.TO_DO },
    { name: 'Open', color: STATUS_STAGE_COLORS.OPEN },
    { name: 'In Progress', color: STATUS_STAGE_COLORS.IN_PROGRESS },
    { name: 'Ready for QA', color: STATUS_STAGE_COLORS.READY_FOR_QA },
    { name: 'In Testing', color: STATUS_STAGE_COLORS.IN_TESTING },
    { name: 'Done', color: STATUS_STAGE_COLORS.DONE },
    { name: 'Verified', color: STATUS_STAGE_COLORS.VERIFIED },
    { name: 'Closed', color: STATUS_STAGE_COLORS.CLOSED },
  ];

  const stageBreakdown: ReportStageBreakdown[] = allStages
    .map((stage) => {
      const taskCount = reportTasks.filter(
        (t) => t.itemType === 'TASK' && t.endStage.toLowerCase() === stage.name.toLowerCase()
      ).length;
      const bugCount = reportTasks.filter(
        (t) => t.itemType === 'BUG' && t.endStage.toLowerCase() === stage.name.toLowerCase()
      ).length;
      return {
        stageName: stage.name,
        stageColor: stage.color,
        taskCount,
        bugCount,
        totalItems: taskCount + bugCount,
      };
    })
    .filter((s) => s.totalItems > 0);

  // ── 7. Bug summary ──
  const bugs = reportTasks.filter((t) => t.itemType === 'BUG');
  const bugSummary: ReportBugSummary | null =
    bugs.length > 0
      ? {
          totalReported: bugs.filter((b) => b.wasCreatedThisMonth).length,
          totalFixed: bugs.filter(
            (b) =>
              b.endStage.toLowerCase().includes('verified') ||
              b.endStage.toLowerCase().includes('done') ||
              b.endStage.toLowerCase().includes('closed')
          ).length,
          totalVerified: bugs.filter((b) => b.wasCompletedThisMonth).length,
          totalReopened: bugs.reduce((sum, b) => {
            const reopens = b.stageTransitions.filter(
              (t) =>
                t.from.toLowerCase().includes('verified') ||
                t.from.toLowerCase().includes('closed')
            ).length;
            return sum + reopens;
          }, 0),
          criticalCount: bugs.filter((b) => b.severity === 'CRITICAL').length,
          highCount: bugs.filter((b) => b.severity === 'HIGH').length,
          mediumCount: bugs.filter((b) => b.severity === 'MEDIUM').length,
          lowCount: bugs.filter((b) => b.severity === 'LOW').length,
          avgTimeToFix: calculateAvgTimeToFix(bugs, tasks),
        }
      : null;

  // ── 8. Effort summary ──
  const totalEstimated = reportTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const totalActual = reportTasks.reduce(
    (s, t) => s + (t.actualMinutes ?? 0),
    0
  );
  const completedItems = reportTasks.filter(
    (t) =>
      t.endStage.toLowerCase().includes('done') ||
      t.endStage.toLowerCase().includes('verified') ||
      t.endStage.toLowerCase().includes('closed')
  ).length;

  const effortSummary: ReportEffortSummary = {
    totalEstimatedMinutes: totalEstimated,
    totalActualMinutes: totalActual,
    varianceMinutes: totalActual - totalEstimated,
    variancePercent:
      totalEstimated > 0
        ? Math.round(((totalActual - totalEstimated) / totalEstimated) * 100)
        : 0,
    completionRate:
      reportTasks.length > 0
        ? Math.round((completedItems / reportTasks.length) * 100)
        : 0,
    memberEffort: members.map((m) => ({
      userId: m.userId,
      name: m.name,
      estimatedMinutes: m.estimatedMinutes,
      actualMinutes: m.actualMinutes,
      taskCount: m.tasksAssigned,
    })),
  };

  return {
    projectId,
    projectName: project.name,
    projectDescription: project.description ?? null,
    month,
    year,
    monthLabel,
    generatedAt: new Date(),
    generatedBy: generatedByName,
    companyName: companySettings?.name ?? 'Deep Impression',
    companyLogo: companySettings?.logoUrl ?? null,
    totalTasks: reportTasks.filter((t) => t.itemType === 'TASK').length,
    totalBugs: reportTasks.filter((t) => t.itemType === 'BUG').length,
    totalItems: reportTasks.length,
    completedItems,
    completionRate: effortSummary.completionRate,
    workingDaysInMonth: getWorkingDaysInMonth(month, year),
    members,
    tasks: reportTasks.sort(
      (a, b) =>
        new Date(a.completedAt ?? b.completedAt ?? 0).getTime() -
        new Date(b.completedAt ?? a.completedAt ?? 0).getTime()
    ),
    stageBreakdown,
    bugSummary,
    effortSummary,
    adminNotes: null,
  };
}

// Helper: get stage name at start of month from history
function getStageAtStartOfMonth(
  task: {
    status: TaskStatus;
    itemType: string;
    history: Array<{ action: string; createdAt: Date; newValue?: string | null }>;
  },
  monthStart: Date
): string {
  const transitionsBeforeMonth = task.history
    .filter(
      (h) =>
        h.action === 'STATUS_CHANGED' && new Date(h.createdAt) < monthStart
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  if (transitionsBeforeMonth.length > 0) {
    const rawVal = transitionsBeforeMonth[0].newValue;
    return rawVal ? getStatusLabel(rawVal) : 'Unknown';
  }

  // Task was created this month — default start stage
  return task.itemType === 'BUG' ? 'Open' : 'To Do';
}

// Helper: generate task ID string
function generateTaskId(
  task: { id: string; humanId?: string | null },
  project: { name: string; prefix?: string | null }
): string {
  if (task.humanId) return task.humanId;
  const prefix = (project.prefix || project.name.slice(0, 4))
    .toUpperCase()
    .replace(/\s/g, '');
  return `${prefix}-${String(task.id).slice(-4).toUpperCase()}`;
}

// Helper: average time to fix bugs (open → verified) in minutes
function calculateAvgTimeToFix(
  bugs: ReportTask[],
  allTasks: Array<{ id: string; createdAt: Date }>
): number | null {
  const fixedBugs = bugs.filter((b) => b.completedAt && b.wasCompletedThisMonth);
  if (fixedBugs.length === 0) return null;

  const totalMins = fixedBugs.reduce((sum, bug) => {
    const original = allTasks.find((t) => t.id === bug.id);
    if (!original || !bug.completedAt) return sum;
    const createdAt = new Date(original.createdAt);
    const fixedAt = new Date(bug.completedAt);
    return sum + differenceInMinutes(fixedAt, createdAt);
  }, 0);

  return Math.round(totalMins / fixedBugs.length);
}

// Helper: calculate working days (Mon-Sat) in month
function getWorkingDaysInMonth(month: number, year: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = getDay(new Date(year, month - 1, d));
    // 0 is Sunday
    if (dayOfWeek !== 0) {
      count++;
    }
  }
  return count;
}
