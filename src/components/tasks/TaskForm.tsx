'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Plus, FolderPlus, ChevronDown, GitBranch, Trash2, UserPlus, Lock, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { createTaskSchema } from '@/lib/validations/task';
import { useCreateTask, useEmployeeList, useTasks } from '@/hooks/useTasks';
import { useClients, useCreateClient } from '@/hooks/useClients';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { EffortInput } from './EffortInput';
import { AssignPeople, chosenPeople, peopleValid, type PersonRow } from './AssignPeople';
import type { AssignMode } from '@/lib/taskAssignment';
import { TEAM_CONFIG } from '@/lib/teamConfig';
import type { TaskStatus, Team } from '@prisma/client';

type FormValues = z.output<typeof createTaskSchema>;

// ── Inline new-client / new-project schemas ─────────────────────────────────

const newClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});
type NewClientValues = z.infer<typeof newClientSchema>;

const newProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  prefix: z.string().min(1, 'Prefix is required').max(10)
    .regex(/^[A-Z0-9]+$/, 'Uppercase letters and numbers only'),
});
type NewProjectValues = z.infer<typeof newProjectSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskFormProps {
  defaultStatus?: 'TO_DO' | 'IN_PROGRESS' | 'INTERNAL_REVIEW' | 'CLIENT_REVIEW' | 'DONE' | 'CLOSED';
  defaultProjectId?: string;
  onClose: () => void;
}

// ── Inline Create Client panel ────────────────────────────────────────────────

interface InlineClientFormProps {
  onCreated: (clientId: string) => void;
  onCancel: () => void;
  fieldClass: (hasError: boolean) => string;
}

