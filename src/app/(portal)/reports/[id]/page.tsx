'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffectiveRole } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Share2,
  RefreshCw,
  Pencil,
  FileBarChart,
  Users,
  CheckCircle2,
  Clock,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowLeft,
  StickyNote,
  X,
  Bug,
  ListTodo,
  Link as LinkIcon,
  Copy,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { ProjectReportData, ReportTask, ReportMember } from '@/types/report';
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

interface SavedReportResponse {
  id: string;
  projectId: string;
  month: number;
  year: number;
  title: string;
  status: 'DRAFT' | 'SAVED' | 'SHARED' | 'ARCHIVED';
  shareToken?: string | null;
  shareExpiresAt?: string | null;
  isPublic: boolean;
  notes?: string | null;
  createdAt: string;
  generatedAt: string;
  reportData: ProjectReportData;
  project: {
    id: string;
    name: string;
    prefix?: string;
  };
  generatedBy: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export default function SavedReportViewPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const { data: session, status: authStatus } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = useEffectiveRole();
  const isAdmin = role === 'ADMIN';

  const [report, setReport] = useState<SavedReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [revoking, setRevoking] = useState<boolean>(false);
  const [savingNotes, setSavingNotes] = useState<boolean>(false);

  // Notes editor
  const [showNotesEditor, setShowNotesEditor] = useState<boolean>(false);
  const [notesText, setNotesText] = useState<string>('');

