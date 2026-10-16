import type { ReactNode } from 'react';

interface PageHeaderProps {
  title:       string;
  description?: string;
  actions?:    ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
