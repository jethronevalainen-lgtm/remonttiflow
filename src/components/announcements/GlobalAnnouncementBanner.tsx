import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, ShieldAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useVisibleAnnouncements } from '@/hooks/useAnnouncements';
import { cn } from '@/lib/utils';

export default function GlobalAnnouncementBanner() {
  const navigate = useNavigate();
  const { announcements, error, record } = useVisibleAnnouncements({ placement: 'banner' });
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const announcement = announcements[0];

  if (error) {
    return <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>;
  }
  if (!announcement) return null;

  const run = async (event: 'opened' | 'acknowledged' | 'dismissed') => {
    setSaving(true);
    setOperationError(null);
    try {
      await record(announcement.id, event);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tiedotteen käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const critical = announcement.priority === 'Kriittinen';

  return (
    <div className={cn(
      'border-b px-3 py-2 sm:px-4',
      critical ? 'border-red-300 bg-red-600 text-white' : 'border-amber-300 bg-amber-50 text-amber-950',
    )} role="status" aria-live={critical ? 'assertive' : 'polite'}>
      <div className="mx-auto flex max-w-[1700px] flex-col gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 shrink-0">{critical ? <ShieldAlert size={20} /> : <BellRing size={19} />}</div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-bold">{announcement.title}</p>
            <p className={cn('mt-0.5 whitespace-pre-wrap break-words text-sm leading-5', !expanded && 'sm:hidden')}>
              {announcement.content}
            </p>
            {expanded && <p className="mt-1 hidden whitespace-pre-wrap break-words text-sm leading-5 sm:block">{announcement.content}</p>}
            {operationError && <p className={cn('mt-2 rounded-md px-2 py-1 text-xs', critical ? 'bg-red-800' : 'bg-red-50 text-red-700')}>{operationError}</p>}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className={cn('hidden min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold sm:flex', critical ? 'hover:bg-red-700' : 'hover:bg-amber-100')}
            aria-label={expanded ? 'Tiivistä tiedote' : 'Näytä tiedote kokonaan'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? 'Tiivistä' : 'Lue'}
          </button>
          {announcement.dismissible && (!announcement.requireAcknowledgement || Boolean(announcement.acknowledgedAt)) && (
            <button
              type="button"
              onClick={() => void run('dismissed')}
              disabled={saving}
              className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', critical ? 'hover:bg-red-700' : 'hover:bg-amber-100')}
              aria-label="Piilota tiedote"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {(announcement.requireAcknowledgement && !announcement.acknowledgedAt) || announcement.linkPath ? (
          <div className="flex flex-wrap gap-2 pl-8">
            {announcement.requireAcknowledgement && !announcement.acknowledgedAt && (
              <Button
                size="sm"
                variant={critical ? 'secondary' : 'default'}
                onClick={() => void run('acknowledged')}
                disabled={saving}
                className="gap-2"
              >
                <CheckCircle2 size={15} /> {saving ? 'Tallennetaan…' : 'Olen lukenut ja ymmärtänyt'}
              </Button>
            )}
            {announcement.linkPath && (
              <Button
                size="sm"
                variant="outline"
                className={cn('gap-2', critical && 'border-white/50 bg-transparent text-white hover:bg-red-700 hover:text-white')}
                onClick={() => {
                  void run('opened');
                  navigate(announcement.linkPath as string);
                }}
              >
                <ExternalLink size={14} /> Avaa liittyvä kohde
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
