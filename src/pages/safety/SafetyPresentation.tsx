import {
  AlertCircle, AlertTriangle, Ambulance, Archive, BookOpenCheck, Camera, CheckCircle2,
  ClipboardCheck, Copy, Edit3, FileText, GraduationCap, HeartPulse, MapPin, Megaphone,
  Phone, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRound, Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  ProjectSafetyProfile, SafetyAttachment, SafetyBriefing, SafetyProjectOption,
} from '@/lib/supabase/safetyWorkspace';
import { safetyActionReasons } from '@/lib/supabase/safetyWorkspace';
import { cn } from '@/lib/utils';
import type { SafetyItem, SafetyItemType } from '@/types';
import {
  BASIC_SAFETY_GUIDANCE, SAFETY_ACTIONS, SAFETY_STATUSES, safetyBriefingGradient,
  safetyDateLabel, safetyPhoneHref, safetySeverityTone, safetyStatusTone, type SafetyViewFilter,
} from './SafetyUiTypes';

const ACTION_ICONS = { risk: ShieldCheck, incident: Ambulance, inspection: ClipboardCheck, training: GraduationCap } as const;

export interface SafetyHeaderProps {
  projects: SafetyProjectOption[];
  projectId: string;
  refreshing: boolean;
  onProjectChange: (value: string) => void;
  onRefresh: () => void;
  onCreate: (type?: SafetyItemType) => void;
}

