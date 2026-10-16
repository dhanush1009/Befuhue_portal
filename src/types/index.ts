export type { Role, AttendanceType, LeaveType, LeaveStatus, TaskStatus, Priority, PayslipStatus, ItemType, BugSeverity, Team, WorkPhase, ClientStatus, ProjectType, ProjectStatus } from '@prisma/client';
import type { Role, AttendanceType, LeaveType, LeaveStatus, TaskStatus, Priority, PayslipStatus, ItemType, BugSeverity, Team, WorkPhase, ClientStatus, ProjectType, ProjectStatus } from '@prisma/client';

// ── Attendance ────────────────────────────────────────────────────────────────

export interface AttendanceSession {
  id:           string;
  attendanceId: string;
  clockIn:      string;
  clockOut:     string | null;
  durationMins: number | null;
  note:         string | null;
  createdAt:    string;
}

export interface AttendanceLog {
  id:        string;
  userId:    string;
  date:      string;
  type:      AttendanceType;
  ipAddress: string | null;
  location:  string | null;
  createdAt: string;
  sessions:  AttendanceSession[];
  // Computed fields returned by /api/attendance/today
  isActive?:           boolean;
  activeSession?:      AttendanceSession | null;
  totalWorkedMins?:    number;
  totalWorkedDisplay?: string;
  firstClockIn?:       string | null;
  lastClockOut?:       string | null;
}

export interface LeaveBalance {
  earned:  { allowance: number; used: number };
  sick:    { allowance: number; used: number };
  casual:  { allowance: number; used: number };
}

// ── Employee ──────────────────────────────────────────────────────────────────

export interface Employee {
  id:          string;
  email:       string;
  name:        string;
  role:        Role;
  department:  string | null;
  designation: string | null;
  phone:       string | null;
  avatarUrl:   string | null;
  managerId:   string | null;
  createdAt:   Date;
  joiningDate?: Date | null;
  attendanceMode?: 'CLOCK_IN' | 'ANYWHERE' | null;
  manager?:    Pick<Employee, 'id' | 'name' | 'avatarUrl'> | null;
  _count?:     { leaves: number; tasks: number };
}

export interface EmployeeDocument {
  id:         string;
  userId:     string;
  name:       string;
  url:        string;
  mimeType:   string;
  sizeBytes:  number;
  uploadedBy: string;
  createdAt:  Date;
}

// ── Task ──────────────────────────────────────────────────────────────────────

export interface TaskParticipantInfo {
  userId:     string;
  kind:       'COLLABORATOR' | 'OFFEREE';
  role:       string | null;
  partDone:   boolean;
  partDoneAt: Date | string | null;
  user:       { id: string; name: string; avatarUrl: string | null };
}

