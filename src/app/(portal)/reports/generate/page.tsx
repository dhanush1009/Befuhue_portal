'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffectiveRole } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { FileBarChart, Loader2, ArrowRight, Calendar, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectOption {
  id: string;
  name: string;
  prefix?: string;
  _count?: { tasks: number };
}

const MONTHS = [
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

const getPreviousMonth = () => {
  const now = new Date();
  const prevMonth = now.getMonth();
  const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return {
    month: prevMonth === 0 ? 12 : prevMonth,
    year: prevYear,
  };
};

function GenerateReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = useEffectiveRole();
  const isAdmin = role === 'ADMIN';

  const prev = getPreviousMonth();
  const paramMonth = searchParams.get('month');
  const paramYear = searchParams.get('year');
  const paramProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(paramProjectId || '');
  const [selectedMonth, setSelectedMonth] = useState<number>(
    paramMonth ? Number(paramMonth) : prev.month
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    paramYear ? Number(paramYear) : prev.year
  );
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 2 }, (_, i) => 2024 + i);

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }

    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        const json = await res.json();
        if (json.data) {
          setProjects(json.data);
          if (!paramProjectId && json.data.length > 0) {
            setSelectedProjectId(json.data[0].id);
          }
        }
      } catch {
        toast.error('Failed to load projects');
      } finally {
        setLoadingProjects(false);
      }
    }

    fetchProjects();
  }, [isAdmin, router, status, paramProjectId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/admin/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          month: Number(selectedMonth),
          year: Number(selectedYear),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to generate report');
      }

      // Store generated report in sessionStorage for the preview page
      sessionStorage.setItem('current_project_report', JSON.stringify(json.data));
      sessionStorage.setItem(
        'current_report_query',
        JSON.stringify({
          projectId: selectedProjectId,
          month: Number(selectedMonth),
          year: Number(selectedYear),
        })
      );

      toast.success('Report generated successfully!');
      router.push('/reports/preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating report';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (status === 'loading' || loadingProjects) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-violet-900/30 dark:bg-surface-dark-2"
      >
        {/* Header Band */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50/70 via-violet-50/30 to-transparent p-6 dark:border-violet-900/30 dark:from-violet-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm shadow-violet-600/20">
              <FileBarChart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Generate Monthly Project Report
              </h1>
              <p className="text-sm text-slate-500 dark:text-violet-300/55">
                Auto-generate comprehensive insights on team effort, tasks & timeline.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="p-6 space-y-6">
          {/* Project selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-violet-200/70 mb-2">
              Select Project
            </label>
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-10 text-sm font-medium text-slate-900 shadow-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-white cursor-pointer"
              >
                <option value="" disabled>
                  Select a project...
                </option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} ({proj._count?.tasks ?? 0} tasks)
                  </option>
                ))}
              </select>
              <FolderKanban className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Month & Year Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-violet-200/70 mb-2">
                Month
              </label>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-8 text-sm font-medium text-slate-900 shadow-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-white cursor-pointer"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <Calendar className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-violet-200/70 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-white cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={generating || !selectedProjectId}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 px-4 text-sm font-semibold text-white shadow-sm shadow-violet-600/30 transition-all hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <span>Generate Report</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function GenerateReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <GenerateReportForm />
    </Suspense>
  );
}
