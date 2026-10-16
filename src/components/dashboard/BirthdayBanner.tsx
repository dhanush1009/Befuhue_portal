'use client';

import { Cake } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCelebrations } from '@/hooks/useEmployeeDetails';

/** On someone's birthday, everyone's dashboard says so. Renders nothing the rest of the year. */
export function BirthdayBanner() {
  const { user } = useAuth();
  const { data } = useCelebrations();
  const today = (data ?? []).filter((c) => c.type === 'BIRTHDAY' && c.daysAway === 0);
  if (today.length === 0) return null;

  const me = today.find((c) => c.userId === user?.id);
  const others = today.filter((c) => c.userId !== user?.id);
  const names = others.map((c) => c.name);
  const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent px-5 py-4">
      <div className="flex -space-x-2 shrink-0">
        {today.slice(0, 3).map((c) => (
          c.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img key={c.userId} src={c.avatarUrl} alt="" className="size-11 rounded-full object-cover ring-2 ring-white dark:ring-surface-dark-3" />
            : <span key={c.userId} className="size-11 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 grid place-items-center text-sm font-semibold ring-2 ring-white dark:ring-surface-dark-3">{c.name.charAt(0)}</span>
        ))}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
          <Cake className="w-4 h-4 text-amber-500 shrink-0" />
          {me ? `Happy birthday, ${me.name.split(' ')[0]}!` : `It's ${list}'s birthday today`}
        </p>
        <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">
          {me
            ? (others.length ? `The whole team is wishing you well. ${list} ${others.length === 1 ? 'shares' : 'share'} your day too.` : 'The whole team is wishing you well today.')
            : 'Drop them a wish when you see them.'}
        </p>
      </div>
    </div>
  );
}