  // Timeline
  const [activeTab, setActiveTab] = useState<TimelineTab>('ALL');
  const [expandedTransitions, setExpandedTransitions] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'completedAt' | 'priority' | 'assignee' | 'effort'>('completedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setReport(json.data);
      if (json.data.notes) {
        setNotesText(json.data.notes);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading report';
      toast.error(msg);
      router.push('/reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'loading') return;
    fetchReport();
  }, [reportId, authStatus]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDownloadPDF = async () => {
    if (!report) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/admin/reports/${report.id}/download`);
      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleShareReport = async () => {
    if (!report) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/admin/reports/${report.id}/share`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate share link');

      navigator.clipboard.writeText(json.data.shareUrl);
      toast.success('Public link created and copied to clipboard!');
      fetchReport();
    } catch {
      toast.error('Failed to share report');
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!report) return;
    if (!confirm('Are you sure you want to revoke the public share link?')) return;

    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: false,
          shareToken: null,
          shareExpiresAt: null,
          status: 'SAVED',
        }),
      });

      if (!res.ok) throw new Error('Failed to revoke share link');
      toast.success('Share link revoked successfully');
      fetchReport();
    } catch {
      toast.error('Failed to revoke share link');
    } finally {
      setRevoking(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!report) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notesText.trim() ? notesText.trim() : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update notes');
      toast.success('Notes updated successfully');
      setShowNotesEditor(false);
      fetchReport();
    } catch {
      toast.error('Failed to update notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleRefreshData = () => {
    if (!report) return;
    router.push('/reports/generate');
  };

  const toggleTransitions = (taskId: string) => {
    setExpandedTransitions((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const reportData = report?.reportData;

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

  if (loading || !report || !reportData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
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
  } = reportData;

  const maxStageCount = Math.max(...stageBreakdown.map((s) => s.totalItems), 1);
  const completionColor =
    completionRate >= 70 ? 'text-emerald-600' : completionRate >= 40 ? 'text-amber-600' : 'text-rose-600';
  const completionBg =
    completionRate >= 70 ? 'bg-emerald-500' : completionRate >= 40 ? 'bg-amber-500' : 'bg-rose-500';

  const shareUrl = report.shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/reports/shared/${report.shareToken}`
    : '';

  return (
    <div className="min-h-screen pb-16">
      {/* ── Top Action Bar ── */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2/95">
        {/* Left Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-violet-300/55">
          <button
            onClick={() => router.push('/reports')}
            className="flex items-center gap-1 font-medium hover:text-violet-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Reports</span>
          </button>
          <span>/</span>
          <span className="font-semibold text-slate-800 dark:text-violet-100/80">
            {projectName}
          </span>
          <span>/</span>
          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            {monthLabel}
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <>
              <button
                onClick={() => setShowNotesEditor((prev) => !prev)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  showNotesEditor || notesText
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-surface-dark-3 dark:text-violet-200/70'
                )}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{notesText ? 'Edit Notes' : 'Add Notes'}</span>
              </button>

              <button
                onClick={handleRefreshData}
                title={`Saved on ${format(new Date(report.generatedAt), 'dd MMM yyyy')}. Click to re-generate.`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-violet-200/70"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh Data</span>
              </button>
            </>
          )}

          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300"
          >
            {downloadingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Download PDF</span>
          </button>

          {isAdmin && (
            <>
              {!report.isPublic ? (
                <button
                  onClick={handleShareReport}
                  disabled={sharing}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 active:scale-[0.98] transition-all"
                >
                  {sharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                  <span>Share Report</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success('Share link copied!');
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Share Link</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">
        {/* ── Share Status Banner (Admin only) ── */}
        {isAdmin && report.isPublic && report.shareToken && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-blue-950 dark:text-blue-200">
                  This report is publicly shared via link
                </p>
                {report.shareExpiresAt && (
                  <p className="text-[11px] text-blue-700/80 dark:text-blue-300/70">
                    Link expires on {format(new Date(report.shareExpiresAt), 'dd MMMM yyyy')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-64 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs text-slate-700 select-all dark:border-blue-800 dark:bg-surface-dark-2 dark:text-violet-200/70"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Share link copied to clipboard!');
                }}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Copy
              </button>
              <button
                onClick={handleRevokeShare}
                disabled={revoking}
                className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400"
              >
                Revoke
              </button>
            </div>
          </div>
        )}

        {/* ── Inline Sliding Notes Editor ── */}
        <AnimatePresence>
          {showNotesEditor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
            >
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
                  <StickyNote className="h-4 w-4 text-amber-600" />
                  <span>Report Notes & Observations</span>
                </div>
                <button
                  onClick={() => setShowNotesEditor(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value.slice(0, 2000))}
                rows={3}
                placeholder="Add any notes, summary remarks, or context for this monthly report..."
                className="w-full rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-amber-800 dark:bg-surface-dark-2 dark:text-white"
              />

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {notesText.length}/2000 characters
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNotesEditor(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SECTION 0: Report Header Card ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-700 to-violet-800 p-8 text-white shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Company Logo"
                  className="h-12 w-12 rounded-xl bg-white/10 p-1 backdrop-blur object-contain border border-white/20"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 font-bold text-white border border-white/20">
                  <FileBarChart className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-violet-200">
                  {companyName}
                </p>
                <h1 className="text-2xl font-black text-white">{projectName}</h1>
                {projectDescription ? (
                  <p className="mt-1 text-sm text-violet-100/80 max-w-xl">
                    {projectDescription}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="text-left md:text-right">
              <span className="text-xs uppercase tracking-widest text-violet-200 font-semibold">
                Monthly Project Report (Saved Snapshot)
              </span>
              <p className="text-3xl font-extrabold text-white">{monthLabel}</p>
              <p className="text-xs text-violet-200/80 mt-1">
                Generated by {generatedBy} · Saved {format(new Date(report.generatedAt), 'dd MMM yyyy')}
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: Summary Cards & Overall Progress ── */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Items */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Items
                </p>
                <Briefcase className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
                {totalItems}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {totalTasks} tasks · {totalBugs} bugs
              </p>
            </div>

            {/* Card 2: Completed */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
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

            {/* Card 3: Actual Effort */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actual Effort
                </p>
                <Clock className="h-4 w-4 text-violet-500" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
                {formatEffort(effortSummary.totalActualMinutes)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Est: {formatEffort(effortSummary.totalEstimatedMinutes)}
              </p>
            </div>

            {/* Card 4: Team Members */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Team Members
                </p>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
                {members.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {workingDaysInMonth} working days in month
              </p>
            </div>
          </div>

          {/* Completion Rate Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-violet-200/70 mb-2">
              <span>Overall Completion Rate</span>
              <span className={completionColor}>{completionRate}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-surface-dark-3">
              <div
                style={{ width: `${Math.min(100, completionRate)}%` }}
                className={cn('h-full rounded-full transition-all duration-500', completionBg)}
              />
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Team Contribution ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-violet-900/30 dark:bg-surface-dark-2">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-violet-900/30 dark:bg-surface-dark-3/40">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-600" />
              <span>Team Contribution</span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500 dark:border-violet-900/30 dark:bg-surface-dark-3/20">
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
              <tbody className="divide-y divide-slate-100 dark:divide-violet-900/20">
                {members.map((m) => (
                  <tr key={m.userId} className="hover:bg-slate-50/50 dark:hover:bg-surface-dark-3/30">
                    <td className="py-3.5 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300 overflow-hidden">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.designation || 'Team Member'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-violet-300/55">
                      {m.department || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-700 dark:text-violet-200/70">
                      {m.tasksAssigned}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                      {m.tasksCompleted}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-600 dark:text-violet-300/55">
                      {m.tasksInProgress}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500">
                      {formatEffort(m.estimatedMinutes)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatEffort(m.actualMinutes)}
                    </td>
                    <td className="py-3.5 pl-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {m.contributionPercent}%
                        </span>
                        <div className="h-2 w-16 rounded-full bg-violet-100 overflow-hidden dark:bg-surface-dark-3">
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
              <tfoot className="border-t border-violet-100 bg-violet-50/50 font-bold text-slate-900 dark:border-violet-950 dark:bg-violet-950/20 dark:text-white">
                <tr>
                  <td className="py-3.5 pl-6 pr-4" colSpan={2}>
                    Total
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {members.reduce((s, m) => s + m.tasksAssigned, 0)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-emerald-600">
                    {members.reduce((s, m) => s + m.tasksCompleted, 0)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {members.reduce((s, m) => s + m.tasksInProgress, 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatEffort(effortSummary.totalEstimatedMinutes)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {formatEffort(effortSummary.totalActualMinutes)}
                  </td>
                  <td className="py-3.5 pl-4 pr-6 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── SECTION 3: Task Timeline ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-violet-900/30 dark:bg-surface-dark-2">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-violet-900/30 dark:bg-surface-dark-3/40">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-violet-600" />
              <span>Task Timeline</span>
            </h2>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-200/60 p-1 text-xs font-semibold dark:bg-surface-dark-3">
              {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'TASKS', 'BUGS'] as TimelineTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-lg px-3 py-1 transition-colors',
                    activeTab === tab
                      ? 'bg-white text-violet-600 shadow-xs dark:bg-surface-dark-3 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-violet-300/55'
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
              <thead className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500 dark:border-violet-900/30 dark:bg-surface-dark-3/20">
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
              <tbody className="divide-y divide-slate-100 dark:divide-violet-900/20">
                {filteredTasks.map((t) => {
                  const isCompleted = t.wasCompletedThisMonth;
                  const isNew = t.wasCreatedThisMonth;
                  const isExpanded = !!expandedTransitions[t.id];

                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        className={cn(
                          'hover:bg-slate-50/50 dark:hover:bg-surface-dark-3/30 transition-colors',
                          isCompleted && 'bg-emerald-50/30 border-l-4 border-l-emerald-500',
                          isNew && !isCompleted && 'border-l-4 border-l-blue-500'
                        )}
                      >
                        <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">
                          {t.taskId}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {t.title}
                            </span>
                            {isNew && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold',
                              t.itemType === 'BUG'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-surface-dark-3 dark:text-violet-200/70'
                            )}
                          >
                            {t.itemType === 'BUG' ? (
                              <Bug className="h-3 w-3" />
                            ) : (
                              <ListTodo className="h-3 w-3" />
                            )}
                            {t.itemType === 'BUG' ? 'Bug' : 'Task'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-semibold text-xs text-slate-700 dark:text-violet-200/70">
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 dark:text-violet-200/70 font-medium">
                          {t.assignee?.name || 'Unassigned'}
                        </td>
                        <td className="py-3.5 px-3 text-right text-xs text-slate-500">
                          {formatEffort(t.estimatedMinutes)}
                        </td>
                        <td className="py-3.5 px-3 text-right text-xs font-bold text-slate-900 dark:text-white">
                          {t.actualMinutes ? formatEffort(t.actualMinutes) : '—'}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-500">
                          {t.startStage}
                        </td>
                        <td className="py-3.5 px-3 text-xs font-semibold text-slate-800 dark:text-violet-100/80">
                          {t.endStage}
                        </td>
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
                              className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-surface-dark-3 dark:text-violet-200/70"
                            >
                              <span>{t.stageTransitions.length} moves</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Transitions row */}
                      {isExpanded && t.stageTransitions.length > 0 && (
                        <tr className="bg-slate-50/80 dark:bg-surface-dark-3/50">
                          <td colSpan={11} className="py-3 px-6">
                            <div className="space-y-1.5 pl-6 border-l-2 border-violet-400 text-xs">
                              {t.stageTransitions.map((st, i) => (
                                <div key={i} className="flex items-center gap-2 text-slate-700 dark:text-violet-200/70">
                                  <span className="font-medium text-slate-500">{st.from}</span>
                                  <span className="text-violet-600 font-bold">→</span>
                                  <span className="font-semibold text-slate-900 dark:text-white">{st.to}</span>
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
          {/* Section 4: Stage Breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Stage Breakdown (End of Month)
            </h2>
            <div className="space-y-3">
              {stageBreakdown.map((s) => {
                const barWidth = Math.max(8, Math.round((s.totalItems / maxStageCount) * 100));
                return (
                  <div key={s.stageName} className="flex items-center gap-3 text-xs">
                    <span className="w-28 truncate font-medium text-slate-700 dark:text-violet-200/70">
                      {s.stageName}
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden dark:bg-surface-dark-3">
                      <div
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: s.stageColor || '#8E51FF',
                        }}
                        className="h-full rounded-full"
                      />
                    </div>
                    <span className="w-16 text-right font-bold text-slate-900 dark:text-white">
                      {s.totalItems} items
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Bug Summary */}
          {bugSummary ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Bug className="h-4 w-4 text-rose-600" />
                <span>Bug Summary</span>
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Stats Grid */}
                <div className="space-y-2 text-xs border-r border-slate-100 pr-4 dark:border-violet-900/30">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-violet-900/30">
                    <span className="text-slate-500">Reported</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {bugSummary.totalReported}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-violet-900/30">
                    <span className="text-slate-500">Fixed</span>
                    <span className="font-bold text-emerald-600">
                      {bugSummary.totalFixed}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-violet-900/30">
                    <span className="text-slate-500">Verified</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {bugSummary.totalVerified}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Reopened</span>
                    <span className={cn('font-bold', bugSummary.totalReopened > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white')}>
                      {bugSummary.totalReopened}
                    </span>
                  </div>
                </div>

                {/* Severities */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-violet-900/30">
                    <span className="font-semibold text-rose-600">Critical</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {bugSummary.criticalCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-violet-900/30">
                    <span className="font-semibold text-amber-600">High</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {bugSummary.highCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-violet-900/30">
                    <span className="font-semibold text-yellow-600">Medium</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {bugSummary.mediumCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Avg. Fix Time</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {bugSummary.avgTimeToFix ? formatEffort(bugSummary.avgTimeToFix) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex items-center justify-center text-slate-400 text-sm dark:border-violet-900/30 dark:bg-surface-dark-2">
              No bugs reported in this project.
            </div>
          )}
        </div>

        {/* ── SECTION 6: Effort Analysis ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Effort Analysis
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Col 1: Totals & Variance */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-violet-900/30 dark:bg-surface-dark-3/30">
              <p className="text-xs uppercase font-bold text-slate-500">Estimated Total</p>
              <p className="text-xl font-bold text-slate-700 dark:text-violet-200/70 mt-1">
                {formatEffort(effortSummary.totalEstimatedMinutes)}
              </p>

              <p className="text-xs uppercase font-bold text-slate-500 mt-4">Actual Total</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
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

            {/* Col 2: Per-member Mini Table */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-violet-900/30 dark:bg-surface-dark-3/30 overflow-y-auto max-h-56">
              <p className="text-xs font-bold uppercase text-slate-500 mb-2">Per-Member Effort</p>
              <div className="space-y-2 text-xs">
                {effortSummary.memberEffort.map((me) => (
                  <div
                    key={me.userId}
                    className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-violet-900/40"
                  >
                    <span className="font-semibold text-slate-800 dark:text-violet-100/80 truncate w-24">
                      {me.name}
                    </span>
                    <span className="text-slate-500">Est: {formatEffort(me.estimatedMinutes)}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      Act: {formatEffort(me.actualMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Col 3: Completion Gauge */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center justify-center dark:border-violet-900/30 dark:bg-surface-dark-3/30">
              <p className="text-xs font-bold uppercase text-slate-500 mb-2">Completion Rate</p>
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="38"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-slate-200 dark:text-violet-400/30"
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

        {/* ── SECTION 7: Admin Notes Card ── */}
        {notesText ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20">
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-600" />
              <span>Notes & Observations</span>
            </h2>
            <p className="text-sm text-slate-800 dark:text-violet-100/80 whitespace-pre-wrap leading-relaxed">
              {notesText}
            </p>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              — {generatedBy}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
