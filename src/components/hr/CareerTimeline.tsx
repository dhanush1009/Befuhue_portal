'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowRight, BadgeCheck, Briefcase, CalendarCheck, Loader2, Plus, Shuffle, TrendingUp, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAREER_LABELS, CAREER_TYPES, type CareerType } from '@/lib/career';
import { useAddCareerEvent, useCareer, useDeleteCareerEvent, type TimelineEntry } from '@/hooks/useEmployeeDetails';

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none';
const LC = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

const ICONS: Record<TimelineEntry['kind'], LucideIcon> = {
  JOINED: Briefcase, PROMOTION: TrendingUp, ROLE_CHANGE: Shuffle, TRANSFER: Shuffle, CONFIRMATION: BadgeCheck, OTHER: CalendarCheck,
};

const today = () => new Date().toISOString().slice(0, 10);

/** Admin only: when they joined and every promotion or role change since. */
export function CareerTimeline({ employeeId }: { employeeId: string }) {
  const q = useCareer(employeeId);
  const add = useAddCareerEvent(employeeId);
  const del = useDeleteCareerEvent(employeeId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'PROMOTION' as CareerType, effectiveDate: today(), title: '', toDesignation: '', note: '', updateDesignation: true });
  const [error, setError] = useState<string | null>(null);

  if (q.isLoading) return <div className="h-40 rounded-xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />;
  if (q.isError || !q.data) return <p className="text-sm text-status-absent">Could not load the timeline.</p>;
  const { timeline, currentDesignation, tenure } = q.data;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = form.title.trim() || (form.type === 'PROMOTION' && form.toDesignation.trim() ? `Promoted to ${form.toDesignation.trim()}` : '');
    if (!title) { setError('Add a short title'); return; }
    add.mutate({
      type: form.type, effectiveDate: form.effectiveDate, title, toDesignation: form.toDesignation.trim() || null,
      note: form.note.trim() || null, updateDesignation: !!form.toDesignation.trim() && form.updateDesignation,
    }, { onSuccess: () => { setOpen(false); setForm({ type: 'PROMOTION', effectiveDate: today(), title: '', toDesignation: '', note: '', updateDesignation: true }); } });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Career timeline</h3>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
            Only admins can see this.{currentDesignation ? ` Currently ${currentDesignation}` : ''}{tenure ? ` · ${tenure} with the company` : ''}
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover">
            <Plus className="w-4 h-4" /> Add promotion or change
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LC}>What happened</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CareerType })} className={IC}>
              {CAREER_TYPES.map((t) => <option key={t} value={t}>{CAREER_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={LC}>Effective date</label>
            <input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className={IC} required />
          </div>
          <div>
            <label className={LC}>New designation (optional)</label>
            <input value={form.toDesignation} onChange={(e) => setForm({ ...form, toDesignation: e.target.value })} placeholder="e.g. Senior Designer" className={IC} />
          </div>
          <div>
            <label className={LC}>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.toDesignation ? `Promoted to ${form.toDesignation}` : 'Short description'} className={IC} />
          </div>
          <div className="md:col-span-2">
            <label className={LC}>Note (optional)</label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className={IC} placeholder="Reason, appraisal cycle, anything worth remembering" />
          </div>
          {form.toDesignation.trim() && (
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-violet-200/70 cursor-pointer">
              <input type="checkbox" checked={form.updateDesignation} onChange={(e) => setForm({ ...form, updateDesignation: e.target.checked })} className="size-4 rounded" />
              Also change their current designation to “{form.toDesignation.trim()}”
            </label>
          )}
          {error && <p className="md:col-span-2 text-xs text-status-absent">{error}</p>}
          <div className="md:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white">Cancel</button>
            <button type="submit" disabled={add.isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">
              {add.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save to timeline
            </button>
          </div>
        </form>
      )}

      {timeline.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-violet-300/45">No joining date or career events recorded yet.</p>
      ) : (
        <ol className="relative border-l border-gray-200 dark:border-violet-900/40 ml-3 space-y-6">
          {timeline.map((t, i) => {
            const Icon = ICONS[t.kind];
            return (
              <li key={t.id ?? 'joined'} className="ml-6">
                <span className={cn('absolute -left-[13px] grid size-6 place-items-center rounded-full ring-4 ring-white dark:ring-surface-dark-3', i === 0 ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-violet-200/70')}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t.title}</p>
                    <p className="text-xs text-gray-400 dark:text-violet-300/45">
                      {format(parseISO(t.date), 'd MMMM yyyy')} · {t.kind === 'JOINED' ? 'Joining date' : CAREER_LABELS[t.kind]}
                    </p>
                    {(t.fromDesignation || t.toDesignation) && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-violet-200/70">
                        {t.fromDesignation && <span>{t.fromDesignation}</span>}
                        {t.fromDesignation && t.toDesignation && <ArrowRight className="w-3 h-3" />}
                        {t.toDesignation && <span className="font-medium">{t.toDesignation}</span>}
                      </p>
                    )}
                    {t.note && <p className="mt-1 text-xs text-gray-500 dark:text-violet-300/55 whitespace-pre-wrap">{t.note}</p>}
                  </div>
                  {t.id && (
                    <button type="button" onClick={() => { if (window.confirm('Remove this entry from the timeline?')) del.mutate(t.id!); }} disabled={del.isPending}
                      className="p-1.5 rounded-md text-gray-400 hover:text-status-absent" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-gray-400 dark:text-violet-300/45">The joining date comes from the employee&apos;s profile. To change it, use Edit Profile.</p>
    </div>
  );
}
