'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useExcelDownloadStore } from '@/store/useExcelDownloadStore';

export function ExcelDownloadPopup() {
  const {
    isOpen,
    status,
    title,
    filename,
    errorMessage,
    closePopup,
  } = useExcelDownloadStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs"
            onClick={closePopup}
          />

          {/* Modal Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-popup-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.25 }}
            className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 shadow-2xl p-6 sm:p-7 overflow-hidden z-10"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={closePopup}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>

            {/* Content per status */}
            <div className="flex flex-col items-center text-center">
              {/* Status: LOADING */}
              {status === 'loading' && (
                <>
                  {/* Animated Loader Container */}
                  <div className="relative mb-5 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                      className="absolute -inset-2.5 rounded-full border-2 border-dashed border-emerald-500/30 dark:border-emerald-400/30"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                      className="size-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10"
                    >
                      <FileSpreadsheet className="size-8" />
                    </motion.div>
                    <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                      <Loader2 className="size-3.5 animate-spin" />
                    </div>
                  </div>

                  <h3
                    id="excel-popup-title"
                    className="text-lg font-bold text-gray-900 dark:text-white tracking-tight"
                  >
                    {title || 'Generating Excel Report...'}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1.5 max-w-xs">
                    Please wait while your report is being prepared and formatted.
                  </p>

                  {/* Animated shimmering progress bar */}
                  <div className="w-full bg-gray-100 dark:bg-surface-dark-3 rounded-full h-1.5 mt-5 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-full w-1/2"
                      animate={{
                        x: ['-100%', '200%'],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.4,
                        ease: 'easeInOut',
                      }}
                    />
                  </div>

                  {/* Target Filename Badge */}
                  {filename && (
                    <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-surface-dark-3 border border-gray-200/80 dark:border-white/5 text-[11px] font-mono text-gray-600 dark:text-zinc-300 max-w-full">
                      <FileSpreadsheet className="size-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{filename}</span>
                    </div>
                  )}

                  <span className="text-[11px] text-gray-400 dark:text-zinc-500 mt-3 font-medium">
                    Download in progress • duplicate clicks prevented
                  </span>
                </>
              )}

              {/* Status: SUCCESS */}
              {status === 'success' && (
                <>
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                    className="relative mb-5"
                  >
                    <div className="size-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/15">
                      <CheckCircle2 className="size-9" />
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15, type: 'spring' }}
                      className="absolute -top-1 -right-1 text-emerald-500"
                    >
                      <Sparkles className="size-4" />
                    </motion.div>
                  </motion.div>

                  <h3
                    id="excel-popup-title"
                    className="text-lg font-bold text-gray-900 dark:text-white tracking-tight"
                  >
                    {title || 'Excel Downloaded Successfully!'}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1.5 max-w-xs">
                    Your spreadsheet has been compiled and saved to your device.
                  </p>

                  {/* Filename Chip */}
                  {filename && (
                    <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 text-[11px] font-mono text-emerald-800 dark:text-emerald-300 max-w-full">
                      <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{filename}</span>
                    </div>
                  )}

                  <div className="w-full mt-6 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={closePopup}
                      className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium">
                      Closing automatically in a few seconds...
                    </span>
                  </div>
                </>
              )}

              {/* Status: ERROR */}
              {status === 'error' && (
                <>
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                    className="size-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mb-5 shadow-lg shadow-rose-500/10"
                  >
                    <AlertCircle className="size-8" />
                  </motion.div>

                  <h3
                    id="excel-popup-title"
                    className="text-lg font-bold text-gray-900 dark:text-white tracking-tight"
                  >
                    {title || 'Download Failed'}
                  </h3>

                  <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 mt-1.5 max-w-xs font-medium">
                    {errorMessage || 'Failed to generate Excel report. Please try again.'}
                  </p>

                  <div className="w-full mt-6">
                    <button
                      type="button"
                      onClick={closePopup}
                      className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 shadow-xs transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
