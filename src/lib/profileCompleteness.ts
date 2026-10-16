import type { MyProfile } from '@/types/profile';

interface CompletenessResult {
  percentage:     number;
  nextSuggestion: { text: string; tab: string; field: string } | null;
}

export function calculateProfileCompleteness(user: MyProfile): CompletenessResult {
  const checks = [
    {
      met:        !!user.avatarUrl,
      points:     15,
      suggestion: { text: 'Add a profile photo',      tab: 'personal', field: 'avatar' },
    },
    {
      met:        !!user.phone,
      points:     15,
      suggestion: { text: 'Add your phone number',    tab: 'personal', field: 'phone' },
    },
    {
      met:        !!user.designation,
      points:     10,
      suggestion: { text: 'Add your designation',     tab: 'work',     field: 'designation' },
    },
    {
      met:        !!user.department,
      points:     10,
      suggestion: { text: 'Add your department',      tab: 'work',     field: 'department' },
    },
    {
      met:        !!user.employmentType,
      points:     10,
      suggestion: { text: 'Set your employment type', tab: 'work',     field: 'employmentType' },
    },
    {
      met:        !!user.manager,
      points:     10,
      suggestion: { text: 'Set your reporting manager', tab: 'work',   field: 'manager' },
    },
    {
      met:        user.detailsPercent >= 80,
      points:     5,
      suggestion: { text: `Complete your HR details (${user.detailsPercent}% done)`, tab: 'details', field: 'details' },
    },
    {
      met:        !!user.fatherName,
      points:     5,
      suggestion: { text: "Add your father's name",    tab: 'personal', field: 'fatherName' },
    },
    {
      met:        user.passwordSetBy === 'SELF' || !!user.passwordChangedAt,
      points:     30,
      suggestion: { text: 'Set your own password',    tab: 'security', field: 'password' },
    },
  ] as const;

  const total  = checks.reduce((s, c) => s + c.points, 0);
  const earned = checks.filter((c) => c.met).reduce((s, c) => s + c.points, 0);
  const nextSuggestion = (checks as readonly { met: boolean; points: number; suggestion: { text: string; tab: string; field: string } }[]).find((c) => !c.met)?.suggestion ?? null;

  return {
    percentage:     Math.round((earned / total) * 100),
    nextSuggestion,
  };
}
