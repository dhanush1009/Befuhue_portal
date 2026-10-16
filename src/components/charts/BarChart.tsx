import { cn } from '@/lib/utils';

export interface BarDatum { label: string; value: number; hint?: string }

/** Simple vertical bars with day labels; the tallest bar is emphasised. Pure HTML, so it scales and themes for free. */
export function BarChart({ data, height = 120, color = '#8E51FF', format = (v) => String(Math.round(v)), className }: {
  data: BarDatum[]; height?: number; color?: string; format?: (v: number) => string; className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn('flex items-end gap-1.5', className)} style={{ height: height + 20 }}>
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 4 : 2, (d.value / max) * height);
        return (
          <div key={`${d.label}-${i}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${d.hint ?? d.label}: ${format(d.value)}`}>
            <div className="w-full rounded-md transition-opacity group-hover:opacity-100" style={{ height: h, backgroundColor: color, opacity: d.value === max && d.value > 0 ? 1 : 0.55 }} />
            <span className="truncate text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal share bars: label, a coloured bar sized to its share, and the value. */
export function ShareBars({ rows, className }: { rows: { key: string; label: string; share: number; value: string; sub?: string; color: string }[]; className?: string }) {
  return (
    <ul className={cn('space-y-3', className)}>
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{r.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-500"><span className="font-medium text-zinc-900 dark:text-white">{r.value}</span>{r.sub && <span className="ml-1.5 text-xs">{r.sub}</span>}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, Math.min(100, r.share))}%`, backgroundColor: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
