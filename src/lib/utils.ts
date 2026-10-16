import { format, isValid } from 'date-fns';

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date | string | null | undefined, pattern = 'MMM dd, yyyy'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, pattern) : '—';
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '-- : --';
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, 'hh:mm a') : '-- : --';
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Count weekdays (Mon–Fri) between two dates, inclusive. */
export function calculateWorkingDays(from: Date, to: Date, holidayKeys?: ReadonlySet<string>): number {
  let count = 0;
  const current = new Date(from);
  while (current <= to) {
    const day = current.getDay();
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (day !== 0 && day !== 6 && !holidayKeys?.has(key)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
