'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
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
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAgencySummaries } from '@/hooks/useBilling';
import { AgencyCard } from '@/components/billing/AgencyCard';
import { PageLoader } from '@/components/shared/PageLoader';
import { BillingFilterDropdown } from '@/components/billing/BillingFilterDropdown';
import { cn } from '@/lib/utils';

export default function BillingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: agencies = [], isLoading: dataLoading } = useAgencySummaries();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'AGENCIES' | 'CLIENTS'>('ALL');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const isAdmin = user?.role === 'ADMIN';

  // Overall KPI aggregates across all agencies
  const kpis = useMemo(() => {
    let totalAgencies = 0;
    let totalProjects = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let totalBilling = 0;

    for (const ag of agencies) {
      if (ag.clientType === 'AGENCY') totalAgencies++;
      totalProjects += ag.totalProjects;
      totalTasks += ag.totalTasks;
      completedTasks += ag.completedTasks;
      totalBilling += ag.totalBilling;
    }

    return {
      totalAgencies: totalAgencies || agencies.length,
      totalProjects,
      totalTasks,
      completedTasks,
      totalBilling,
    };
  }, [agencies]);

  // Dropdown list items for Agencies
  const agencyDropdownItems = useMemo(() => {
    return agencies
      .filter((a) => a.clientType === 'AGENCY')
      .map((a) => ({
        id: a.id,
        name: a.name,
        subtitle: `${a.totalProjects} ${a.totalProjects === 1 ? 'project' : 'projects'} · ${a.totalTasks} ${a.totalTasks === 1 ? 'task' : 'tasks'}`,
        badge: a.totalProjects,
      }));
  }, [agencies]);

  // Dropdown list items for Clients
  const clientDropdownItems = useMemo(() => {
    return agencies
      .filter((c) => c.clientType === 'CLIENT')
      .map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: `${c.totalProjects} ${c.totalProjects === 1 ? 'project' : 'projects'} · ${c.totalTasks} ${c.totalTasks === 1 ? 'task' : 'tasks'}`,
        badge: c.totalProjects,
      }));
  }, [agencies]);

  const selectedAgencyName = useMemo(() => {
    if (filterType !== 'AGENCIES' || !selectedEntityId) return null;
    return agencies.find((a) => a.id === selectedEntityId)?.name ?? null;
  }, [filterType, selectedEntityId, agencies]);

  const selectedClientName = useMemo(() => {
    if (filterType !== 'CLIENTS' || !selectedEntityId) return null;
    return agencies.find((a) => a.id === selectedEntityId)?.name ?? null;
  }, [filterType, selectedEntityId, agencies]);

  // Filtered agencies by search, filterType, and specific selected entity
  const filteredAgencies = useMemo(() => {
    return agencies.filter((item) => {
      if (filterType === 'AGENCIES') {
        if (item.clientType !== 'AGENCY') return false;
        if (selectedEntityId && item.id !== selectedEntityId) return false;
      }
      if (filterType === 'CLIENTS') {
        if (item.clientType !== 'CLIENT') return false;
        if (selectedEntityId && item.id !== selectedEntityId) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchRef = item.billingReference?.toLowerCase().includes(q);
      return matchName || matchRef;
    });
  }, [agencies, search, filterType, selectedEntityId]);

  if (authLoading || dataLoading) {
    return <PageLoader />;
  }

  // Strict UI security check: Admin only
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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20">
              <Briefcase className="size-3.5" /> Agency Billing System
            </span>
            <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">Confidential</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Agency Billing Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Track agency-wise client projects, task performance metrics, and confidential billing totals.
          </p>
        </div>
      </div>

      {/* Aggregate KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <Briefcase className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Agencies
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {kpis.totalAgencies}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <FolderKanban className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Projects
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {kpis.totalProjects}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckSquare className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Tasks Across Projects
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {kpis.totalTasks}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-brand/30 dark:border-brand/40 bg-gradient-to-br from-brand/[0.04] to-transparent p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="size-3.5" /> Grand Billing Total
            </p>
            <p className="text-2xl font-black text-brand tracking-tight mt-0.5">
              ₹{kpis.totalBilling.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar & Dropdown Filter Buttons */}
      <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder={
              filterType === 'AGENCIES'
                ? 'Search agencies by name or reference ID...'
                : filterType === 'CLIENTS'
                  ? 'Search clients by name or reference ID...'
                  : 'Search agencies and clients by name or reference ID...'
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
                setSelectedEntityId(null);
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
              label="Agencies"
              icon={<Briefcase className="size-3.5" />}
              isActive={filterType === 'AGENCIES'}
              selectedId={selectedEntityId}
              selectedLabel={selectedAgencyName}
              allOptionLabel="All Agencies"
              allOptionCount={agencyDropdownItems.length}
              items={agencyDropdownItems}
              onSelectAll={() => {
                setFilterType('AGENCIES');
                setSelectedEntityId(null);
              }}
              onSelectItem={(id) => {
                setFilterType('AGENCIES');
                setSelectedEntityId(id);
              }}
            />

            <BillingFilterDropdown
              label="Clients"
              icon={<Building2 className="size-3.5" />}
              isActive={filterType === 'CLIENTS'}
              selectedId={selectedEntityId}
              selectedLabel={selectedClientName}
              allOptionLabel="All Clients"
              allOptionCount={clientDropdownItems.length}
              items={clientDropdownItems}
              onSelectAll={() => {
                setFilterType('CLIENTS');
                setSelectedEntityId(null);
              }}
              onSelectItem={(id) => {
                setFilterType('CLIENTS');
                setSelectedEntityId(id);
              }}
            />
          </div>
        </div>
      </div>

      {/* Agency & Client Cards Grid */}
      {filteredAgencies.length === 0 ? (
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-12 text-center shadow-xs">
          {filterType === 'CLIENTS' ? (
            <Building2 className="size-12 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
          ) : (
            <Briefcase className="size-12 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
          )}
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            {filterType === 'AGENCIES'
              ? 'No Agencies Found'
              : filterType === 'CLIENTS'
                ? 'No Clients Found'
                : 'No Records Found'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
            {search.trim()
              ? `No records matched "${search}". Try searching with a different keyword.`
              : 'No records matching the selected filter are currently available.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgencies.map((agency) => (
            <AgencyCard key={agency.id} item={agency} />
          ))}
        </div>
      )}
    </div>
  );
}
