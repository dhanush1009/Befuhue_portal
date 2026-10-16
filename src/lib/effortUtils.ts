// ── Effort conversion ─────────────────────────────────────────────────────────

export function toTotalMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

export function fromTotalMinutes(totalMinutes: number): { hours: number; minutes: number } {
  return {
    hours:   Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function formatEffort(totalMinutes: number): string {
  if (totalMinutes === 0) return '0m';
  const { hours, minutes } = fromTotalMinutes(totalMinutes);
  if (hours === 0)   return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// ── Variance ──────────────────────────────────────────────────────────────────

export function formatVariance(
  estimatedMinutes: number,
  actualMinutes: number,
): { text: string; type: 'over' | 'under' | 'exact'; color: string } {
  const diff = actualMinutes - estimatedMinutes;
  if (diff === 0) return { text: 'On estimate', type: 'exact', color: 'text-status-present' };
  if (diff > 0)   return { text: `+${formatEffort(diff)} over estimate`,          type: 'over',  color: 'text-status-absent' };
  return           { text: `${formatEffort(Math.abs(diff))} under estimate`, type: 'under', color: 'text-status-present' };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateEffort(
  hours: number,
  minutes: number,
): { valid: boolean; error?: string } {
  if (hours < 0 || hours > 999)     return { valid: false, error: 'Hours must be between 0 and 999.' };
  if (minutes < 0 || minutes > 59)  return { valid: false, error: 'Minutes must be between 0 and 59.' };
  if (hours === 0 && minutes === 0)  return { valid: false, error: 'Effort cannot be 0. Please enter a valid duration.' };
  return { valid: true };
}
