import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Quote } from '@/types/quote';

export interface UseQuoteRotationReturn {
  currentQuote:    Quote | null;
  nextQuote:       () => void;
  isTransitioning: boolean;
  totalQuotes:     number;
  isLoading:       boolean;
}

// Fisher-Yates shuffle — proper playlist, not pure random
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Random interval between 45–90 seconds
function getRandomInterval(): number {
  return Math.floor(Math.random() * (90_000 - 45_000 + 1)) + 45_000;
}

export function useQuoteRotation(): UseQuoteRotationReturn {
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [shuffledQuotes,  setShuffledQuotes]  = useState<Quote[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const res = await fetch('/api/quotes');
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const json = await res.json() as { data: Quote[] };
      return json.data;
    },
    staleTime: Infinity,
    gcTime:    1000 * 60 * 60,
    retry:     2,
  });

  // Initialize shuffled queue on first load — random start position
  useEffect(() => {
    if (!data || data.length === 0) return;
    const shuffled   = shuffleArray(data);
    const startIndex = Math.floor(Math.random() * shuffled.length);
    setShuffledQuotes(shuffled);
    setCurrentIndex(startIndex);
  }, [data]);

  // Advance with 300ms fade-out → swap → fade-in
  const advanceQuote = useCallback(() => {
    // Edge case: 0 or 1 quote — nothing to advance to
    if (shuffledQuotes.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= shuffledQuotes.length) {
          setShuffledQuotes((q) => shuffleArray(q));
          return 0;
        }
        return next;
      });
      setIsTransitioning(false);
    }, 300);
  }, [shuffledQuotes.length]);

  // Schedule next auto-rotation with a fresh random interval each time
  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Edge case: only 1 quote — no point scheduling rotation
    if (shuffledQuotes.length <= 1) return;
    timerRef.current = setTimeout(() => {
      advanceQuote();
      scheduleNext();
    }, getRandomInterval());
  }, [advanceQuote, shuffledQuotes.length]);

  // Start auto-rotation once quotes are ready
  useEffect(() => {
    if (shuffledQuotes.length === 0) return;
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [shuffledQuotes.length, scheduleNext]);

  // Pause rotation when tab is hidden, resume when visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        scheduleNext();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [scheduleNext]);

  // Manual next — resets the auto-rotation timer so it doesn't fire too soon
  const nextQuote = useCallback(() => {
    if (shuffledQuotes.length <= 1) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    advanceQuote();
    setTimeout(() => scheduleNext(), 350);
  }, [advanceQuote, scheduleNext, shuffledQuotes.length]);

  // Edge case: 0 active quotes → null (QuoteDisplay renders nothing)
  const currentQuote = shuffledQuotes.length > 0
    ? (shuffledQuotes[currentIndex] ?? null)
    : null;

  return { currentQuote, nextQuote, isTransitioning, totalQuotes: shuffledQuotes.length, isLoading };
}
