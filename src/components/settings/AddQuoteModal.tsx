'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Quote as QuoteIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminQuotes } from '@/hooks/useAdminQuotes';
import { toast } from 'sonner';

const schema = z.object({
  text:   z.string().min(10, 'At least 10 characters.').max(300, 'Max 300 characters.'),
  author: z.string().max(100).optional(),
});
type FormInput = z.infer<typeof schema>;

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

interface AddQuoteModalProps {
  open:    boolean;
  onClose: () => void;
}

export function AddQuoteModal({ open, onClose }: AddQuoteModalProps) {
  const { addQuote } = useAdminQuotes();
  const [duplicateError, setDuplicateError] = useState(false);

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isValid },
  } = useForm<FormInput>({
    resolver:    zodResolver(schema),
    mode:        'onChange',
    defaultValues: { text: '', author: '' },
  });

  const text   = watch('text')  ?? '';
  const author = watch('author') ?? '';

  function handleClose() {
    reset();
    setDuplicateError(false);
    onClose();
  }

  async function onSubmit(data: FormInput) {
    setDuplicateError(false);
    try {
      await addQuote.mutateAsync({
        text:   data.text,
        author: data.author || undefined,
      });
      toast.success('Quote added successfully. It will appear on employee dashboards.');
      handleClose();
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        setDuplicateError(true);
      }
      // non-409 errors are handled by the hook
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-[480px] mx-4">

        {/* Header */}
        <div className="flex items-center gap-2.5 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-violet-900/40">
          <QuoteIcon className="w-[18px] h-[18px] text-brand flex-shrink-0" fill="currentColor" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Add Motivational Quote</h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">

          {/* Quote text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">
                Quote <span className="text-red-500 normal-case">*</span>
              </label>
              <span className={cn(
                'text-xs tabular-nums',
                text.length > 280 ? 'text-red-500' : 'text-gray-400 dark:text-violet-300/45',
              )}>
                {text.length}/300
              </span>
            </div>
            <textarea
              {...register('text')}
              rows={3}
              placeholder="Enter an inspiring quote..."
              className={cn(IC, 'resize-none min-h-[72px] max-h-[144px] overflow-y-auto', errors.text || duplicateError ? 'border-red-400 focus:ring-red-400' : '')}
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            {errors.text && (
              <p className="text-xs text-red-500 mt-1">{errors.text.message}</p>
            )}
            {duplicateError && !errors.text && (
              <p className="text-xs text-red-500 mt-1">This quote already exists.</p>
            )}

            {/* Live preview */}
            {text.length >= 3 && (
              <div className="mt-2 bg-gray-50 dark:bg-surface-dark-3/60 rounded-lg p-3 border-l-2 border-violet-200 dark:border-violet-700">
                <div className="flex items-start gap-2">
                  <QuoteIcon className="w-3.5 h-3.5 text-violet-300 dark:text-violet-500 flex-shrink-0 mt-0.5" fill="currentColor" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-600 dark:text-violet-300/55 italic leading-relaxed">{text}</p>
                    {author && (
                      <p className="text-[10px] text-gray-400 dark:text-violet-300/45 mt-0.5 font-medium not-italic">— {author}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Author */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
              Author (optional)
            </label>
            <input
              {...register('author')}
              placeholder="e.g. Steve Jobs, Maya Angelou"
              className={IC}
            />
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
              Leave blank if the author is unknown — no &apos;Unknown&apos; label will be shown.
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || addQuote.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]"
            >
              {addQuote.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Quote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
