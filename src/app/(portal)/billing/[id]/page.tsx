'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Briefcase,
  Building2,
  LayoutGrid,
  Search,
  FolderKanban,
  CheckSquare,
  ShieldAlert,
  ArrowLeft,
  DollarSign,
  Download,
  Loader2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAgencyProjects, downloadAgencyAllProjectsExcel } from '@/hooks/useBilling';
import { ProjectCard } from '@/components/billing/ProjectCard';
import { PageLoader } from '@/components/shared/PageLoader';
import { BillingFilterDropdown } from '@/components/billing/BillingFilterDropdown';
import { cn } from '@/lib/utils';

export default function AgencyProjectsPage() {
  const params = useParams();
  const rawId = (params?.id as string) ?? '';
  const agencyId = decodeURIComponent(rawId);

  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading: dataLoading, error } = useAgencyProjects(agencyId);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CLIENTS'>('ALL');
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const agency = data?.agency;
  const projects = data?.projects ?? [];

  // Dropdown list items for Clients under this agency
  const clientDropdownItems = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; projectCount: number; taskCount: number }
    >();
    for (const p of projects) {
      if (p.clientName) {
        const key = p.clientId || p.clientName;
        if (!map.has(key)) {
          map.set(key, { id: key, name: p.clientName, projectCount: 0, taskCount: 0 });
        }
        const item = map.get(key)!;
        item.projectCount += 1;
        item.taskCount += p.totalTasks;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: `${c.projectCount} ${c.projectCount === 1 ? 'project' : 'projects'} · ${c.taskCount} ${c.taskCount === 1 ? 'task' : 'tasks'}`,
        badge: c.projectCount,
      }));
  }, [projects]);

  const selectedClientName = useMemo(() => {
    if (filterType !== 'CLIENTS' || !selectedSubItemId) return null;
    return clientDropdownItems.find((c) => c.id === selectedSubItemId)?.name ?? null;
  }, [filterType, selectedSubItemId, clientDropdownItems]);

  // Filter projects by search, filterType, and specific selected client
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filterType === 'CLIENTS') {
        if (selectedSubItemId) {
          const matches = p.clientId === selectedSubItemId || p.clientName === selectedSubItemId;
          if (!matches) return false;
        }
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchPrefix = p.prefix.toLowerCase().includes(q);
      const matchClient = p.clientName?.toLowerCase().includes(q);
      return matchName || matchPrefix || matchClient;
    });
  }, [projects, search, filterType, selectedSubItemId]);

  const handleExportAll = () => {
    if (!agency) return;
    setIsExportingAll(true);
    try {
      downloadAgencyAllProjectsExcel(agency.id, agency.name, { search });
    } finally {
      setTimeout(() => setIsExportingAll(false), 800);
    }
  };

  if (authLoading || dataLoading) {
    return <PageLoader />;
  }

  // Security check: Only Admin
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="size-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <ShieldAlert className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Admin Authorization Required
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mb-6">
          The Billing and Financial Management section is strictly confidential and reserved for authorized administrators.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-colors"
        >
          <ArrowLeft className="size-4" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  if (error || !agency) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Briefcase className="size-16 text-gray-300 dark:text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Agency Not Found</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mb-6">
          The requested agency could not be located or has no active projects in the system.
        </p>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to Billing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
        <Link href="/billing" className="hover:text-brand transition-colors">
          Billing
        </Link>
        <ChevronRight className="size-3.5 text-gray-400" />
        <span className="text-gray-900 dark:text-white font-semibold truncate max-w-xs">
          {agency.name}
        </span>
      </nav>

      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Link
              href="/billing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Back to Agencies
            </Link>
            <span className="text-xs text-gray-300 dark:text-zinc-600">|</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-brand/10 text-brand border border-brand/20">
              Agency Projects
            </span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Briefcase className="size-6 text-brand" />
            {agency.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Displaying all client projects and billing summaries belonging exclusively to {agency.name}.
          </p>
        </div>

        {/* Export All Projects Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportAll}
            disabled={isExportingAll || projects.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {isExportingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span>Export All Projects (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Agency Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <FolderKanban className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Agency Projects
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {agency.totalProjects}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckSquare className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Agency Tasks
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {agency.totalTasks}
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 ml-2">
                ({agency.completedTasks} completed)
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-brand/30 dark:border-brand/40 bg-gradient-to-br from-brand/[0.04] to-transparent p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="size-3.5" /> Total Agency Billing
            </p>
            <p className="text-2xl font-black text-brand tracking-tight mt-0.5">
              ₹{agency.totalBilling.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* Search Input & Dropdown Filter Buttons */}
      <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder={
              filterType === 'CLIENTS'
                ? 'Search client projects by name or client...'
                : 'Search projects by project name, prefix, or client name...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        {/* Dropdown / Filter buttons near right */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-1 bg-gray-100 dark:bg-surface-dark-3/80 border border-gray-200/80 dark:border-white/10 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => {
                setFilterType('ALL');
                setSelectedSubItemId(null);
              }}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                filterType === 'ALL'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>All</span>
            </button>

            <BillingFilterDropdown
              label="Clients"
              icon={<Building2 className="size-3.5" />}
              isActive={filterType === 'CLIENTS'}
              selectedId={selectedSubItemId}
              selectedLabel={selectedClientName}
              allOptionLabel="All Clients"
              allOptionCount={clientDropdownItems.length}
              items={clientDropdownItems}
              onSelectAll={() => {
                setFilterType('CLIENTS');
                setSelectedSubItemId(null);
              }}
              onSelectItem={(id) => {
                setFilterType('CLIENTS');
                setSelectedSubItemId(id);
              }}
            />
          </div>
        </div>
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-12 text-center shadow-xs">
          <FolderKanban className="size-12 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            No Projects Found
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
            {search.trim()
              ? `No projects matched "${search}". Try another search term.`
              : 'No projects matching the selected filter are currently available.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} agencyId={agency.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
