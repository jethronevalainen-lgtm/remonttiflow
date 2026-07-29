import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  Info,
  Megaphone,
  Pin,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useVisibleAnnouncements } from '@/hooks/useAnnouncements';
import type {
  AnnouncementPlacement,
  AnnouncementPriorityV2,
  VisibleAnnouncement,
} from '@/lib/supabase/announcements';
import { cn } from '@/lib/utils';

function formatDateTime(value: string | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function priorityStyle(priority: AnnouncementPriorityV2) {
  if (priority === 'Kriittinen') return 'border-red-300 bg-red-50 text-red-800';
  if (priority === 'Tärkeä') return 'border-amber-300 bg-amber-50 text-amber-800';
  if (priority === 'Info') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function priorityIcon(priority: AnnouncementPriorityV2) {
  if (priority === 'Kriittinen') return <ShieldAlert size={19} />;
  if (priority === 'Tärkeä') return <BellRing size={19} />;
  if (priority === 'Info') return <Info size={19} />;
  return <Megaphone size={19} />;
}

interface AnnouncementCardProps {
  announcement: VisibleAnnouncement;
  compact?: boolean;
  onRecord: (announcementId: string, event: 'opened' | 'acknowledged' | 'dismissed') => Promise<void>;
}

export function AnnouncementCard({ announcement, compact = false, onRecord }: AnnouncementCardProps) {
  const navigate = useNavigate();
  const { effectiveRole } = useViewAs();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const relatedPath = announcement.linkPath
    ?? (announcement.relatedWorkOrderId ? '/tyomaaraykset' : undefined)
    ?? (announcement.relatedProjectId
      ? effectiveRole === 'customer'
        ? `/tilaajan-projektit/${announcement.relatedProjectId}`
        : `/projektit/${announcement.relatedProjectId}`
      : undefined);

  const run = async (event: 'opened' | 'acknowledged' | 'dismissed') => {
    setSaving(true);
    setError(null);
    try {
      await onRecord(announcement.id, event);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tiedotteen käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openLink = async () => {
    await run('opened');
    if (relatedPath) navigate(relatedPath);
  };

  return (
    <Card className={cn(
      'min-w-0 overflow-hidden shadow-sm',
      announcement.priority === 'Kriittinen'
        ? 'border-red-300'
        : announcement.priority === 'Tärkeä'
          ? 'border-amber-300'
          : 'border-slate-200',
    )}>
      <CardContent className={cn('space-y-4', compact ? 'p-4' : 'p-5')}>
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', priorityStyle(announcement.priority))}>
            {priorityIcon(announcement.priority)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 flex-1 break-words font-semibold text-slate-950">{announcement.title}</h3>
              {announcement.pinned && <Badge variant="outline" className="gap-1"><Pin size={11} /> Kiinnitetty</Badge>}
              <Badge variant="outline" className={priorityStyle(announcement.priority)}>{announcement.priority}</Badge>
            </div>
            <p className="mt-1 break-words text-xs leading-5 text-slate-500">
              {announcement.author} · {formatDateTime(announcement.startsAt || announcement.publishedAt)}
              {announcement.expiresAt ? ` · voimassa ${formatDateTime(announcement.expiresAt)} asti` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {announcement.relatedProjectId && <Badge variant="outline" className="gap-1"><FolderKanban size={11} /> Projektiin liittyvä tiedote</Badge>}
          {announcement.relatedWorkOrderId && <Badge variant="outline" className="gap-1"><Wrench size={11} /> Työmääräykseen liittyvä tiedote</Badge>}
        </div>

        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{announcement.content}</p>

        {announcement.requireAcknowledgement && !announcement.acknowledgedAt && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm leading-6 text-violet-950">
            Tämä tiedote vaatii henkilökohtaisen lukukuittauksen.
          </div>
        )}

        {announcement.acknowledgedAt && (
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 size={16} /> Kuitattu {formatDateTime(announcement.acknowledgedAt)}
          </div>
        )}

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {announcement.requireAcknowledgement && !announcement.acknowledgedAt && (
            <Button onClick={() => void run('acknowledged')} disabled={saving} className="gap-2">
              <CheckCircle2 size={15} /> {saving ? 'Tallennetaan…' : 'Olen lukenut ja ymmärtänyt'}
            </Button>
          )}
          {relatedPath && (
            <Button variant="outline" onClick={() => void openLink()} disabled={saving} className="gap-2">
              <ExternalLink size={15} /> Avaa liittyvä kohde
            </Button>
          )}
          {announcement.dismissible && (!announcement.requireAcknowledgement || Boolean(announcement.acknowledgedAt)) && (
            <Button variant="ghost" onClick={() => void run('dismissed')} disabled={saving} className="gap-2 text-slate-600">
              <X size={15} /> Piilota tästä näkymästä
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AnnouncementSectionProps {
  placement: AnnouncementPlacement;
  projectId?: string;
  workOrderId?: string;
  title?: string;
  description?: string;
  compact?: boolean;
  limit?: number;
  showEmpty?: boolean;
  className?: string;
}

export default function AnnouncementSection({
  placement,
  projectId,
  workOrderId,
  title,
  description,
  compact = false,
  limit,
  showEmpty = false,
  className,
}: AnnouncementSectionProps) {
  const { announcements, loading, error, record } = useVisibleAnnouncements({
    placement,
    projectId,
    workOrderId,
  });
  const visible = typeof limit === 'number' ? announcements.slice(0, limit) : announcements;

  if (!loading && !error && visible.length === 0 && !showEmpty) return null;

  return (
    <section className={cn('min-w-0 space-y-3', className)}>
      {(title || description) && (
        <div>
          {title && <h2 className="break-words text-lg font-semibold text-slate-950">{title}</h2>}
          {description && <p className="mt-1 break-words text-sm leading-6 text-slate-500">{description}</p>}
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <Card className="border-slate-200"><CardContent className="p-5 text-sm text-slate-500">Ladataan tiedotteita…</CardContent></Card>}
      <div className="grid min-w-0 gap-3">
        {visible.map((announcement) => (
          <AnnouncementCard key={announcement.id} announcement={announcement} compact={compact} onRecord={record} />
        ))}
      </div>
      {!loading && !error && visible.length === 0 && showEmpty && (
        <Card className="border-dashed border-slate-200">
          <CardHeader><CardTitle className="text-base">Ei tiedotteita</CardTitle></CardHeader>
          <CardContent className="pt-0 text-sm text-slate-500">Sinulle ei ole julkaistu tähän näkymään tiedotteita.</CardContent>
        </Card>
      )}
    </section>
  );
}
