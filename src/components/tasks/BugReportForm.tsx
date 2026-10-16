'use client';

import { useState, useRef, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Bug, Loader2, Plus, Minus, GripVertical,
  ChevronDown, ChevronUp, FolderPlus, UserPlus, ArrowLeft,
  Paperclip, FileText, ImageIcon, Trash2, UploadCloud,
} from 'lucide-react';
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { SEVERITY_CONFIG, BROWSER_OPTIONS, OS_OPTIONS, DEVICE_OPTIONS } from '@/lib/bugUtils';
import { createBugSchema } from '@/lib/validations/task';
import { useCreateBug, useEmployeeList } from '@/hooks/useTasks';
import { useClients, useCreateClient } from '@/hooks/useClients';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { EffortInput } from './EffortInput';
import type { TaskStatus } from '@prisma/client';
import type { BugSeverity } from '@prisma/client';

const TiptapEditor = dynamic(
  () => import('@/components/communication/TiptapEditor').then((m) => m.TiptapEditor),
  { ssr: false, loading: () => <div className="h-[120px] animate-pulse bg-gray-100 dark:bg-surface-dark-3 rounded-lg" /> },
);

// ── Types ─────────────────────────────────────────────────────────────────────

type FormValues = z.output<typeof createBugSchema>;

interface BugReportFormProps {
  defaultStatus?:    TaskStatus;
  defaultProjectId?: string;
  onClose:           () => void;
  onBack?:           () => void;
}

// ── Attachment item ───────────────────────────────────────────────────────────

interface AttachmentFile {
  id:   string;
  file: File;
  preview?: string; // object URL for images
}

const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'video/mp4',
  'text/plain', 'text/x-log',
];
const MAX_FILES      = 5;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-green-500" />;
  if (type === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />;
  return <Paperclip className="w-4 h-4 text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface BugAttachmentsProps {
  files:    AttachmentFile[];
  onChange: (files: AttachmentFile[]) => void;
}

function BugAttachments({ files, onChange }: BugAttachmentsProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const errors: string[] = [];
    const next = [...files];

    Array.from(incoming).forEach((f) => {
      if (next.length >= MAX_FILES) { errors.push(`Max ${MAX_FILES} files allowed.`); return; }
      if (f.size > MAX_SIZE_BYTES)  { errors.push(`"${f.name}" exceeds 10 MB.`); return; }
      if (!ACCEPTED_TYPES.includes(f.type)) { errors.push(`"${f.name}" type not supported.`); return; }
      const preview = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
      next.push({ id: `${f.name}-${Date.now()}`, file: f, preview });
    });

    if (errors.length) import('sonner').then(({ toast }) => toast.error(errors[0]));
    onChange(next);
  }

  function removeFile(id: string) {
    const f = files.find((x) => x.id === id);
    if (f?.preview) URL.revokeObjectURL(f.preview);
    onChange(files.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors duration-150',
          dragOver
            ? 'border-brand bg-brand/5 dark:bg-brand/10'
            : 'border-gray-200 dark:border-violet-900/40 hover:border-brand/50 hover:bg-gray-50 dark:hover:bg-surface-dark-3/50',
        )}
      >
        <UploadCloud className={cn('w-6 h-6 transition-colors duration-150', dragOver ? 'text-brand' : 'text-gray-300 dark:text-violet-400/35')} />
        <p className="text-xs text-gray-500 dark:text-violet-300/55 text-center">
          Drag & drop or <span className="text-brand font-medium">browse</span>
        </p>
        <p className="text-[10px] text-gray-400 dark:text-violet-300/45">
          Images, PDFs, MP4, TXT/LOG · Max {MAX_FILES} files · 10 MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-surface-dark-3 rounded-lg border border-gray-100 dark:border-violet-900/40">
              {f.preview
                ? <img src={f.preview} alt={f.file.name} className="w-8 h-8 rounded object-cover shrink-0 border border-gray-200 dark:border-white/10" />
                : <div className="w-8 h-8 rounded bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">{fileIcon(f.file.type)}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-violet-200/70 truncate">{f.file.name}</p>
                <p className="text-[10px] text-gray-400 dark:text-violet-300/45">{formatBytes(f.file.size)}</p>
              </div>
              <button type="button" onClick={() => removeFile(f.id)}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-status-absent transition-colors duration-150 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared field class helper ─────────────────────────────────────────────────

function fieldCls(hasError: boolean) {
  return cn(
    'w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-surface-dark-2 border rounded-lg',
    'focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150',
    'text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-violet-300/45',
    hasError
      ? 'border-status-absent focus:ring-status-absent/30'
      : 'border-gray-200 dark:border-violet-900/40',
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-status-absent ml-0.5">*</span>}
    </label>
  );
}

// ── Inline new-client form ────────────────────────────────────────────────────

const newClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});
type NewClientValues = z.infer<typeof newClientSchema>;

