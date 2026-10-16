'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import type { Theme } from '@/store/useUIStore';

/**
 * Reads the theme already applied by the inline ThemeScript (in layout.tsx)
 * and syncs it into the Zustand store — without causing a flash.
 * Must be rendered inside the portal layout (client boundary).
 */
export function ThemeInitializer() {
  const setTheme = useUIStore((s) => s.setTheme);

  useEffect(() => {
    const stored = localStorage.getItem('di-theme') as Theme | null;
    const isDark  = document.documentElement.classList.contains('dark');
    // Prefer the DOM state (set by inline script) as source of truth
    const resolved: Theme = isDark ? 'dark' : (stored ?? 'light');
    setTheme(resolved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  return null;
}
