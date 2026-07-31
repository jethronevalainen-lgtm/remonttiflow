import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createDiaryEvent,
  createWorkforceRow,
  createWorkItem,
  lockSiteDiary,
  reviewSiteDiary,
  voidSiteDiary,
  type SiteDiaryBundle,
  type SiteDiaryEventType,
  type WorkforceCategory,
  type WorkItemState,
} from '@/lib/supabase/siteDiaries';
import { EVENT_LABELS, WORKFORCE_LABELS, WORK_ITEM_LABELS, dateTimeLocalToIso, isoToDateTimeLocal, numberOrUndefined } from './labels';

export function WorkforceDialog({ open, onOpenChange, diaryId, userId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; diaryId: string; userId: string; onCreated: () => Promise<void> }) {
  const [category, setCategory] = useState<WorkforceCategory>('own_skilled');
  const [company, setCompany] = useState('');
  const [trade, setTrade] = useState('');
  const [headcount, setHeadcount] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await createWorkforceRow({ diaryId, userId, category, companyName: company, trade, headcount: Math.max(0, Number(headcount) || 0), notes }); await onCreated(); onOpenChange(false); setCompany(''); setTrade(''); setHeadcount('1'); setNotes(''); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Lisää työvoimaryhmä</DialogTitle><DialogDescription>Erittele aliurakoitsijat yrityksittäin. Omille työntekijöille riittää ryhmä ja määrä.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1 sm:col-span-2"><Label>Ryhmä</Label><Select value={category} onValueChange={(value: WorkforceCategory) => setCategory(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORKFORCE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Yritys</Label><Input value={company} onChange={(event) => setCompany(event.target.value)} /></div><div className="space-y-1"><Label>Ammatti / työala</Label><Input value={trade} onChange={(event) => setTrade(event.target.value)} /></div><div className="space-y-1"><Label>Henkilömäärä</Label><Input type="number" min="0" step="1" value={headcount} onChange={(event) => setHeadcount(event.target.value)} /></div><div className="space-y-1"><Label>Lisätieto</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Lisää'}</Button></DialogFooter></DialogContent></Dialog>;
}