interface InlineClientFormProps {
  onCreated: (id: string) => void;
  onCancel:  () => void;
}

function InlineClientForm({ onCreated, onCancel }: InlineClientFormProps) {
  const createClient = useCreateClient();
  const { register, handleSubmit, formState: { errors } } = useForm<NewClientValues>({
    resolver: zodResolver(newClientSchema),
    defaultValues: { name: '' },
  });

  function onSubmit(data: NewClientValues) {
    createClient.mutate(
      { name: data.name },
      { onSuccess: (c) => onCreated(c.id) },
    );
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-surface-dark-3/60 border border-gray-200 dark:border-violet-900/40 rounded-lg space-y-3">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider flex items-center gap-1.5">
        <UserPlus className="w-3.5 h-3.5" /> New Client
      </p>
      <div>
        <input {...register('name')} placeholder="Client name" autoFocus className={fieldCls(!!errors.name)} />
        {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-violet-300/55 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
          Cancel
        </button>
        <button type="button" onClick={handleSubmit(onSubmit)} disabled={createClient.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
          {createClient.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Create & Select
        </button>
      </div>
    </div>
  );
}

// ── Inline new-project form (scoped to a client) ──────────────────────────────

const newProjectSchema = z.object({
  name:   z.string().min(1, 'Name is required').max(100),
  prefix: z.string().min(1, 'Prefix is required').max(10)
            .regex(/^[A-Z0-9]+$/, 'Uppercase letters and numbers only'),
});
type NewProjectValues = z.infer<typeof newProjectSchema>;

interface InlineProjectFormProps {
  clientId:  string;
  onCreated: (id: string) => void;
  onCancel:  () => void;
}

function InlineProjectForm({ clientId, onCreated, onCancel }: InlineProjectFormProps) {
  const createProject = useCreateProject();
  const { register, handleSubmit, formState: { errors } } = useForm<NewProjectValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { name: '', prefix: '' },
  });

  function onSubmit(data: NewProjectValues) {
    createProject.mutate(
      { clientId, name: data.name, prefix: data.prefix.toUpperCase() },
      { onSuccess: (p) => onCreated(p.id) },
    );
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-surface-dark-3/60 border border-gray-200 dark:border-violet-900/40 rounded-lg space-y-3">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider flex items-center gap-1.5">
        <FolderPlus className="w-3.5 h-3.5" /> New Project
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input {...register('name')} placeholder="Project name" autoFocus className={fieldCls(!!errors.name)} />
          {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <input
            {...register('prefix')} placeholder="PREFIX" maxLength={10}
            className={cn(fieldCls(!!errors.prefix), 'uppercase font-mono')}
            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }}
          />
          {errors.prefix
            ? <p className="text-xs text-status-absent mt-1">{errors.prefix.message}</p>
            : <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">e.g. TP → TP-001</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-violet-300/55 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
          Cancel
        </button>
        <button type="button" onClick={handleSubmit(onSubmit)} disabled={createProject.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
          {createProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Create & Select
        </button>
      </div>
    </div>
  );
}

// ── Severity card ─────────────────────────────────────────────────────────────

interface SeverityCardProps {
  value:    BugSeverity;
  selected: boolean;
  onSelect: (v: BugSeverity) => void;
}

function SeverityCard({ value, selected, onSelect }: SeverityCardProps) {
  const cfg = SEVERITY_CONFIG[value];
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex flex-col items-center text-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-150 active:scale-[0.97]',
        selected
          ? `${cfg.borderColor.replace('border-', 'border-')} ${cfg.bgColor} ${cfg.color}`
          : 'border-gray-200 dark:border-violet-900/40 bg-white dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55 hover:border-gray-300 dark:hover:border-violet-800/40',
      )}
    >
      <span className="text-lg mb-1">{cfg.icon}</span>
      <span className="text-xs font-semibold">{cfg.label}</span>
      <span className="text-[10px] mt-0.5 leading-tight opacity-75">{cfg.description.split(',')[0]}</span>
    </button>
  );
}

