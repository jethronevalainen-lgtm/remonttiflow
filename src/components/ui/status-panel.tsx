import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type StatusPanelTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: StatusPanelTone;
  icon?: LucideIcon;
  title: string;
  description?: string;
}

const toneClasses: Record<StatusPanelTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
  neutral: 'border-slate-200 bg-slate-50 text-slate-950',
};

const iconClasses: Record<StatusPanelTone, string> = {
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  info: 'text-blue-700',
  neutral: 'text-slate-500',
};

const StatusPanel = React.forwardRef<HTMLDivElement, StatusPanelProps>(({
  tone = 'neutral',
  icon: Icon,
  title,
  description,
  className,
  ...props
}, ref) => (
  <div
    ref={ref}
    data-slot="status-panel"
    className={cn('flex min-w-0 items-start gap-3 rounded-xl border p-4', toneClasses[tone], className)}
    {...props}
  >
    {Icon && <Icon size={19} className={cn('mt-0.5 shrink-0', iconClasses[tone])} aria-hidden="true" />}
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 break-words text-xs leading-5 opacity-80">{description}</p>}
    </div>
  </div>
));

StatusPanel.displayName = 'StatusPanel';

export { StatusPanel, type StatusPanelTone };