export function WorkItemDialog({ open, onOpenChange, diaryId, userId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; diaryId: string; userId: string; onCreated: () => Promise<void> }) {
  const [state, setState] = useState<WorkItemState>('ongoing');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [responsible, setResponsible] = useState('');
  const [progress, setProgress] = useState('');
  const [notes, setNotes] = useState('');
  const [inspection, setInspection] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => { if (!title.trim()) return; setSaving(true); try { await createWorkItem({ diaryId, userId, phaseState: state, title, location, responsibleParty: responsible, progressPercent: numberOrUndefined(progress), notes, inspectionRequired: inspection }); await onCreated(); onOpenChange(false); setTitle(''); setLocation(''); setResponsible(''); setProgress(''); setNotes(''); setInspection(false); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Lisää työvaihe</DialogTitle><DialogDescription>Valitse aloitetun, käynnissä olevan tai päättyneen työn tila ja kohdista se työmaan osaan.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><Label>Tila</Label><Select value={state} onValueChange={(value: WorkItemState) => setState(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORK_ITEM_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Valmius %</Label><Input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></div><div className="space-y-1 sm:col-span-2"><Label>Työvaihe *</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Esim. salaojien asennus" /></div><div className="space-y-1"><Label>Sijainti / kohde</Label><Input value={location} onChange={(event) => setLocation(event.target.value)} /></div><div className="space-y-1"><Label>Tekijä / yritys</Label><Input value={responsible} onChange={(event) => setResponsible(event.target.value)} /></div><div className="space-y-1 sm:col-span-2"><Label>Lisätieto</Label><Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></div><label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={inspection} onCheckedChange={(value) => setInspection(value === true)} /> Työvaihe vaatii tarkastuksen</label></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button><Button onClick={() => void save()} disabled={!title.trim() || saving}>{saving ? 'Tallennetaan…' : 'Lisää'}</Button></DialogFooter></DialogContent></Dialog>;
}

export function EventDialog({ open, onOpenChange, diaryId, userId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; diaryId: string; userId: string; onCreated: () => Promise<void> }) {
  const [type, setType] = useState<SiteDiaryEventType>('inspection');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(isoToDateTimeLocal(new Date().toISOString()));
  const [responsible, setResponsible] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [cost, setCost] = useState('');
  const [days, setDays] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => { if (!title.trim()) return; setSaving(true); try { const euros = numberOrUndefined(cost); await createDiaryEvent({ diaryId, userId, eventType: type, title, description, occurredAt: dateTimeLocalToIso(occurredAt), responsibleParty: responsible, dueAt: dateTimeLocalToIso(dueAt), costImpactCents: euros == null ? undefined : Math.round(euros * 100), scheduleImpactDays: numberOrUndefined(days) }); await onCreated(); onOpenChange(false); setTitle(''); setDescription(''); setResponsible(''); setDueAt(''); setCost(''); setDays(''); } finally { setSaving(false); } };
  const critical = ['deviation', 'delay', 'safety', 'decision_needed', 'yse_43_3', 'yse_44_2'].includes(type);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Lisää päivän tapahtuma</DialogTitle><DialogDescription>YSE-kirjaukset tallennetaan erillisinä tapahtumina, jotta kustannus- ja aikatauluvaikutukset eivät huku vapaaseen tekstiin.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1 sm:col-span-2"><Label>Tapahtumatyyppi</Label><Select value={type} onValueChange={(value: SiteDiaryEventType) => setType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EVENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Ajankohta</Label><Input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></div><div className="space-y-1"><Label>Otsikko *</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-1 sm:col-span-2"><Label>Kuvaus</Label><Textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></div>{critical && <><div className="space-y-1"><Label>Vastuuhenkilö / yritys</Label><Input value={responsible} onChange={(event) => setResponsible(event.target.value)} /></div><div className="space-y-1"><Label>Määräaika</Label><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div><div className="space-y-1"><Label>Arvioitu kustannusvaikutus €</Label><Input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></div><div className="space-y-1"><Label>Aikatauluvaikutus päivää</Label><Input type="number" step="0.5" value={days} onChange={(event) => setDays(event.target.value)} /></div></>}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button><Button onClick={() => void save()} disabled={!title.trim() || saving}>{saving ? 'Tallennetaan…' : 'Lisää tapahtuma'}</Button></DialogFooter></DialogContent></Dialog>;
}

export function WorkflowDialog({ mode, onOpenChange, bundle, userName, saving, run, runCorrection }: { mode: 'review' | 'lock' | 'correction' | 'void' | null; onOpenChange: (open: boolean) => void; bundle: SiteDiaryBundle; userName: string; saving: boolean; run: (action: () => Promise<unknown>) => Promise<void>; runCorrection: (reason: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [signerName, setSignerName] = useState(userName);
  const [signerTitle, setSignerTitle] = useState('Vastaava työnjohtaja');
  useEffect(() => { if (mode) { setNote(''); setSignerName(userName); setSignerTitle('Vastaava työnjohtaja'); } }, [mode, userName]);
  const title = mode === 'review' ? 'Palauta täydennettäväksi' : mode === 'lock' ? 'Allekirjoita ja lukitse' : mode === 'correction' ? 'Luo korjausversio' : 'Mitätöi päiväkirja';
  const submit = async () => { if (mode === 'review') await run(() => reviewSiteDiary(bundle.diary.id, false, note)); if (mode === 'lock') await run(() => lockSiteDiary({ diaryId: bundle.diary.id, signerName, signerTitle, waitForExternalSignature: false })); if (mode === 'correction') await runCorrection(note); if (mode === 'void') await run(() => voidSiteDiary(bundle.diary.id, note)); };
  return <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{mode === 'lock' ? 'Lukitus muodostaa muuttumattoman snapshotin ja SHA-256-varmennustunnuksen. Korjaukset tehdään myöhemmin uutena versiona.' : 'Kirjaa peruste niin, että myöhempi auditointi kertoo selvästi miksi tila muuttui.'}</DialogDescription></DialogHeader>{mode === 'lock' ? <div className="space-y-4"><div className="space-y-1"><Label>Allekirjoittajan nimi *</Label><Input value={signerName} onChange={(event) => setSignerName(event.target.value)} /></div><div className="space-y-1"><Label>Tehtävänimike</Label><Input value={signerTitle} onChange={(event) => setSignerTitle(event.target.value)} /></div></div> : <div className="space-y-1"><Label>Peruste *</Label><Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></div>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button><Button className={mode === 'void' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => void submit()} disabled={saving || (mode === 'lock' ? !signerName.trim() : !note.trim())}>{saving ? 'Käsitellään…' : title}</Button></DialogFooter></DialogContent></Dialog>;
}
