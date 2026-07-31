import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Check, ClipboardCheck, Download, FileText, HardHat, Lock, MapPin, Plus, RefreshCw, Send, ShieldCheck, Trash2, Users, Wind, X } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { canEditSiteDiary, canLockSiteDiary, canReviewSiteDiary, canSubmitSiteDiary, completionSummary, formatSiteDiaryDate, normalizeSiteDiaryError } from '@/lib/siteDiaryRules';
import {
  createSiteDiaryCorrection,
  deleteSiteDiaryAttachment,
  listSiteDiaries,
  loadSiteDiaryBundle,
  removeSiteDiaryChild,
  reviewSiteDiary,
  submitSiteDiary,
  type SiteDiary,
  type SiteDiaryAttachment,
  type SiteDiaryBundle,
  type WorkItemState,
} from '@/lib/supabase/siteDiaries';
import { ErrorBanner, SectionCard, StatusBadge } from './common';
import { WorkflowDialog, EventDialog, WorkforceDialog, WorkItemDialog } from './dialogs';
import { HeaderSection, AttachmentSection, EventRow } from './sections';
import { WeatherEditor, WorkforceRow, WorkItemRow } from './rows';
import { WORK_ITEM_LABELS } from './labels';
import { printDiary } from './print';

export function DiaryEditor({ diaryId, onBack, onOpenDiary }: { diaryId: string; onBack: () => void; onOpenDiary: (diaryId: string) => void }) {
  const { user, profile } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const [bundle, setBundle] = useState<SiteDiaryBundle | null>(null);
  const [versions, setVersions] = useState<SiteDiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workforceDialog, setWorkforceDialog] = useState(false);
  const [workDialog, setWorkDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [workflowDialog, setWorkflowDialog] = useState<'review' | 'lock' | 'correction' | 'void' | null>(null);
  const [deleteAttachment, setDeleteAttachment] = useState<SiteDiaryAttachment | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const nextBundle = await loadSiteDiaryBundle(currentOrg.id, diaryId);
      setBundle(nextBundle);
      setVersions(await listSiteDiaries(currentOrg.id, {
        projectId: nextBundle.diary.projectId,
        dateFrom: nextBundle.diary.date,
        dateTo: nextBundle.diary.date,
        includeHistory: true,
      }));
    } catch (caught) {
      setError(normalizeSiteDiaryError(caught, 'Työmaapäiväkirjan haku epäonnistui.'));
    } finally {
      setLoading(false);
    }
  }, [currentOrg, diaryId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      await refresh();
      setWorkflowDialog(null);
    } catch (caught) {
      setError(normalizeSiteDiaryError(caught, 'Toiminto epäonnistui.'));
    } finally {
      setSaving(false);
    }
  };

  const runCorrection = async (reason: string) => {
    setSaving(true);
    setError(null);
    try {
      const correction = await createSiteDiaryCorrection(diaryId, reason);
      setWorkflowDialog(null);
      onOpenDiary(correction.id);
    } catch (caught) {
      setError(normalizeSiteDiaryError(caught, 'Korjausversion luominen epäonnistui.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !bundle) return <div className="flex min-h-[50vh] items-center justify-center"><RefreshCw className="size-7 animate-spin text-primary" /></div>;
  if (!bundle) return <div className="space-y-4"><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 size-4" />Takaisin</Button>{error && <ErrorBanner message={error} />}</div>;

  const editable = canEditSiteDiary(bundle.diary.status, bundle.diary.lockedAt);
  const management = currentRole === 'admin' || currentRole === 'supervisor' || currentRole === 'project_coordinator';
  const canApprove = currentRole === 'admin' || currentRole === 'supervisor';
  const userId = user?.id ?? '';
  const userName = profile?.full_name || user?.email || '';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-24 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0"><Button variant="ghost" className="-ml-3 mb-2" onClick={onBack}><ArrowLeft className="mr-2 size-4" />Päiväkirjalista</Button><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{bundle.diary.project}</h1><StatusBadge status={bundle.diary.status} /><Badge variant="outline">Versio {bundle.diary.version}</Badge></div><p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary"><span className="flex items-center gap-1"><CalendarDays className="size-4" />{formatSiteDiaryDate(bundle.diary.date)}</span><span className="flex items-center gap-1"><MapPin className="size-4" />{bundle.diary.siteAddress || 'Osoite puuttuu'}</span></p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />Päivitä</Button><Button variant="outline" onClick={() => void run(() => printDiary(bundle))}><Download className="mr-2 size-4" />Tulosta / PDF</Button>{bundle.diary.status === 'Lukittu' && canApprove && <Button variant="outline" onClick={() => setWorkflowDialog('correction')}><FileText className="mr-2 size-4" />Luo korjausversio</Button>}</div>
      </div>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {versions.length > 1 && <Card className="border-slate-200"><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Versiohistoria</p><p className="text-sm text-text-secondary">Alkuperäinen lukittu versio säilyy muuttumattomana. Korjaukset avataan uutena versiona.</p></div><div className="flex flex-wrap gap-2">{versions.map((version) => <Button key={version.id} size="sm" variant={version.id === bundle.diary.id ? 'default' : 'outline'} onClick={() => onOpenDiary(version.id)}><span>v{version.version}</span><span className="ml-2 text-xs opacity-80">{version.status}</span></Button>)}</div></div></CardContent></Card>}

      <Card className={`border ${bundle.completion.missing.length ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Päiväkirja {bundle.completion.percent} % valmis</p><p className="mt-1 text-sm text-text-secondary">{completionSummary(bundle.completion)}</p></div><div className="w-full sm:w-64"><Progress value={bundle.completion.percent} /></div></div></CardContent></Card>

      <HeaderSection bundle={bundle} userId={userId} userName={userName} editable={editable && management} onSaved={refresh} />

      <SectionCard title="Sääolosuhteet" description="Kirjaa vähintään aamun ja keskipäivän havainnot sekä olosuhteiden vaikutus työhön." icon={<Wind className="size-5" />}>
        <div className="space-y-3">{bundle.weather.map((item) => <WeatherEditor key={item.id} item={item} userId={userId} disabled={!editable} onSaved={refresh} />)}</div>
      </SectionCard>

      <SectionCard title="Työvoima" description="Erittele työnjohto, omat työntekijät, aliurakoitsijat ja muut työmaalla olleet." icon={<Users className="size-5" />} action={editable ? <Button size="sm" onClick={() => setWorkforceDialog(true)}><Plus className="mr-2 size-4" />Lisää ryhmä</Button> : undefined}>
        <div className="space-y-3">{bundle.workforce.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-text-secondary">Työvoimaa ei ole vielä kirjattu.</p>}{bundle.workforce.map((row) => <WorkforceRow key={row.id} row={row} disabled={!editable} onSaved={refresh} onDelete={() => run(() => removeSiteDiaryChild('site_diary_workforce_rows', row.id))} />)}{bundle.workforce.length > 0 && <div className="flex justify-end text-sm font-semibold">Yhteensä {bundle.workforce.reduce((sum, row) => sum + row.headcount, 0)} henkilöä</div>}</div>
      </SectionCard>

      <SectionCard title="Työmaan tilanne" description="Aloitetut, käynnissä olevat ja päättyneet työvaiheet erillisinä, kohde- ja vastuuhenkilötietoineen." icon={<HardHat className="size-5" />} action={editable ? <Button size="sm" onClick={() => setWorkDialog(true)}><Plus className="mr-2 size-4" />Lisää työvaihe</Button> : undefined}>
        <div className="grid gap-5 xl:grid-cols-3">{(['started', 'ongoing', 'completed'] as WorkItemState[]).map((state) => { const rows = bundle.workItems.filter((item) => item.phaseState === state); return <div key={state} className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold">{WORK_ITEM_LABELS[state]}</h3><Badge variant="outline">{rows.length}</Badge></div>{rows.length === 0 && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-text-muted">Ei kirjauksia</div>}{rows.map((item) => <WorkItemRow key={item.id} item={item} disabled={!editable} onSaved={refresh} onDelete={() => run(() => removeSiteDiaryChild('site_diary_work_items', item.id))} />)}</div>; })}</div>
      </SectionCard>

      <SectionCard title="Katselmukset, tapahtumat ja YSE-kirjaukset" description="Kirjaa tarkastukset, toimitukset, poikkeamat, viiveet sekä YSE 43 § 3- ja YSE 44 § 2 -asiat rakenteisina tapahtumina." icon={<ClipboardCheck className="size-5" />} action={editable ? <Button size="sm" onClick={() => setEventDialog(true)}><Plus className="mr-2 size-4" />Lisää tapahtuma</Button> : undefined}>
        <div className="space-y-3">{bundle.events.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-text-secondary">Päivälle ei ole kirjattu tapahtumia.</p>}{bundle.events.map((event) => <EventRow key={event.id} event={event} disabled={!editable} onSaved={refresh} onDelete={() => run(() => removeSiteDiaryChild('site_diary_events', event.id))} />)}</div>
      </SectionCard>

      <AttachmentSection bundle={bundle} userId={userId} editable={editable} onSaved={refresh} onDelete={setDeleteAttachment} onError={setError} />

      <SectionCard title="Tarkastus, kuittaus ja lukitus" description="Hyväksyntäketju erottaa laatijan, tarkastajan ja allekirjoittajan. Lukittu versio on muuttumaton." icon={<ShieldCheck className="size-5" />}>
        <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-text-muted">Lähetetty</p><p className="mt-1 font-medium">{bundle.diary.submittedAt ? new Date(bundle.diary.submittedAt).toLocaleString('fi-FI') : '–'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-text-muted">Tarkastettu</p><p className="mt-1 font-medium">{bundle.diary.reviewedAt ? new Date(bundle.diary.reviewedAt).toLocaleString('fi-FI') : '–'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase text-text-muted">Lukittu</p><p className="mt-1 font-medium">{bundle.diary.lockedAt ? new Date(bundle.diary.lockedAt).toLocaleString('fi-FI') : '–'}</p></div></div>{bundle.signatures.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Allekirjoitukset</h3>{bundle.signatures.map((signature) => <div key={signature.id} className="rounded-lg border p-3"><p className="font-medium">{signature.signerName}</p><p className="text-sm text-text-secondary">{signature.signerTitle || signature.signatureRole} · {new Date(signature.signedAt).toLocaleString('fi-FI')}</p></div>)}</div>}{bundle.diary.contentChecksum && <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100"><p className="mb-1 text-slate-400">Varmennustunnus SHA-256</p><p className="break-all">{bundle.diary.contentChecksum}</p></div>}<div className="flex flex-wrap justify-end gap-2">{editable && management && canSubmitSiteDiary(bundle.diary.status, bundle.completion) && <Button onClick={() => void run(() => submitSiteDiary(bundle.diary.id))}><Send className="mr-2 size-4" />Lähetä tarkastettavaksi</Button>}{canApprove && canReviewSiteDiary(bundle.diary.status) && <><Button variant="outline" onClick={() => setWorkflowDialog('review')}><X className="mr-2 size-4" />Palauta täydennettäväksi</Button><Button onClick={() => void run(() => reviewSiteDiary(bundle.diary.id, true))}><Check className="mr-2 size-4" />Hyväksy tarkastus</Button></>}{canApprove && canLockSiteDiary(bundle.diary.status, bundle.completion) && <Button onClick={() => setWorkflowDialog('lock')}><Lock className="mr-2 size-4" />Allekirjoita ja lukitse</Button>}{editable && canApprove && <Button variant="ghost" className="text-red-600" onClick={() => setWorkflowDialog('void')}><Trash2 className="mr-2 size-4" />Mitätöi</Button>}</div></div>
      </SectionCard>

      <WorkforceDialog open={workforceDialog} onOpenChange={setWorkforceDialog} diaryId={bundle.diary.id} userId={userId} onCreated={refresh} />
      <WorkItemDialog open={workDialog} onOpenChange={setWorkDialog} diaryId={bundle.diary.id} userId={userId} onCreated={refresh} />
      <EventDialog open={eventDialog} onOpenChange={setEventDialog} diaryId={bundle.diary.id} userId={userId} onCreated={refresh} />
      <WorkflowDialog mode={workflowDialog} onOpenChange={(open) => { if (!open) setWorkflowDialog(null); }} bundle={bundle} userName={userName} saving={saving} run={run} runCorrection={runCorrection} />

      <AlertDialog open={Boolean(deleteAttachment)} onOpenChange={(open) => { if (!open) setDeleteAttachment(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko liite?</AlertDialogTitle><AlertDialogDescription>Tiedosto poistetaan päiväkirjasta ja tallennustilasta. Lukitun päiväkirjan liitteitä ei voi poistaa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteAttachment) void run(async () => { await deleteSiteDiaryAttachment(deleteAttachment); setDeleteAttachment(null); }); }}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