export interface Task {
  id:               string;
  // Shared work: TOGETHER (each person owns a part) or OFFER (first to accept takes it). null/undefined = one assignee.
  assignMode?:      'SINGLE' | 'TOGETHER' | 'OFFER' | null;
  participants?:    TaskParticipantInfo[];
  humanId:          string;
  title:            string;
  description:      string | null;
  status:           TaskStatus;
  priority:         Priority;
  assigneeId:       string | null;
  reporterId:       string;
  dueDate:          Date | null;
  parentId:         string | null;
  deletedAt:        Date | null;
  estimatedMinutes: number | null;
  actualMinutes:    number | null;
  effortVariance:   number | null;
  closedAt:         Date | null;
  closedById:       string | null;
  // Timer & Performance Scoring (In Progress -> Internal Review)
  inProgressAt?:        Date | string | null;
  timerStartedAt?:      Date | string | null;
  internalReviewAt?:    Date | string | null;
  timerStoppedAt?:      Date | string | null;
  timeTakenMinutes?:    number | null;
  performancePoints?:   number | null;
  performanceOutcome?:  'EARLY' | 'ON_TIME' | 'OVERTIME' | 'LATE' | string | null;
  // Workflow tracking
  reopenCount:      number;
  testedById:       string | null;
  testedAt:         Date | null;
  doneAt:           Date | null;
  doneById:         string | null;
  readyForQaAt:     Date | null;
  readyForQaById:   string | null;
  createdAt:        Date;
  updatedAt:        Date;
  // Bug tracking
  itemType:         ItemType;
  severity:         BugSeverity | null;
  stepsToReproduce: string[] | null;
  expectedBehavior: string | null;
  actualBehavior:   string | null;
  environment:      { browser?: string; os?: string; appVersion?: string; device?: string } | null;
  affectedVersion:  string | null;
  fixedInVersion:   string | null;
  isBugVerified:    boolean;
  verifiedById:     string | null;
  verifiedAt:       Date | null;
  // Visible only to the assignee, reporter, and Admins when true
  isPrivate:             boolean;
  // Agency work-management
  clientId:              string;
  projectId:             string | null;
  team?:                 Team | null;
  phase?:                WorkPhase | null;
  dependsOn:             string[];
  isGate:                boolean;
  needsClientApproval:   boolean;
  reviewerChain:         string[];
  deliverableLinks?:     { label: string; url: string }[] | null;
  deliverableVersion?:   number | null;
  agencyName?:          string | null;
  amount?:              number | null; // Admin only - protected at backend & frontend
  currency?:            string;
  billingReference?:    string | null;
  // Relations
  project?:         { id: string; name: string; prefix: string };
  client?:          Pick<Client, 'id' | 'name'> | null;
  assignee?:        Pick<Employee, 'id' | 'name' | 'avatarUrl'> | null;
  reporter?:        Pick<Employee, 'id' | 'name' | 'avatarUrl'>;
  closedBy?:        Pick<Employee, 'id' | 'name'> | null;
  testedBy?:        Pick<Employee, 'id' | 'name'> | null;
  doneBy?:          Pick<Employee, 'id' | 'name'> | null;
  verifiedBy?:      Pick<Employee, 'id' | 'name'> | null;
  subTasks?:        Pick<Task, 'id' | 'humanId' | 'title' | 'status'>[];
  comments?:        TaskComment[];
  history?:         TaskHistory[];
  _count?:          { comments: number; subTasks: number };
}

// ── Agency work-management: Client / Project ─────────────────────────────────

export interface Client {
  id:            string;
  name:          string;
  logoUrl:       string | null;
  industry:      string | null;
  website:       string | null;
  contactName:   string | null;
  contactEmail:  string | null;
  contactPhone:  string | null;
  notes:         string | null;
  accountLeadId: string | null;
  status:        ClientStatus;
  createdAt:     Date;
  clientType?:         string | null;
  billingReference?:   string | null;
  billingType?:        string | null;
  billingCurrency?:    string | null;
  billingAmount?:      number | null;
  billingCycle?:       string | null;
  paymentTerms?:       string | null;
  taxId?:              string | null;
  billingEmail?:       string | null;
  billingAddress?:     string | null;
  invoices?:           ClientInvoice[];
  accountLead?:  Pick<Employee, 'id' | 'name' | 'avatarUrl'> | null;
  projects?:     (Project & { _count?: { tasks: number } })[];
  _count?:       { projects: number; tasks: number; invoices?: number };
}

export interface ClientInvoice {
  id:            string;
  clientId:      string;
  invoiceNumber: string;
  title:         string;
  amount:        number;
  currency:      string;
  status:        'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issueDate:     string | Date;
  dueDate?:      string | Date | null;
  paidDate?:     string | Date | null;
  paymentMethod?: string | null;
  notes?:        string | null;
  createdAt:     string | Date;
  updatedAt:     string | Date;
}

export interface ClientBillingSummary {
  id:               string;
  name:             string;
  clientType:       'CLIENT' | 'AGENCY';
  agencyName?:      string | null;
  billingReference?: string | null;
  logoUrl?:         string | null;
  industry?:        string | null;
  contactName?:     string | null;
  contactEmail?:    string | null;
  totalTasks:       number;
  completedTasks:   number;
  inProgressTasks:  number;
  pendingTasks:     number;
  totalBilling:     number;
  currency:         string;
}

export interface AgencyBillingSummary {
  id: string;
  name: string;
  clientType?: 'AGENCY' | 'CLIENT';
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalBilling: number;
  currency: string;
  logoUrl?: string | null;
  billingReference?: string | null;
}

export interface AgencyProjectSummary {
  id: string;
  name: string;
  prefix: string;
  clientName: string | null;
  clientId: string | null;
  clientType?: string | null;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  totalBilling: number;
  currency: string;
  status: string;
}

export interface ProjectBillingTask {
  id: string;
  humanId: string;
  title: string;
  assignee: {
    id: string;
    name: string;
    avatarUrl: string | null;
    designation: string | null;
  } | null;
  assignedDate: string;
  dueDate: string | null;
  status: string;
  amount: number;
  currency: string;
}

