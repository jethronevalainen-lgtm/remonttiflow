import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarDays, CheckCircle2, MapPin, Send, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { convertCustomerWorkRequest, loadCustomerWorkRequests, type CustomerWorkRequest } from '@/lib/supabase/customerWorkRequests';
import type { WorkAssignmentScope, WorkOrderPriority } from '@/types';

function formatDate(value: string) { return value ? new Date(value).toLocaleDateString('fi-FI') : 'Ei toivottua ajankohtaa'; }

export default function Tilaukset() {
  const { currentOrg } = useOrganization();
  const { projects, refresh: refreshDomain } = useAppDataContext();
  const { people, projectMemberships, canManage, refresh: refreshWorkspace } = useRoleWorkspace();
  const [requests, setRequests] = useState<CustomerWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CustomerWorkRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ dueDate: string; priority: WorkOrderPriority; scope: WorkAssignmentScope; assignees: string[]; note: string }>({ dueDate: '', priority: 'Normaali', scope: 'people', assignees: [], note: '' });

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try { setRequests(await loadCustomerWorkRequests(currentOrg.id)); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Tilausten haku epäonnistui.'); }
    finally { setLoading(false); }
  }, [currentOrg]);
  useEffect(() => { void refresh(); }, [refresh]);
  const selectedMemberIds = new Set(projectMemberships.filter((member) => member.projectId === selected?.projectId).map((member) => member.userId));
  const installers = people.filter((person) => selectedMemberIds.has(person.userId) && person.role === 'worker');
  const openRequests = requests.filter((request) => request.status !== 'Työmääräys luotu' && request.status !== 'Peruttu');
  const customerName = (request: CustomerWorkRequest) => projects.find((project) => project.id === request.projectId)?.customer || 'Tilaaja';
  const choose = (request: CustomerWorkRequest) => { setSelected(request); setForm({ dueDate: request.requestedDate, priority: request.urgency === 'Kiireellinen' ? 'Korkea' : 'Normaali', scope: 'people', assignees: [], note: '' }); };
  const submit = async () => {
    if (!selected) return;
    if (form.scope === 'people' && form.assignees.length === 0) { setError('Valitse vähintään yksi asentaja projektitiimistä.'); return; }
    if (form.scope === 'project_team' && installers.length === 0) { setError('Projektilla ei ole asentajia projektitiimissä.'); return; }
    setSaving(true);
    try {
      await convertCustomerWorkRequest({ requestId: selected.id, dueDate: form.dueDate, priority: form.priority, assignmentScope: form.scope, assigneeUserIds: form.assignees, supervisorNote: form.note });
      setSelected(null); await Promise.all([refresh(), refreshWorkspace(), refreshDomain()]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Työmääräyksen luonti epäonnistui.'); }
    finally { setSaving(false); }
  };

  if (!canManage) return null;
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1450px] space-y-6"><section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-900 p-6 text-white shadow-lg sm:p-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">Työnjohto</p><h1 className="text-3xl font-bold">Tilaukset</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Tilaajien lähettämät työpyynnöt. Tarkista tiedot ja luo niistä asentajille kohdistettu työmääräys.</p></section>{error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} /> {error}</div>}<div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Uudet ja käsittelyssä</p><p className="mt-2 text-3xl font-bold">{openRequests.length}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Muunnettu työmääräyksiksi</p><p className="mt-2 text-3xl font-bold">{requests.filter((request) => request.status === 'Työmääräys luotu').length}</p></CardContent></Card></div><div className="grid gap-4 xl:grid-cols-2">{openRequests.map((request) => <Card key={request.id} className={request.urgency === 'Kiireellinen' ? 'border-l-4 border-l-red-500' : ''}><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{request.status}</Badge><h2 className="mt-3 text-lg font-semibold">{request.title}</h2><p className="mt-1 text-sm text-slate-500">{customerName(request)} · {projects.find((project) => project.id === request.projectId)?.name ?? 'Kohde'} · {request.category}</p></div><Badge variant="outline" className={request.urgency === 'Kiireellinen' ? 'border-red-200 bg-red-50 text-red-700' : ''}>{request.urgency}</Badge></div><p className="text-sm leading-6 text-slate-700">{request.description}</p><div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2"><span className="flex items-center gap-2"><CalendarDays size={16} /> {formatDate(request.requestedDate)}</span>{request.locationDetails && <span className="flex items-center gap-2"><MapPin size={16} /> {request.locationDetails}</span>}{request.contactName && <span className="flex items-center gap-2"><UserRound size={16} /> {request.contactName}{request.contactPhone ? ` · ${request.contactPhone}` : ''}</span>}</div>{request.accessInstructions && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Pääsyohje:</strong> {request.accessInstructions}</p>}{request.safetyNotes && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>Huomio:</strong> {request.safetyNotes}</p>}<Button onClick={() => choose(request)} className="gap-2"><Send size={16} /> Luo työmääräys ja jaa</Button></CardContent></Card>)}</div>{!loading && openRequests.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center"><CheckCircle2 size={44} className="mx-auto mb-3 text-emerald-400" /><p className="font-semibold">Tilaukset on käsitelty</p><p className="mt-1 text-sm text-slate-500">Uudet tilaajien työpyynnöt ilmestyvät tähän.</p></CardContent></Card>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Luo työmääräys: {selected?.title}</DialogTitle></DialogHeader><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Määräaika</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm((old) => ({ ...old, dueDate: event.target.value }))} /></div><div className="space-y-2"><Label>Prioriteetti</Label><Select value={form.priority} onValueChange={(priority: WorkOrderPriority) => setForm((old) => ({ ...old, priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Korkea">Korkea</SelectItem><SelectItem value="Normaali">Normaali</SelectItem><SelectItem value="Matala">Matala</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Kohdistus</Label><Select value={form.scope} onValueChange={(scope: WorkAssignmentScope) => setForm((old) => ({ ...old, scope, assignees: [] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="people">Nimetyt asentajat</SelectItem><SelectItem value="project_team">Koko projektitiimi</SelectItem></SelectContent></Select></div>{form.scope === 'people' && <div className="space-y-2"><Label>Asentajat projektitiimistä *</Label><div className="grid gap-2 rounded-xl border p-3">{installers.map((person) => <label key={person.userId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50"><Checkbox checked={form.assignees.includes(person.userId)} onCheckedChange={(checked) => setForm((old) => ({ ...old, assignees: checked === true ? [...old.assignees, person.userId] : old.assignees.filter((id) => id !== person.userId) }))} /><span className="text-sm font-medium">{person.name}</span></label>)}{installers.length === 0 && <p className="text-sm text-slate-500">Projektitiimissä ei ole asentajia. Lisää heidät ensin Projektit-näkymässä.</p>}</div></div>}<div className="space-y-2"><Label>Viesti tilaajalle</Label><Textarea rows={3} value={form.note} onChange={(event) => setForm((old) => ({ ...old, note: event.target.value }))} placeholder="Esim. työ on vastaanotettu ja aikataulutettu." /></div></div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>Peruuta</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? 'Luodaan…' : 'Luo ja jaa työ'}</Button></DialogFooter></DialogContent></Dialog></motion.div>;
}
