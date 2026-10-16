'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { formatEffort, toTotalMinutes } from '@/lib/effortUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EffortValue {
  hours:   number;
  minutes: number;
}

interface EffortInputProps {
  label?:      string;
  value:       EffortValue;
  onChange:    (value: EffortValue) => void;
  error?:      string;
  required?:   boolean;
  disabled?:   boolean;
  helperText?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EffortInput({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  helperText,
}: EffortInputProps) {
  const minutesRef = useRef<HTMLInputElement>(null);

  const total = toTotalMinutes(value.hours, value.minutes);

  const inputClass = cn(
    'w-20 px-2 py-2 text-sm text-center tabular-nums bg-gray-50 dark:bg-surface-dark-2 border rounded-lg',
    'focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150',
    'text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed',
    error
      ? 'border-status-absent focus:ring-status-absent/30'
      : 'border-gray-200 dark:border-violet-900/40',
  );

  function handleHoursChange(raw: string) {
    const h = raw === '' ? 0 : Math.max(0, Math.min(999, parseInt(raw, 10) || 0));
    onChange({ hours: h, minutes: value.minutes });
  }

  function handleMinutesChange(raw: string) {
    const parsed = parseInt(raw, 10) || 0;
    if (parsed > 59) {
      // Carry over: e.g. 90m → +1h 30m
      const carry   = Math.floor(parsed / 60);
      const remain  = parsed % 60;
      onChange({ hours: Math.min(999, value.hours + carry), minutes: remain });
    } else {
      onChange({ hours: value.hours, minutes: Math.max(0, parsed) });
    }
  }

  function handleHoursKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp')   { e.preventDefault(); onChange({ hours: Math.min(999, value.hours + 1), minutes: value.minutes }); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange({ hours: Math.max(0,   value.hours - 1), minutes: value.minutes }); }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); minutesRef.current?.focus(); }
  }

  function handleMinutesKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp')   { e.preventDefault(); handleMinutesChange(String(value.minutes + 5)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange({ hours: value.hours, minutes: Math.max(0, value.minutes - 5) }); }
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-violet-200/70 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="flex items-start gap-2">
        {/* Hours */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={999}
            value={value.hours === 0 ? '' : value.hours}
            placeholder="0"
            disabled={disabled}
            className={inputClass}
            onChange={(e) => handleHoursChange(e.target.value)}
            onBlur={(e)   => { if (e.target.value === '') onChange({ hours: 0, minutes: value.minutes }); }}
            onKeyDown={handleHoursKeyDown}
          />
          <span className="text-sm text-gray-500 dark:text-violet-300/55">h</span>
        </div>

        {/* Minutes */}
        <div className="flex items-center gap-1">
          <input
            ref={minutesRef}
            type="number"
            min={0}
            max={59}
            value={value.minutes === 0 ? '' : value.minutes}
            placeholder="00"
            disabled={disabled}
            className={inputClass}
            onChange={(e) => handleMinutesChange(e.target.value)}
            onBlur={(e) => {
              if (e.target.value === '') onChange({ hours: value.hours, minutes: 0 });
            }}
            onKeyDown={handleMinutesKeyDown}
          />
          <span className="text-sm text-gray-500 dark:text-violet-300/55">m</span>
        </div>
      </div>

      {/* Live preview */}
      {total > 0 && (
        <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
          = {formatEffort(total)} total
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {/* Helper text — only when no error */}
      {!error && helperText && (
        <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">{helperText}</p>
      )}
    </div>
  );
}
