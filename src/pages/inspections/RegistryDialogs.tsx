import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createProjectBuilding, createProjectStairwell, createProjectUnit,
  type OrganizationPerson, type ProjectBuilding, type ProjectStairwell,
} from '@/lib/supabase/inspectionEntities';

interface ProjectOption { id: string; name: string }
interface BaseProps {
  organizationId: string;
  currentUserId?: string;
  projects: ProjectOption[];
  onSaved: () => Promise<unknown>;
}

function ErrorBox({ message }: { message: string | null }) {
  return message ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</div> : null;
}

export function BuildingDialog({ open, onClose, ...props }: BaseProps & { open: boolean; onClose: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setProjectId(props.projects[0]?.id ?? ''); setName(''); setAddress(''); setError(null); } }, [open, props.projects]);
  const submit = async () => {
    if (!projectId || !name.trim()) return;
    setSaving(true); setError(null);
    try { await createProjectBuilding({ organizationId: props.organizationId, projectId, name, address, userId: props.currentUserId }); await props.onSaved(); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Lisää rakennus</DialogTitle></DialogHeader><ErrorBox message={error} /><div className="space-y-4"><div><Label>Projekti *</Label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{props.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Rakennuksen nimi *</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Esim. Rakennus 1" /></div><div><Label>Osoite</Label><Input value={address} onChange={(event) => setAddress(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Peruuta</Button><Button disabled={saving || !projectId || !name.trim()} onClick={() => void submit()}>{saving && <Loader2 size={16} className="mr-2 animate-spin" />}Tallenna</Button></DialogFooter></DialogContent></Dialog>;
}

export function StairwellDialog({ open, buildings, onClose, ...props }: BaseProps & { open: boolean; buildings: ProjectBuilding[]; onClose: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => buildings.filter((item) => item.projectId === projectId), [buildings, projectId]);
  useEffect(() => { if (open) { const id = props.projects[0]?.id ?? ''; setProjectId(id); setBuildingId(buildings.find((item) => item.projectId === id)?.id ?? ''); setName(''); setError(null); } }, [buildings, open, props.projects]);
  const submit = async () => {
    if (!projectId || !buildingId || !name.trim()) return;
    setSaving(true); setError(null);
    try { await createProjectStairwell({ organizationId: props.organizationId, projectId, buildingId, name, userId: props.currentUserId }); await props.onSaved(); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Lisää rappu</DialogTitle></DialogHeader><ErrorBox message={error} /><div className="space-y-4"><div><Label>Projekti *</Label><Select value={projectId} onValueChange={(value) => { setProjectId(value); setBuildingId(buildings.find((item) => item.projectId === value)?.id ?? ''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{props.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Rakennus *</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="Valitse rakennus" /></SelectTrigger><SelectContent>{options.map((building) => <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Rapun tunnus *</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Esim. A" /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Peruuta</Button><Button disabled={saving || !buildingId || !name.trim()} onClick={() => void submit()}>{saving && <Loader2 size={16} className="mr-2 animate-spin" />}Tallenna</Button></DialogFooter></DialogContent></Dialog>;
}

export function UnitDialog({ open, buildings, stairwells, people, onClose, ...props }: BaseProps & { open: boolean; buildings: ProjectBuilding[]; stairwells: ProjectStairwell[]; people: OrganizationPerson[]; onClose: () => void }) {
  const [draft, setDraft] = useState({ projectId: '', buildingId: 'none', stairwellId: 'none', unitCode: '', floor: '', unitType: '', areaM2: '', scope: '', supervisorId: 'none', completion: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setDraft({ projectId: props.projects[0]?.id ?? '', buildingId: 'none', stairwellId: 'none', unitCode: '', floor: '', unitType: '', areaM2: '', scope: '', supervisorId: 'none', completion: '', notes: '' }); setError(null); } }, [open, props.projects]);
  const buildingOptions = buildings.filter((item) => item.projectId === draft.projectId);
  const stairwellOptions = stairwells.filter((item) => item.buildingId === draft.buildingId);
  const submit = async () => {
    if (!draft.projectId || !draft.unitCode.trim()) return;
    setSaving(true); setError(null);
    try {
      await createProjectUnit({ organizationId: props.organizationId, projectId: draft.projectId, buildingId: draft.buildingId === 'none' ? undefined : draft.buildingId, stairwellId: draft.stairwellId === 'none' ? undefined : draft.stairwellId, unitCode: draft.unitCode, floor: draft.floor, unitType: draft.unitType, areaM2: draft.areaM2 ? Number(draft.areaM2) : undefined, renovationScope: draft.scope, responsibleSupervisorId: draft.supervisorId === 'none' ? undefined : draft.supervisorId, plannedCompletionDate: draft.completion, notes: draft.notes, userId: props.currentUserId });
      await props.onSaved(); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Lisää huoneisto</DialogTitle></DialogHeader><ErrorBox message={error} /><div className="grid gap-4 sm:grid-cols-2"><div><Label>Projekti *</Label><Select value={draft.projectId} onValueChange={(value) => setDraft((previous) => ({ ...previous, projectId: value, buildingId: 'none', stairwellId: 'none' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{props.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Huoneiston tunnus *</Label><Input value={draft.unitCode} onChange={(event) => setDraft((previous) => ({ ...previous, unitCode: event.target.value }))} placeholder="Esim. A 12" /></div><div><Label>Rakennus</Label><Select value={draft.buildingId} onValueChange={(value) => setDraft((previous) => ({ ...previous, buildingId: value, stairwellId: 'none' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei valintaa</SelectItem>{buildingOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Rappu</Label><Select value={draft.stairwellId} onValueChange={(value) => setDraft((previous) => ({ ...previous, stairwellId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei valintaa</SelectItem>{stairwellOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Kerros</Label><Input value={draft.floor} onChange={(event) => setDraft((previous) => ({ ...previous, floor: event.target.value }))} /></div><div><Label>Huoneistotyyppi</Label><Input value={draft.unitType} onChange={(event) => setDraft((previous) => ({ ...previous, unitType: event.target.value }))} placeholder="Esim. 3h+k" /></div><div><Label>Pinta-ala m²</Label><Input type="number" min="0" step="0.1" value={draft.areaM2} onChange={(event) => setDraft((previous) => ({ ...previous, areaM2: event.target.value }))} /></div><div><Label>Vastuullinen työnjohtaja</Label><Select value={draft.supervisorId} onValueChange={(value) => setDraft((previous) => ({ ...previous, supervisorId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei nimetty</SelectItem>{people.filter((person) => ['admin', 'supervisor'].includes(person.role)).map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Suunniteltu valmistuminen</Label><Input type="date" value={draft.completion} onChange={(event) => setDraft((previous) => ({ ...previous, completion: event.target.value }))} /></div><div><Label>Remontin laajuus</Label><Input value={draft.scope} onChange={(event) => setDraft((previous) => ({ ...previous, scope: event.target.value }))} /></div><div className="sm:col-span-2"><Label>Huomiot</Label><Textarea value={draft.notes} onChange={(event) => setDraft((previous) => ({ ...previous, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Peruuta</Button><Button disabled={saving || !draft.projectId || !draft.unitCode.trim()} onClick={() => void submit()}>{saving && <Loader2 size={16} className="mr-2 animate-spin" />}Tallenna huoneisto</Button></DialogFooter></DialogContent></Dialog>;
}
