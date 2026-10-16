'use client';

import { useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X, Loader2, Upload, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseHolidayText } from '@/lib/holidays';
import { useImportHolidays, type Holiday } from '@/hooks/useHolidays';

const EXAMPLE = `2027-01-01, New Year's Day
14 Jan 2027 - Pongal
26/01/2027  Republic Day
Diwali - 29 Oct 2027
Dec 25, Christmas`;

interface Props {
  /** The year being viewed — used for lines that don't name a year, and for "replace this year". */
  year:     number;
  existing: Holiday[];
  onClose:  () => void;
}

export function HolidayImportModal({ year, existing, onClose }: Props) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replaceYear'>('merge');
  const fileRef = useRef<HTMLInputElement>(null);
  const importer = useImportHolidays();

  const parsed = useMemo(() => parseHolidayText(text, year), [text, year]);
  const existingByDate = useMemo(() => new Map(existing.map((h) => [h.date, h])), [existing]);

  const years = useMemo(() => [...new Set(parsed.rows.map((r) => r.date.slice(0, 4)))], [parsed.rows]);
  const singleYear = years.length === 1 ? Number(years[0]) : null;
  // Replacing is only offered for the year on screen, so the preview can show exactly what would be removed.
  const canReplace = singleYear === year;
  const effectiveMode = mode === 'replaceYear' && canReplace ? 'replaceYear' : 'merge';

  // What saving will do, so the admin is never surprised.
  const summary = useMemo(() => {
    let added = 0, changed = 0, same = 0;
    for (const r of parsed.rows) {
      const ex = existingByDate.get(r.date);
      if (!ex) added++;
      else if (ex.name !== r.name || (ex.note ?? null) !== (r.note ?? null)) changed++;
      else same++;
    }
    const removed = effectiveMode === 'replaceYear'
      ? existing.filter((h) => !parsed.rows.some((r) => r.date === h.date)).length
      : 0;
    return { added, changed, same, removed };
  }, [parsed.rows, existingByDate, effectiveMode, singleYear, year, existing]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  function save() {
    importer.mutate(
      {
        rows: parsed.rows,
        mode: effectiveMode,
        year: effectiveMode === 'replaceYear' ? year : undefined,
      },
      { onSuccess: onClose },
    );
  }

  const canSave = parsed.rows.length > 0 && !importer.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Add holidays in bulk</h2>
            <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">Paste your list or upload a CSV — one holiday per line. Nothing is saved until you confirm.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="h-bulk" className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Your holiday list</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setText(EXAMPLE)} className="flex items-center gap-1 text-xs text-brand hover:underline underline-offset-2">
                  <Sparkles className="w-3 h-3" /> Try an example
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-violet-900/40 rounded-md text-gray-600 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
                  <Upload className="w-3 h-3" /> Upload CSV / text
                </button>
                <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
              </div>
            </div>
            <textarea
              id="h-bulk"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={`${EXAMPLE}\n\nDate first or last. Dates like 2027-01-14, 14/01/2027 (day first) or 14 Jan 2027 all work. Lines with no year use ${year}. A third column becomes a note.`}
              className="w-full px-3 py-2.5 text-sm font-mono bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-violet-300/30 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150"
            />
            <p className="text-[11px] text-gray-400 dark:text-violet-300/45 mt-1">Tip: copy two columns (date, holiday) straight out of Excel or Google Sheets and paste them here.</p>
          </div>

          {/* Problems */}
          {parsed.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {parsed.errors.length} line{parsed.errors.length === 1 ? '' : 's'} need attention (these will be skipped)
              </p>
              <ul className="space-y-0.5">
                {parsed.errors.slice(0, 6).map((e) => (
                  <li key={e.line} className="text-xs text-red-700 dark:text-red-300">
                    <span className="font-mono opacity-70">Line {e.line}:</span> {e.message} — <span className="font-mono opacity-80">{e.text.slice(0, 50)}</span>
                  </li>
                ))}
                {parsed.errors.length > 6 && <li className="text-xs text-red-600/70">…and {parsed.errors.length - 6} more</li>}
              </ul>
            </div>
          )}
          {parsed.duplicates.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {parsed.duplicates.length} date{parsed.duplicates.length === 1 ? ' appears' : 's appear'} more than once — the later line was used.
            </p>
          )}

          {/* Preview */}
          {parsed.rows.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-present" /> Preview — {parsed.rows.length} holiday{parsed.rows.length === 1 ? '' : 's'}
              </p>
              <div className="rounded-lg border border-gray-200 dark:border-violet-900/40 overflow-hidden">
                <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-gray-50 dark:divide-violet-900/25">
                  {parsed.rows.map((r) => {
                    const d  = parseISO(r.date);
                    const ex = existingByDate.get(r.date);
                    const isSunday = d.getDay() === 0;
                    const state = !ex ? 'new' : ex.name !== r.name || (ex.note ?? null) !== (r.note ?? null) ? 'changed' : 'same';
                    return (
                      <div key={r.date} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-28 shrink-0 text-xs font-mono text-gray-500 dark:text-violet-300/55">{format(d, 'EEE, d MMM yyyy')}</span>
                        <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-white">
                          {r.name}{r.note && <span className="text-gray-400 dark:text-violet-300/45"> — {r.note}</span>}
                        </span>
                        {isSunday && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55" title="Sunday is already a weekly off">Sunday</span>}
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded',
                          state === 'new'     && 'bg-status-present/10 text-status-present',
                          state === 'changed' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                          state === 'same'    && 'bg-gray-100 dark:bg-surface-dark-3 text-gray-400',
                        )}>
                          {state === 'new' ? 'New' : state === 'changed' ? 'Updates existing' : 'Already there'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* How to apply it */}
              <fieldset className="mt-4 space-y-2">
                <legend className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">When saving</legend>
                {([
                  { id: 'merge' as const,       title: 'Add these and update matching dates', desc: 'Everything else already on the calendar stays as it is.', disabled: false },
                  { id: 'replaceYear' as const, title: `Make ${year} match this list exactly`, desc: canReplace ? `Holidays in ${year} that are not in your list are removed.` : `Only available when every date is in ${year} (the year you are viewing).`, disabled: !canReplace },
                ]).map((o) => (
                  <label key={o.id} className={cn(
                    'flex items-start gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-colors duration-150',
                    effectiveMode === o.id ? 'border-brand bg-brand/5' : 'border-gray-200 dark:border-violet-900/40 hover:bg-gray-50 dark:hover:bg-surface-dark-3',
                    o.disabled && 'opacity-50 cursor-not-allowed',
                  )}>
                    <input type="radio" name="h-mode" className="mt-1 accent-[#8E51FF]" checked={effectiveMode === o.id} disabled={o.disabled} onChange={() => setMode(o.id)} />
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">{o.title}</span>
                      <span className="block text-xs text-gray-500 dark:text-violet-300/55">{o.desc}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
          <p className="text-xs text-gray-500 dark:text-violet-300/55">
            {parsed.rows.length === 0
              ? 'Paste a list to see a preview.'
              : `${summary.added} new · ${summary.changed} updated${summary.same ? ` · ${summary.same} unchanged` : ''}${summary.removed ? ` · ${summary.removed} removed` : ''}. Everyone is notified.`}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={!canSave} className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]',
              summary.removed > 0 ? 'bg-status-absent hover:bg-red-700' : 'bg-brand hover:bg-brand-hover',
            )}>
              {importer.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {summary.removed > 0 ? `Save and remove ${summary.removed}` : `Save ${parsed.rows.length || ''} holiday${parsed.rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
