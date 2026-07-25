import { useState, type ChangeEvent } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Upload, Wrench, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createFindingWorkOrder, transitionInspectionFinding, uploadInspectionAttachment,
  type FindingStatus, type InspectionFinding,
} from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import { findingStatusClasses, formatDate, isFindingOpen, severityClasses, todayIso } from './inspectionUi';

interface FindingCardProps {
  finding: InspectionFinding;
  canManage: boolean;
  organizationId: string;
  userId?: string;
  project: string;
  unit: string;
  assignee: string;
  onRefresh: () => Promise<unknown>;
  onOpenInspection: () => void;
}

export default function FindingCard({
  finding,
  canManage,
  organizationId,
  userId,
  project,
  unit,
  assignee,
  onRefresh,
  onOpenInspection,
}: FindingCardProps) {
  const [note, setNote] = useState(finding.correctionNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transition = async (status: FindingStatus) => {
    setBusy(true);
    setError(null);
    try {
      await transitionInspectionFinding(finding.id, status, note);
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilan muuttaminen epäonnistui.');
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      await createFindingWorkOrder(organizationId, finding);
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työmääräyksen luonti epäonnistui.');
    } finally {
      setBusy(false);
    }
  };

  const uploadCorrection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setBusy(true);
    setError(null);
    try {
      await uploadInspectionAttachment({
        organizationId,
        inspectionId: finding.inspectionId,
        findingId: finding.id,
        file,
        kind: 'Korjauksen jälkeinen kuva',
        userId,
      });
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kuvan lähetys epäonnistui.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn(finding.severity === 'Kriittinen' && isFindingOpen(finding) && 'border-red-300')}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-text-primary">{finding.title}</h3>
              <Badge className={cn('border-0', severityClasses(finding.severity))}>{finding.severity}</Badge>
              <Badge className={cn('border-0', findingStatusClasses(finding.status))}>{finding.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{project} · {unit} · {finding.location || 'Sijaintia ei kirjattu'}</p>
            {finding.description && <p className="mt-3 whitespace-pre-wrap text-sm">{finding.description}</p>}
            <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
              <span>Vastuuhenkilö: <strong className="text-text-primary">{assignee}</strong></span>
              <span>Määräpäivä: <strong className={cn('text-text-primary', finding.dueDate && finding.dueDate < todayIso() && isFindingOpen(finding) && 'text-red-700')}>{formatDate(finding.dueDate)}</strong></span>
              <span>Työmääräys: <strong className="text-text-primary">{finding.workOrderId ? 'Luotu' : 'Ei luotu'}</strong></span>
            </div>
            {finding.rejectionReason && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">Hylkäyksen syy: {finding.rejectionReason}</p>}
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenInspection}>Avaa tarkastus <ArrowRight size={15} className="ml-1" /></Button>
        </div>

        {isFindingOpen(finding) && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Label>{canManage ? 'Uusintatarkastuksen tai käsittelyn huomio' : 'Korjauksen kuvaus'}</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-20" placeholder={canManage ? 'Kirjaa päätöksen perustelu tarvittaessa…' : 'Kuvaa tehty korjaus…'} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                <Upload size={15} className="mr-2" />Lisää korjauksen kuva
                <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => void uploadCorrection(event)} />
              </Label>
              {canManage ? (
                <>
                  {!finding.workOrderId && <Button variant="outline" size="sm" disabled={busy} onClick={() => void createOrder()}><Wrench size={15} className="mr-2" />Luo työmääräys</Button>}
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void transition('Työn alla')}>Työn alle</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void transition('Odottaa uusintatarkastusta')}>Uusintatarkastukseen</Button>
                  <Button size="sm" disabled={busy} onClick={() => void transition('Hyväksytty')}><CheckCircle2 size={15} className="mr-2" />Hyväksy</Button>
                  <Button variant="destructive" size="sm" disabled={busy || !note.trim()} onClick={() => void transition('Hylätty')}><XCircle size={15} className="mr-2" />Hylkää</Button>
                </>
              ) : (
                <Button size="sm" disabled={busy || !note.trim()} onClick={() => void transition('Ilmoitettu korjatuksi')}>
                  {busy ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle2 size={15} className="mr-2" />}Ilmoita korjatuksi
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
