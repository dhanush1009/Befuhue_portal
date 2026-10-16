import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The one card surface used by the redesigned screens: rounded, hairline border, layered on dark. */
export function Card({ className, children, ...rest }: { className?: string; children?: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-surface-dark-3 dark:shadow-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title:     string;
  subtitle?: string;
  icon?:     ReactNode;
  action?:   ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{title}</h2>
          {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
