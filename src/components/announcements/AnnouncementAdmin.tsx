import { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FilePenLine,
  Loader2,
  Megaphone,
  Send,
  StopCircle,
  Trash2,
  UsersRound,
} from 'lucide-react';

import { ROLE_LABELS } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useManagedAnnouncements } from '@/hooks/useAnnouncements';
import {
  deleteAnnouncementV2,
  endAnnouncementV2,
  listAnnouncementReceipts,
  publishAnnouncementV2,
  type AnnouncementPlacement,
  type AnnouncementReceipt,
  type ManagedAnnouncement,
} from '@/lib/supabase/announcements';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AnnouncementComposerDialog from './AnnouncementComposerDialog';

const PLACEMENT_LABELS: Record<AnnouncementPlacement, string> = {
  archive: 'Tiedotearkisto',
  dashboard: 'Etusivu',
  notification_center: 'Ilmoituskello',
  banner: 'Yläpalkki',
  project: 'Projektisivu',
  work_order: 'Työmääräys',
};

const TARGET_LABELS: Record<string, string> = {
  organization: 'Koko organisaatio',
  role: 'Roolit',
  team: 'Työnjohtajan tiimit',
  project: 'Projektit',
  project_customer: 'Projektien tilaajat',
  user: 'Nimetyt henkilöt',
};

function formatDateTime(value: string | undefined) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function statusLabel(status: ManagedAnnouncement['status']) {
  if (status === 'draft') return 'Luonnos';
  if (status === 'scheduled') return 'Ajastettu';
  if (status === 'expired') return 'Päättynyt';
  return 'Julkaistu';
}

