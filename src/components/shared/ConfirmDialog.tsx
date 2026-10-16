'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open:        boolean;
  title:       string;
  description: string;
  confirmLabel?: string;
  cancelLabel?:  string;
  destructive?:  boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-slate-200 dark:border-violet-900/30 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-4 mb-5">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', destructive ? 'bg-status-absent/10' : 'bg-brand/10')}>
            <AlertTriangle className={cn('w-5 h-5', destructive ? 'text-status-absent' : 'text-brand')} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-violet-300/55">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-violet-200/70 bg-white dark:bg-surface-dark-3 border border-slate-200 dark:border-violet-900/40 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-dark-3 transition-colors interactive-node">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={cn('px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors interactive-node shadow-sm', destructive ? 'bg-status-absent hover:bg-red-700' : 'bg-brand hover:bg-brand-hover')}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
