'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Download,
  FileBarChart,
  Users,
  CheckCircle2,
  Clock,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Loader2,
  StickyNote,
  Bug,
  ListTodo,
  AlertCircle,
  ClockAlert,
} from 'lucide-react';
import { format } from 'date-fns';
import type { ProjectReportData } from '@/types/report';
import { cn } from '@/lib/utils';

function formatEffort(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || mins === 0) return '0h 0m';
  const isNeg = mins < 0;
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = isNeg ? '-' : '';
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

type TimelineTab = 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'TASKS' | 'BUGS';

export default function PublicSharedReportPage() {
  const params = useParams();
  const token = params.token as string;

  const [reportData, setReportData] = useState<ProjectReportData | null>(null);
  const [reportTitle, setReportTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [expired, setExpired] = useState<boolean>(false);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // Timeline
  const [activeTab, setActiveTab] = useState<TimelineTab>('ALL');
  const [expandedTransitions, setExpandedTransitions] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'completedAt' | 'priority' | 'assignee' | 'effort'>('completedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    async function fetchSharedReport() {
      try {
        const res = await fetch(`/api/reports/shared/${token}`);
        if (res.status === 410) {
          setExpired(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }

        const json = await res.json();
        if (json.data) {
          setReportData(json.data.reportData);
          setReportTitle(json.data.title || 'Project Report');
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchSharedReport();
  }, [token]);

  const handleDownloadPDF = async () => {
    if (!reportData) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/admin/reports/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData }),
      });

      if (!res.ok) throw new Error('Failed to download PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(reportData.projectName || 'Project').replace(/\s+/g, '_')}_${(reportData.monthLabel || 'Report').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const toggleTransitions = (taskId: string) => {
    setExpandedTransitions((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const filteredTasks = useMemo(() => {
    if (!reportData) return [];
    let list = [...reportData.tasks];

    if (activeTab === 'COMPLETED') {
      list = list.filter((t) => t.wasCompletedThisMonth || t.wasClosedThisMonth);
    } else if (activeTab === 'IN_PROGRESS') {
      list = list.filter((t) => !t.wasCompletedThisMonth && !t.wasClosedThisMonth);
    } else if (activeTab === 'TASKS') {
      list = list.filter((t) => t.itemType === 'TASK');
    } else if (activeTab === 'BUGS') {
      list = list.filter((t) => t.itemType === 'BUG');
    }

    list.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'completedAt') {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        comp = timeA - timeB;
      } else if (sortBy === 'priority') {
        comp = a.priority.localeCompare(b.priority);
      } else if (sortBy === 'assignee') {
        comp = (a.assignee?.name || '').localeCompare(b.assignee?.name || '');
      } else if (sortBy === 'effort') {
        comp = (a.actualMinutes || 0) - (b.actualMinutes || 0);
      }
      return sortDir === 'asc' ? comp : -comp;
    });

    return list;
  }, [reportData, activeTab, sortBy, sortDir]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
            <ClockAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">This report link has expired</h2>
          <p className="mt-2 text-sm text-slate-500">
            The temporary access token for this report is no longer valid. Contact your project administrator to request a renewed link.
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !reportData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Report Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">
            This project report could not be found or the sharing link is no longer active.
          </p>
        </div>
      </div>
    );
  }

  const {
    projectName,
    projectDescription,
    monthLabel,
    generatedBy,
    companyName,
    companyLogo,
    totalTasks,
    totalBugs,
    totalItems,
    completedItems,
    completionRate,
    workingDaysInMonth,
    members,
    stageBreakdown,
    bugSummary,
    effortSummary,
    adminNotes,
  } = reportData;

  const maxStageCount = Math.max(...stageBreakdown.map((s) => s.totalItems), 1);
  const completionColor =
    completionRate >= 70 ? 'text-emerald-600' : completionRate >= 40 ? 'text-amber-600' : 'text-rose-600';
  const completionBg =
    completionRate >= 70 ? 'bg-emerald-500' : completionRate >= 40 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* ── Top Clean Bar (No auth buttons) ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur shadow-2xs">
        <div className="flex items-center gap-3">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="h-7 w-7 rounded object-contain" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded bg-violet-600 font-bold text-white text-xs">
              TP
            </div>
          )}
          <span className="font-bold text-slate-900 text-sm">{companyName}</span>
        </div>

        <div className="hidden sm:block text-xs font-semibold uppercase tracking-widest text-slate-400">
          Project Report
        </div>

        <div>
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            {downloadingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Download PDF</span>
          </button>
        </div>
      </header>

      {/* ── Main Report Content ── */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 space-y-6">
        {/* ── SECTION 0: Header Card ── */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-700 to-violet-800 p-8 text-white shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-200">
                {companyName}
              </p>
              <h1 className="text-2xl font-black text-white">{projectName}</h1>
              {projectDescription && (
                <p className="mt-1 text-sm text-violet-100/80 max-w-xl">
                  {projectDescription}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs uppercase tracking-widest text-violet-200 font-semibold">
                Monthly Project Report
              </span>
              <p className="text-3xl font-extrabold text-white">{monthLabel}</p>
              <p className="text-xs text-violet-200/80 mt-1">
                Generated by {generatedBy}
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: Summary Cards ── */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Items
                </p>
                <Briefcase className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalItems}</p>
              <p className="mt-1 text-xs text-slate-500">
                {totalTasks} tasks · {totalBugs} bugs
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Completed
                </p>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className={cn('mt-2 text-3xl font-extrabold', completionColor)}>
                {completedItems}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {completionRate}% completion rate
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actual Effort
                </p>
                <Clock className="h-4 w-4 text-violet-500" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">
                {formatEffort(effortSummary.totalActualMinutes)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Est: {formatEffort(effortSummary.totalEstimatedMinutes)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Team Members
                </p>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{members.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                {workingDaysInMonth} working days in month
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
              <span>Overall Completion Rate</span>
              <span className={completionColor}>{completionRate}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, completionRate)}%` }}
                className={cn('h-full rounded-full transition-all duration-500', completionBg)}
              />
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Team Contribution ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-600" />
              <span>Team Contribution</span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="py-3.5 pl-6 pr-4">Employee</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4 text-center">Assigned</th>
                  <th className="py-3.5 px-4 text-center">Completed</th>
                  <th className="py-3.5 px-4 text-center">In Progress</th>
                  <th className="py-3.5 px-4 text-right">Est. Effort</th>
                  <th className="py-3.5 px-4 text-right">Actual Effort</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={m.userId} className="hover:bg-slate-50/50">
                    <td className="py-3.5 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 overflow-hidden">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.designation || 'Team Member'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{m.department || '—'}</td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-700">{m.tasksAssigned}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">{m.tasksCompleted}</td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-600">{m.tasksInProgress}</td>
                    <td className="py-3.5 px-4 text-right text-slate-500">{formatEffort(m.estimatedMinutes)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatEffort(m.actualMinutes)}</td>
                    <td className="py-3.5 pl-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold text-slate-900">{m.contributionPercent}%</span>
                        <div className="h-2 w-16 rounded-full bg-violet-100 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, m.contributionPercent)}%` }}
                            className="h-full rounded-full bg-violet-600"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECTION 3: Task Timeline ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-violet-600" />
              <span>Task Timeline</span>
            </h2>

            <div className="flex items-center gap-1 rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
              {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'TASKS', 'BUGS'] as TimelineTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-lg px-3 py-1 transition-colors',
                    activeTab === tab
                      ? 'bg-white text-violet-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {tab === 'ALL'
                    ? 'All'
                    : tab === 'COMPLETED'
                    ? 'Completed'
                    : tab === 'IN_PROGRESS'
                    ? 'In Progress'
                    : tab === 'TASKS'
                    ? 'Tasks'
                    : 'Bugs'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="py-3 pl-6 pr-3">ID</th>
                  <th className="py-3 px-3">Title</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Assignee</th>
                  <th className="py-3 px-3 text-right">Est.</th>
                  <th className="py-3 px-3 text-right">Actual</th>
                  <th className="py-3 px-3">Stage Start</th>
                  <th className="py-3 px-3">Stage End</th>
                  <th className="py-3 px-3">Completed</th>
                  <th className="py-3 pr-6 pl-3">Transitions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((t) => {
                  const isCompleted = t.wasCompletedThisMonth;
                  const isNew = t.wasCreatedThisMonth;
                  const isExpanded = !!expandedTransitions[t.id];

                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        className={cn(
                          'hover:bg-slate-50/50 transition-colors',
                          isCompleted && 'bg-emerald-50/30 border-l-4 border-l-emerald-500',
                          isNew && !isCompleted && 'border-l-4 border-l-blue-500'
                        )}
                      >
                        <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-semibold text-violet-600">
                          {t.taskId}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{t.title}</span>
                            {isNew && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold',
                              t.itemType === 'BUG' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {t.itemType === 'BUG' ? <Bug className="h-3 w-3" /> : <ListTodo className="h-3 w-3" />}
                            {t.itemType === 'BUG' ? 'Bug' : 'Task'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-xs text-slate-700">{t.priority}</td>
                        <td className="py-3.5 px-3 text-slate-700 font-medium">
                          {t.assignee?.name || 'Unassigned'}
                        </td>
                        <td className="py-3.5 px-3 text-right text-xs text-slate-500">
                          {formatEffort(t.estimatedMinutes)}
                        </td>
                        <td className="py-3.5 px-3 text-right text-xs font-bold text-slate-900">
                          {t.actualMinutes ? formatEffort(t.actualMinutes) : '—'}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-500">{t.startStage}</td>
                        <td className="py-3.5 px-3 text-xs font-semibold text-slate-800">{t.endStage}</td>
                        <td className="py-3.5 px-3 text-xs">
                          {t.completedAt ? (
                            <span className="font-semibold text-emerald-600">
                              {format(new Date(t.completedAt), 'dd MMM yyyy')}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-6 pl-3">
                          {t.stageTransitions.length > 0 ? (
                            <button
                              onClick={() => toggleTransitions(t.id)}
                              className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              <span>{t.stageTransitions.length} moves</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && t.stageTransitions.length > 0 && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={11} className="py-3 px-6">
                            <div className="space-y-1.5 pl-6 border-l-2 border-violet-400 text-xs">
                              {t.stageTransitions.map((st, i) => (
                                <div key={i} className="flex items-center gap-2 text-slate-700">
                                  <span className="font-medium text-slate-500">{st.from}</span>
                                  <span className="text-violet-600 font-bold">→</span>
                                  <span className="font-semibold text-slate-900">{st.to}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">by {st.by}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-400">
                                    {format(new Date(st.at), 'dd MMM yyyy, HH:mm')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECTION 4 & 5: Stage Breakdown & Bug Summary ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 mb-4">Stage Breakdown (End of Month)</h2>
            <div className="space-y-3">
              {stageBreakdown.map((s) => {
                const barWidth = Math.max(8, Math.round((s.totalItems / maxStageCount) * 100));
                return (
                  <div key={s.stageName} className="flex items-center gap-3 text-xs">
                    <span className="w-28 truncate font-medium text-slate-700">{s.stageName}</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${barWidth}%`, backgroundColor: s.stageColor || '#8E51FF' }}
                        className="h-full rounded-full"
                      />
                    </div>
                    <span className="w-16 text-right font-bold text-slate-900">{s.totalItems} items</span>
                  </div>
                );
              })}
            </div>
          </div>

          {bugSummary ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Bug className="h-4 w-4 text-rose-600" />
                <span>Bug Summary</span>
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-xs border-r border-slate-100 pr-4">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Reported</span>
                    <span className="font-bold text-slate-900">{bugSummary.totalReported}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Fixed</span>
                    <span className="font-bold text-emerald-600">{bugSummary.totalFixed}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Verified</span>
                    <span className="font-bold text-slate-900">{bugSummary.totalVerified}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Reopened</span>
                    <span className={cn('font-bold', bugSummary.totalReopened > 0 ? 'text-rose-600' : 'text-slate-900')}>
                      {bugSummary.totalReopened}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="font-semibold text-rose-600">Critical</span>
                    <span className="font-bold text-slate-900">{bugSummary.criticalCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="font-semibold text-amber-600">High</span>
                    <span className="font-bold text-slate-900">{bugSummary.highCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="font-semibold text-yellow-600">Medium</span>
                    <span className="font-bold text-slate-900">{bugSummary.mediumCount}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Avg. Fix Time</span>
                    <span className="font-bold text-slate-900">
                      {bugSummary.avgTimeToFix ? formatEffort(bugSummary.avgTimeToFix) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs flex items-center justify-center text-slate-400 text-sm">
              No bugs reported in this project.
            </div>
          )}
        </div>

        {/* ── SECTION 6: Effort Analysis ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">Effort Analysis</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-xs uppercase font-bold text-slate-500">Estimated Total</p>
              <p className="text-xl font-bold text-slate-700 mt-1">
                {formatEffort(effortSummary.totalEstimatedMinutes)}
              </p>

              <p className="text-xs uppercase font-bold text-slate-500 mt-4">Actual Total</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatEffort(effortSummary.totalActualMinutes)}
              </p>

              <p className="text-xs uppercase font-bold text-slate-500 mt-4">Variance</p>
              <p
                className={cn(
                  'text-lg font-bold mt-1',
                  effortSummary.varianceMinutes > 0 ? 'text-rose-600' : 'text-emerald-600'
                )}
              >
                {effortSummary.varianceMinutes > 0 ? '+' : ''}
                {formatEffort(effortSummary.varianceMinutes)} ({effortSummary.variancePercent > 0 ? '+' : ''}
                {effortSummary.variancePercent}%)
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 overflow-y-auto max-h-56">
              <p className="text-xs font-bold uppercase text-slate-500 mb-2">Per-Member Effort</p>
              <div className="space-y-2 text-xs">
                {effortSummary.memberEffort.map((me) => (
                  <div key={me.userId} className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="font-semibold text-slate-800 truncate w-24">{me.name}</span>
                    <span className="text-slate-500">Est: {formatEffort(me.estimatedMinutes)}</span>
                    <span className="font-bold text-slate-900">Act: {formatEffort(me.actualMinutes)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center justify-center">
              <p className="text-xs font-bold uppercase text-slate-500 mb-2">Completion Rate</p>
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="38"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-slate-200"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="38"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 * (1 - completionRate / 100)}
                    strokeLinecap="round"
                    className={completionColor}
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className={cn('text-xl font-extrabold', completionColor)}>
                    {completionRate}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {completedItems} of {totalItems} completed
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 7: Notes (if present) ── */}
        {adminNotes && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-amber-900 mb-2 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-600" />
              <span>Notes & Observations</span>
            </h2>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {adminNotes}
            </p>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              — {generatedBy}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
