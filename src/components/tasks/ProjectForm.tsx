'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Trash2, FolderOpen, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import type { Project } from '@/types';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  clientId:    z.string().min(1, 'Client is required'),
  name:        z.string().min(1, 'Name is required').max(100),
  prefix:      z.string().min(1, 'Prefix is required').max(10)
                .regex(/^[A-Z0-9]+$/, 'Uppercase letters and numbers only')
                .transform((v) => v.toUpperCase()),
  description: z.string().max(300).optional(),
});

type FormValues = z.infer<typeof schema>;

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';
const LABEL = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ project, onClose }: { project: Project; onClose: () => void }) {
  const deleteProject = useDeleteProject();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-status-absent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Delete "{project.name}"?</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
              This cannot be undone. Projects with tasks cannot be deleted.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteProject.mutate(project.id, { onSuccess: onClose })}
            disabled={deleteProject.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-status-absent text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors duration-150"
          >
            {deleteProject.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface ProjectFormProps {
  onClose: () => void;
}

export function ProjectForm({ onClose }: ProjectFormProps) {
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useClients();
  const createProject = useCreateProject();
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientId: '', name: '', prefix: '', description: '' },
  });

  function onSubmit(data: FormValues) {
    createProject.mutate(data, { onSuccess: () => reset() });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Manage Projects</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Create form */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-violet-900/30">
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-4">New Project</p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className={LABEL}>Client *</label>
                  <select {...register('clientId')} className={IC}>
                    <option value="">Select client...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {errors.clientId && <p className="text-xs text-status-absent mt-1">{errors.clientId.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className={LABEL}>Project Name *</label>
                    <input {...register('name')} className={IC} placeholder="e.g. Website Revamp" />
                    {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className={LABEL}>Prefix *</label>
                    <input
                      {...register('prefix')}
                      className={cn(IC, 'uppercase')}
                      placeholder="e.g. TP"
                      maxLength={10}
                      onInput={(e) => {
                        const t = e.currentTarget;
                        t.value = t.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      }}
                    />
                    {errors.prefix
                      ? <p className="text-xs text-status-absent mt-1">{errors.prefix.message}</p>
                      : <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">Used for task IDs, e.g. TP-001</p>
                    }
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Description</label>
                  <textarea {...register('description')} rows={2} className={cn(IC, 'resize-none')} placeholder="Optional description..." />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={createProject.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
                  >
                    {createProject.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create Project
                  </button>
                </div>
              </form>
            </div>

            {/* Existing projects list */}
            <div className="px-6 py-5">
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">
                Existing Projects {projects.length > 0 && `(${projects.length})`}
              </p>

              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-gray-100 dark:bg-surface-dark-3 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <FolderOpen className="w-8 h-8 text-gray-300 dark:text-violet-400/35 mb-2" />
                  <p className="text-sm text-gray-400 dark:text-violet-300/45">No projects yet. Create one above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-surface-dark-3 rounded-lg border border-gray-100 dark:border-violet-900/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</span>
                          <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-brand-light text-brand dark:bg-violet-900/30 dark:text-violet-300 shrink-0">
                            {p.prefix}
                          </span>
                        </div>
                        {p.client?.name && (
                          <p className="text-xs text-violet-500 dark:text-violet-300/70 truncate mt-0.5">{p.client.name}</p>
                        )}
                        {p.description && (
                          <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate mt-0.5">{p.description}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
                          {(p as Project & { _count?: { tasks: number } })._count?.tasks ?? 0} task(s)
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmDelete(p)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 shrink-0 ml-3"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <DeleteConfirm project={confirmDelete} onClose={() => setConfirmDelete(null)} />
      )}
    </>
  );
}
