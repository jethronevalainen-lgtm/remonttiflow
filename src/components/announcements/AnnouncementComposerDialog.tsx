import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Eye,
  FolderKanban,
  Link2,
  Loader2,
  Megaphone,
  Search,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';

import { ROLE_LABELS, type UserRole } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAnnouncementDirectory } from '@/hooks/useAnnouncements';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  buildAnnouncementPlacements,
  buildAnnouncementTargets,
  localDateTimeToIso,
  statusForPublishMode,
  validateAnnouncementForm,
  type AnnouncementPlacementSelections,
  type AnnouncementTargetSelections,
} from '@/lib/announcementForm';
import {
  createAnnouncementV2,
  previewAnnouncementRecipients,
  type AnnouncementDirectoryPerson,
  type AnnouncementPriorityV2,
} from '@/lib/supabase/announcements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PRIORITIES: AnnouncementPriorityV2[] = ['Info', 'Normaali', 'Tärkeä', 'Kriittinen'];
const TARGET_ROLES: UserRole[] = ['admin', 'supervisor', 'project_coordinator', 'worker', 'customer'];

type PublishMode = 'draft' | 'now' | 'scheduled';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (announcementId: string, mode: PublishMode) => Promise<void> | void;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function defaultTargets(): AnnouncementTargetSelections {
  return {
    wholeOrganization: true,
    roles: [],
    supervisorUserIds: [],
    projectIds: [],
    customerProjectIds: [],
    userIds: [],
  };
}

function defaultPlacements(): AnnouncementPlacementSelections {
  return {
    dashboard: true,
    notificationCenter: false,
    banner: false,
    projectIds: [],
    workOrderIds: [],
  };
}

function roleSummary(people: AnnouncementDirectoryPerson[]) {
  const counts = new Map<UserRole, number>();
  people.forEach((person) => counts.set(person.role, (counts.get(person.role) ?? 0) + 1));
  return TARGET_ROLES
    .filter((role) => (counts.get(role) ?? 0) > 0)
    .map((role) => `${ROLE_LABELS[role]} ${counts.get(role)}`)
    .join(' · ');
}