export function SafetyHeader({ projects, projectId, refreshing, onProjectChange, onRefresh, onCreate }: SafetyHeaderProps) {
  return <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Ennakoi · ilmoita · korjaa · varmista</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Työturvallisuuden ohjauskeskus</h1>
      <p className="mt-2 text-sm text-slate-600">Yhteiset ohjeet ja kaikki turvallisuusasiat yhdessä. Rajaa näkymä työmaahan vain tarvittaessa.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Select value={projectId || 'all'} onValueChange={(value) => onProjectChange(value === 'all' ? '' : value)}>
        <SelectTrigger className="w-[260px]" aria-label="Rajaa turvallisuusnäkymä työmaahan">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Kaikki työmaat</SelectItem>
          {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw size={16} className={cn('mr-2', refreshing && 'animate-spin')} /> Päivitä
      </Button>
      <Button onClick={() => onCreate()}><Plus size={16} className="mr-2" /> Tee havainto</Button>
    </div>
  </header>;
}

export interface SafetyHeroProps {
  briefing?: SafetyBriefing;
  attachments: SafetyAttachment[];
  canManage: boolean;
  saving: boolean;
  onCreate: (type?: SafetyItemType) => void;
  onAcknowledge: () => void;
  onOpenAttachment: (attachment: SafetyAttachment) => void;
  onEditBriefing: () => void;
}

export function SafetyHero({ briefing, attachments, canManage, saving, onCreate, onAcknowledge, onOpenAttachment, onEditBriefing }: SafetyHeroProps) {
  return <section className={cn('rounded-3xl bg-gradient-to-br p-6 text-white shadow-xl sm:p-8', safetyBriefingGradient(briefing?.severity ?? 'info'))}>
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
          <Megaphone size={16} /> Työturvallisuus tänään · {new Date().toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{briefing?.title || 'Turvallinen työpäivä alkaa ennakoinnista'}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{briefing?.introduction || 'Käy päivän riskit läpi ennen työn aloittamista ja ilmoita jokaisesta vaarasta heti.'}</p>
        <ul className="mt-5 space-y-3">
          {(briefing?.instructionItems.length ? briefing.instructionItems : BASIC_SAFETY_GUIDANCE).map((instruction) => <li key={instruction} className="flex gap-3 rounded-xl bg-white/10 p-3 text-sm leading-6"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" /><span>{instruction}</span></li>)}
        </ul>
        {briefing && <p className="mt-4 text-xs text-slate-400">Voimassa {safetyDateLabel(briefing.validFrom)}{briefing.validUntil ? `–${safetyDateLabel(briefing.validUntil)}` : ''} · versio {briefing.version} · {briefing.acknowledgementCount} kuittausta</p>}
      </div>
      <div className="flex min-w-[220px] flex-col gap-2">
        <Button onClick={() => onCreate('risk')} className="bg-orange-500 text-white hover:bg-orange-600"><ShieldCheck size={16} className="mr-2" /> Tee turvallisuushavainto</Button>
        <Button onClick={() => onCreate('incident')} variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Ambulance size={16} className="mr-2" /> Tapaturma / läheltä piti</Button>
        {briefing?.requiresAcknowledgement && <Button onClick={onAcknowledge} disabled={saving || Boolean(briefing.acknowledgedAt)} className="bg-emerald-500 text-white hover:bg-emerald-600"><BookOpenCheck size={16} className="mr-2" /> {briefing.acknowledgedAt ? 'Ohje kuitattu' : 'Olen lukenut ohjeen'}</Button>}
        {attachments.map((attachment) => <Button key={attachment.id} variant="ghost" className="justify-start text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => onOpenAttachment(attachment)}><FileText size={15} className="mr-2" /> {attachment.fileName}</Button>)}
        {canManage && <Button variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white" onClick={onEditBriefing}><Edit3 size={15} className="mr-2" /> {briefing ? 'Muokkaa päivän ohjetta' : 'Julkaise päivän ohje'}</Button>}
      </div>
    </div>
  </section>;
}

export interface EmergencyCardProps {
  project?: SafetyProjectOption;
  profile?: ProjectSafetyProfile;
  canManage: boolean;
  onCallEmergency: () => void;
  onCopyAddress: () => void;
  onOpenGuide: () => void;
  onEditProfile: () => void;
}

export function EmergencyCard({ project, profile, canManage, onCallEmergency, onCopyAddress, onOpenGuide, onEditProfile }: EmergencyCardProps) {
  const address = profile?.siteAddress || project?.location || '';
  return <Card className="border-red-200 bg-red-50/70 shadow-sm">
    <CardHeader><CardTitle className="flex items-center gap-2 text-red-900"><HeartPulse size={21} /> Hätätilanteessa</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <Button className="h-14 w-full bg-red-600 text-lg font-bold hover:bg-red-700" onClick={onCallEmergency}><Phone size={20} className="mr-2" /> Soita 112</Button>
      {project ? <>
        <div className="space-y-2 text-sm text-red-950">
          <p><strong>Työmaa:</strong> {project.name}</p>
          <p><strong>Osoite:</strong> {address || 'Ei määritelty'}</p>
          <p><strong>Kokoontumispaikka:</strong> {profile?.assemblyPoint || 'Ei määritelty'}</p>
          <p><strong>Ensiapu:</strong> {profile?.firstAidLocation || 'Ei määritelty'}</p>
          <p><strong>AED:</strong> {profile?.defibrillatorLocation || 'Ei määritelty'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCopyAddress} disabled={!address}><Copy size={15} className="mr-2" /> Kopioi osoite</Button>
          <Button variant="outline" onClick={onOpenGuide}><FileText size={15} className="mr-2" /> Toimintaohje</Button>
        </div>
        {profile?.dutyPhone && <Button asChild variant="outline" className="w-full"><a href={safetyPhoneHref(profile.dutyPhone)}><Phone size={15} className="mr-2" /> Päivystys {profile.dutyPhone}</a></Button>}
        {canManage && <Button variant="ghost" className="w-full" onClick={onEditProfile}><Edit3 size={15} className="mr-2" /> Muokkaa työmaan hätätietoja</Button>}
      </> : <>
        <div className="rounded-xl border border-red-200 bg-white/70 p-4 text-sm leading-6 text-red-950">
          Tämä on organisaation yleinen turvallisuusnäkymä. Valitse yläreunasta työmaa vain, kun tarvitset sen osoitteen, kokoontumispaikan tai muut työmaakohtaiset hätätiedot.
        </div>
        <Button variant="outline" className="w-full" onClick={onOpenGuide}><FileText size={15} className="mr-2" /> Yleinen toimintaohje</Button>
      </>}
    </CardContent>
  </Card>;
}

export function SafetyQuickActions({ onCreate }: { onCreate: (type: SafetyItemType) => void }) {
  return <section>
    <div className="mb-3"><h2 className="text-xl font-bold text-slate-950">Nopeat turvallisuustoiminnot</h2><p className="text-sm text-slate-600">Avaa oikea lomake suoraan. Työmaan valinta ei ole pakollinen.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{SAFETY_ACTIONS.map((action) => { const Icon = ACTION_ICONS[action.value]; return <button key={action.value} type="button" onClick={() => onCreate(action.value)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={21} /></div><h3 className="mt-4 font-semibold text-slate-950">{action.label}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{action.detail}</p></button>; })}</div>
  </section>;
}

export function SafetyMetrics({ metrics, onSelect }: { metrics: { open: number; serious: number; overdue: number; waitingVerification: number }; onSelect: (view: SafetyViewFilter) => void }) {
  const cards = [
    { label: 'Avoimet asiat', value: metrics.open, icon: AlertTriangle, view: 'open' as SafetyViewFilter, detail: 'kaikki käsittelyssä olevat' },
    { label: 'Vakavat avoimet', value: metrics.serious, icon: AlertCircle, view: 'action' as SafetyViewFilter, detail: 'vaativat välitöntä arviota' },
    { label: 'Myöhässä', value: metrics.overdue, icon: ClipboardCheck, view: 'action' as SafetyViewFilter, detail: 'määräaika ylitetty' },
    { label: 'Varmennettavana', value: metrics.waitingVerification, icon: CheckCircle2, view: 'verification' as SafetyViewFilter, detail: 'korjaus odottaa tarkistusta' },
  ];
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map((metric) => <button key={metric.label} type="button" onClick={() => onSelect(metric.view)} className="text-left"><Card className="h-full border-slate-200 transition hover:border-emerald-300 hover:shadow-md"><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-slate-600"><span>{metric.label}</span><metric.icon size={18} className="text-emerald-700" /></div><p className="mt-2 font-mono text-3xl font-bold text-slate-950">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.value ? metric.detail : `Ei ${metric.label.toLocaleLowerCase('fi')}`}</p></CardContent></Card></button>)}</div>;
}

export function SafetyActionQueue({ entries, onOpen, onVerify }: { entries: Array<{ item: SafetyItem; reasons: string[] }>; onOpen: (item: SafetyItem) => void; onVerify: (item: SafetyItem) => void }) {
  return <Card className="border-amber-200 bg-amber-50/40">
    <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Wrench size={19} className="text-amber-700" /> Vaatii toimintaa</CardTitle><Badge variant="outline">{entries.length}</Badge></CardHeader>
    <CardContent className="space-y-2">
      {entries.slice(0, 8).map(({ item, reasons }) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{item.title}</p>{reasons.map((reason) => <Badge key={reason} variant="outline" className="border-amber-300 text-amber-800">{reason}</Badge>)}</div><p className="mt-1 text-sm text-slate-600">{item.project || 'Ei työmaata'} · {item.location || 'sijainti puuttuu'} · {item.assignee || 'ei vastuuhenkilöä'}</p></div><div className="flex gap-2">{item.status === 'Ilmoitettu korjatuksi' && <Button size="sm" onClick={() => onVerify(item)} className="bg-emerald-600 hover:bg-emerald-700">Vahvista</Button>}<Button size="sm" variant="outline" onClick={() => onOpen(item)}>Avaa käsittely</Button></div></div>)}
      {!entries.length && <div className="py-8 text-center"><CheckCircle2 size={38} className="mx-auto text-emerald-500" /><p className="mt-2 font-semibold">Ei käsittelyä vaativia asioita</p></div>}
    </CardContent>
  </Card>;
}

export interface SafetyListProps {
  items: SafetyItem[];
  attachments: SafetyAttachment[];
  view: SafetyViewFilter;
  search: string;
  typeFilter: string;
  statusFilter: string;
  canManage: boolean;
  today: string;
  onView: (value: SafetyViewFilter) => void;
  onSearch: (value: string) => void;
  onType: (value: string) => void;
  onStatus: (value: string) => void;
  onEdit: (item: SafetyItem) => void;
  onDelete: (item: SafetyItem) => void;
  onVerify: (item: SafetyItem) => void;
  onOpenAttachment: (attachment: SafetyAttachment) => void;
  onCreate: (type: SafetyItemType) => void;
}

export function SafetyList(props: SafetyListProps) {
  const { items, attachments, view, search, typeFilter, statusFilter, canManage, today, onView, onSearch, onType, onStatus, onEdit, onDelete, onVerify, onOpenAttachment, onCreate } = props;
  return <section className="space-y-3">
    <div className="flex flex-col gap-3 xl:flex-row">
      <div className="flex flex-wrap gap-2">{([['action', 'Vaatii toimintaa'], ['open', 'Avoimet'], ['verification', 'Varmennettavana'], ['closed', 'Suljetut'], ['all', 'Kaikki']] as Array<[SafetyViewFilter, string]>).map(([value, label]) => <Button key={value} size="sm" variant={view === value ? 'default' : 'outline'} onClick={() => onView(value)}>{label}</Button>)}</div>
      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_210px_210px]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Hae havainnosta, työmaasta tai vastuuhenkilöstä…" /></div>
        <Select value={typeFilter} onValueChange={onType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tyypit</SelectItem>{SAFETY_ACTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={onStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilat</SelectItem>{SAFETY_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
      </div>
    </div>
    {items.map((item) => {
      const itemAttachments = attachments.filter((attachment) => attachment.safetyItemId === item.id);
      const reasons = safetyActionReasons(item, today);
      return <Card key={item.id} className={cn('border-slate-200', item.severity === 'Vakava' && 'border-red-300')}>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={20} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{item.title}</h3><Badge variant="outline" className={safetySeverityTone(item.severity)}>{item.severity || 'Ei määritelty'}</Badge><Badge variant="outline" className={safetyStatusTone(item.status)}>{item.status}</Badge>{reasons.map((reason) => <Badge key={reason} variant="outline">{reason}</Badge>)}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description || 'Ei tarkempaa kuvausta.'}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{safetyDateLabel(item.date)}</span><span>{item.project || 'Ei työmaata'}</span>{item.location && <span className="flex items-center gap-1"><MapPin size={12} />{item.location}</span>}{item.assignee && <span className="flex items-center gap-1"><UserRound size={12} />{item.assignee}</span>}{item.dueDate && <span>Määräaika {safetyDateLabel(item.dueDate)}</span>}</div>
                {item.correctiveAction && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Korjaava toimenpide:</strong> {item.correctiveAction}</div>}
                {itemAttachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{itemAttachments.map((attachment) => <Button key={attachment.id} size="sm" variant="outline" onClick={() => onOpenAttachment(attachment)}><Camera size={14} className="mr-1" /> {attachment.fileName}</Button>)}</div>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">{canManage && item.status === 'Ilmoitettu korjatuksi' && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onVerify(item)}>Vahvista</Button>}{canManage && <Button size="sm" variant="outline" onClick={() => onEdit(item)}><Edit3 size={14} className="mr-1" /> Käsittele</Button>}{canManage && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDelete(item)}><Trash2 size={15} /></Button>}</div>
          </div>
        </CardContent>
      </Card>;
    })}
    {!items.length && <Card className="border-dashed"><CardContent className="p-12 text-center"><ShieldCheck size={44} className="mx-auto text-emerald-300" /><p className="mt-3 font-semibold text-slate-900">Ei tämän näkymän turvallisuusasioita</p><p className="mt-1 text-sm text-slate-500">Hyvä tilanne. Tee havainto heti, jos huomaat vaaran tai puutteen.</p><div className="mt-4 flex justify-center gap-2"><Button onClick={() => onCreate('risk')}>Tee havainto</Button><Button variant="outline" onClick={() => onCreate('inspection')}>Aloita tarkastus</Button></div></CardContent></Card>}
  </section>;
}

export function BriefingAdminList({ briefings, projects, onCreate, onEdit, onArchive }: { briefings: SafetyBriefing[]; projects: SafetyProjectOption[]; onCreate: () => void; onEdit: (item: SafetyBriefing) => void; onArchive: (item: SafetyBriefing) => void }) {
  return <section className="space-y-3">
    <div className="flex items-end justify-between"><div><h2 className="text-xl font-bold text-slate-950">Turvallisuusohjeiden hallinta</h2><p className="text-sm text-slate-600">Julkaise koko organisaatiolle tai valitulle työmaalle.</p></div><Button variant="outline" onClick={onCreate}><Plus size={15} className="mr-2" /> Uusi ohje</Button></div>
    <div className="grid gap-3 lg:grid-cols-2">{briefings.map((item) => <Card key={item.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{item.status === 'published' ? 'Julkaistu' : 'Luonnos'}</Badge><h3 className="mt-2 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.projectId ? projects.find((project) => project.id === item.projectId)?.name : 'Koko organisaatio'} · {item.acknowledgementCount} kuittausta</p></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => onEdit(item)}><Edit3 size={14} /></Button><Button size="sm" variant="ghost" onClick={() => onArchive(item)}><Archive size={14} /></Button></div></div></CardContent></Card>)}</div>
  </section>;
}
