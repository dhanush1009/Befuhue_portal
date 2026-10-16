'use client';

import { RefreshCw, Quote as QuoteIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuoteRotation } from '@/hooks/useQuoteRotation';

export function QuoteDisplay() {
  const { currentQuote, nextQuote, totalQuotes, isLoading } = useQuoteRotation();

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex items-start gap-3 py-3" aria-hidden="true">
        <div className="w-4 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded animate-pulse mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded animate-pulse w-full" />
          <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded animate-pulse w-3/4" />
          <div className="h-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded animate-pulse w-1/4 mt-1" />
        </div>
      </div>
    );
  }

  // Edge case: 0 active quotes — render nothing silently
  if (!currentQuote) return null;

  // Edge case: only 1 quote — hide refresh button (nothing else to show)
  const canRefresh = totalQuotes > 1;

  return (
    <div
      role="region"
      aria-label="Daily motivation"
      className="group relative flex items-start gap-3 py-3 pr-8"
    >
      {/* Decorative opening quote mark */}
      <QuoteIcon
        className="w-4 h-4 text-violet-300 dark:text-violet-500 flex-shrink-0 mt-0.5"
        fill="currentColor"
        aria-hidden="true"
      />

      {/* aria-live so screen readers announce quote changes */}
      <div className="flex-1 min-w-0" aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuote.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {/* Semantic blockquote */}
            <blockquote cite={currentQuote.author ?? undefined}>
              {/* line-clamp-4 on mobile, unclamped on md+ (300 chars fits ~4 lines anyway) */}
              <p className="text-sm text-gray-700 dark:text-violet-300/55 leading-relaxed italic line-clamp-4 md:line-clamp-none font-medium">
                {currentQuote.text}
              </p>
              {currentQuote.author && (
                <footer className="text-xs text-gray-500 dark:text-violet-300/45 mt-1 font-semibold not-italic">
                  — {currentQuote.author}
                </footer>
              )}
            </blockquote>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Refresh button — only shown when >1 quote exists, visible on hover */}
      {canRefresh && (
        <button
          onClick={nextQuote}
          className="absolute right-0 top-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 cursor-pointer"
          aria-label="Show another motivational quote"
        >
          <RefreshCw className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-violet-200/70" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
