import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { HeartPulse, Phone } from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/contexts/AuthContext';
import type { ProjectSafetyProfile, SafetyBriefing, SafetyBriefingSeverity, SafetyBriefingStatus, SafetyProjectOption } from '@/lib/supabase/safetyWorkspace';
import type { SafetyItem, SafetyItemSeverity, SafetyItemType } from '@/types';
import { SAFETY_ACTIONS, SAFETY_AUDIENCE_ROLES, SAFETY_STATUSES, type SafetyBriefingForm, type SafetyItemForm } from './SafetyUiTypes';

export interface SafetyItemDialogProps {
  open: boolean;
  form: SafetyItemForm;
  editing: SafetyItem | null;
  errors: string[];
  projects: SafetyProjectOption[];
  people: Array<{ userId: string; name: string }>;
  canManage: boolean;
  observationFileCount: number;
  correctionFileCount: number;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onForm: Dispatch<SetStateAction<SafetyItemForm>>;
  onObservationFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onCorrectionFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}

export function SafetyItemDialog(props: SafetyItemDialogProps) {
  const { open, form, editing, errors, projects, people, canManage, observationFileCount, correctionFileCount, saving, onOpenChange, onForm, onObservationFiles, onCorrectionFiles, onSave } = props;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{editing ? 'Käsittele turvallisuusasiaa' : SAFETY_ACTIONS.find((item) => item.value === form.type)?.label}</DialogTitle></DialogHeader>
      {errors.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Tyyppi</Label><Select value={form.type} onValueChange={(value) => onForm((previous) => ({ ...previous, type: value as SafetyItemType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SAFETY_ACTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Päivä</Label><Input type="date" value={form.date} onChange={(event) => onForm((previous) => ({ ...previous, date: event.target.value }))} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Otsikko *</Label><Input value={form.title} onChange={(event) => onForm((previous) => ({ ...previous, title: event.target.value }))} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Kuvaus *</Label><Textarea rows={5} value={form.description} onChange={(event) => onForm((previous) => ({ ...previous, description: event.target.value }))} /></div>
        <div className="space-y-2">
          <Label>Työmaa</Label>
          <Select value={form.projectId || 'none'} onValueChange={(value) => onForm((previous) => ({ ...previous, projectId: value === 'none' ? '' : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">Ei liity tiettyyn työmaahan</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs leading-5 text-slate-500">Valinnainen. Havainto voidaan tallentaa myös organisaation yleiseksi turvallisuusasiaksi.</p>
        </div>
        <div className="space-y-2"><Label>Tarkka sijainti</Label><Input value={form.location} onChange={(event) => onForm((previous) => ({ ...previous, location: event.target.value }))} placeholder="Esim. varasto, piha tai porrashuone" /></div>
        <div className="space-y-2"><Label>Vakavuus</Label><Select value={form.severity} onValueChange={(value) => onForm((previous) => ({ ...previous, severity: value as SafetyItemSeverity }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['Lievä', 'Keskitasoinen', 'Vakava'] as SafetyItemSeverity[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        {canManage && <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value) => onForm((previous) => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SAFETY_STATUSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>}
        {canManage && <>
          <div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={form.assigneeUserId || 'none'} onValueChange={(value) => onForm((previous) => ({ ...previous, assigneeUserId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Korjauksen määräaika</Label><Input type="date" value={form.dueDate} onChange={(event) => onForm((previous) => ({ ...previous, dueDate: event.target.value }))} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Juurisyy</Label><Textarea rows={2} value={form.rootCause} onChange={(event) => onForm((previous) => ({ ...previous, rootCause: event.target.value }))} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Korjaava toimenpide</Label><Textarea rows={3} value={form.correctiveAction} onChange={(event) => onForm((previous) => ({ ...previous, correctiveAction: event.target.value }))} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Ehkäisevä toimenpide</Label><Textarea rows={3} value={form.preventiveAction} onChange={(event) => onForm((previous) => ({ ...previous, preventiveAction: event.target.value }))} /></div>
        </>}
        <div className="space-y-2 sm:col-span-2"><Label>Havainnon kuvat</Label><Input type="file" accept="image/*" capture="environment" multiple onChange={onObservationFiles} /><p className="text-xs text-slate-500">Enintään 8 kuvaa, 15 Mt / kuva. Valittu: {observationFileCount}</p></div>
        {canManage && <div className="space-y-2 sm:col-span-2"><Label>Korjauksen kuvat</Label><Input type="file" accept="image/*" capture="environment" multiple onChange={onCorrectionFiles} /><p className="text-xs text-slate-500">Valittu: {correctionFileCount}</p></div>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button><Button onClick={onSave} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export interface SafetyBriefingDialogProps {
  open: boolean;
  form: SafetyBriefingForm;
  errors: string[];
  projects: SafetyProjectOption[];
  fileCount: number;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onForm: Dispatch<SetStateAction<SafetyBriefingForm>>;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}

export function SafetyBriefingDialog(props: SafetyBriefingDialogProps) {
  const { open, form, errors, projects, fileCount, saving, onOpenChange, onForm, onFiles, onSave } = props;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{form.id ? 'Muokkaa turvallisuusohjetta' : 'Uusi turvallisuusohje'}</DialogTitle></DialogHeader>
      {errors.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Otsikko *</Label><Input value={form.title} onChange={(event) => onForm((previous) => ({ ...previous, title: event.target.value }))} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Johdanto</Label><Textarea rows={3} value={form.introduction} onChange={(event) => onForm((previous) => ({ ...previous, introduction: event.target.value }))} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Toimintaohjeet, yksi per rivi *</Label><Textarea rows={6} value={form.instructions} onChange={(event) => onForm((previous) => ({ ...previous, instructions: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Kohde</Label><Select value={form.projectId || 'all'} onValueChange={(value) => onForm((previous) => ({ ...previous, projectId: value === 'all' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Koko organisaatio</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Tärkeys</Label><Select value={form.severity} onValueChange={(value) => onForm((previous) => ({ ...previous, severity: value as SafetyBriefingSeverity }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Tieto</SelectItem><SelectItem value="warning">Huomio</SelectItem><SelectItem value="danger">Tärkeä</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Voimassa alkaen</Label><Input type="date" value={form.validFrom} onChange={(event) => onForm((previous) => ({ ...previous, validFrom: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Voimassa asti</Label><Input type="date" value={form.validUntil} onChange={(event) => onForm((previous) => ({ ...previous, validUntil: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Tila</Label><Select value={form.status} onValueChange={(value) => onForm((previous) => ({ ...previous, status: value as SafetyBriefingStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Luonnos</SelectItem><SelectItem value="published">Julkaistu</SelectItem></SelectContent></Select></div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><Checkbox checked={form.requiresAcknowledgement} onCheckedChange={(checked) => onForm((previous) => ({ ...previous, requiresAcknowledgement: checked === true }))} /> Vaadi lukukuittaus</label>
        <div className="space-y-2 sm:col-span-2"><Label>Kohderoolit</Label><div className="grid gap-2 sm:grid-cols-3">{SAFETY_AUDIENCE_ROLES.map((role) => <label key={role} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><Checkbox checked={form.audienceRoles.includes(role)} onCheckedChange={(checked) => onForm((previous) => ({ ...previous, audienceRoles: checked === true ? [...new Set([...previous.audienceRoles, role])] : previous.audienceRoles.filter((item) => item !== role) }))} /> {ROLE_LABELS[role]}</label>)}</div></div>
        <div className="space-y-2 sm:col-span-2"><Label>Liitteet</Label><Input type="file" accept="image/*,application/pdf" multiple onChange={onFiles} /><p className="text-xs text-slate-500">Valittu: {fileCount}</p></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button><Button onClick={onSave} disabled={saving}>{form.status === 'published' ? 'Julkaise ohje' : 'Tallenna luonnos'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function SafetyProfileDialog({ open, form, saving, onOpenChange, onForm, onSave }: { open: boolean; form: ProjectSafetyProfile; saving: boolean; onOpenChange: (open: boolean) => void; onForm: Dispatch<SetStateAction<ProjectSafetyProfile>>; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>Työmaan hätä- ja turvallisuustiedot</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Osoite</Label><Input value={form.siteAddress} onChange={(event) => onForm((previous) => ({ ...previous, siteAddress: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Kokoontumispaikka</Label><Input value={form.assemblyPoint} onChange={(event) => onForm((previous) => ({ ...previous, assemblyPoint: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Ensiapuvälineet</Label><Input value={form.firstAidLocation} onChange={(event) => onForm((previous) => ({ ...previous, firstAidLocation: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Defibrillaattori</Label><Input value={form.defibrillatorLocation} onChange={(event) => onForm((previous) => ({ ...previous, defibrillatorLocation: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Päivystysnumero</Label><Input type="tel" value={form.dutyPhone} onChange={(event) => onForm((previous) => ({ ...previous, dutyPhone: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Turvallisuusvastaava</Label><Input value={form.safetyContactName} onChange={(event) => onForm((previous) => ({ ...previous, safetyContactName: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Puhelin</Label><Input type="tel" value={form.safetyContactPhone} onChange={(event) => onForm((previous) => ({ ...previous, safetyContactPhone: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Ensiapuvastaava</Label><Input value={form.firstAidContactName} onChange={(event) => onForm((previous) => ({ ...previous, firstAidContactName: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Puhelin</Label><Input type="tel" value={form.firstAidContactPhone} onChange={(event) => onForm((previous) => ({ ...previous, firstAidContactPhone: event.target.value }))} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Muut hätäohjeet</Label><Textarea rows={5} value={form.emergencyInstructions} onChange={(event) => onForm((previous) => ({ ...previous, emergencyInstructions: event.target.value }))} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button><Button onClick={onSave} disabled={saving}>Tallenna</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function EmergencyGuideDialog({ open, profile, project, onOpenChange, onCall }: { open: boolean; profile?: ProjectSafetyProfile; project?: SafetyProjectOption; onOpenChange: (open: boolean) => void; onCall: () => void }) {
  const address = profile?.siteAddress || project?.location || '';
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-800"><HeartPulse size={20} /> Toimi hätätilanteessa</DialogTitle></DialogHeader>
      <ol className="space-y-3 text-sm leading-6">
        <li className="rounded-xl border border-red-200 bg-red-50 p-4"><strong>1. Soita 112.</strong> Kerro mitä tapahtui ja kuinka monta loukkaantunutta on.</li>
        <li className="rounded-xl border p-4"><strong>2. Ilmoita tarkka sijainti.</strong> {address ? `Osoite: ${address}` : 'Kerro työmaan, rakennuksen tai muun tapahtumapaikan tarkka osoite.'}</li>
        <li className="rounded-xl border p-4"><strong>3. Järjestä opastus.</strong> Lähetä henkilö sisäänkäynnille tai sovittuun kohtaamispaikkaan.</li>
        <li className="rounded-xl border p-4"><strong>4. Estä lisävahingot turvallisesti.</strong></li>
      </ol>
      {profile?.emergencyInstructions && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><strong>Työmaan oma ohje:</strong><p className="mt-1 whitespace-pre-wrap">{profile.emergencyInstructions}</p></div>}
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Sulje</Button><Button className="bg-red-600 hover:bg-red-700" onClick={onCall}><Phone size={15} className="mr-2" /> Soita 112</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function SafetyConfirmDialogs({ callOpen, deleteTarget, archiveTarget, address, onCallOpen, onDeleteTarget, onArchiveTarget, onDelete, onArchive }: { callOpen: boolean; deleteTarget: SafetyItem | null; archiveTarget: SafetyBriefing | null; address: string; onCallOpen: (open: boolean) => void; onDeleteTarget: (item: SafetyItem | null) => void; onArchiveTarget: (item: SafetyBriefing | null) => void; onDelete: () => void; onArchive: () => void }) {
  return <>
    <AlertDialog open={callOpen} onOpenChange={onCallOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Oletko hätätilanteessa?</AlertDialogTitle><AlertDialogDescription>{address ? `Soita 112 vain todellisessa hätätilanteessa. Ilmoita osoite: ${address}.` : 'Soita 112 vain todellisessa hätätilanteessa. Selvitä ja ilmoita tapahtumapaikan tarkka osoite.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction asChild className="bg-red-600 hover:bg-red-700"><a href="tel:112"><Phone size={15} className="mr-2" /> Soita 112</a></AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && onDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko turvallisuusasia?</AlertDialogTitle><AlertDialogDescription>Poisto tallentuu organisaation audit-lokiin.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={onDelete}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && onArchiveTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arkistoidaanko turvallisuusohje?</AlertDialogTitle><AlertDialogDescription>Ohje poistuu aktiivisesta näkymästä. Kuittaukset ja versiohistoria säilyvät.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={onArchive}>Arkistoi</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
