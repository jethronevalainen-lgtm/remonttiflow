import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SiteDiaryStatus } from '@/lib/siteDiaryRules';
import { STATUS_CLASS, statusTone } from './labels';

export function StatusBadge({ status }: { status: SiteDiaryStatus }) {
  return <Badge variant="outline" className={STATUS_CLASS[statusTone(status)]}>{status}</Badge>;
}

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onClose && <button type="button" aria-label="Sulje virhe" onClick={onClose}><X className="size-4" /></button>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white p-2 text-primary shadow-sm">{icon}</div>
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-4 sm:p-6">{children}</CardContent>
    </Card>
  );
}

export function MetricCard({ label, value, icon, description }: { label: string; value: number; icon: ReactNode; description: string }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
            <p className="mt-2 font-mono text-3xl font-bold text-text-primary">{value}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        </div>
        <p className="mt-3 text-xs text-text-muted">{description}</p>
      </CardContent>
    </Card>
  );
}
