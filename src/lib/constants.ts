export const LEAVE_TYPES = [
  { value: 'EARNED',    label: 'Earned Leave',       color: '#8E51FF' },
  { value: 'SICK',      label: 'Sick Leave',          color: '#16A34A' },
  { value: 'CASUAL',    label: 'Casual Leave',        color: '#D97706' },
  { value: 'LOP',       label: 'Loss of Pay',         color: '#DC2626' },
  { value: 'COMP_OFF',  label: 'Compensatory Off',    color: '#7C3AED' },
  { value: 'MATERNITY', label: 'Maternity Leave',     color: '#0891B2' },
  { value: 'PATERNITY', label: 'Paternity Leave',     color: '#0891B2' },
] as const;

export const TASK_STATUSES = [
  { value: 'TO_DO',        label: 'To Do',         color: '#6B7280' },
  { value: 'OPEN',         label: 'Open',          color: '#6B7280' },
  { value: 'IN_PROGRESS',  label: 'In Progress',   color: '#2563EB' },
  { value: 'READY_FOR_QA', label: 'Ready for QA',  color: '#D97706' },
  { value: 'IN_TESTING',   label: 'In Testing',    color: '#0F9B8E' },
  { value: 'DONE',         label: 'Done',          color: '#16A34A' },
  { value: 'VERIFIED',     label: 'Verified',      color: '#16A34A' },
  { value: 'CLOSED',       label: 'Closed',        color: '#9CA3AF' },
] as const;

// Task-only statuses (for TaskForm default status picker)
export const TASK_ONLY_STATUSES = [
  { value: 'TO_DO',        label: 'To Do',        color: '#6B7280' },
  { value: 'IN_PROGRESS',  label: 'In Progress',  color: '#2563EB' },
  { value: 'READY_FOR_QA', label: 'Ready for QA', color: '#D97706' },
  { value: 'IN_TESTING',   label: 'In Testing',   color: '#0F9B8E' },
  { value: 'DONE',         label: 'Done',         color: '#16A34A' },
  { value: 'CLOSED',       label: 'Closed',       color: '#9CA3AF' },
] as const;

// Bug-only statuses
export const BUG_ONLY_STATUSES = [
  { value: 'OPEN',         label: 'Open',         color: '#6B7280' },
  { value: 'IN_PROGRESS',  label: 'In Progress',  color: '#2563EB' },
  { value: 'READY_FOR_QA', label: 'Ready for QA', color: '#D97706' },
  { value: 'IN_TESTING',   label: 'In Testing',   color: '#0F9B8E' },
  { value: 'VERIFIED',     label: 'Verified',     color: '#16A34A' },
  { value: 'CLOSED',       label: 'Closed',       color: '#9CA3AF' },
] as const;

export const PRIORITY_LEVELS = [
  { value: 'P0', label: 'Critical', color: '#DC2626' },
  { value: 'P1', label: 'High',     color: '#D97706' },
  { value: 'P2', label: 'Medium',   color: '#2563EB' },
  { value: 'P3', label: 'Low',      color: '#6B7280' },
] as const;

export const DEPARTMENTS = [
  'Junior Video Editor',
  'Senior Video Editor',
  'Creative Editor',
  'Content Writer',
  'Graphic Designer',
  'SEO Expert',
  'Meta Manager',
  'Performance Marketer',
  'SEO Executive',
  'Sales Executive',
  'Engineering',
  'Design',
  'Product',
  'Quality Assurance',
  'Marketing',
  'Sales',
  'Human Resources',
  'Finance',
  'Operations',
  'Technology',
] as const;

export const LEAVE_ALLOWANCES: Record<string, number> = {
  EARNED:  24,
  SICK:    12,
  CASUAL:   8,
};

export const ATTENDANCE_TYPES = [
  { value: 'OFFICE',   label: 'Office' },
  { value: 'WFH',      label: 'Work From Home' },
  { value: 'HALF_DAY', label: 'Half Day' },
] as const;

// Payroll
export const EARNED_LEAVE_PER_MONTH = 1; // 1 earned leave credited on 1st of every month

export const PAYSLIP_STATUS_LABELS: Record<string, string> = {
  DRAFT:     'Draft',
  PUBLISHED: 'Published',
  VOID:      'Void',
};

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const;
