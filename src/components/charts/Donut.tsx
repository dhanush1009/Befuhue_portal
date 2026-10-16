import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DonutSlice { key: string; label: string; value: number; color: string }

/** A donut with a centre label. Zero total renders an empty track instead of NaN arcs. */
export function Donut({ slices, size = 160, thickness = 16, center, className }: {
  slices: DonutSlice[]; size?: number; thickness?: number; center?: ReactNode; className?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label="Distribution">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-black/[0.06] dark:stroke-white/[0.07]" />
        {total > 0 && slices.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c;
          const gap = Math.min(3, len * 0.15); // a hairline gap between arcs
          const el = (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeLinecap="butt" strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset}>
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}

export function Ring({ value, size = 96, thickness = 9, color = '#8E51FF', children }: {
  value: number; size?: number; thickness?: number; color?: string; children?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-black/[0.07] dark:stroke-white/[0.08]" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
