import { useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Upload,
  Wrench,
  XCircle,
} from 'lucide-react';

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
import { findingStageDescription, findingWorkflowStage } from './inspectionWorkflow';

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
  const [expanded, setExpanded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = isFindingOpen(finding);
  const overdue = Boolean(finding.dueDate && finding.dueDate < todayIso() && open);
  const stage = findingWorkflowStage(finding.status);
  const busy = Boolean(busyKey);

  const transition = async (status: FindingStatus, includeNote = true) => {
    setBusyKey(`status-${status}`);
    setError(null);
    try {
      await transitionInspectionFinding(finding.id, status, includeNote ? note : undefined);
      await onRefresh();
      if (status === 'Hyväksytty' || status === 'Ilmoitettu korjatuksi' || status === 'Odottaa uusintatarkastusta') {
        setExpanded(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilan muuttaminen epäonnistui.');
    } finally {
      setBusyKey(null);
    }
  };

  const createOrder = async () => {
    setBusyKey('work-order');
    setError(null);
    try {
      await createFindingWorkOrder(organizationId, finding);
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työmääräyksen luonti epäonnistui.');
    } finally {
      setBusyKey(null);
    }
  };

  const uploadCorrection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    setBusyKey('upload');
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
      setBusyKey(null);
    }
  };

  const noteLabel = canManage
    ? stage === 'verification'
      ? 'Uusintatarkastuksen huomio'
      : stage === 'correction'
        ? 'Korjauksen tilanne ja tarkistusohje'
        : 'Korjauksen ohje tai vastuumerkintä'
    : 'Tehdyn korjauksen kuvaus';

  return (
    <Card className={cn(
      'overflow-hidden transition',
      finding.severity === 'Kriittinen' && open && 'border-red-300',
      overdue && 'border-red-300 shadow-sm',
    )}>
      <CardContent className="p-0">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {overdue && <Badge className="border-0 bg-red-100 text-red-800"><Clock3 size={13} className="mr-1" />Myöhässä</Badge>}
                <Badge className={cn('border-0', severityClasses(finding.severity))}>{finding.severity}</Badge>
                <Badge className={cn('border-0', findingStatusClasses(finding.status))}>{finding.status}</Badge>
                {finding.workOrderId && <Badge variant="outline"><Wrench size={13} className="mr-1" />Työmääräys luotu</Badge>}
              </div>
              <h3 className="mt-3 text-base font-semibold text-text-primary sm:text-lg">{finding.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{project} · {unit} · {finding.location || 'Sijaintia ei kirjattu'}</p>
              {finding.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{finding.description}</p>}

              <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-text-secondary sm:grid-cols-3">
                <div><p className="text-text-muted">Vastuuhenkilö</p><p className="mt-0.5 font-semibold text-text-primary">{assignee}</p></div>
                <div><p className="text-text-muted">Määräpäivä</p><p className={cn('mt-0.5 font-semibold text-text-primary', overdue && 'text-red-700')}>{formatDate(finding.dueDate)}</p></div>
                <div><p className="text-text-muted">Korjausketju</p><p className="mt-0.5 font-semibold text-text-primary">{stage === 'assignment' ? 'Aloittamatta' : stage === 'correction' ? 'Korjattavana' : stage === 'verification' ? 'Tarkistettavana' : 'Suljettu'}</p></div>
              </div>

              <div className={cn(
                'mt-3 flex items-start gap-3 rounded-xl border p-3 text-sm',
                stage === 'verification' ? 'border-blue-200 bg-blue-50 text-blue-950'
                  : finding.status === 'Hylätty' ? 'border-red-200 bg-red-50 text-red-950'
                    : stage === 'closed' ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-text-secondary',
              )}>
                {stage === 'verification' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  : finding.status === 'Hylätty' || overdue ? <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    : <Wrench size={18} className="mt-0.5 shrink-0" />}
                <p>{findingStageDescription(finding.status)}</p>
              </div>

              {finding.correctionNote && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950"><strong>Korjauksen ilmoitus:</strong> {finding.correctionNote}</p>}
              {finding.rejectionReason && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-950"><strong>Hylkäyksen syy:</strong> {finding.rejectionReason}</p>}
              {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <Button variant="ghost" size="sm" onClick={onOpenInspection}>Avaa tarkastus <ArrowRight size={15} className="ml-1" /></Button>
              {open && (
                <Button variant="outline" size="sm" aria-expanded={expanded} onClick={() => setExpanded((previous) => !previous)}>
                  {expanded ? 'Sulje käsittely' : canManage ? 'Käsittele puute' : 'Päivitä korjaus'}
                  {expanded ? <ChevronUp size={15} className="ml-1" /> : <ChevronDown size={15} className="ml-1" />}
                </Button>
              )}
            </div>
          </div>
        </div>

        {open && expanded && (
          <div className="border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <Label>{noteLabel}</Label>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-1 min-h-24 bg-white"
                  placeholder={canManage ? 'Kirjaa ohje, tarkistushavainto tai hylkäyksen täsmällinen syy…' : 'Kuvaa mitä korjattiin ja miten korjaus varmistettiin…'}
                />
              </div>
              <Label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-input bg-white px-4 py-2 text-sm font-medium hover:bg-accent">
                {busyKey === 'upload' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Upload size={15} className="mr-2" />}
                Lisää korjauskuva
                <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={busy} onChange={(event) => void uploadCorrection(event)} />
              </Label>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {canManage ? (
                <>
                  {!finding.workOrderId && stage !== 'closed' && (
                    <Button variant="outline" disabled={busy} onClick={() => void createOrder()}>
                      {busyKey === 'work-order' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Wrench size={15} className="mr-2" />} Luo työmääräys
                    </Button>
                  )}
                  {stage === 'assignment' && (
                    <Button disabled={busy} onClick={() => void transition('Työn alla', false)}>
                      {busyKey === 'status-Työn alla' && <Loader2 size={15} className="mr-2 animate-spin" />} Aloita korjaus
                    </Button>
                  )}
                  {stage === 'correction' && (
                    <Button disabled={busy || !note.trim()} onClick={() => void transition('Odottaa uusintatarkastusta')}>
                      {busyKey === 'status-Odottaa uusintatarkastusta' && <Loader2 size={15} className="mr-2 animate-spin" />} Siirrä tarkistettavaksi
                    </Button>
                  )}
                  {stage === 'verification' && (
                    <>
                      <Button variant="destructive" disabled={busy || !note.trim()} onClick={() => void transition('Hylätty')}>
                        {busyKey === 'status-Hylätty' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <XCircle size={15} className="mr-2" />} Palauta korjattavaksi
                      </Button>
                      <Button disabled={busy} onClick={() => void transition('Hyväksytty', false)}>
                        {busyKey === 'status-Hyväksytty' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle2 size={15} className="mr-2" />} Hyväksy korjaus
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {stage === 'assignment' && (
                    <Button disabled={busy} onClick={() => void transition('Työn alla', false)}>
                      {busyKey === 'status-Työn alla' && <Loader2 size={15} className="mr-2 animate-spin" />} Aloita korjaus
                    </Button>
                  )}
                  {stage === 'correction' && (
                    <Button disabled={busy || !note.trim()} onClick={() => void transition('Ilmoitettu korjatuksi')}>
                      {busyKey === 'status-Ilmoitettu korjatuksi' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle2 size={15} className="mr-2" />} Ilmoita korjatuksi
                    </Button>
                  )}
                  {stage === 'verification' && <p className="self-center text-sm text-text-secondary">Korjaus odottaa työnjohdon uusintatarkastusta.</p>}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
