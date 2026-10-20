import { useState, useEffect } from 'react';
import { getInitials, cn } from '@/lib/utils';

interface UserAvatarProps {
  name:       string | null | undefined;
  avatarUrl?: string | null;
  size?:      'sm' | 'md' | 'lg';
  className?: string;
  loading?:   boolean;
}

const SIZE_MAP = {
  sm: { container: 'w-7 h-7 text-xs',  fontSize: 11 },
  md: { container: 'w-9 h-9 text-sm',  fontSize: 13 },
  lg: { container: 'w-12 h-12 text-base', fontSize: 16 },
};

const COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
];

function nameColor(name: string | null | undefined): string {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function UserAvatar({ name, avatarUrl, size = 'md', className, loading = false }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { container } = SIZE_MAP[size];

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  if (loading) {
    return (
      <div className={cn('rounded-full bg-gray-200 dark:bg-surface-dark-3 animate-pulse shrink-0', container, className)} />
    );
  }

  const showImage = avatarUrl && !imgError;

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold overflow-hidden shrink-0 border border-white/20',
        showImage ? 'bg-gray-100 dark:bg-surface-dark-3' : nameColor(name),
        container,
        className,
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name ?? 'User'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
