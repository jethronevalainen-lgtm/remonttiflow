import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  FolderKanban,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  loadPortalAccounts,
  loadPortalProjectRequests,
  loadPortalProjects,
  type CustomerPortalAccountV2,
} from '@/lib/supabase/customerPortalData';
import { createProjectRequest, type CustomerProjectSummary, type ProjectRequest } from '@/lib/supabase/projectCollaboration';

const ALL_CUSTOMERS = 'all';
const EMPTY_FORM = {
  customerId: '',
  projectName: '',
  location: '',
  description: '',
  desiredStartDate: '',
  desiredEndDate: '',
  contactName: '',
  contactPhone: '',
};

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function requestStatusClass(status: string) {
  if (status === 'Muutettu projektiksi' || status === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Lisätietoja pyydetty') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function TilaajanTyotV2() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName, isPreviewing, customerPreview } = useViewAs();
  const [accounts, setAccounts] = useState<CustomerPortalAccountV2[]>([]);
  const [projects, setProjects] = useState<CustomerProjectSummary[]>([]);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(ALL_CUSTOMERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [nextAccounts, nextProjects, nextRequests] = await Promise.all([
        loadPortalAccounts(currentOrg.id, isPreviewing ? customerPreview : null),
        loadPortalProjects(currentOrg.id, isPreviewing ? customerPreview : null),
        loadPortalProjectRequests(currentOrg.id, isPreviewing ? customerPreview : null),
      ]);
      setAccounts(nextAccounts);
      setProjects(nextProjects);
      setRequests(nextRequests);
      setSelectedCustomerId((current) => current === ALL_CUSTOMERS || nextAccounts.some((item) => item.customerId === current) ? current : ALL_CUSTOMERS);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilaajan työtilan lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, customerPreview, isPreviewing]);

  useEffect(() => { void refresh(); }, [refresh]);

  const visibleProjects = useMemo(
    () => selectedCustomerId === ALL_CUSTOMERS ? projects : projects.filter((project) => project.customerId === selectedCustomerId),
    [projects, selectedCustomerId],
  );
  const visibleRequests = useMemo(
    () => selectedCustomerId === ALL_CUSTOMERS ? requests : requests.filter((request) => request.customerId === selectedCustomerId),
    [requests, selectedCustomerId],
  );
  const activeProjects = visibleProjects.filter((project) => project.status !== 'Valmis').length;
  const waitingDecisions = visibleRequests.filter((request) => ['Lähetetty', 'Käsittelyssä', 'Lisätietoja pyydetty'].includes(request.status)).length;

  const openRequest = () => {
    if (isPreviewing) return;
    const defaultCustomerId = selectedCustomerId !== ALL_CUSTOMERS
      ? selectedCustomerId
      : accounts[0]?.customerId ?? '';
    setForm({ ...EMPTY_FORM, customerId: defaultCustomerId, contactName: effectiveDisplayName });
    setError(null);
    setSuccess(null);
    setOpen(true);
  };

  const submitRequest = async () => {
    if (isPreviewing) return;
    if (!currentOrg || !form.customerId || form.projectName.trim().length < 3 || form.description.trim().length < 10) {
      setError('Valitse tilaaja-asiakkuus ja anna projektille nimi sekä riittävä kuvaus.');
      return;
    }
    setSaving(true);
    try {
      await createProjectRequest({
        organizationId: currentOrg.id,
        customerId: form.customerId,
        projectName: form.projectName.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        desiredStartDate: form.desiredStartDate,
        desiredEndDate: form.desiredEndDate,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
      });
      setOpen(false);
      setSuccess('Projektipyyntö lähetettiin työnjohdolle käsiteltäväksi.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Projektipyynnön lähetys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              <span>Tilaajan työtila</span>
              {isPreviewing && <Badge className="border-white/20 bg-white/10 text-white"><Eye size={12} className="mr-1" /> Esikatselu</Badge>}
            </div>
            <h1 className="text-3xl font-bold">Projektini</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Näet vain sinulle sallitut asiakkuudet, projektit, työpyynnöt ja tilaajalle julkaistut tiedot.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {accounts.length > 1 && (
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="min-w-64 border-white/20 bg-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL_CUSTOMERS}>Kaikki asiakkuudet</SelectItem>{accounts.map((account) => <SelectItem key={account.customerId} value={account.customerId}>{account.customerName}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {!isPreviewing && <Button onClick={openRequest} disabled={accounts.length === 0} className="gap-2 bg-teal-500 text-white hover:bg-teal-600"><Plus size={17} /> Uusi projektipyyntö</Button>}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Asiakkuudet</p><p className="mt-1 text-2xl font-bold">{selectedCustomerId === ALL_CUSTOMERS ? accounts.length : 1}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Projektit</p><p className="mt-1 text-2xl font-bold">{visibleProjects.length}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Aktiiviset</p><p className="mt-1 text-2xl font-bold">{activeProjects}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Avoimet pyynnöt</p><p className="mt-1 text-2xl font-bold">{waitingDecisions}</p></div>
        </div>
      </section>

      {isPreviewing && <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900"><ShieldCheck size={19} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Vain lukemiseen tarkoitettu tilaajaesikatselu</p><p className="mt-1 leading-6">Tallennukset, päätökset ja viestien lähetys ovat poissa käytöstä. Tiedot tulevat adminille rajatuista preview-rajapinnoista.</p></div></div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{success}</div>}

      {accounts.length > 1 && selectedCustomerId === ALL_CUSTOMERS && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => <button key={account.customerId} type="button" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md" onClick={() => setSelectedCustomerId(account.customerId)}><span className="min-w-0"><span className="flex items-center gap-2 font-semibold text-slate-950"><Building2 size={17} className="text-teal-700" /> {account.customerName}</span><span className="mt-1 block text-xs text-slate-500">{account.visibleProjectCount} näkyvää projektia</span></span><Badge variant="outline">Avaa</Badge></button>)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleProjects.map((project) => (
          <Card key={project.id} className="border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><FolderKanban size={21} /></div><Badge variant="outline">{project.status}</Badge></div>
              <h2 className="mt-4 text-xl font-semibold text-slate-950">{project.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{project.location || 'Sijaintia ei ole määritetty'}</p>
              <div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Projektin eteneminen</span><strong>{project.progress}%</strong></div><Progress value={project.progress} className="h-2" /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Aloitus</p><p className="mt-1 font-medium">{dateLabel(project.startDate)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tavoite</p><p className="mt-1 font-medium">{dateLabel(project.endDate)}</p></div></div>
              {project.supervisorName && <p className="mt-4 text-sm text-slate-600"><strong>Työnjohto:</strong> {project.supervisorName}{project.supervisorEmail ? ` · ${project.supervisorEmail}` : ''}</p>}
              <Button className="mt-5 w-full gap-2" onClick={() => navigate(`/tilaajan-projektit/${project.id}`)}><ClipboardList size={16} /> Avaa projekti</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && visibleProjects.length === 0 && <Card className="border-amber-200 bg-amber-50"><CardContent className="p-6"><div className="flex items-start gap-3"><FolderKanban size={22} className="mt-0.5 text-amber-700" /><div><p className="font-semibold text-amber-950">Tunnuksellesi ei ole tässä rajauksessa projekteja</p><p className="mt-1 text-sm leading-6 text-amber-900">Työnjohto voi liittää tilaajakäyttäjän asiakkuuteen tai valittuihin projekteihin organisaation hallinnassa.</p></div></div></CardContent></Card>}

      {visibleRequests.length > 0 && <section className="space-y-3"><div className="flex items-center gap-2"><ClipboardList size={19} className="text-teal-700" /><h2 className="text-xl font-semibold text-slate-950">Projektipyynnöt</h2></div>{visibleRequests.map((request) => <Card key={request.id}><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-slate-950">{request.projectName}</h3><p className="mt-1 text-sm text-slate-500">{request.customerName} · {request.location || 'Ei sijaintia'} · {dateLabel(request.createdAt)}</p><p className="mt-3 text-sm leading-6 text-slate-700">{request.description}</p>{request.managementNote && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohdon viesti:</strong> {request.managementNote}</div>}</div><Badge variant="outline" className={requestStatusClass(request.status)}>{request.status}</Badge></div></CardContent></Card>)}</section>}

      {!isPreviewing && <div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate('/projektikeskustelut')}><MessageCircle size={20} className="text-teal-700" /><span className="text-left"><span className="block font-semibold">Projektikeskustelut</span><span className="block text-xs font-normal text-slate-500">Keskustele projektin jäsenien kanssa</span></span></Button><Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate('/tyoturvallisuus')}><ShieldCheck size={20} className="text-teal-700" /><span className="text-left"><span className="block font-semibold">Turvallisuushavainto</span><span className="block text-xs font-normal text-slate-500">Ilmoita projektiin liittyvästä vaarasta</span></span></Button></div>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi projektipyyntö</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Tilaaja-asiakkuus *</Label><Select value={form.customerId} onValueChange={(customerId) => setForm((old) => ({ ...old, customerId }))}><SelectTrigger><SelectValue placeholder="Valitse asiakas" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.customerId} value={account.customerId}>{account.customerName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-request-name">Projektin nimi *</Label><Input id="project-request-name" value={form.projectName} onChange={(event) => setForm((old) => ({ ...old, projectName: event.target.value }))} placeholder="Esim. Taloyhtiön linjasaneeraus" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-request-location">Kohteen osoite / sijainti</Label><Input id="project-request-location" value={form.location} onChange={(event) => setForm((old) => ({ ...old, location: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-request-description">Työn kuvaus *</Label><Textarea id="project-request-description" rows={6} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} placeholder="Kuvaa tavoite, laajuus, lähtötilanne ja tärkeät vaatimukset." /></div>
            <div className="space-y-2"><Label htmlFor="project-request-start">Toivottu aloitus</Label><Input id="project-request-start" type="date" value={form.desiredStartDate} onChange={(event) => setForm((old) => ({ ...old, desiredStartDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-request-end">Toivottu valmistuminen</Label><Input id="project-request-end" type="date" value={form.desiredEndDate} onChange={(event) => setForm((old) => ({ ...old, desiredEndDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-request-contact">Yhteyshenkilö</Label><Input id="project-request-contact" value={form.contactName} onChange={(event) => setForm((old) => ({ ...old, contactName: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-request-phone">Puhelin</Label><Input id="project-request-phone" value={form.contactPhone} onChange={(event) => setForm((old) => ({ ...old, contactPhone: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void submitRequest()} disabled={saving}>{saving ? 'Lähetetään…' : 'Lähetä pyyntö'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
