'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemTypeSelectorProps {
  onSelect: (type: 'TASK') => void;
  onClose:  () => void;
}

// ── Option card ───────────────────────────────────────────────────────────────

interface OptionCardProps {
  icon:        React.ReactNode;
  title:       string;
  description: string;
  hoverBorder: string;
  hoverBg:     string;
  onClick:     () => void;
}

function OptionCard({ icon, title, description, hoverBorder, hoverBg, onClick }: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center text-center p-5 rounded-xl border-2 border-gray-200 dark:border-violet-900/40',
        'bg-white dark:bg-[#131317] cursor-pointer transition-all duration-150 active:scale-[0.98]',
        `hover:${hoverBorder} hover:${hoverBg}`,
      )}
    >
      <div className="mb-3">{icon}</div>
      <p className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1.5">{title}</p>
      <p className="text-xs text-gray-500 dark:text-violet-300/80 leading-relaxed">{description}</p>
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ItemTypeSelector({ onSelect, onClose }: ItemTypeSelectorProps) {
  return (
    <AnimatePresence>
      <div key="backdrop" className="fixed inset-0 bg-black/30 dark:bg-black/60 z-40" onClick={onClose} />

      <div key="content" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1,    y: 0 }}
          exit={{    opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="bg-white dark:bg-[#101014] rounded-2xl border border-gray-200 dark:border-violet-900/40 shadow-2xl w-full max-w-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              What would you like to create?
            </p>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-violet-500/15 transition-colors duration-150 active:scale-[0.98]"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-violet-300/80" />
            </button>
          </div>

          {/* Options */}
          <div className="p-5">
            <OptionCard
              icon={<CheckSquare className="w-7 h-7 text-brand" />}
              title="Task"
              description="A unit of work or feature to be completed."
              hoverBorder="border-violet-400"
              hoverBg="bg-violet-50 dark:bg-violet-900/20"
              onClick={() => onSelect('TASK')}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
