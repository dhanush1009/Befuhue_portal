'use client';

import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { niceMax } from '@/lib/format';

export interface AreaPoint {
  label: string;           // shown in the tooltip, e.g. "Mon, 6 Oct"
  axis?: string;           // short label under the axis, e.g. "6 Oct"
  value: number;
  prev?: number;           // the same slot in the previous period
  prevLabel?: string;
}

interface Props {
  data:       AreaPoint[];
  height?:    number;
  color?:     string;                          // any CSS colour
  format?:    (v: number) => string;
  seriesName?: string;
  prevName?:  string;
  className?: string;
}

/**
 * A smooth area chart with hover tooltip and an optional dashed "previous period" line.
 * SVG draws the shapes; HTML overlays carry the text, so labels never stretch.
 */
export function AreaChart({ data, height = 240, color = '#8E51FF', format = (v) => String(Math.round(v)), seriesName = 'This period', prevName = 'Previous period', className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { max, line, area, prevLine, ticks, xLabels } = useMemo(() => {
    const n = data.length;
    const maxV = niceMax(Math.max(1, ...data.map((d) => Math.max(d.value, d.prev ?? 0))));
    const x = (i: number) => (n <= 1 ? 500 : (i / (n - 1)) * 1000);
    const y = (v: number) => 300 - (v / maxV) * 280 - 4; // keeps the stroke off the very top/bottom edge
    const pts = data.map((d, i) => [x(i), y(d.value)] as const);
    const prevPts = data.map((d, i) => (d.prev === undefined ? null : ([x(i), y(d.prev)] as const)));
    const smooth = (p: readonly (readonly [number, number])[]) => {
      if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : '';
      let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
      for (let i = 0; i < p.length - 1; i++) {
        const [x0, y0] = p[i], [x1, y1] = p[i + 1];
        const cx = (x0 + x1) / 2;
        d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
      }
      return d;
    };
    const ln = smooth(pts);
    const prevClean = prevPts.filter((p): p is readonly [number, number] => p !== null);
    const count = Math.min(6, n);
    const idx = n <= 1 ? [0] : Array.from({ length: count }, (_, k) => Math.round((k / (count - 1)) * (n - 1)));
    return {
      max: maxV,
      line: ln,
      area: pts.length ? `${ln} L${pts[pts.length - 1][0]},300 L${pts[0][0]},300 Z` : '',
      prevLine: prevClean.length > 1 ? smooth(prevClean) : '',
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxV),
      xLabels: idx.map((i) => ({ i, text: data[i]?.axis ?? data[i]?.label ?? '' })),
    };
  }, [data]);

  const n = data.length;
  const gid = useMemo(() => `area-${Math.abs(hashStr(color + n))}`, [color, n]);
  const hp = hover !== null ? data[hover] : null;
  const xPct = hover !== null && n > 1 ? (hover / (n - 1)) * 100 : 50;
  const yPct = hp ? ((300 - ((hp.value / max) * 280 + 4)) / 300) * 100 : 0;

  function onMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(n === 1 ? 0 : Math.round(f * (n - 1)));
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex">
        {/* y-axis labels */}
        <div className="relative mr-2 w-11 shrink-0 text-right text-[11px] tabular-nums text-zinc-400" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${((300 - ((t / max) * 280 + 4)) / 300) * 100}%` }}>
              {format(t)}
            </span>
          ))}
        </div>

        <div
          ref={ref}
          className="relative min-w-0 flex-1"
          style={{ height }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" role="img" aria-label={`${seriesName} chart`}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.30" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line key={t} x1="0" x2="1000" y1={300 - ((t / max) * 280 + 4)} y2={300 - ((t / max) * 280 + 4)}
                className="stroke-black/[0.07] dark:stroke-white/[0.07]" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={t === 0 ? undefined : '3 5'} />
            ))}
            {area && <path d={area} fill={`url(#${gid})`} />}
            {prevLine && <path d={prevLine} fill="none" className="stroke-zinc-400/70" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
            {line && <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {hover !== null && n > 1 && (
              <line x1={(hover / (n - 1)) * 1000} x2={(hover / (n - 1)) * 1000} y1="0" y2="300" className="stroke-zinc-400/60" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            )}
          </svg>

          {hp && (
            <>
              <span className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow dark:border-surface-dark-3"
                style={{ left: `${xPct}%`, top: `${yPct}%`, backgroundColor: color }} />
              <div
                className="pointer-events-none absolute top-0 z-10 min-w-[8.5rem] rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-surface-dark-2"
                style={{ left: `${xPct}%`, transform: `translateX(${xPct > 70 ? '-105%' : '8%'})` }}
              >
                <p className="mb-1 font-medium text-zinc-900 dark:text-white">{hp.label}</p>
                <p className="flex items-center justify-between gap-4 text-zinc-600 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: color }} />{seriesName}</span>
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">{format(hp.value)}</span>
                </p>
                {hp.prev !== undefined && (
                  <p className="mt-0.5 flex items-center justify-between gap-4 text-zinc-500">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-zinc-400" />{prevName}</span>
                    <span className="tabular-nums">{format(hp.prev)}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* x-axis labels */}
      <div className="relative ml-[3.25rem] mt-2 h-4 text-[11px] text-zinc-400">
        {xLabels.map(({ i, text }) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 50}%` }}>{text}</span>
        ))}
      </div>
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
