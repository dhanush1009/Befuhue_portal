'use client';

import Link from 'next/link';
import { ArrowRight, UserRoundCheck } from 'lucide-react';
import { useMyProfile } from '@/hooks/useMyProfile';

/** A gentle reminder to finish the HR details form. Disappears once it is 100% complete. */
export function DetailsNudge() {
  const { profile } = useMyProfile();
  const pct = profile.data?.detailsPercent;
  if (pct === undefined || pct >= 100) return null;

  return (
    <Link href="/profile?tab=details" className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-surface-dark-3 px-5 py-3.5 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <UserRoundCheck className="w-5 h-5 text-brand shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Complete your details · {pct}% done</p>
        <p className="text-xs text-gray-600 dark:text-violet-300/45">Add your bank details, ID numbers and emergency contact so HR has everything.</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-500 shrink-0" />
    </Link>
  );
}
