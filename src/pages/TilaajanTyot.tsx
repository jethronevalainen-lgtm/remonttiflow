import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarDays, ClipboardList, MapPin, Plus, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  createCustomerWorkRequest, loadCustomerPortalProjects, loadCustomerWorkRequests,
  type CustomerPortalProject, type CustomerRequestUrgency, type CustomerWorkRequest,
} from '@/lib/supabase/customerWorkRequests';

const CATEGORIES = ['Korjaus', 'Huolto', 'Muutos- tai lisätyö', 'Tarkastus', 'Reklamaatio', 'Muu'];
const EMPTY_FORM = {
  projectId: '', title: '', category: '', description: '', locationDetails: '', contactName: '', contactPhone: '',
  requestedDate: '', preferredTime: '', urgency: 'Normaali' as CustomerRequestUrgency, accessInstructions: '', safetyNotes: '',
};

function formatDate(value: string) {
  if (!value) return 'Ei toivottua ajankohtaa';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fi-FI');
}

function statusStyle(status: CustomerWorkRequest['status']) {
  return {
    Uusi: 'border-blue-200 bg-blue-50 text-blue-700',
    Käsittelyssä: 'border-amber-200 bg-amber-50 text-amber-700',
    'Työmääräys luotu': 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Peruttu: 'border-slate-200 bg-slate-50 text-slate-600',
  }[status];
}

