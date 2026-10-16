import type { Team } from '@prisma/client';

export interface TeamConfig {
  label:   string;
  chipCls: string; // bg + text, light & dark
}

export const TEAM_CONFIG: Record<Team, TeamConfig> = {
  MARKETING: { label: 'Marketing', chipCls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  DESIGN:    { label: 'Design',    chipCls: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300' },
  DEV:       { label: 'Dev',       chipCls: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
};

export const PHASE_LABEL: Record<string, string> = {
  RESEARCH: 'Research',
  FORECAST: 'Forecast',
  BUILD:    'Build',
  LAUNCH:   'Launch',
  OPTIMIZE: 'Optimize',
};
