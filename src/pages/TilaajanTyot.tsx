import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, FolderKanban, MapPin, MessageCircle, Plus, ShieldCheck } from 'lucide-react';

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
  createProjectRequest,
  loadCustomerAccounts,
  loadCustomerProjectSummaries,
  loadProjectRequests,
  type CustomerAccount,
  type CustomerProjectSummary,
  type ProjectRequest,
} from '@/lib/supabase/projectCollaboration';

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

export default function TilaajanTyot() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName } = useViewAs();
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [projects, setProjects] = useState<CustomerProjectSummary[]>([]);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
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
        loadCustomerAccounts(currentOrg.id),
        loadCustomerProjectSummaries(currentOrg.id),
        loadProjectRequests(currentOrg.id),
      ]);
      setAccounts(nextAccounts);
      setProjects(nextProjects);
      setRequests(nextRequests);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilaajan työtilan lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status !== 'Valmis').length, [projects]);

  const openRequest = () => {
    setForm({ ...EMPTY_FORM, customerId: accounts[0]?.customerId ?? '', contactName: effectiveDisplayName });
    setError(null);
    setSuccess(null);
    setOpen(true);
  };

  const submitRequest = async () => {
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
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Tilaajan työtila</p><h1 className="text-3xl font-bold">Projektini</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Näet vain omaan tilaaja-asiakkuuteesi liitetyt projektit, niiden etenemisen, työpyynnöt ja projektikeskustelut.</p></div>
          <Button onClick={openRequest} disabled={accounts.length === 0} className="gap-2 bg-teal-500 text-white hover:bg-teal-600"><Plus size={17} /> Uusi projektipyyntö</Button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Projektit</p><p className="mt-1 text-2xl font-bold">{projects.length}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Aktiiviset</p><p className="mt-1 text-2xl font-bold">{activeProjects}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">Pyynnöt</p><p className="mt-1 text-2xl font-bold">{requests.length}</p></div>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{success}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><FolderKanban size={21} /></div><Badge variant="outline">{project.status}</Badge></div>
              <h2 className="mt-4 text-xl font-semibold text-slate-950">{project.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{project.location || 'Sijaintia ei ole määritetty'}</p>
              <div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Projektin eteneminen</span><strong>{project.progress}%</strong></div><Progress value={project.progress} className="h-2" /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Aloitus</p><p className="mt-1 font-medium">{dateLabel(project.startDate)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tavoite</p><p className="mt-1 font-medium">{dateLabel(project.endDate)}</p></div></div>
              {project.supervisorName && <p className="mt-4 text-sm text-slate-600"><strong>Työnjohto:</strong> {project.supervisorName}{project.supervisorEmail ? ` · ${project.supervisorEmail}` : ''}</p>}
              <div className="mt-5 flex flex-wrap gap-2"><Button className="flex-1 gap-2" onClick={() => navigate(`/tilaajan-projektit/${project.id}`)}><ClipboardList size={16} /> Avaa projekti</Button><Button variant="outline" className="gap-2" onClick={() => navigate(`/projektikeskustelut/${project.id}`)}><MessageCircle size={16} /> Keskustelu</Button></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && projects.length === 0 && <Card className="border-amber-200 bg-amber-50"><CardContent className="p-6"><div className="flex items-start gap-3"><FolderKanban size={22} className="mt-0.5 text-amber-700" /><div><p className="font-semibold text-amber-950">Tunnuksellesi ei ole vielä liitetty projektia</p><p className="mt-1 text-sm leading-6 text-amber-900">Voit lähettää uuden projektipyynnön tai pyytää työnjohtoa liittämään olemassa olevan projektin tilaaja-asiakkuuteesi.</p></div></div></CardContent></Card>}

      {requests.length > 0 && <section className="space-y-3"><div className="flex items-center gap-2"><ClipboardList size={19} className="text-teal-700" /><h2 className="text-xl font-semibold text-slate-950">Projektipyynnöt</h2></div>{requests.map((request) => <Card key={request.id}><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-slate-950">{request.projectName}</h3><p className="mt-1 text-sm text-slate-500">{request.location || 'Ei sijaintia'} · {dateLabel(request.createdAt)}</p><p className="mt-3 text-sm leading-6 text-slate-700">{request.description}</p>{request.managementNote && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohdon viesti:</strong> {request.managementNote}</div>}</div><Badge variant="outline" className={requestStatusClass(request.status)}>{request.status}</Badge></div></CardContent></Card>)}</section>}

      <div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate('/projektikeskustelut')}><MessageCircle size={20} className="text-teal-700" /><span className="text-left"><span className="block font-semibold">Projektikeskustelut</span><span className="block text-xs font-normal text-slate-500">Keskustele projektin jäsenien kanssa</span></span></Button><Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" onClick={() => navigate('/tyoturvallisuus')}><ShieldCheck size={20} className="text-teal-700" /><span className="text-left"><span className="block font-semibold">Turvallisuushavainto</span><span className="block text-xs font-normal text-slate-500">Ilmoita projektiin liittyvästä vaarasta</span></span></Button></div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi projektipyyntö</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Tilaaja-asiakkuus *</Label><Select value={form.customerId} onValueChange={(customerId) => setForm((old) => ({ ...old, customerId }))}><SelectTrigger><SelectValue placeholder="Valitse tilaaja" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.customerId} value={account.customerId}>{account.customerName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-request-name">Projektin nimi *</Label><Input id="project-request-name" value={form.projectName} onChange={(event) => setForm((old) => ({ ...old, projectName: event.target.value }))} placeholder="Esim. Taloyhtiön linjasaneeraus" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-request-location">Kohteen osoite / sijainti</Label><Input id="project-request-location" value={form.location} onChange={(event) => setForm((old) => ({ ...old, location: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="project-request-description">Työn kuvaus *</Label><Textarea id="project-request-description" rows={6} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} placeholder="Kuvaa tavoite, laajuus, lähtötilanne ja tärkeät vaatimukset." /></div>
            <div className="space-y-2"><Label htmlFor="project-request-start">Toivottu aloitus</Label><Input id="project-request-start" type="date" value={form.desiredStartDate} onChange={(event) => setForm((old) => ({ ...old, desiredStartDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-request-end">Tavoitevalmistuminen</Label><Input id="project-request-end" type="date" value={form.desiredEndDate} onChange={(event) => setForm((old) => ({ ...old, desiredEndDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-request-contact">Yhteyshenkilö</Label><Input id="project-request-contact" value={form.contactName} onChange={(event) => setForm((old) => ({ ...old, contactName: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="project-request-phone">Puhelin</Label><Input id="project-request-phone" value={form.contactPhone} onChange={(event) => setForm((old) => ({ ...old, contactPhone: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void submitRequest()} disabled={saving}>{saving ? 'Lähetetään…' : 'Lähetä työnjohdolle'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