function InlineClientForm({ onCreated, onCancel, fieldClass }: InlineClientFormProps) {
  const createClient = useCreateClient();
  const { register, handleSubmit, formState: { errors } } = useForm<NewClientValues>({
    resolver: zodResolver(newClientSchema),
    defaultValues: { name: '' },
  });

  function onSubmit(data: NewClientValues) {
    createClient.mutate(
      { name: data.name },
      { onSuccess: (client) => onCreated(client.id) },
    );
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-surface-dark-3/60 border border-gray-200 dark:border-violet-900/40 rounded-lg space-y-3">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider flex items-center gap-1.5">
        <UserPlus className="w-3.5 h-3.5" /> New Client
      </p>
      <div>
        <input
          {...register('name')}
          placeholder="Client name"
          autoFocus
          className={fieldClass(!!errors.name)}
        />
        {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-violet-300/55 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={createClient.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
        >
          {createClient.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Create & Select
        </button>
      </div>
    </div>
  );
}

// ── Inline Create Project panel (scoped to a client) ──────────────────────────

interface InlineProjectFormProps {
  clientId: string;
  onCreated: (projectId: string) => void;
  onCancel: () => void;
  fieldClass: (hasError: boolean) => string;
}

function InlineProjectForm({ clientId, onCreated, onCancel, fieldClass }: InlineProjectFormProps) {
  const createProject = useCreateProject();
  const { register, handleSubmit, formState: { errors } } = useForm<NewProjectValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { name: '', prefix: '' },
  });

  function onSubmit(data: NewProjectValues) {
    createProject.mutate(
      { clientId, name: data.name, prefix: data.prefix.toUpperCase() },
      { onSuccess: (project) => onCreated(project.id) },
    );
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-surface-dark-3/60 border border-gray-200 dark:border-violet-900/40 rounded-lg space-y-3">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider flex items-center gap-1.5">
        <FolderPlus className="w-3.5 h-3.5" /> New Project
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            {...register('name')}
            placeholder="Project name"
            autoFocus
            className={fieldClass(!!errors.name)}
          />
          {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <input
            {...register('prefix')}
            placeholder="PREFIX"
            maxLength={10}
            className={cn(fieldClass(!!errors.prefix), 'uppercase font-mono')}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            }}
          />
          {errors.prefix
            ? <p className="text-xs text-status-absent mt-1">{errors.prefix.message}</p>
            : <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">e.g. WEB → WEB-001</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-violet-300/55 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={createProject.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
        >
          {createProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Create & Select
        </button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskForm({ defaultStatus = 'TO_DO', defaultProjectId, onClose }: TaskFormProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const createTask = useCreateTask();
  const { data: employees = [] } = useEmployeeList();
  const { data: clients = [] } = useClients();
  const { data: allProjects = [] } = useProjects(); // unscoped — used to resolve a defaultProjectId's client
  const { data: allTasks = [] } = useTasks({});
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCustomAgency, setShowCustomAgency] = useState(false);
  const [addingDepId, setAddingDepId] = useState('');
  // Who does this: one person, a group working together, or an open offer (first to accept)
  const [assignMode, setAssignMode] = useState<AssignMode>('SINGLE');
  const [people, setPeople] = useState<PersonRow[]>([]);
  const groupInvalid = assignMode !== 'SINGLE' && !peopleValid(people);

  const agencyOptions = useMemo(() => {
    const set = new Set<string>();
    set.add('Befhue Agency');
    clients.filter((c) => c.clientType === 'AGENCY').forEach((c) => set.add(c.name));
    allTasks.forEach((t) => {
      if (t.agencyName && t.agencyName.trim()) set.add(t.agencyName.trim());
    });
    return Array.from(set).sort();
  }, [clients, allTasks]);

  const defaultProject = defaultProjectId ? allProjects.find((p) => p.id === defaultProjectId) : undefined;

  const getDefaultDueDate = () => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    if (Date.now() >= d.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createTaskSchema) as any,
    defaultValues: {
      status: defaultStatus,
      priority: 'P2',
      clientId: defaultProject?.clientId ?? '',
      projectId: defaultProjectId ?? '',
      estimatedHours: 0,
      estimatedMinutes: 0,
      dueDate: getDefaultDueDate(),
      dependsOn: [],
      isGate: false,
      isPrivate: false,
      agencyName: '',
      amount: undefined,
    },
  });

  const selectedPriority = watch('priority') as string;
  const selectedClientId = watch('clientId');
  const selectedProjectId = watch('projectId');
  const selectedDependsOn = watch('dependsOn') ?? [];
  const { data: projects = [] } = useProjects(selectedClientId || undefined);

  const onSubmit = async (data: FormValues) => {
    if (groupInvalid) return;
    await createTask.mutateAsync({
      ...data,
      amount: isAdmin && data.amount != null && !isNaN(Number(data.amount)) ? Number(data.amount) : undefined,
      agencyName: data.agencyName ? data.agencyName.trim() : undefined,
      projectId: data.projectId || undefined,
      assignMode,
      people: assignMode === 'SINGLE' ? [] : chosenPeople(people, assignMode),
      // a group has no single assignee: the server decides the owner (together) or leaves it open (anyone)
      assigneeId: assignMode === 'SINGLE' ? data.assigneeId || undefined : undefined,
    });
    onClose();
  };

  function handleAddDependency() {
    if (!addingDepId) return;
    setValue('dependsOn', [...new Set([...selectedDependsOn, addingDepId])]);
    setAddingDepId('');
  }

  function handleRemoveDependency(depId: string) {
    setValue('dependsOn', selectedDependsOn.filter((id) => id !== depId));
  }

  const fieldClass = (hasError: boolean) => cn(
    'w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-surface-dark-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 text-gray-900 dark:text-white',
    hasError
      ? 'border-status-absent focus:ring-status-absent/30'
      : 'border-gray-200 dark:border-violet-900/40',
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-violet-900/40 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New Task</h2>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]">
              <X className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4 overflow-y-auto">

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
                Title <span className="text-status-absent">*</span>
              </label>
              <input
                {...register('title')}
                placeholder="Task title..."
                className={fieldClass(!!errors.title)}
                autoFocus
              />
              {errors.title && <p className="text-xs text-status-absent mt-1">{errors.title.message}</p>}
            </div>

            {/* Client / Project */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
                  Client <span className="text-status-absent">*</span>
                </label>
                {!showNewClient ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedClientId ?? ''}
                      onChange={(e) => {
                        setValue('clientId', e.target.value);
                        setValue('projectId', '');
                      }}
                      className={cn(fieldClass(!!errors.clientId), 'flex-1')}
                    >
                      <option value="">Select client...</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewClient(true)}
                      className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors duration-150 active:scale-[0.98] shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <InlineClientForm
                    fieldClass={fieldClass}
                    onCreated={(id) => { setValue('clientId', id); setShowNewClient(false); }}
                    onCancel={() => setShowNewClient(false)}
                  />
                )}
                {errors.clientId && <p className="text-xs text-status-absent mt-1">{errors.clientId.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
                  Project <span className="text-gray-400 dark:text-violet-300/45 normal-case">(optional)</span>
                </label>
                {!showNewProject ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={selectedProjectId ?? ''}
                        onChange={(e) => setValue('projectId', e.target.value || undefined)}
                        disabled={!selectedClientId}
                        className={cn(fieldClass(!!errors.projectId), 'appearance-none pr-8 disabled:opacity-50')}
                      >
                        <option value="">{selectedClientId ? 'No project' : 'Pick a client first'}</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>[{p.prefix}] {p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewProject(true)}
                      disabled={!selectedClientId}
                      className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors duration-150 active:scale-[0.98] shrink-0 disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <InlineProjectForm
                    clientId={selectedClientId as string}
                    fieldClass={fieldClass}
                    onCreated={(id) => { setValue('projectId', id); setShowNewProject(false); }}
                    onCancel={() => setShowNewProject(false)}
                  />
                )}
                {errors.projectId && <p className="text-xs text-status-absent mt-1">{errors.projectId.message}</p>}
              </div>
            </div>

            {/* Agency Name & Task Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
                  Agency Name <span className="text-gray-400 dark:text-violet-300/45 normal-case">(optional)</span>
                </label>
                {!showCustomAgency ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={watch('agencyName') ?? ''}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setShowCustomAgency(true);
                          setValue('agencyName', '');
                        } else {
                          setValue('agencyName', e.target.value);
                        }
                      }}
                      className={cn(fieldClass(false), 'truncate')}
                    >
                      <option value="">Select agency...</option>
                      {agencyOptions.map((agency) => (
                        <option key={agency} value={agency}>
                          {agency}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter custom agency...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomAgency(true)}
                      title="Add custom agency"
                      className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors duration-150 active:scale-[0.98] shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Befhue Agency"
                      value={watch('agencyName') ?? ''}
                      onChange={(e) => setValue('agencyName', e.target.value)}
                      className={fieldClass(false)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomAgency(false)}
                      title="Select from dropdown"
                      className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-violet-300/70 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150 active:scale-[0.98] shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {isAdmin ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Task Amount</span>
                    <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      <Lock className="w-2.5 h-2.5" /> Admin Only
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 dark:text-violet-300/50">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      {...register('amount', { valueAsNumber: true })}
                      placeholder="e.g. 15000"
                      className={cn(fieldClass(false), 'pl-7')}
                    />
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Team / Gate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
                  Team
                </label>
                <select
                  value={watch('team') ?? ''}
                  onChange={(e) => setValue('team', (e.target.value || undefined) as FormValues['team'])}
                  className={fieldClass(false)}
                >
                  <option value="">No team</option>
                  {(['MARKETING', 'DESIGN', 'DEV'] as Team[]).map((t) => (
                    <option key={t} value={t}>{TEAM_CONFIG[t].label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-4">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-violet-200/70 cursor-pointer select-none pb-2.5">
                  <input
                    type="checkbox"
                    checked={watch('isGate') ?? false}
                    onChange={(e) => setValue('isGate', e.target.checked)}
                    className="rounded border-gray-300 dark:border-white/10 text-brand focus:ring-brand"
                  />
                  Gate task
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-violet-200/70 cursor-pointer select-none pb-2.5">
                  <input
                    type="checkbox"
                    checked={watch('isPrivate') ?? false}
                    onChange={(e) => setValue('isPrivate', e.target.checked)}
                    className="rounded border-gray-300 dark:border-white/10 text-brand focus:ring-brand"
                  />
                  <Lock className="w-3 h-3" /> Private
                </label>
              </div>
            </div>

            {/* Dependencies */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <GitBranch className="w-3.5 h-3.5 text-gray-400 dark:text-violet-300/45" />
                <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Depends on</p>
              </div>

              <div className="space-y-1.5 mb-2">
                {selectedDependsOn.map((depId) => {
                  const dep = allTasks.find((t) => t.id === depId);
                  return (
                    <div key={depId} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-surface-dark-3 rounded-md px-2 py-1.5">
                      <span className="font-mono text-gray-400 dark:text-violet-400/60 shrink-0">{dep?.humanId ?? depId}</span>
                      <span className="flex-1 truncate text-gray-700 dark:text-violet-200/70">{dep?.title ?? 'Unknown task'}</span>
                      <button type="button" onClick={() => handleRemoveDependency(depId)} className="p-0.5 text-gray-400 hover:text-status-absent transition-colors duration-150">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {selectedDependsOn.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-violet-300/45 italic">No dependencies.</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={addingDepId}
                  onChange={(e) => setAddingDepId(e.target.value)}
                  className={cn(fieldClass(false), 'flex-1')}
                >
                  <option value="">Add a dependency…</option>
                  {allTasks
                    .filter((t) => !selectedDependsOn.includes(t.id))
                    .map((t) => <option key={t.id} value={t.id}>{t.humanId} — {t.title}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleAddDependency}
                  disabled={!addingDepId}
                  className="p-2 rounded-lg bg-brand text-white hover:bg-brand-hover transition-colors duration-150 disabled:opacity-40 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional description..."
                className={cn(fieldClass(false), 'resize-none')}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <div className="flex gap-1">
                {PRIORITY_LEVELS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setValue('priority', p.value as FormValues['priority'])}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 active:scale-[0.98]',
                      selectedPriority === p.value
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-gray-200 dark:border-violet-900/40 text-gray-500 dark:text-violet-300/55 hover:border-gray-300 dark:hover:border-violet-800/40',
                    )}
                    style={selectedPriority === p.value ? { backgroundColor: p.color } : {}}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Effort — mandatory, uses EffortInput */}
            <Controller
              name="estimatedHours"
              control={control}
              render={({ field: hoursField }) => (
                <Controller
                  name="estimatedMinutes"
                  control={control}
                  render={({ field: minutesField }) => (
                    <EffortInput
                      label="Estimated Effort"
                      required
                      value={{ hours: hoursField.value ?? 0, minutes: minutesField.value ?? 0 }}
                      onChange={({ hours, minutes }) => {
                        hoursField.onChange(hours);
                        minutesField.onChange(minutes);
                      }}
                      error={errors.estimatedHours?.message}
                      helperText="How long do you estimate this task will take?"
                    />
                  )}
                />
              )}
            />

            {/* Who does this */}
            <AssignPeople
              mode={assignMode}
              onModeChange={setAssignMode}
              people={people}
              onPeopleChange={setPeople}
              singleAssigneeId={watch('assigneeId') ?? ''}
              onSingleChange={(id) => setValue('assigneeId', id || undefined)}
              employees={employees}
            />

            {/* Start Date & Deadline Date/Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand" /> Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  {...register('startDate')}
                  className={cn(fieldClass(false), 'dark:[color-scheme:dark] text-xs')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Deadline Date & Time
                </label>
                <input
                  type="datetime-local"
                  {...register('dueDate')}
                  className={cn(fieldClass(false), 'dark:[color-scheme:dark] text-xs')}
                />
              </div>
            </div>
            {assignMode === 'OFFER' && (
              <p className="text-[11px] text-gray-400 dark:text-violet-300/45 -mt-2">If nobody has accepted 24 hours before this date, everyone it was offered to gets a reminder.</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || createTask.isPending || groupInvalid}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
              >
                {(isSubmitting || createTask.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