export interface ProjectBillingDetail {
  agency: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
    prefix: string;
    clientName: string | null;
    status: string;
  };
  summary: {
    totalTasks: number;
    completedTasks: number;
    totalBilling: number;
    currency: string;
  };
  tasks: ProjectBillingTask[];
}

export interface TaskHistory {
  id:          string;
  taskId:      string;
  actorId:     string;
  action:      string;
  fieldName:   string | null;
  oldValue:    string | null;
  newValue:    string | null;
  oldRawValue: string | null;
  newRawValue: string | null;
  metadata:    Record<string, unknown> | null;
  createdAt:   Date;
  actor?:      Pick<Employee, 'id' | 'name' | 'avatarUrl'>;
}

export interface TaskComment {
  id:        string;
  taskId:    string;
  authorId:  string;
  body:      Record<string, unknown>;
  bodyText:  string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author?:   Pick<Employee, 'id' | 'name' | 'avatarUrl' | 'designation'>;
  mentions?: { userId: string; user?: Pick<Employee, 'id' | 'name'> }[];
}

export interface Project {
  id:                  string;
  clientId:            string;
  name:                string;
  description:         string | null;
  prefix:              string;
  type:                ProjectType;
  templateId:          string | null;
  startDate:           Date | string | null;
  targetDate:          Date | string | null;
  deadline?:           Date | string | null;
  status:              ProjectStatus;
  assignedEmployeeId?: string | null;
  assignedEmployee?:   Pick<Employee, 'id' | 'name' | 'email' | 'avatarUrl' | 'designation'> | null;
  amount?:             number | null; // Admin only - protected at backend & frontend
  currency?:           string;
  createdAt:           Date | string;
  updatedAt:           Date | string;
  client?:             Pick<Client, 'id' | 'name'>;
  _count?:             { tasks: number };
  // Computed, not stored — see src/lib/engagementHealth.ts
  health?:             'on_track' | 'at_risk' | 'blocked';
  percentDone?:        number;
}

// ── Leave ─────────────────────────────────────────────────────────────────────

export interface Leave {
  id:          string;
  userId:      string;
  type:        LeaveType;
  fromDate:    Date;
  toDate:      Date;
  days:        number;
  reason:      string;
  status:      LeaveStatus;
  approvedBy:  string | null;
  rejectedBy:  string | null;
  remarks:     string | null;
  documentUrl: string | null;
  createdAt:   Date;
  user?:       Pick<Employee, 'id' | 'name' | 'avatarUrl'>;
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export interface EmployeeSalary {
  id:               string;
  userId:           string;
  basic:            number;
  hra:              number;
  conveyance:       number;
  medicalAllowance: number;
  specialAllowance: number;
  bonus:            number;
  incentive:        number;
  incomeTax:        number;
  providentFund:    number;
  esi:              number;
  professionalTax:  number;
  otherDeductions:  number;
  effectiveFrom:    Date;
  createdAt:        Date;
  updatedAt:        Date;
}

export interface Payslip {
  id:                 string;
  userId:             string;
  employeeId:         string;
  month:              number;
  year:               number;
  payPeriod:          string;
  payDate:            Date;
  employeeName:       string;
  designation:        string;
  department:         string;
  totalDays:          number;
  workingDays:        number;
  paidDays:           number;
  lopDays:            number;
  earnedLeaveUsed:    number;
  earnedLeaveBalance: number;
  basic:              number;
  hra:                number;
  conveyance:         number;
  medicalAllowance:   number;
  specialAllowance:   number;
  bonus:              number;
  incentive:          number;
  grossEarnings:      number;
  incomeTax:          number;
  providentFund:      number;
  esi:                number;
  professionalTax:    number;
  otherDeductions:    number;
  lopDeduction:       number;
  totalDeductions:    number;
  totalNetPay:        number;
  amountInWords:      string;
  status:             PayslipStatus;
  publishedAt:        Date | null;
  createdAt:          Date;
  updatedAt:          Date;
  user?:              Pick<Employee, 'id' | 'name' | 'avatarUrl' | 'designation' | 'department'>;
}

export interface LeaveBalanceRecord {
  id:              string;
  userId:          string;
  year:            number;
  earnedLeave:     number;
  usedEarnedLeave: number;
  lopDays:         number;
  createdAt:       Date;
  updatedAt:       Date;
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

export * from './report';