function sectionTitle(icon: React.ReactNode, title: string, description: string) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{icon}</div>
      <div>
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 break-words text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export default function AnnouncementComposerDialog({ open, onOpenChange, onCreated }: Props) {
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const { workOrders } = useRoleWorkspace();
  const { people: directory, loading: directoryLoading, error: directoryError } = useAnnouncementDirectory(open);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriorityV2>('Normaali');
  const [linkPath, setLinkPath] = useState('');
  const [targets, setTargets] = useState<AnnouncementTargetSelections>(defaultTargets);
  const [placements, setPlacements] = useState<AnnouncementPlacementSelections>(defaultPlacements);
  const [publishMode, setPublishMode] = useState<PublishMode>('now');
  const [startsAtLocal, setStartsAtLocal] = useState('');
  const [expiresAtLocal, setExpiresAtLocal] = useState('');
  const [requireAcknowledgement, setRequireAcknowledgement] = useState(false);
  const [dismissible, setDismissible] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [previewPeople, setPreviewPeople] = useState<AnnouncementDirectoryPerson[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const builtTargets = useMemo(() => buildAnnouncementTargets(targets), [targets]);
  const builtPlacements = useMemo(() => buildAnnouncementPlacements(placements), [placements]);
  const targetSignature = JSON.stringify(builtTargets);
  const supervisors = directory.filter((person) => person.role === 'supervisor');
  const filteredPeople = directory.filter((person) => {
    const query = personSearch.trim().toLocaleLowerCase('fi');
    return !query || `${person.displayName} ${person.email} ${ROLE_LABELS[person.role]}`.toLocaleLowerCase('fi').includes(query);
  });

  useEffect(() => {
    if (!open || !currentOrg || builtTargets.length === 0) {
      setPreviewPeople([]);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError(null);
      void previewAnnouncementRecipients(currentOrg.id, builtTargets)
        .then((people) => {
          if (!cancelled) setPreviewPeople(people);
        })
        .catch((caught) => {
          if (!cancelled) {
            setPreviewPeople([]);
            setPreviewError(caught instanceof Error ? caught.message : 'Vastaanottajien esikatselu epäonnistui.');
          }
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [builtTargets, currentOrg, open, targetSignature]);

  const reset = () => {
    setTitle('');
    setContent('');
    setPriority('Normaali');
    setLinkPath('');
    setTargets(defaultTargets());
    setPlacements(defaultPlacements());
    setPublishMode('now');
    setStartsAtLocal('');
    setExpiresAtLocal('');
    setRequireAcknowledgement(false);
    setDismissible(true);
    setPinned(false);
    setPersonSearch('');
    setPreviewPeople([]);
    setPreviewError(null);
    setFormErrors([]);
  };

  const changePriority = (next: AnnouncementPriorityV2) => {
    setPriority(next);
    if (next === 'Info') {
      setPlacements((value) => ({ ...value, dashboard: false, notificationCenter: false, banner: false }));
      setRequireAcknowledgement(false);
      setDismissible(true);
    } else if (next === 'Normaali') {
      setPlacements((value) => ({ ...value, dashboard: true, notificationCenter: false, banner: false }));
      setRequireAcknowledgement(false);
      setDismissible(true);
    } else if (next === 'Tärkeä') {
      setPlacements((value) => ({ ...value, dashboard: true, notificationCenter: true, banner: false }));
    } else {
      setPlacements((value) => ({ ...value, dashboard: true, notificationCenter: true, banner: true }));
      setRequireAcknowledgement(true);
      setDismissible(false);
      setPinned(true);
    }
  };

  const save = async () => {
    const errors = validateAnnouncementForm({
      title,
      content,
      priority,
      publishMode,
      startsAtLocal,
      expiresAtLocal,
      targets: builtTargets,
      placements: builtPlacements,
    });
    if (previewPeople.length === 0 && !previewLoading) errors.push('Valittu kohdistus ei tuota yhtään vastaanottajaa.');
    setFormErrors([...new Set(errors)]);
    if (errors.length > 0 || !currentOrg) return;

    setSaving(true);
    try {
      const announcementId = await createAnnouncementV2({
        organizationId: currentOrg.id,
        title: title.trim(),
        content: content.trim(),
        priority,
        status: statusForPublishMode(publishMode),
        startsAt: publishMode === 'now' ? undefined : localDateTimeToIso(startsAtLocal),
        expiresAt: localDateTimeToIso(expiresAtLocal),
        requireAcknowledgement,
        dismissible: requireAcknowledgement ? false : dismissible,
        pinned,
        linkPath: linkPath.trim() || undefined,
        targets: builtTargets,
        placements: builtPlacements,
      });
      await onCreated(announcementId, publishMode);
      reset();
      onOpenChange(false);
    } catch (caught) {
      setFormErrors([caught instanceof Error ? caught.message : 'Tiedotteen tallennus epäonnistui.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) { if (!next) reset(); onOpenChange(next); } }}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone size={20} /> Uusi tiedote</DialogTitle>
        </DialogHeader>

        {formErrors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {formErrors.map((error) => <p key={error} className="break-words">{error}</p>)}
          </div>
        )}
        {directoryError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{directoryError}</div>}

        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
            {sectionTitle(<Megaphone size={18} />, '1. Tiedotteen sisältö', 'Kirjoita selkeä otsikko ja varsinainen ohje. Kriittisessä tiedotteessa kerro myös, mitä vastaanottajan pitää tehdä.')}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="announcement-title">Otsikko *</Label>
                <Input id="announcement-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Esimerkiksi työmaan kulkureitti muuttuu maanantaina" />
                <p className="text-right text-xs text-slate-400">{title.length}/180</p>
              </div>
              <div className="space-y-2">
                <Label>Prioriteetti</Label>
                <Select value={priority} onValueChange={(value: AnnouncementPriorityV2) => changePriority(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-link">Liittyvä sovelluspolku</Label>
                <div className="relative">
                  <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input id="announcement-link" value={linkPath} onChange={(event) => setLinkPath(event.target.value)} className="pl-9" placeholder="Esimerkiksi /projektit/... tai /tyomaaraykset" />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="announcement-content">Sisältö *</Label>
                <Textarea id="announcement-content" value={content} onChange={(event) => setContent(event.target.value)} rows={7} maxLength={10_000} placeholder="Kerro mitä muuttuu, milloin muutos alkaa, ketä se koskee ja keneltä saa tarvittaessa lisätietoja." />
                <p className="text-right text-xs text-slate-400">{content.length}/10 000</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
            {sectionTitle(<UsersRound size={18} />, '2. Vastaanottajat', 'Valitse yksi tai useampi kohderyhmä. Sama henkilö lasketaan vastaanottajaksi vain kerran, vaikka hän kuuluisi useaan valintaan.')}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-3">
                <Checkbox checked={targets.wholeOrganization} onCheckedChange={(checked) => setTargets((value) => ({ ...value, wholeOrganization: checked === true }))} />
                <span><span className="block font-medium text-slate-950">Koko sisäinen organisaatio</span><span className="mt-1 block text-xs leading-5 text-slate-500">Ylläpitäjät, työnjohto, projektikoordinaattorit ja työntekijät. Ei tilaajia.</span></span>
              </label>
              {TARGET_ROLES.map((role) => (
                <label key={role} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <Checkbox checked={targets.roles.includes(role)} onCheckedChange={() => setTargets((value) => ({ ...value, roles: toggle(value.roles, role) }))} />
                  <span className="font-medium text-slate-900">Kaikki: {ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>

            {supervisors.length > 0 && (
              <details className="rounded-xl border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer font-semibold text-slate-900">Työnjohtajan tiimi</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {supervisors.map((person) => (
                    <label key={person.userId} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                      <Checkbox checked={targets.supervisorUserIds.includes(person.userId)} onCheckedChange={() => setTargets((value) => ({ ...value, supervisorUserIds: toggle(value.supervisorUserIds, person.userId) }))} />
                      <span className="break-words text-sm font-medium">{person.displayName}</span>
                    </label>
                  ))}
                </div>
              </details>
            )}

            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer font-semibold text-slate-900">Projektien sisäiset käyttäjät</summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">Valinta sisältää projektitiimin, työhön nimetyt tekijät ja projektin vastuuhenkilöt.</p>
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                    <Checkbox checked={targets.projectIds.includes(project.id)} onCheckedChange={() => setTargets((value) => ({ ...value, projectIds: toggle(value.projectIds, project.id) }))} />
                    <span className="break-words text-sm font-medium">{project.name}</span>
                  </label>
                ))}
                {projects.length === 0 && <p className="text-sm text-slate-500">Organisaatiolla ei ole projekteja.</p>}
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer font-semibold text-slate-900">Projektien tilaajat</summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">Tiedote näkyy valitun projektin asiakasportaaliin liitetyille tilaajakäyttäjille.</p>
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                    <Checkbox checked={targets.customerProjectIds.includes(project.id)} onCheckedChange={() => setTargets((value) => ({ ...value, customerProjectIds: toggle(value.customerProjectIds, project.id) }))} />
                    <span className="break-words text-sm font-medium">{project.name}</span>
                  </label>
                ))}
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer font-semibold text-slate-900">Nimetyt henkilöt</summary>
              <div className="relative mt-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} className="pl-9" placeholder="Hae nimellä, sähköpostilla tai roolilla" />
              </div>
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                {filteredPeople.map((person) => (
                  <label key={person.userId} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                    <Checkbox checked={targets.userIds.includes(person.userId)} onCheckedChange={() => setTargets((value) => ({ ...value, userIds: toggle(value.userIds, person.userId) }))} />
                    <span className="min-w-0"><span className="block break-words text-sm font-medium">{person.displayName}</span><span className="block break-all text-xs text-slate-500">{ROLE_LABELS[person.role]}{person.email ? ` · ${person.email}` : ''}</span></span>
                  </label>
                ))}
                {directoryLoading && <p className="text-sm text-slate-500">Ladataan henkilöitä…</p>}
              </div>
            </details>

            <div className={cn('rounded-xl border p-4', previewError ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')}>
              <div className="flex items-center gap-2 font-semibold text-slate-950">
                {previewLoading ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} className="text-emerald-700" />}
                {previewLoading ? 'Lasketaan vastaanottajia…' : `Tiedote kohdistuu ${previewPeople.length} henkilölle`}
              </div>
              {previewError ? <p className="mt-2 break-words text-sm text-red-700">{previewError}</p> : previewPeople.length > 0 && <p className="mt-2 break-words text-sm text-slate-600">{roleSummary(previewPeople)}</p>}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4 sm:p-5">
            {sectionTitle(<Eye size={18} />, '3. Näyttöpaikat', 'Tiedote tallentuu aina tiedotearkistoon. Valitse lisäksi paikat, joissa vastaanottajan on tarkoitus huomata se.')}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 opacity-80">
                <Checkbox checked disabled />
                <span><span className="block font-medium">Tiedotearkisto</span><span className="mt-1 block text-xs text-slate-500">Aina käytössä.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <Checkbox checked={placements.dashboard} onCheckedChange={(checked) => setPlacements((value) => ({ ...value, dashboard: checked === true }))} />
                <span><span className="block font-medium">Etusivu</span><span className="mt-1 block text-xs text-slate-500">Näkyy käyttäjän etusivun tiedotekortissa.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <Checkbox checked={placements.notificationCenter} onCheckedChange={(checked) => setPlacements((value) => ({ ...value, notificationCenter: checked === true }))} />
                <span><span className="block font-medium">Ilmoituskello</span><span className="mt-1 block text-xs text-slate-500">Luo jokaiselle vastaanottajalle henkilökohtaisen ilmoituksen.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <Checkbox checked={placements.banner} onCheckedChange={(checked) => setPlacements((value) => ({ ...value, banner: checked === true }))} />
                <span><span className="block font-medium">Sovelluksen yläpalkki</span><span className="mt-1 block text-xs text-slate-500">Näkyy kaikilla sovelluksen sivuilla, kunnes tiedote voidaan piilottaa tai se päättyy.</span></span>
              </label>
            </div>

            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer font-semibold text-slate-900">Projektien sivut</summary>
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                    <Checkbox checked={placements.projectIds.includes(project.id)} onCheckedChange={() => setPlacements((value) => ({ ...value, projectIds: toggle(value.projectIds, project.id) }))} />
                    <span className="break-words text-sm font-medium">{project.name}</span>
                  </label>
                ))}
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer font-semibold text-slate-900">Työmääräykset</summary>
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                {workOrders.map((order) => (
                  <label key={order.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                    <Checkbox checked={placements.workOrderIds.includes(order.id)} onCheckedChange={() => setPlacements((value) => ({ ...value, workOrderIds: toggle(value.workOrderIds, order.id) }))} />
                    <span className="min-w-0"><span className="block break-words text-sm font-medium">{order.title}</span><span className="block break-words text-xs text-slate-500">{order.project} · {order.location || 'Ei sijaintia'}</span></span>
                  </label>
                ))}
                {workOrders.length === 0 && <p className="text-sm text-slate-500">Ei valittavia työmääräyksiä.</p>}
              </div>
            </details>
          </section>

          <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
            {sectionTitle(<CalendarClock size={18} />, '4. Julkaisu ja kuittaus', 'Julkaise heti, ajasta myöhemmäksi tai tallenna luonnoksena. Voimassaolon päättyessä tiedote poistuu aktiivisista näyttöpaikoista.')}
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><input type="radio" name="publish-mode" checked={publishMode === 'now'} onChange={() => setPublishMode('now')} /><span className="font-medium">Julkaise heti</span></label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><input type="radio" name="publish-mode" checked={publishMode === 'scheduled'} onChange={() => setPublishMode('scheduled')} /><span className="font-medium">Ajasta</span></label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><input type="radio" name="publish-mode" checked={publishMode === 'draft'} onChange={() => setPublishMode('draft')} /><span className="font-medium">Luonnos</span></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="announcement-start">Julkaisuaika{publishMode === 'scheduled' ? ' *' : ''}</Label>
                <Input id="announcement-start" type="datetime-local" value={startsAtLocal} onChange={(event) => setStartsAtLocal(event.target.value)} disabled={publishMode === 'now'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-end">Voimassaolon päättyminen</Label>
                <Input id="announcement-end" type="datetime-local" value={expiresAtLocal} onChange={(event) => setExpiresAtLocal(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <Checkbox checked={pinned} onCheckedChange={(checked) => setPinned(checked === true)} />
                <span><span className="block font-medium">Kiinnitä tärkeäksi</span><span className="mt-1 block text-xs text-slate-500">Nostetaan muiden tiedotteiden edelle.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <Checkbox checked={requireAcknowledgement} onCheckedChange={(checked) => { const next = checked === true; setRequireAcknowledgement(next); if (next) setDismissible(false); }} />
                <span><span className="block font-medium">Vaadi lukukuittaus</span><span className="mt-1 block text-xs text-slate-500">Käyttäjän pitää vahvistaa lukeneensa tiedotteen.</span></span>
              </label>
              <label className={cn('flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3', requireAcknowledgement ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
                <Checkbox checked={dismissible} disabled={requireAcknowledgement} onCheckedChange={(checked) => setDismissible(checked === true)} />
                <span><span className="block font-medium">Saa piilottaa</span><span className="mt-1 block text-xs text-slate-500">Koskee yläpalkin tiedotetta.</span></span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            {sectionTitle(priority === 'Kriittinen' ? <ShieldAlert size={18} /> : <BellRing size={18} />, '5. Julkaisuyhteenveto', 'Tarkista kohdistus ennen tallennusta. Vastaanottajalista jää muuttumattomaksi toimitusjäljeksi julkaisuhetkellä.')}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Vastaanottajia</p><p className="mt-1 text-2xl font-bold text-slate-950">{previewPeople.length}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Näyttöpaikkoja</p><p className="mt-1 text-2xl font-bold text-slate-950">{builtPlacements.length}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Julkaisu</p><p className="mt-1 break-words font-semibold text-slate-950">{publishMode === 'now' ? 'Heti' : publishMode === 'scheduled' ? 'Ajastettuna' : 'Luonnoksena'}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {builtPlacements.map((placement, index) => <Badge key={`${placement.type}-${index}`} variant="outline" className="bg-white">{placement.type}</Badge>)}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Peruuta</Button>
          <Button onClick={() => void save()} disabled={saving || previewLoading} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : publishMode === 'draft' ? <FolderKanban size={16} /> : publishMode === 'scheduled' ? <CalendarClock size={16} /> : <Megaphone size={16} />}
            {saving ? 'Tallennetaan…' : publishMode === 'draft' ? 'Tallenna luonnos' : publishMode === 'scheduled' ? 'Ajasta tiedote' : 'Julkaise tiedote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
