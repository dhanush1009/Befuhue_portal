import type { BugSeverity } from '@prisma/client';

export const SEVERITY_CONFIG: Record<BugSeverity, {
  label:       string;
  color:       string;
  bgColor:     string;
  borderColor: string;
  dotColor:    string;
  icon:        string;
  description: string;
}> = {
  CRITICAL: {
    label:       'Critical',
    color:       'text-red-700',
    bgColor:     'bg-red-50',
    borderColor: 'border-red-200',
    dotColor:    'bg-red-500',
    icon:        '🔴',
    description: 'System down, data loss, blocking all users',
  },
  HIGH: {
    label:       'High',
    color:       'text-orange-700',
    bgColor:     'bg-orange-50',
    borderColor: 'border-orange-200',
    dotColor:    'bg-orange-500',
    icon:        '🟠',
    description: 'Major feature broken, no workaround available',
  },
  MEDIUM: {
    label:       'Medium',
    color:       'text-yellow-700',
    bgColor:     'bg-yellow-50',
    borderColor: 'border-yellow-200',
    dotColor:    'bg-yellow-400',
    icon:        '🟡',
    description: 'Feature partially broken, workaround exists',
  },
  LOW: {
    label:       'Low',
    color:       'text-blue-700',
    bgColor:     'bg-blue-50',
    borderColor: 'border-blue-200',
    dotColor:    'bg-blue-400',
    icon:        '🔵',
    description: 'Minor issue, cosmetic, low user impact',
  },
};

export const BROWSER_OPTIONS = [
  'Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Samsung Internet', 'Other',
] as const;

export const OS_OPTIONS = [
  'Windows 11', 'Windows 10', 'macOS', 'Ubuntu', 'iOS', 'Android', 'Other',
] as const;

export const DEVICE_OPTIONS = [
  'Desktop', 'Laptop', 'Mobile', 'Tablet', 'Other',
] as const;

export function getSeverityBadgeClass(severity: BugSeverity): string {
  const config = SEVERITY_CONFIG[severity];
  return `${config.bgColor} ${config.color} border ${config.borderColor}`;
}

export function validateBugFields(data: {
  severity?:        string;
  stepsToReproduce?: string[];
  expectedBehavior?: string;
  actualBehavior?:   string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!data.severity) errors.severity = 'Severity is required.';
  if (!data.stepsToReproduce?.length || data.stepsToReproduce.every((s) => !s.trim())) {
    errors.stepsToReproduce = 'At least one step to reproduce is required.';
  }
  if (!data.expectedBehavior?.trim()) errors.expectedBehavior = 'Expected behavior is required.';
  if (!data.actualBehavior?.trim())   errors.actualBehavior   = 'Actual behavior is required.';
  return { valid: Object.keys(errors).length === 0, errors };
}
