'use client';

import { useState } from 'react';
import { X, Loader2, FolderKanban, ShieldCheck, User, Calendar, Building2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useEmployeeList } from '@/hooks/useTasks';
import { useUpdateProject } from '@/hooks/useProjects';
import type { Project, ProjectStatus } from '@/types';

interface EditProjectModalProps {
  project: Project;
  isAdmin: boolean;
  onClose: () => void;
}

export function EditProjectModal({ project, isAdmin, onClose }: EditProjectModalProps) {
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployeeList();
  const updateProject = useUpdateProject();

  const [clientId,           setClientId]           = useState(project.clientId);
  const [name,               setName]               = useState(project.name);
  const [description,        setDescription]        = useState(project.description ?? '');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(project.assignedEmployeeId ?? '');
  const [deadline,           setDeadline]           = useState(
    project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) :
    project.targetDate ? new Date(project.targetDate).toISOString().slice(0, 10) : ''
  );
  const [status,             setStatus]             = useState<ProjectStatus>(project.status);
  const [amount,             setAmount]             = useState(project.amount != null ? String(project.amount) : '');
  const [currency,           setCurrency]           = useState(project.currency ?? 'INR');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAdmin) {
      updateProject.mutate(
        {
          id:                 project.id,
          clientId,
          name:               name.trim(),
          description:        description.trim() || null,
          assignedEmployeeId: assignedEmployeeId || null,
          deadline:           deadline || null,
          status,
          amount:             amount ? parseFloat(amount) : null,
          currency,
        },
        {
          onSuccess: () => onClose(),
        },
      );
    } else {
      // Employee updating status
      updateProject.mutate(
        {
          id:     project.id,
          status,
        },
        {
          onSuccess: () => onClose(),
        },
      );
    }
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
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                {isAdmin ? 'Edit Project Details' : 'Update Project Progress'}
              </h2>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {project.prefix} · {project.name}
              </p>
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
          {isAdmin ? (
            <>
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
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Project Name <span className="text-status-absent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
                />
              </div>

              {/* Project Details */}
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Project Details & Scope
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none resize-none"
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
                    <option value="">Unassigned</option>
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

              {/* Confidential Project Amount (ADMIN ONLY) */}
              <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" /> Project Amount (Confidential — Admin View Only)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200">
                    Protected Field
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                      Budget / Amount
                    </label>
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
            </>
          ) : (
            /* Employee Read-only info with status update */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 space-y-2">
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Client</p>
                <p className="text-sm font-bold text-zinc-950 dark:text-white">{project.client?.name ?? '—'}</p>
                
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 pt-2">Project Details</p>
                <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line">{project.description || 'No description provided.'}</p>

                {deadline && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Deadline</p>
                    <p className="text-sm font-bold text-zinc-950 dark:text-white">{deadline}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Project Status Selection (Available to Admin and Assigned Employee) */}
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
              disabled={updateProject.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {updateProject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
