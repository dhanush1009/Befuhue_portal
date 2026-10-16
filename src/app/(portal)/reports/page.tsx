'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffectiveRole } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import {
  FileBarChart2,
  Plus,
  Download,
  Share2,
  Trash2,
  Link as LinkIcon,
  Loader2,
  Calendar,
  CalendarDays,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ProjectReportData } from '@/types/report';
import { useReports } from '@/hooks/useReports';

interface SavedReportItem {
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

interface ProjectOption {
  id: string;
  name: string;
}

const MONTHS = [
  { value: 0, label: 'All Months' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getPreviousMonth = () => {
  const now = new Date();
  const prevMonth = now.getMonth(); // getMonth() is 0-based, so this gives previous month
  const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return {
    month: prevMonth === 0 ? 12 : prevMonth,
    year: prevYear,
  };
};

function formatEffort(mins: number | null | undefined): string {
  if (!mins) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ReportsListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = useEffectiveRole();
  const isAdmin = role === 'ADMIN';

  const prev = getPreviousMonth();
  const currentYear = new Date().getFullYear();

  // State for all 3 filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(prev.month);
  const [selectedYear, setSelectedYear] = useState<number>(prev.year);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Year options (2024 to current year)
  const YEARS = Array.from(
    { length: currentYear - 2023 },
    (_, i) => currentYear - i
  );

  // Use the useReports hook passing all 3 filters
  const {
    data: reports = [],
    isLoading: loading,
    refetch: fetchReports,
  } = useReports(
    selectedProjectId !== 'all' ? selectedProjectId : undefined,
    selectedYear,
    selectedMonth !== 0 ? selectedMonth : undefined
  );

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects');
        const json = await res.json();
        if (json.data) setProjects(json.data);
      } catch {
        // silently fail
      }
    }
    loadProjects();
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDownloadPDF = async (e: React.MouseEvent, report: SavedReportItem) => {
    e.stopPropagation();
    try {
      toast.info('Preparing PDF download...');
      const res = await fetch(`/api/admin/reports/${report.id}/download`);
      if (!res.ok) throw new Error('Failed to download PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Downloaded PDF successfully');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const handleShare = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    setSharingId(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/share`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to share report');

      navigator.clipboard.writeText(json.data.shareUrl);
      toast.success('Public link copied to clipboard!');
      fetchReports();
    } catch {
      toast.error('Failed to share report');
    } finally {
      setSharingId(null);
    }
  };

  const handleCopyExistingLink = (e: React.MouseEvent, token: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/reports/shared/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied to clipboard!');
  };

  const handleDelete = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this report snapshot?')) return;

    setDeletingId(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete report');

      toast.success('Report deleted successfully');
      fetchReports();
    } catch {
      toast.error('Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
            <FileBarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Project Reports
            </h1>
            <p className="text-xs text-slate-500 dark:text-violet-300/55">
              Monthly executive summaries, effort tracking, and timeline snapshots.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              const queryMonth = selectedMonth !== 0 ? selectedMonth : prev.month;
              const queryParams = new URLSearchParams({
                month: String(queryMonth),
                year: String(selectedYear),
              });
              if (selectedProjectId !== 'all') {
                queryParams.set('projectId', selectedProjectId);
              }
              router.push(`/reports/generate?${queryParams.toString()}`);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Report</span>
          </button>
        )}
      </div>

      {/* ── Filter Bar (3 filters side by side + Clear Filters) ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
        {/* Project filter */}
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-slate-400" />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-44 h-9 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-sm font-medium text-slate-700 cursor-pointer focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-violet-100/80"
          >
            <option value="all">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Month filter */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-36 h-9 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-sm font-medium text-slate-700 cursor-pointer focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-violet-100/80"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-28 h-9 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-sm font-medium text-slate-700 cursor-pointer focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-violet-100/80"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Clear filters — only shown when any filter is active */}
        {(selectedProjectId !== 'all' || selectedMonth !== 0 || selectedYear !== currentYear) && (
          <button
            onClick={() => {
              setSelectedProjectId('all');
              setSelectedMonth(0);
              setSelectedYear(currentYear);
            }}
            className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer underline-offset-2 hover:underline transition-colors ml-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Reports Grid ── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : reports.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs dark:border-violet-900/30 dark:bg-surface-dark-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-surface-dark-3 dark:text-violet-300/45 mb-4">
            <FileBarChart2 className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No reports generated yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            Generate your first monthly report to analyze project timeline, team contribution, and efforts.
          </p>
          {isAdmin && (
            <button
              onClick={() => {
                const queryMonth = selectedMonth !== 0 ? selectedMonth : prev.month;
                router.push(`/reports/generate?month=${queryMonth}&year=${selectedYear}`);
              }}
              className="mt-5 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Generate your first report</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reports.map((rep: SavedReportItem) => {
            const data = rep.reportData;
            const totalItems = data.totalItems ?? 0;
            const completionRate = data.completionRate ?? 0;
            const actualMinutes = data.effortSummary?.totalActualMinutes ?? 0;
            const members = data.members || [];
            const displayMembers = members.slice(0, 5);
            const extraCount = members.length - 5;
            const lastDayOfMonth = new Date(rep.year, rep.month, 0).getDate();

            return (
              <motion.div
                key={rep.id}
                onClick={() => router.push(`/reports/${rep.id}`)}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-violet-300 hover:shadow-md cursor-pointer dark:border-violet-900/30 dark:bg-surface-dark-2 dark:hover:border-violet-700"
              >
                <div>
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {rep.project.name}
                      </span>
                      {rep.project.prefix && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-surface-dark-3 dark:text-violet-300/55">
                          {rep.project.prefix}
                        </span>
                      )}
                    </div>

                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        rep.status === 'SHARED'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : rep.status === 'SAVED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-surface-dark-3 dark:text-violet-300/55'
                      )}
                    >
                      {rep.status}
                    </span>
                  </div>

                  {/* Month + Year */}
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {MONTH_NAMES[rep.month]} {rep.year}
                  </p>

                  {/* Subtitle date range */}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {MONTH_NAMES[rep.month]} 1 – {MONTH_NAMES[rep.month]} {lastDayOfMonth}, {rep.year}
                  </p>

                  {/* Quick stats row */}
                  <p className="mt-2 text-xs text-slate-500 dark:text-violet-300/55">
                    {totalItems} items · {completionRate}% complete · {formatEffort(actualMinutes)} logged
                  </p>

                  {/* Team Avatars */}
                  <div className="mt-4 flex items-center gap-1">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {displayMembers.map((m, i) => (
                        <div
                          key={m.userId || i}
                          title={m.name}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 ring-2 ring-white text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:ring-surface-dark-2 dark:text-violet-300 overflow-hidden"
                        >
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                    {extraCount > 0 && (
                      <span className="text-[10px] font-semibold text-slate-500 pl-1">
                        +{extraCount} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom row & Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between dark:border-violet-900/30">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700 overflow-hidden dark:bg-surface-dark-3 dark:text-violet-200/70">
                      {rep.generatedBy.avatarUrl ? (
                        <img src={rep.generatedBy.avatarUrl} alt={rep.generatedBy.name} className="h-full w-full object-cover" />
                      ) : (
                        rep.generatedBy.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 truncate max-w-[120px]">
                      {rep.generatedBy.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      · {formatDistanceToNow(new Date(rep.generatedAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleDownloadPDF(e, rep)}
                      title="Download PDF"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-surface-dark-3 dark:hover:text-violet-100/80"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>

                    {rep.status === 'SHARED' && rep.shareToken && (
                      <button
                        onClick={(e) => handleCopyExistingLink(e, rep.shareToken!)}
                        title="Copy Public Link"
                        className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          onClick={(e) => handleShare(e, rep.id)}
                          title="Share Link"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-surface-dark-3"
                        >
                          {sharingId === rep.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Share2 className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <button
                          onClick={(e) => handleDelete(e, rep.id)}
                          title="Delete Report"
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          {deletingId === rep.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
