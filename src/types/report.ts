export interface ReportMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  designation: string;
  department: string;
  tasksAssigned: number;
  tasksCompleted: number;       // reached requiresActualEffort or isEndStage
  tasksInProgress: number;
  estimatedMinutes: number;     // sum of estimated effort for their tasks
  actualMinutes: number;        // sum of actual effort logged
  contributionPercent: number;  // their actual effort / total actual effort * 100
}

export interface ReportTask {
  id: string;
  taskId: string;               // e.g. PROJ-042
  title: string;
  itemType: 'TASK' | 'BUG' | 'DELIVERABLE';
  priority: string;
  severity?: string;            // bugs only
  assignee: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  reporter: {
    id: string;
    name: string;
  };
  startStage: string;           // stage name at start of month (or creation stage)
  endStage: string;             // stage name at end of month (or current)
  estimatedMinutes: number;
  actualMinutes: number | null;
  completedAt: Date | null;     // date moved to requiresActualEffort stage
  closedAt: Date | null;
  stageTransitions: {
    from: string;
    to: string;
    by: string;
    at: Date;
  }[];
  commentCount: number;
  wasCreatedThisMonth: boolean;
  wasCompletedThisMonth: boolean;
  wasClosedThisMonth: boolean;
}

export interface ReportStageBreakdown {
  stageName: string;
  stageColor: string;
  taskCount: number;
  bugCount: number;
  totalItems: number;
}

export interface ReportBugSummary {
  totalReported: number;
  totalFixed: number;           // reached verified stage this month
  totalVerified: number;
  totalReopened: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  avgTimeToFix: number | null;  // average minutes from OPEN to VERIFIED
}

export interface ReportEffortSummary {
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  varianceMinutes: number;      // actual - estimated
  variancePercent: number;      // (actual - estimated) / estimated * 100
  completionRate: number;       // completed tasks / total tasks * 100
  memberEffort: {
    userId: string;
    name: string;
    estimatedMinutes: number;
    actualMinutes: number;
    taskCount: number;
  }[];
}

export interface ProjectReportData {
  // Meta
  reportId?: string;
  projectId: string;
  projectName: string;
  projectDescription: string | null;
  month: number;
  year: number;
  monthLabel: string;           // e.g. "June 2026"
  generatedAt: Date;
  generatedBy: string;
  
  // Company info (for PDF header)
  companyName: string;
  companyLogo: string | null;
  
  // Summary
  totalTasks: number;
  totalBugs: number;
  totalItems: number;
  completedItems: number;
  completionRate: number;
  workingDaysInMonth: number;
  
  // Sections
  members: ReportMember[];
  tasks: ReportTask[];
  stageBreakdown: ReportStageBreakdown[];
  bugSummary: ReportBugSummary | null;  // null if no bugs in project
  effortSummary: ReportEffortSummary;
  
  // Notes
  adminNotes: string | null;
}
