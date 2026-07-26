import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Plus, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { loadAccessibleProjectConversations, type ProjectConversationSummary } from '@/lib/supabase/projectCollaboration';
import { supabase } from '@/lib/supabase/client';
import { createSafetyItemRecord } from '@/lib/supabase/workforceEntities';
import type { SafetyItem, SafetyItemSeverity } from '@/types';

function text(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function mapSafety(row: Record<string, unknown>): SafetyItem {
  const severity = text(row, 'severity');
  return {
    id: text(row, 'id'),
    type: 'risk',
    title: text(row, 'title'),
    date: text(row, 'date'),
    projectId: text(row, 'project_id') || undefined,
    project: text(row, 'project') || undefined,
    description: text(row, 'description') || undefined,
    location: text(row, 'location') || undefined,
    severity: ['Lievä', 'Keskitasoinen', 'Vakava'].includes(severity) ? severity as SafetyItemSeverity : undefined,
    status: text(row, 'status') || 'Avoin',
  };
}

function statusClass(status: string) {
  if (['Suljettu', 'Vahvistettu'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['Korjattavana', 'Ilmoitettu korjatuksi'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

export default function SafetyObservationPortal() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [projects, setProjects] = useState<ProjectConversationSummary[]>([]);
  const [items, setItems] = useState<SafetyItem[]>([]);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<SafetyItemSeverity>('Keskitasoinen');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [projectRows, safetyResult] = await Promise.all([
        loadAccessibleProjectConversations(currentOrg.id),
        supabase.from('safety_items').select('*').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }),
      ]);
      if (safetyResult.error) throw safetyResult.error;
      setProjects(projectRows);
      setItems((safetyResult.data ?? []).map((row) => mapSafety(row as Record<string, unknown>)));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Turvallisuustietojen lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedProject = useMemo(() => projects.find((project) => project.projectId === projectId), [projectId, projects]);

  const startCreate = () => {
    setProjectId(projects[0]?.projectId ?? '');
    setTitle('');
    setDescription('');
    setLocation('');
    setSeverity('Keskitasoinen');
    setError(null);
    setSuccess(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!currentOrg || !user || !title.trim() || description.trim().length < 5) {
      setError('Anna havainnolle otsikko ja riittävä kuvaus.');
      return;
    }
    setSaving(true);
    try {
      await createSafetyItemRecord(currentOrg.id, user.id, {
        type: 'risk',
        title: title.trim(),
        description: description.trim(),
        date: new Date().toISOString().slice(0, 10),
        projectId: projectId || undefined,
        project: selectedProject?.projectName,
        location: location.trim() || undefined,
        severity,
        status: 'Avoin',
      });
      setOpen(false);
      setSuccess('Turvallisuushavainto tallennettiin ja välitettiin työnjohdolle.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Turvallisuushavainnon tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Turvallisuus kuuluu kaikille</p><h1 className="text-3xl font-bold">Turvallisuushavainnot</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Ilmoita vaarasta, puutteesta tai läheltä piti -tilanteesta heti. Näet omat sekä käyttöoikeuksiisi kuuluvien projektien havainnot.</p></div>
          <Button onClick={startCreate} className="gap-2 bg-emerald-500 text-white hover:bg-emerald-600"><Plus size={17} /> Uusi havainto</Button>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{success}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={19} /></div><Badge variant="outline" className={statusClass(item.status)}>{item.status}</Badge></div><h2 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500"><span>{new Date(item.date).toLocaleDateString('fi-FI')}</span>{item.project && <span>· {item.project}</span>}{item.location && <span className="flex items-center gap-1"><MapPin size={13} />{item.location}</span>}</div></CardContent></Card>
        ))}
      </div>

      {!loading && items.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><ShieldCheck size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold text-slate-800">Ei näkyviä turvallisuushavaintoja</p><p className="mt-1 text-sm text-slate-500">Uusi havainto voidaan tehdä heti yllä olevasta painikkeesta.</p></CardContent></Card>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Uusi turvallisuushavainto</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Projekti</Label><Select value={projectId || '__none'} onValueChange={(value) => setProjectId(value === '__none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Valitse projekti" /></SelectTrigger><SelectContent><SelectItem value="__none">Ei tiettyä projektia</SelectItem>{projects.map((project) => <SelectItem key={project.projectId} value={project.projectId}>{project.projectName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-title">Otsikko *</Label><Input id="safety-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Esim. Suojaamaton aukko porrastasanteella" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="safety-description">Kuvaus *</Label><Textarea id="safety-description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Kuvaa mitä havaitsit, missä ja milloin." /></div>
            <div className="space-y-2"><Label htmlFor="safety-location">Tarkka sijainti</Label><Input id="safety-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Rakennus, kerros, tila" /></div>
            <div className="space-y-2"><Label>Vakavuus</Label><Select value={severity} onValueChange={(value) => setSeverity(value as SafetyItemSeverity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lievä">Lievä</SelectItem><SelectItem value="Keskitasoinen">Keskitasoinen</SelectItem><SelectItem value="Vakava">Vakava</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Lähetä havainto'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
