import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="empty-state"
    className={cn(
      'flex h-full min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center',
      compact ? 'min-h-36 py-6' : 'min-h-52 py-8',
      className,
    )}
    {...props}
  >
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
      <Icon size={23} aria-hidden="true" />
    </div>
    <p className="mt-4 break-words text-sm font-semibold text-slate-950">{title}</p>
    {description && (
      <p className="mt-1 max-w-lg break-words text-sm leading-6 text-slate-500">{description}</p>
    )}
    {action && <div className="mt-4 flex max-w-full flex-wrap justify-center gap-2">{action}</div>}
  </div>
));

EmptyState.displayName = 'EmptyState';

export { EmptyState };
