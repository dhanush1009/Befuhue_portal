'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ChevronLeft, ChevronRight, CalendarHeart, PartyPopper, Plus, ListPlus, Download,
  Pencil, Trash2, CalendarX2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { HolidayFormModal } from '@/components/holidays/HolidayFormModal';
import { HolidayImportModal } from '@/components/holidays/HolidayImportModal';
import { useAuth } from '@/hooks/useAuth';
import { useHolidays, useDeleteHoliday, type Holiday } from '@/hooks/useHolidays';

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((parseISO(toKey).getTime() - parseISO(fromKey).getTime()) / 86_400_000);
}

function whenBadge(diff: number): { text: string; cls: string } {
  if (diff < 0)   return { text: 'Passed',                                      cls: 'bg-gray-100 dark:bg-surface-dark-2 text-gray-400 dark:text-violet-300/40' };
  if (diff === 0) return { text: 'Today',                                       cls: 'bg-rose-500 text-white' };
  if (diff === 1) return { text: 'Tomorrow',                                    cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
  if (diff <= 14) return { text: `In ${diff} days`,                             cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' };
  return                 { text: `In ${diff} days`,                             cls: 'bg-gray-100 dark:bg-surface-dark-2 text-gray-500 dark:text-violet-300/55' };
}

function exportCsv(holidays: Holiday[], year: number) {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = ['Date,Holiday,Note', ...holidays.map((h) => `${h.date},${q(h.name)},${q(h.note ?? '')}`)];
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `holidays-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HolidaysPage() {
  const { isAdmin } = useAuth();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const { data, isLoading, isError } = useHolidays(year);
  const del = useDeleteHoliday();

  const [editing,    setEditing]    = useState<Holiday | null>(null);
  const [adding,     setAdding]     = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [removing,   setRemoving]   = useState<Holiday | null>(null);

  const holidays = useMemo(() => data?.holidays ?? [], [data]);
  const today    = data?.today ?? format(new Date(), 'yyyy-MM-dd');

  const next = useMemo(() => holidays.find((h) => h.date >= today) ?? null, [holidays, today]);
  const stats = useMemo(() => {
    const onSunday = holidays.filter((h) => parseISO(h.date).getDay() === 0).length;
    return { total: holidays.length, extraDaysOff: holidays.length - onSunday, onSunday, remaining: holidays.filter((h) => h.date >= today).length };
  }, [holidays, today]);

  const byMonth = useMemo(() => {
    const groups = new Map<string, Holiday[]>();
    for (const h of holidays) groups.set(h.date.slice(0, 7), [...(groups.get(h.date.slice(0, 7)) ?? []), h]);
    return [...groups.entries()];
  }, [holidays]);

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-6">
      <PageHeader
        title="Holidays"
        description={isAdmin
          ? 'The company holiday calendar. Add, change or replace it any time — everyone sees updates straight away.'
          : 'Company holidays for the year. These are paid days off, and they are never counted against your leave.'}
        actions={isAdmin ? (
          <>
            <button onClick={() => exportCsv(holidays, year)} disabled={holidays.length === 0} className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150" title="Download this year as CSV — edit it and upload it back">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => setImporting(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
              <ListPlus className="w-4 h-4" /> Bulk add
            </button>
            <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]">
              <Plus className="w-4 h-4" /> Add holiday
            </button>
          </>
        ) : undefined}
      />

      {/* Year navigator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-1 py-1">
          <button onClick={() => setYear((y) => y - 1)} aria-label="Previous year" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-2 transition-colors duration-150">
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 min-w-[110px] justify-center">
            <CalendarHeart className="w-4 h-4 text-gray-400 dark:text-violet-300/45" />
            <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">{year}</span>
          </div>
          <button onClick={() => setYear((y) => y + 1)} aria-label="Next year" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-2 transition-colors duration-150">
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
        </div>
        {year !== thisYear && (
          <button onClick={() => setYear(thisYear)} className="px-3 py-2 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors duration-150">
            Back to {thisYear}
          </button>
        )}
      </div>

      {isError ? (
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-10 text-center text-sm text-gray-500 dark:text-violet-300/55">
          Couldn&apos;t load the holiday list. Please refresh and try again.
        </div>
      ) : isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 rounded-xl bg-gray-100 dark:bg-surface-dark-3" />
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-surface-dark-3" />)}
        </div>
      ) : holidays.length === 0 ? (
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-dashed border-gray-300 dark:border-violet-900/50 py-16 px-6 text-center">
          <CalendarX2 className="w-10 h-10 mx-auto text-gray-300 dark:text-violet-400/35 mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-white">
            {isAdmin ? `No holidays added for ${year} yet` : `The ${year} holiday list hasn’t been published yet`}
          </p>
          <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Paste the whole year at once — Diwali, Pongal, New Year and the rest — or add them one by one.'
              : 'Check back soon — you will get a notification when it is added.'}
          </p>
          {isAdmin && (
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={() => setImporting(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]">
                <ListPlus className="w-4 h-4" /> Bulk add the year
              </button>
              <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
                <Plus className="w-4 h-4" /> Add one
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Next holiday + counts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 rounded-xl border border-rose-200/70 dark:border-rose-900/40 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-surface-dark-3 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <PartyPopper className="w-6 h-6" />
              </div>
              {next ? (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-rose-600/80 dark:text-rose-300/70 uppercase tracking-wider">Next holiday</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">{next.name}</p>
                  <p className="text-sm text-gray-600 dark:text-violet-200/70">
                    {format(parseISO(next.date), 'EEEE, d MMMM')} · <span className="font-medium">{daysBetween(today, next.date) === 0 ? 'today' : `in ${daysBetween(today, next.date)} day${daysBetween(today, next.date) === 1 ? '' : 's'}`}</span>
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-rose-600/80 dark:text-rose-300/70 uppercase tracking-wider">{year < thisYear ? 'Past year' : 'All done'}</p>
                  <p className="text-sm text-gray-600 dark:text-violet-200/70 mt-0.5">No more holidays left in {year}.</p>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-violet-900/40 bg-white dark:bg-surface-dark-3 px-6 py-5">
              <p className="text-3xl font-semibold text-gray-900 dark:text-white tabular-nums">{stats.total}</p>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Holidays in {year}</p>
              <p className="text-[11px] text-gray-400 dark:text-violet-300/45 mt-1">
                {stats.remaining} still to come{stats.onSunday > 0 ? ` · ${stats.onSunday} fall on a Sunday` : ''}
              </p>
            </div>
          </div>

          {/* Month by month */}
          <div className="space-y-5">
            {byMonth.map(([ym, items]) => (
              <section key={ym}>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2 px-1">
                  {format(parseISO(`${ym}-01`), 'MMMM')}
                </h2>
                <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 divide-y divide-gray-50 dark:divide-violet-900/25 overflow-hidden">
                  {items.map((h) => {
                    const d    = parseISO(h.date);
                    const diff = daysBetween(today, h.date);
                    const b    = whenBadge(diff);
                    const sunday = d.getDay() === 0;
                    return (
                      <div key={h.id} className={cn('group flex items-center gap-4 px-5 py-3.5', diff < 0 && 'opacity-60')}>
                        <div className="w-12 shrink-0 text-center">
                          <p className="text-xl font-semibold text-gray-900 dark:text-white leading-none tabular-nums">{format(d, 'd')}</p>
                          <p className="text-[11px] font-medium text-gray-400 dark:text-violet-300/45 uppercase mt-1">{format(d, 'EEE')}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{h.name}</p>
                          {(h.note || sunday) && (
                            <p className="text-xs text-gray-500 dark:text-violet-300/55 truncate">
                              {h.note}{h.note && sunday ? ' · ' : ''}{sunday && 'Falls on a Sunday'}
                            </p>
                          )}
                        </div>
                        <span className={cn('shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium', b.cls)}>{b.text}</span>
                        {isAdmin && (
                          <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                            <button onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`} className="p-1.5 rounded-md text-gray-400 hover:text-brand hover:bg-brand/10 transition-colors duration-150"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setRemoving(h)} aria-label={`Remove ${h.name}`} className="p-1.5 rounded-md text-gray-400 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {adding    && <HolidayFormModal defaultDate={`${year}-01-01`} onClose={() => setAdding(false)} />}
      {editing   && <HolidayFormModal holiday={editing} onClose={() => setEditing(null)} />}
      {importing && <HolidayImportModal year={year} existing={holidays} onClose={() => setImporting(false)} />}

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? 'holiday'}?`}
        description="It will disappear from everyone's calendar and they will be notified. You can add it back any time."
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (removing) del.mutate(removing.id, { onSuccess: () => setRemoving(null) }); }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
