'use client';

import { checkPasswordStrength } from '@/lib/passwordUtils';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const { score, label, color } = checkPasswordStrength(password);
  const percent = ((score + 1) / 5) * 100;

  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs font-medium" style={{ color }}>
        {label}
      </p>
    </div>
  );
}