function statusClass(status: ManagedAnnouncement['status']) {
  if (status === 'draft') return 'border-slate-200 bg-slate-50 text-slate-700';
  if (status === 'scheduled') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (status === 'expired') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function priorityClass(priority: ManagedAnnouncement['priority']) {
  if (priority === 'Kriittinen') return 'border-red-300 bg-red-50 text-red-800';
  if (priority === 'Tärkeä') return 'border-amber-300 bg-amber-50 text-amber-800';
  if (priority === 'Info') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

interface PendingAction {
  kind: 'publish' | 'end' | 'delete';
  announcement: ManagedAnnouncement;
}

export default function AnnouncementAdmin() {
  const { currentOrg } = useOrganization();
  const { announcements, loading, error, refresh } = useManagedAnnouncements(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportAnnouncement, setReportAnnouncement] = useState<ManagedAnnouncement | null>(null);
  const [receipts, setReceipts] = useState<AnnouncementReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptFilter, setReceiptFilter] = useState<'all' | 'unopened' | 'unacknowledged'>('all');

  const totals = useMemo(() => ({
    active: announcements.filter((item) => item.status === 'published').length,
    scheduled: announcements.filter((item) => item.status === 'scheduled').length,
    drafts: announcements.filter((item) => item.status === 'draft').length,
    recipients: announcements.reduce((sum, item) => sum + item.recipientCount, 0),
  }), [announcements]);

  const filteredReceipts = receipts.filter((receipt) => {
    if (receiptFilter === 'unopened') return !receipt.openedAt;
    if (receiptFilter === 'unacknowledged') return !receipt.acknowledgedAt;
    return true;
  });

  const openReport = async (announcement: ManagedAnnouncement) => {
    if (!currentOrg) return;
    setReportAnnouncement(announcement);
    setReceipts([]);
    setReceiptFilter('all');
    setReceiptsLoading(true);
    setOperationError(null);
    try {
      setReceipts(await listAnnouncementReceipts(currentOrg.id, announcement.id));
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Toimitusraportin haku epäonnistui.');
    } finally {
      setReceiptsLoading(false);
    }
  };

  const executeAction = async () => {
    if (!pendingAction || !currentOrg) return;
    setSaving(true);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      if (pendingAction.kind === 'publish') {
        await publishAnnouncementV2(currentOrg.id, pendingAction.announcement.id);
        setOperationSuccess('Tiedote julkaistiin heti.');
      } else if (pendingAction.kind === 'end') {
        await endAnnouncementV2(currentOrg.id, pendingAction.announcement.id);
        setOperationSuccess('Tiedotteen voimassaolo päätettiin.');
      } else {
        await deleteAnnouncementV2(currentOrg.id, pendingAction.announcement.id);
        setOperationSuccess('Tiedote poistettiin.');
      }
      setPendingAction(null);
      await refresh();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tiedotteen käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Tiedotteiden hallinta</h2>
          <p className="mt-1 break-words text-sm leading-6 text-slate-500">Luo kohdistettuja tiedotteita, ajasta julkaisu ja seuraa henkilökohtaisesti, kenelle tiedote toimitettiin ja kuka sen kuittasi.</p>
        </div>
        <Button onClick={() => setComposerOpen(true)} className="min-h-11 gap-2"><Megaphone size={16} /> Uusi tiedote</Button>
      </div>

      {(operationError || error) && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{operationError ?? error}</div>}
      {operationSuccess && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{operationSuccess}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Julkaistu', value: totals.active, icon: Send },
          { label: 'Ajastettu', value: totals.scheduled, icon: CalendarClock },
          { label: 'Luonnokset', value: totals.drafts, icon: FilePenLine },
          { label: 'Toimituksia yhteensä', value: totals.recipients, icon: UsersRound },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div><p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-2 font-mono text-3xl font-bold text-slate-950">{item.value}</p></div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><item.icon size={20} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" /> Ladataan tiedotteita…</CardContent></Card>}

      <div className="space-y-3">
        {announcements.map((announcement) => {
          const seenPercent = announcement.recipientCount > 0 ? Math.round(announcement.seenCount / announcement.recipientCount * 100) : 0;
          const acknowledgedPercent = announcement.recipientCount > 0 ? Math.round(announcement.acknowledgedCount / announcement.recipientCount * 100) : 0;
          return (
            <Card key={announcement.id} className="min-w-0 border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-lg font-semibold text-slate-950">{announcement.title}</h3>
                      <Badge variant="outline" className={statusClass(announcement.status)}>{statusLabel(announcement.status)}</Badge>
                      <Badge variant="outline" className={priorityClass(announcement.priority)}>{announcement.priority}</Badge>
                    </div>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">{announcement.author} · alkaa {formatDateTime(announcement.startsAt)}{announcement.expiresAt ? ` · päättyy ${formatDateTime(announcement.expiresAt)}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void openReport(announcement)} className="gap-2"><Eye size={14} /> Toimitusraportti</Button>
                    {(announcement.status === 'draft' || announcement.status === 'scheduled') && <Button size="sm" onClick={() => setPendingAction({ kind: 'publish', announcement })} className="gap-2"><Send size={14} /> Julkaise nyt</Button>}
                    {(announcement.status === 'published' || announcement.status === 'scheduled') && <Button variant="outline" size="sm" onClick={() => setPendingAction({ kind: 'end', announcement })} className="gap-2"><StopCircle size={14} /> Päätä</Button>}
                    <Button variant="ghost" size="sm" onClick={() => setPendingAction({ kind: 'delete', announcement })} className="gap-2 text-red-600"><Trash2 size={14} /> Poista</Button>
                  </div>
                </div>

                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{announcement.content}</p>

                <div className="flex flex-wrap gap-2">
                  {announcement.placementLabels.map((placement) => <Badge key={placement} variant="outline">{PLACEMENT_LABELS[placement] ?? placement}</Badge>)}
                  {announcement.targetLabels.map((target) => <Badge key={target} variant="secondary">{TARGET_LABELS[target] ?? target}</Badge>)}
                  {announcement.requireAcknowledgement && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">Lukukuittaus vaaditaan</Badge>}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Vastaanottajia</p><p className="mt-1 text-xl font-bold">{announcement.recipientCount}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">Nähty</p><span className="text-xs font-semibold">{seenPercent} %</span></div><p className="mt-1 text-xl font-bold">{announcement.seenCount}/{announcement.recipientCount}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500" style={{ width: `${seenPercent}%` }} /></div></div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">Kuitattu</p><span className="text-xs font-semibold">{acknowledgedPercent} %</span></div><p className="mt-1 text-xl font-bold">{announcement.acknowledgedCount}/{announcement.recipientCount}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${acknowledgedPercent}%` }} /></div></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && announcements.length === 0 && <Card className="border-dashed"><CardContent className="p-10 text-center"><Megaphone size={42} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei tiedotteita</p><p className="mt-1 text-sm text-slate-500">Luo ensimmäinen kohdistettu tiedote.</p></CardContent></Card>}
      </div>

      <AnnouncementComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onCreated={async (_id, mode) => {
          setOperationSuccess(mode === 'draft' ? 'Tiedote tallennettiin luonnoksena.' : mode === 'scheduled' ? 'Tiedote ajastettiin.' : 'Tiedote julkaistiin.');
          await refresh();
        }}
      />

      <Dialog open={Boolean(reportAnnouncement)} onOpenChange={(open) => !open && setReportAnnouncement(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle className="break-words">Toimitusraportti: {reportAnnouncement?.title}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={receiptFilter === 'all' ? 'default' : 'outline'} onClick={() => setReceiptFilter('all')}>Kaikki ({receipts.length})</Button>
            <Button size="sm" variant={receiptFilter === 'unopened' ? 'default' : 'outline'} onClick={() => setReceiptFilter('unopened')}>Ei avannut ({receipts.filter((item) => !item.openedAt).length})</Button>
            <Button size="sm" variant={receiptFilter === 'unacknowledged' ? 'default' : 'outline'} onClick={() => setReceiptFilter('unacknowledged')}>Ei kuitannut ({receipts.filter((item) => !item.acknowledgedAt).length})</Button>
          </div>
          {receiptsLoading ? <div className="flex items-center justify-center gap-2 p-10 text-slate-500"><Loader2 size={18} className="animate-spin" /> Ladataan toimituksia…</div> : (
            <div className="divide-y rounded-xl border border-slate-200">
              {filteredReceipts.map((receipt) => (
                <div key={receipt.userId} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,0.7fr))] md:items-center">
                  <div className="min-w-0"><p className="break-words font-semibold text-slate-950">{receipt.displayName}</p><p className="break-all text-xs text-slate-500">{ROLE_LABELS[receipt.role]}{receipt.email ? ` · ${receipt.email}` : ''}</p></div>
                  <div><p className="text-xs text-slate-400">Näytetty</p><p className={cn('mt-1 break-words text-sm font-medium', receipt.firstShownAt ? 'text-emerald-700' : 'text-slate-500')}>{receipt.firstShownAt ? formatDateTime(receipt.firstShownAt) : 'Ei vielä'}</p></div>
                  <div><p className="text-xs text-slate-400">Avattu</p><p className={cn('mt-1 break-words text-sm font-medium', receipt.openedAt ? 'text-emerald-700' : 'text-slate-500')}>{receipt.openedAt ? formatDateTime(receipt.openedAt) : 'Ei vielä'}</p></div>
                  <div><p className="text-xs text-slate-400">Kuitattu</p><p className={cn('mt-1 break-words text-sm font-medium', receipt.acknowledgedAt ? 'text-emerald-700' : 'text-slate-500')}>{receipt.acknowledgedAt ? formatDateTime(receipt.acknowledgedAt) : 'Ei vielä'}</p></div>
                </div>
              ))}
              {filteredReceipts.length === 0 && <div className="p-8 text-center text-sm text-slate-500"><CheckCircle2 size={30} className="mx-auto mb-2 text-emerald-500" />Ei tähän rajaukseen kuuluvia vastaanottajia.</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && !saving && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.kind === 'publish' ? 'Julkaise tiedote heti' : pendingAction?.kind === 'end' ? 'Päätä tiedotteen voimassaolo' : 'Poista tiedote'}</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {pendingAction?.kind === 'publish'
                ? `Tiedote “${pendingAction.announcement.title}” julkaistaan kaikille ratkaistuille vastaanottajille heti.`
                : pendingAction?.kind === 'end'
                  ? `Tiedote “${pendingAction?.announcement.title}” poistuu aktiivisista näyttöpaikoista ja ilmoitukset suljetaan.`
                  : `Tiedote “${pendingAction?.announcement.title}” ja sen toimitusraportti poistetaan pysyvästi.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Peruuta</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeAction()} disabled={saving} className={pendingAction?.kind === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}>
              {saving ? <><Loader2 size={15} className="mr-2 animate-spin" />Käsitellään…</> : pendingAction?.kind === 'publish' ? 'Julkaise nyt' : pendingAction?.kind === 'end' ? 'Päätä tiedote' : 'Poista tiedote'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
