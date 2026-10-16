'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OGILVY_QUOTES } from '@/lib/ogilvyQuotes';

/** Picks a fresh quote on every mount (i.e. every visit to the login page). */
export function QuoteRotator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * OGILVY_QUOTES.length));
  }, []);

  const quote = OGILVY_QUOTES[index];

  return (
    <div className="mt-10 max-w-sm min-h-[76px] text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="text-sm italic leading-relaxed text-gray-500">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="mt-2 text-xs font-medium text-brand">— {quote.author}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
