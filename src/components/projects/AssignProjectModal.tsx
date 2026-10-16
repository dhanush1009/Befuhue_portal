'use client';

import { useState } from 'react';
import { X, Loader2, FolderKanban, ShieldCheck, User, Calendar, IndianRupee, Building2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useEmployeeList } from '@/hooks/useTasks';
import { useCreateProject } from '@/hooks/useProjects';
import type { ProjectStatus } from '@/types';

interface AssignProjectModalProps {
  onClose: () => void;
  defaultClientId?: string;
}

export function AssignProjectModal({ onClose, defaultClientId }: AssignProjectModalProps) {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeeList();
  const createProject = useCreateProject();

  const [clientId,           setClientId]           = useState(defaultClientId ?? '');
  const [name,               setName]               = useState('');
  const [description,        setDescription]        = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [deadline,           setDeadline]           = useState('');
  const [status,             setStatus]             = useState<ProjectStatus>('ACTIVE');
  const [amount,             setAmount]             = useState('');
  const [currency,           setCurrency]           = useState('INR');
  const [prefix,             setPrefix]             = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !name.trim()) return;

    createProject.mutate(
      {
        clientId,
        name:               name.trim(),
        description:        description.trim() || undefined,
        prefix:             prefix.trim() || undefined,
        assignedEmployeeId: assignedEmployeeId || undefined,
        deadline:           deadline || undefined,
        status,
        amount:             amount ? parseFloat(amount) : undefined,
        currency,
      },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-light dark:bg-brand/10 text-brand flex items-center justify-center">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">Assign Client Project</h2>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Assign project to employee with details, deadline and budget</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Client Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-500" /> Client Name <span className="text-status-absent">*</span>
            </label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Project Name & Project Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                Project Name <span className="text-status-absent">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Website Redesign & SEO"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!prefix && e.target.value.length >= 3) {
                    setPrefix(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase());
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                Code / Prefix
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="e.g. WEB"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white uppercase font-mono focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>
          </div>

          {/* Project Details */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
              Project Details & Scope
            </label>
            <textarea
              rows={3}
              placeholder="Outline project deliverables, requirements, tech stack, milestones..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none resize-none placeholder:text-zinc-400"
            />
          </div>

          {/* Assigned Employee & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-500" /> Assigned Employee
              </label>
              <select
                value={assignedEmployeeId}
                onChange={(e) => setAssignedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="">Unassigned (Assign later)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.designation ? `(${emp.designation})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Project Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>
          </div>

          {/* Project Status */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
              Project Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'ACTIVE', label: 'Active' },
                { key: 'ON_HOLD', label: 'On Hold' },
                { key: 'COMPLETED', label: 'Completed' },
                { key: 'CANCELLED', label: 'Cancelled' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key as ProjectStatus)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                    status === s.key
                      ? 'border-brand bg-brand-light text-brand dark:bg-brand/10 dark:text-brand shadow-xs'
                      : 'border-gray-300 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confidential Project Amount (ADMIN ACCESS ONLY) */}
          <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" /> Project Amount (Confidential — Admin View Only)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200">
                Protected Field
              </span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/80 leading-relaxed font-medium">
              This amount is stored securely and is strictly hidden from employees in the API and UI. Only authorized admins can view or export financial details.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                  Budget / Fee Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 75000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-white/10 rounded-lg text-zinc-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProject.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {createProject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Assign Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