// ── Sortable step row ─────────────────────────────────────────────────────────

interface StepRowProps {
  id:       string;
  index:    number;
  value:    string;
  canRemove: boolean;
  onChange: (v: string) => void;
  onRemove: () => void;
}

function SortableStepRow({ id, index, value, canRemove, onChange, onRemove }: StepRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2', isDragging && 'opacity-50')}
    >
      <button type="button" {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-300 dark:text-violet-400/35 hover:text-gray-400 dark:hover:text-violet-300/45 shrink-0">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55 text-[10px] font-semibold flex items-center justify-center shrink-0">
        {index + 1}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`e.g. ${index === 0 ? 'Navigate to the login page' : index === 1 ? 'Click the submit button' : 'Observe the error'}`}
        className={cn(fieldCls(false), 'flex-1')}
      />
      {canRemove && (
        <button type="button" onClick={onRemove}
          className="p-1.5 rounded-md text-gray-400 dark:text-violet-300/45 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 shrink-0">
          <Minus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Severity → default priority map ──────────────────────────────────────────

const SEVERITY_TO_PRIORITY: Record<BugSeverity, FormValues['priority']> = {
  CRITICAL: 'P0',
  HIGH:     'P1',
  MEDIUM:   'P2',
  LOW:      'P3',
};

// ── Main component ────────────────────────────────────────────────────────────

export function BugReportForm({
  defaultStatus = 'OPEN',
  defaultProjectId,
  onClose,
  onBack,
}: BugReportFormProps) {
  const createBug = useCreateBug();
  const { data: employees   = [] } = useEmployeeList();
  const { data: clients     = [] } = useClients();
  const { data: allProjects = [] } = useProjects(); // unscoped — used to resolve a defaultProjectId's client

  const [showNewClient,  setShowNewClient]  = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [envExpanded,     setEnvExpanded]     = useState(false);
  const [priorityAutoSet, setPriorityAutoSet] = useState(true);
  const [attachments,     setAttachments]     = useState<AttachmentFile[]>([]);
  const [descContent,     setDescContent]     = useState<Record<string, unknown> | undefined>(undefined);

  const defaultProject = defaultProjectId ? allProjects.find((p) => p.id === defaultProjectId) : undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createBugSchema) as any,
    defaultValues: {
      itemType:         'BUG',
      priority:         'P2',
      clientId:         defaultProject?.clientId ?? '',
      projectId:        defaultProjectId ?? '',
      estimatedHours:   0,
      estimatedMinutes: 0,
      stepsToReproduce: ['', '', ''],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: control as any,
    name: 'stepsToReproduce' as never,
  });

  const selectedSeverity  = watch('severity') as BugSeverity | undefined;
  const selectedPriority  = watch('priority') as string;
  const selectedClientId  = watch('clientId');
  const selectedProjectId = watch('projectId');
  const { data: projects = [] } = useProjects(selectedClientId || undefined);
  const selectedProject   = projects.find((p) => p.id === selectedProjectId);
  const titleValue        = watch('title') ?? '';
  const expectedValue     = watch('expectedBehavior') ?? '';
  const actualValue       = watch('actualBehavior') ?? '';

  // DnD sensors for step reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleSeveritySelect(sev: BugSeverity) {
    setValue('severity', sev);
    if (priorityAutoSet) {
      setValue('priority', SEVERITY_TO_PRIORITY[sev]);
    }
  }

  function handlePriorityClick(p: string) {
    setPriorityAutoSet(false);
    setValue('priority', p as FormValues['priority']);
  }

  function handleStepDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex);
  }

  const submitBug = useCallback(async (data: FormValues, asDraft: boolean) => {
    const steps   = data.stepsToReproduce.filter((s) => s.trim().length > 0);
    const assignee = employees.find((e) => e.id === data.assigneeId);
    const project  = projects.find((p) => p.id === data.projectId);

    const payload = {
      ...data,
      projectId:        data.projectId || undefined,
      stepsToReproduce: steps,
      ...(descContent ? { description: JSON.stringify(descContent) } : {}),
    };

    await createBug.mutateAsync(payload);

    const { toast } = await import('sonner');
    if (!asDraft && data.assigneeId && assignee) {
      const severityLabel = SEVERITY_CONFIG[data.severity]?.label ?? data.severity;
      toast.success(`Bug reported successfully. ${assignee.name} has been notified.`, {
        description: `${severityLabel} severity · ${project?.name ?? 'project'}`,
      });
    } else if (asDraft) {
      toast.success('Bug saved as draft.');
    } else {
      toast.success('Bug reported. Assign it to a team member to get it fixed.');
    }
    onClose();
  }, [createBug, employees, projects, descContent, onClose]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => submitBug(data as FormValues, false);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-violet-900/40 shadow-2xl w-full max-w-[680px] max-h-[92vh] flex flex-col">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <Bug className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Report a Bug</h2>
                {selectedProject && (
                  <span className="text-xs text-gray-400 dark:text-violet-300/45">{selectedProject.name}</span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]">
              <X className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
            </button>
          </div>

          {/* ── Scrollable form body ── */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-5 py-5 space-y-5">

              {/* ══ SECTION 1: Bug Summary ══ */}

              {/* Title */}
              <div>
                <SectionLabel required>Bug Title</SectionLabel>
                <div className="relative">
                  <input
                    {...register('title')}
                    autoFocus
                    maxLength={200}
                    placeholder="Short description of the bug (e.g. Login button unresponsive on mobile)"
                    className={fieldCls(!!errors.title)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 dark:text-violet-300/45 tabular-nums pointer-events-none">
                    {titleValue.length}/200
                  </span>
                </div>
                {errors.title && <p className="text-xs text-status-absent mt-1">{errors.title.message}</p>}
              </div>

              {/* Client / Project */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel required>Client</SectionLabel>
                  {!showNewClient ? (
                    <div className="flex gap-2">
                      <select
                        value={selectedClientId ?? ''}
                        onChange={(e) => { setValue('clientId', e.target.value); setValue('projectId', ''); }}
                        className={cn(fieldCls(!!errors.clientId), 'flex-1')}
                      >
                        <option value="">Select client...</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowNewClient(true)}
                        className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors duration-150 active:scale-[0.98] shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <InlineClientForm
                      onCreated={(id) => { setValue('clientId', id); setShowNewClient(false); }}
                      onCancel={() => setShowNewClient(false)}
                    />
                  )}
                  {errors.clientId && <p className="text-xs text-status-absent mt-1">{errors.clientId.message}</p>}
                </div>

                <div>
                  <SectionLabel>Project <span className="text-gray-400 dark:text-violet-300/45 normal-case">(optional)</span></SectionLabel>
                  {!showNewProject ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedProjectId ?? ''}
                          onChange={(e) => setValue('projectId', e.target.value || undefined)}
                          disabled={!selectedClientId}
                          className={cn(fieldCls(!!errors.projectId), 'appearance-none pr-8 disabled:opacity-50')}
                        >
                          <option value="">{selectedClientId ? 'No project' : 'Pick a client first'}</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>[{p.prefix}] {p.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <button type="button" onClick={() => setShowNewProject(true)} disabled={!selectedClientId}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors duration-150 active:scale-[0.98] shrink-0 disabled:opacity-40">
                        <Plus className="w-3.5 h-3.5" /> New
                      </button>
                    </div>
                  ) : (
                    <InlineProjectForm
                      clientId={selectedClientId as string}
                      onCreated={(id) => { setValue('projectId', id); setShowNewProject(false); }}
                      onCancel={() => setShowNewProject(false)}
                    />
                  )}
                  {errors.projectId && <p className="text-xs text-status-absent mt-1">{errors.projectId.message}</p>}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <SectionLabel>Assign to (optional)</SectionLabel>
                <select {...register('assigneeId')} className={fieldCls(false)}>
                  <option value="">Select who will fix this bug</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.designation ? ` — ${e.designation}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-100 dark:border-violet-900/30" />

              {/* ══ SECTION 2: Severity & Priority ══ */}

              {/* Severity */}
              <div>
                <SectionLabel required>Severity</SectionLabel>
                <Controller
                  name="severity"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-4 gap-2">
                      {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as BugSeverity[]).map((sev) => (
                        <SeverityCard
                          key={sev}
                          value={sev}
                          selected={field.value === sev}
                          onSelect={handleSeveritySelect}
                        />
                      ))}
                    </div>
                  )}
                />
                {errors.severity && (
                  <p className="text-xs text-status-absent mt-1">
                    {typeof errors.severity.message === 'string' ? errors.severity.message : 'Severity is required.'}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <SectionLabel>Priority</SectionLabel>
                  {priorityAutoSet && selectedSeverity && (
                    <span className="text-[10px] text-gray-400 dark:text-violet-300/45 italic -mt-1">
                      Auto-set from severity
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {PRIORITY_LEVELS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handlePriorityClick(p.value)}
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

              <div className="border-t border-gray-100 dark:border-violet-900/30" />

              {/* ══ SECTION 3: Bug Details ══ */}

              {/* Steps to Reproduce */}
              <div>
                <SectionLabel required>Steps to Reproduce</SectionLabel>
                <p className="text-xs text-gray-400 dark:text-violet-300/45 mb-2">
                  List the exact steps to reproduce this bug.
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleStepDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {fields.map((field, index) => (
                        <Controller
                          key={field.id}
                          name={`stepsToReproduce.${index}` as const}
                          control={control}
                          render={({ field: f }) => (
                            <SortableStepRow
                              id={field.id}
                              index={index}
                              value={f.value as string}
                              canRemove={fields.length > 1}
                              onChange={f.onChange}
                              onRemove={() => remove(index)}
                            />
                          )}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {fields.length < 20 && (
                  <button
                    type="button"
                    onClick={() => append('')}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-violet-300/55 border border-dashed border-gray-200 dark:border-violet-900/40 rounded-lg hover:border-brand hover:text-brand transition-colors duration-150"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Step
                  </button>
                )}
                {errors.stepsToReproduce && (
                  <p className="text-xs text-status-absent mt-1">
                    {typeof errors.stepsToReproduce.message === 'string'
                      ? errors.stepsToReproduce.message
                      : 'At least one step to reproduce is required.'}
                  </p>
                )}
              </div>

              {/* Expected Behavior */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <SectionLabel required>Expected Behavior</SectionLabel>
                  <span className="text-[10px] text-gray-400 dark:text-violet-300/45 tabular-nums">
                    {expectedValue.length}/1000
                  </span>
                </div>
                <textarea
                  {...register('expectedBehavior')}
                  rows={3}
                  maxLength={1000}
                  placeholder="What should happen? Describe the correct expected behavior."
                  className={cn(fieldCls(!!errors.expectedBehavior), 'resize-none')}
                />
                {errors.expectedBehavior && (
                  <p className="text-xs text-status-absent mt-1">{errors.expectedBehavior.message}</p>
                )}
              </div>

              {/* Actual Behavior */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <SectionLabel required>Actual Behavior</SectionLabel>
                  <span className="text-[10px] text-gray-400 dark:text-violet-300/45 tabular-nums">
                    {actualValue.length}/1000
                  </span>
                </div>
                <textarea
                  {...register('actualBehavior')}
                  rows={3}
                  maxLength={1000}
                  placeholder="What actually happens? Describe the incorrect behavior you observed."
                  className={cn(fieldCls(!!errors.actualBehavior), 'resize-none')}
                />
                {errors.actualBehavior && (
                  <p className="text-xs text-status-absent mt-1">{errors.actualBehavior.message}</p>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-violet-900/30" />

              {/* ══ SECTION 4: Environment (collapsible) ══ */}

              <div>
                <button
                  type="button"
                  onClick={() => setEnvExpanded((v) => !v)}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-violet-200/70">
                    Environment Details
                  </span>
                  <span className="text-xs text-gray-400 dark:text-violet-300/45">(Optional)</span>
                  <span className="ml-auto text-gray-400 dark:text-violet-300/45 group-hover:text-gray-600 dark:group-hover:text-violet-200/70 transition-colors duration-150">
                    {envExpanded
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                <AnimatePresence>
                  {envExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Browser */}
                          <div>
                            <SectionLabel>Browser</SectionLabel>
                            <select {...register('environment.browser')} className={fieldCls(false)}>
                              <option value="">Select browser</option>
                              {BROWSER_OPTIONS.map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                          {/* OS */}
                          <div>
                            <SectionLabel>Operating System</SectionLabel>
                            <select {...register('environment.os')} className={fieldCls(false)}>
                              <option value="">Select OS</option>
                              {OS_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                          {/* Device */}
                          <div>
                            <SectionLabel>Device</SectionLabel>
                            <select {...register('environment.device')} className={fieldCls(false)}>
                              <option value="">Select device</option>
                              {DEVICE_OPTIONS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          {/* App Version */}
                          <div>
                            <SectionLabel>App Version</SectionLabel>
                            <input
                              {...register('environment.appVersion')}
                              placeholder="e.g. v1.2.3"
                              className={fieldCls(false)}
                            />
                          </div>
                        </div>
                        {/* Affected Version */}
                        <div>
                          <SectionLabel>Affected Version</SectionLabel>
                          <input
                            {...register('affectedVersion')}
                            placeholder="Which version is this bug present in? (e.g. v2.1.0)"
                            className={fieldCls(false)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-gray-100 dark:border-violet-900/30" />

              {/* ══ SECTION 5: Effort & Timeline ══ */}

              <div className="grid grid-cols-2 gap-4">
                {/* Estimated Effort */}
                <div>
                  <Controller
                    name="estimatedHours"
                    control={control}
                    render={({ field: hoursField }) => (
                      <Controller
                        name="estimatedMinutes"
                        control={control}
                        render={({ field: minutesField }) => (
                          <EffortInput
                            label="Estimated Fix Effort"
                            required
                            value={{ hours: hoursField.value ?? 0, minutes: minutesField.value ?? 0 }}
                            onChange={({ hours, minutes }) => {
                              hoursField.onChange(hours);
                              minutesField.onChange(minutes);
                            }}
                            error={errors.estimatedHours?.message}
                            helperText="How long to fix this bug?"
                          />
                        )}
                      />
                    )}
                  />
                </div>
                {/* Due Date */}
                <div>
                  <SectionLabel>Fix by Date (optional)</SectionLabel>
                  <input
                    type="date"
                    {...register('dueDate')}
                    className={cn(fieldCls(false), 'dark:[color-scheme:dark]')}
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-violet-900/30" />

              {/* ══ SECTION 6: Additional Info ══ */}

              {/* Description — Tiptap rich text */}
              <div>
                <SectionLabel>Additional Description (optional)</SectionLabel>
                <TiptapEditor
                  content={descContent}
                  onChange={setDescContent}
                  placeholder="Any additional context, logs, screenshots description..."
                  className="min-h-[120px]"
                />
              </div>

              {/* Attachments */}
              <div>
                <SectionLabel>Screenshots / Attachments</SectionLabel>
                <BugAttachments files={attachments} onChange={setAttachments} />
                <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1.5">
                  Attach screenshots, screen recordings, or log files.
                </p>
              </div>

            </div>{/* end px-5 py-5 */}

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0 bg-white dark:bg-surface-dark-2 rounded-b-2xl">
              {/* Back */}
              <button
                type="button"
                onClick={onBack ?? onClose}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-violet-300/55 hover:text-gray-900 dark:hover:text-white transition-colors duration-150"
              >
                <ArrowLeft className="w-4 h-4" />
                {onBack ? 'Back' : 'Cancel'}
              </button>

              {/* Right actions */}
              <div className="flex items-center gap-2">
                {/* Save as Draft */}
                <button
                  type="button"
                  disabled={isSubmitting || createBug.isPending}
                  onClick={handleSubmit((data) => submitBug(data as FormValues, true))}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98] disabled:opacity-60"
                >
                  Save as Draft
                </button>
                {/* Report Bug */}
                <button
                  type="submit"
                  disabled={isSubmitting || createBug.isPending}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[#DC2626] hover:bg-red-700 text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
                >
                  {(isSubmitting || createBug.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Bug className="w-4 h-4" />
                  Report Bug
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