export default function TilaajanTyot() {
  const { currentOrg } = useOrganization();
  const { effectiveDisplayName } = useViewAs();
  const [projects, setProjects] = useState<CustomerPortalProject[]>([]);
  const [requests, setRequests] = useState<CustomerWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [nextProjects, nextRequests] = await Promise.all([
        loadCustomerPortalProjects(currentOrg.id), loadCustomerWorkRequests(currentOrg.id),
      ]);
      setProjects(nextProjects);
      setRequests(nextRequests);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tietojen lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === form.projectId), [form.projectId, projects]);
  const openCreate = () => {
    setForm({ ...EMPTY_FORM, contactName: effectiveDisplayName });
    setError(null);
    setOpen(true);
  };
  const submit = async () => {
    if (!currentOrg || !selectedProject) return;
    if (form.title.trim().length < 3 || !form.category || form.description.trim().length < 10) {
      setError('Täytä kohde, otsikko, työn laji ja riittävän tarkka kuvaus.');
      return;
    }
    setSaving(true);
    try {
      await createCustomerWorkRequest({
        organizationId: currentOrg.id, customerId: selectedProject.customerId, projectId: form.projectId,
        title: form.title.trim(), category: form.category, description: form.description.trim(),
        locationDetails: form.locationDetails, contactName: form.contactName, contactPhone: form.contactPhone,
        requestedDate: form.requestedDate, preferredTime: form.preferredTime, urgency: form.urgency,
        accessInstructions: form.accessInstructions, safetyNotes: form.safetyNotes,
      });
      setOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilauksen lähetys epäonnistui.');
    } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Tilaajan työtila</p><h1 className="text-3xl font-bold">Tilaukseni</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Lähetä työtilaus työnjohdolle. Saat työn etenemisestä tiedon tässä näkymässä.</p></div>
          <Button onClick={openCreate} disabled={projects.length === 0} className="gap-2 bg-teal-500 text-white hover:bg-teal-600"><Plus size={17} /> Uusi tilaus</Button>
        </div>
      </section>
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} /> {error}</div>}
      {!loading && projects.length === 0 && <Card className="border-amber-200 bg-amber-50"><CardContent className="p-5 text-sm text-amber-900">Tunnuksellesi ei ole vielä liitetty kohdetta. Ota yhteys työnjohtoon.</CardContent></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {requests.map((request) => {
          const project = projects.find((item) => item.id === request.projectId);
          return <Card key={request.id} className="border-slate-200 shadow-sm"><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className={statusStyle(request.status)}>{request.status}</Badge><h2 className="mt-3 text-lg font-semibold text-slate-950">{request.title}</h2><p className="mt-1 text-sm text-slate-500">{project?.name ?? 'Kohde' } · {request.category}</p></div><Badge variant="outline" className={request.urgency === 'Kiireellinen' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200'}>{request.urgency}</Badge></div><p className="text-sm leading-6 text-slate-600">{request.description}</p><div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2"><span className="flex items-center gap-2 text-slate-600"><CalendarDays size={16} /> {formatDate(request.requestedDate)}</span>{request.locationDetails && <span className="flex items-center gap-2 text-slate-600"><MapPin size={16} /> {request.locationDetails}</span>}</div>{request.supervisorNote && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Työnjohdon viesti:</strong> {request.supervisorNote}</div>}</CardContent></Card>;
        })}
      </div>
      {!loading && requests.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><ClipboardList size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold text-slate-800">Ei vielä tilauksia</p><p className="mt-1 text-sm text-slate-500">Luo ensimmäinen tilaus, niin työnjohto voi ottaa sen käsittelyyn.</p></CardContent></Card>}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Uusi työtilaus</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Kohde *</Label><Select value={form.projectId} onValueChange={(projectId) => setForm((old) => ({ ...old, projectId }))}><SelectTrigger><SelectValue placeholder="Valitse kohde" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}{project.location ? ` · ${project.location}` : ''}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="request-title">Työn otsikko *</Label><Input id="request-title" value={form.title} maxLength={180} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder="Esim. Vuoto kylpyhuoneessa" /></div><div className="space-y-2"><Label>Työn laji *</Label><Select value={form.category} onValueChange={(category) => setForm((old) => ({ ...old, category }))}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Kiireellisyys</Label><Select value={form.urgency} onValueChange={(urgency: CustomerRequestUrgency) => setForm((old) => ({ ...old, urgency }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Kiireellinen">Kiireellinen</SelectItem><SelectItem value="Normaali">Normaali</SelectItem><SelectItem value="Ei kiireellinen">Ei kiireellinen</SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="request-description">Kuvaile työ mahdollisimman tarkasti *</Label><Textarea id="request-description" rows={5} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} placeholder="Mitä on tapahtunut, milloin se havaittiin ja mitä toivot tehtävän?" /></div><div className="space-y-2"><Label htmlFor="request-location">Tarkka sijainti</Label><Input id="request-location" value={form.locationDetails} onChange={(event) => setForm((old) => ({ ...old, locationDetails: event.target.value }))} placeholder="Rakennus, kerros, tila" /></div><div className="space-y-2"><Label htmlFor="request-date">Toivottu päivä</Label><Input id="request-date" type="date" value={form.requestedDate} onChange={(event) => setForm((old) => ({ ...old, requestedDate: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="request-contact">Yhteyshenkilö</Label><Input id="request-contact" value={form.contactName} onChange={(event) => setForm((old) => ({ ...old, contactName: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="request-phone">Puhelin</Label><Input id="request-phone" value={form.contactPhone} onChange={(event) => setForm((old) => ({ ...old, contactPhone: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="request-access">Pääsy- ja avainohjeet</Label><Textarea id="request-access" rows={2} value={form.accessInstructions} onChange={(event) => setForm((old) => ({ ...old, accessInstructions: event.target.value }))} placeholder="Kulku, avain, ovikoodi tai yhteydenotto ennen saapumista" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="request-safety">Turvallisuus- tai muut huomioitavat asiat</Label><Textarea id="request-safety" rows={2} value={form.safetyNotes} onChange={(event) => setForm((old) => ({ ...old, safetyNotes: event.target.value }))} placeholder="Esim. mahdolliset vaarat, lemmikit tai työskentelyrajoitukset" /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void submit()} disabled={saving} className="gap-2"><Send size={16} /> {saving ? 'Lähetetään…' : 'Lähetä tilaus'}</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
