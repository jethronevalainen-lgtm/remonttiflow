import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MessageSquareWarning,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  decideCustomerCaseResolution,
  loadCustomerProjectCases,
  type CustomerCaseDecision,
  type CustomerProjectCase,
} from '@/lib/supabase/crmAftercare';

function dateTime(value?: string): string {
  if (!value) return 'Ei asetettu';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function statusClass(status: string): string {
  if (status === 'Suljettu') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Hylätty') return 'border-slate-200 bg-slate-100 text-slate-700';
  if (status === 'Odottaa asiakkaan hyväksyntää') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'Korjauksessa' || status === 'Korjaus sovittu') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'Selvityksessä') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-orange-200 bg-orange-50 text-orange-700';
}

function priorityClass(priority: string): string {
  if (priority === 'Kriittinen') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'Korkea') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (priority === 'Matala') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export function CustomerAftercarePanel({ projectId, readOnly }: { projectId: string; readOnly?: boolean }) {
  const [cases, setCases] = useState<CustomerProjectCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<CustomerProjectCase | null>(null);
  const [decision, setDecision] = useState<Extract<CustomerCaseDecision, 'Hyväksytty' | 'Hylätty'>>('Hyväksytty');
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await loadCustomerProjectCases(projectId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Reklamaatioiden lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const startDecision = (
    item: CustomerProjectCase,
    nextDecision: Extract<CustomerCaseDecision, 'Hyväksytty' | 'Hylätty'>,
  ) => {
    if (readOnly) return;
    setSelected(item);
    setDecision(nextDecision);
    setNote('');
    setError(null);
    setSuccess(null);
  };

  const saveDecision = async () => {
    if (!selected || readOnly) return;
    setSaving(true);
    setError(null);
    try {
      await decideCustomerCaseResolution({ caseId: selected.id, decision, note });
      setSelected(null);
      setSuccess(
        decision === 'Hyväksytty'
          ? 'Ratkaisu hyväksyttiin ja asia suljettiin.'
          : 'Asia palautettiin työnjohdolle uudelleen selvitettäväksi.',
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Päätöksen tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">Ladataan reklamaatio- ja takuutietoja…</div>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" />{success}</div>}

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">
        <div className="flex items-start gap-3"><ShieldCheck size={19} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Reklamaatioiden ja takuukorjausten tilanne</p><p className="mt-1 leading-6">Tässä näkyvät vain projektin asiakkaalle julkaistut asiat. Kun työnjohto ehdottaa ratkaisua, voit hyväksyä sen tai palauttaa asian perusteluineen uudelleen käsittelyyn.</p></div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {cases.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-1"><Badge variant="outline">{item.caseType}</Badge><Badge variant="outline" className={priorityClass(item.priority)}>{item.priority}</Badge></div>
                  <p className="mt-3 font-mono text-xs font-bold text-slate-500">{item.caseNumber}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{item.title}</h3>
                </div>
                <Badge variant="outline" className={statusClass(item.status)}>{item.status}</Badge>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-700">{item.description}</p>
              <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                <span className="flex items-center gap-1.5"><MessageSquareWarning size={13} />Ilmoitettu {dateTime(item.reportedAt)}</span>
                <span className="flex items-center gap-1.5"><Clock3 size={13} />Tavoite {dateTime(item.dueAt)}</span>
                {item.warrantyCovered !== undefined && <span className="flex items-center gap-1.5"><ShieldCheck size={13} />{item.warrantyCovered ? 'Kuuluu takuuseen' : 'Ei kuulu takuuseen'}</span>}
              </div>

              {item.resolution && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><Wrench size={16} />Työnjohdon ratkaisu</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">{item.resolution}</p>
                </div>
              )}

              {item.customerDecision && item.customerDecision !== 'Odottaa' && (
                <div className="mt-3 text-sm"><Badge variant="outline" className={item.customerDecision === 'Hyväksytty' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>{item.customerDecision}</Badge>{item.customerDecisionNote && <p className="mt-2 text-slate-600">{item.customerDecisionNote}</p>}</div>
              )}

              {item.status === 'Odottaa asiakkaan hyväksyntää' && !readOnly && (
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => startDecision(item, 'Hylätty')}><ThumbsDown size={15} className="mr-2" />Palauta käsittelyyn</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => startDecision(item, 'Hyväksytty')}><ThumbsUp size={15} className="mr-2" />Hyväksy ratkaisu</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!cases.length && (
        <div className="rounded-2xl border border-dashed p-12 text-center"><ShieldCheck size={42} className="mx-auto mb-3 text-emerald-600" /><p className="font-semibold text-slate-950">Ei avoimia tai julkaistuja jälkihoitoasioita</p><p className="mt-1 text-sm text-slate-500">Voit tehdä uuden reklamaation projektin työpyyntölomakkeella.</p></div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{decision === 'Hyväksytty' ? 'Hyväksy ratkaisu' : 'Palauta asia käsittelyyn'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-4"><p className="font-semibold">{selected?.caseNumber} · {selected?.title}</p><p className="mt-1 text-sm text-slate-600">{selected?.resolution}</p></div>
            <div className="space-y-2"><Label>{decision === 'Hyväksytty' ? 'Lisähuomio' : 'Miksi ratkaisu ei ole riittävä? *'}</Label><Textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder={decision === 'Hyväksytty' ? 'Valinnainen huomio' : 'Kuvaa, mitä pitää vielä korjata tai selvittää'} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Peruuta</Button><Button disabled={saving || (decision === 'Hylätty' && note.trim().length < 3)} className={decision === 'Hyväksytty' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => void saveDecision()}>{decision === 'Hyväksytty' ? 'Hyväksy ja sulje' : 'Palauta työnjohdolle'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
