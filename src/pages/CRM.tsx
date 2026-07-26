import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Edit3,
  Euro,
  Handshake,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCustomerRelations } from '@/hooks/useCustomerRelations';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  completeCrmActivity,
  createCrmActivity,
  deleteCrmActivity,
  type CrmActivity,
} from '@/lib/supabase/customerRelations';
import type { CrmLead, CrmLeadStage } from '@/types';

const STAGES: CrmLeadStage[] = ['Uusi', 'Tarjous tehty', 'Neuvottelu', 'Sopimus'];
const ACTIVITY_TYPES = ['Puhelu', 'Sähköposti', 'Tapaaminen', 'Tehtävä', 'Muistutus'];

interface LeadForm {
  name: string;
  company: string;
  customerId: string;
  value: string;
  stage: CrmLeadStage;
  assignee: string;
  assigneeUserId: string;
  probability: string;
  source: string;
  date: string;
}

const emptyLead: LeadForm = {
  name: '', company: '', customerId: '', value: '', stage: 'Uusi', assignee: '',
  assigneeUserId: '', probability: '20', source: '', date: new Date().toISOString().slice(0, 10),
};

function currency(value: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function dateTime(value?: string) {
  if (!value) return 'Ei määräaikaa';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function stageClass(stage: CrmLeadStage) {
  if (stage === 'Sopimus') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (stage === 'Neuvottelu') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (stage === 'Tarjous tehty') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function CRM() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { crmLeads, customers, addCrmLead, updateCrmLead, deleteCrmLead, operationError: domainError } = useAppDataContext();
  const relations = useCustomerRelations();
  const { people } = useRoleWorkspace();
  const [leadDialog, setLeadDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<CrmLead | null>(null);
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLead);
  const [activityDialog, setActivityDialog] = useState(false);
  const [activityLeadId, setActivityLeadId] = useState('');
  const [activityCustomerId, setActivityCustomerId] = useState('');
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [activitySubject, setActivitySubject] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDueAt, setActivityDueAt] = useState('');
  const [activityAssignedUserId, setActivityAssignedUserId] = useState('');
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const leadsByStage = useMemo(() => Object.fromEntries(
    STAGES.map((stage) => [stage, crmLeads.filter((lead) => lead.stage === stage)]),
  ) as Record<CrmLeadStage, CrmLead[]>, [crmLeads]);
  const totalValue = crmLeads.reduce((sum, lead) => sum + lead.value, 0);
  const weightedValue = crmLeads.reduce((sum, lead) => sum + lead.value * ((lead.probability ?? (lead.stage === 'Sopimus' ? 100 : lead.stage === 'Neuvottelu' ? 70 : lead.stage === 'Tarjous tehty' ? 40 : 20)) / 100), 0);
  const today = new Date().toISOString();
  const openActivities = relations.activities.filter((item) => !item.completedAt);
  const overdueActivities = openActivities.filter((item) => item.dueAt && item.dueAt < today);
  const visibleError = operationError ?? domainError ?? relations.error;

  const openLeadCreate = (stage: CrmLeadStage = 'Uusi') => {
    setEditingLead(null); setLeadForm({ ...emptyLead, stage, date: new Date().toISOString().slice(0, 10) }); setErrors([]); setOperationError(null); setLeadDialog(true);
  };

  const openLeadEdit = (lead: CrmLead) => {
    setEditingLead(lead);
    setLeadForm({ name: lead.name, company: lead.company, customerId: lead.customerId ?? '', value: String(lead.value), stage: lead.stage, assignee: lead.assignee, assigneeUserId: lead.assigneeUserId ?? '', probability: String(lead.probability ?? 20), source: lead.source ?? '', date: lead.date });
    setErrors([]); setOperationError(null); setLeadDialog(true);
  };

  const selectCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    setLeadForm((previous) => ({ ...previous, customerId, company: customer?.name ?? previous.company }));
  };

  const selectAssignee = (userId: string) => {
    const person = people.find((item) => item.userId === userId);
    setLeadForm((previous) => ({ ...previous, assigneeUserId: userId, assignee: person?.name ?? previous.assignee }));
  };

  const saveLead = () => {
    const value = Number(leadForm.value.replace(/\s/g, '').replace(',', '.'));
    const probability = Number(leadForm.probability);
    const nextErrors: string[] = [];
    if (!leadForm.name.trim()) nextErrors.push('Mahdollisuuden nimi on pakollinen.');
    if (!Number.isFinite(value) || value < 0) nextErrors.push('Arvon pitää olla nolla tai positiivinen.');
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) nextErrors.push('Todennäköisyyden pitää olla 0–100 %.');
    setErrors(nextErrors);
    if (nextErrors.length) return;
    const payload = { name: leadForm.name.trim(), company: leadForm.company.trim(), customerId: leadForm.customerId || undefined, value, stage: leadForm.stage, assignee: leadForm.assignee.trim(), assigneeUserId: leadForm.assigneeUserId || undefined, probability, source: leadForm.source.trim() || undefined, date: leadForm.date };
    if (editingLead) updateCrmLead(editingLead.id, payload);
    else addCrmLead(payload);
    setLeadDialog(false);
  };

  const advanceLead = (lead: CrmLead) => {
    const index = STAGES.indexOf(lead.stage);
    if (index < STAGES.length - 1) updateCrmLead(lead.id, { stage: STAGES[index + 1] });
  };

  const openActivity = (lead?: CrmLead) => {
    setActivityLeadId(lead?.id ?? ''); setActivityCustomerId(lead?.customerId ?? ''); setActivityType(ACTIVITY_TYPES[0]); setActivitySubject(''); setActivityDescription(''); setActivityDueAt(''); setActivityAssignedUserId(lead?.assigneeUserId ?? ''); setOperationError(null); setActivityDialog(true);
  };

  const saveActivity = async () => {
    if (!currentOrg || !activitySubject.trim()) { setOperationError('Aktiviteetin otsikko on pakollinen.'); return; }
    setSaving(true); setOperationError(null);
    try {
      await createCrmActivity({ organizationId: currentOrg.id, leadId: activityLeadId || undefined, customerId: activityCustomerId || undefined, userId: user?.id, assignedUserId: activityAssignedUserId || undefined, activityType, subject: activitySubject, description: activityDescription, dueAt: activityDueAt ? new Date(activityDueAt).toISOString() : undefined });
      await relations.refresh(); setActivityDialog(false);
    } catch (caught) { setOperationError(caught instanceof Error ? caught.message : 'Aktiviteetin tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const completeActivity = async (activity: CrmActivity) => {
    if (!currentOrg) return;
    setSaving(true); try { await completeCrmActivity(currentOrg.id, activity.id); await relations.refresh(); }
    catch (caught) { setOperationError(caught instanceof Error ? caught.message : 'Aktiviteetin kuittaus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const removeActivity = async () => {
    if (!currentOrg || !deleteActivityTarget) return;
    setSaving(true); try { await deleteCrmActivity(currentOrg.id, deleteActivityTarget.id); await relations.refresh(); setDeleteActivityTarget(null); }
    catch (caught) { setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-hero text-text-primary">CRM ja myyntiaktiviteetit</h1><p className="mt-1 text-body-sm text-text-secondary">Myyntiputki, vastuuhenkilöt, muistutukset ja yhteydenottohistoria</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => openLeadCreate()}><Plus size={16} className="mr-2" /> Uusi mahdollisuus</Button><Button variant="outline" onClick={() => openActivity()}><Calendar size={16} className="mr-2" /> Uusi aktiviteetti</Button></div></div>
      {visibleError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{visibleError}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Mahdollisuuksia', value: crmLeads.length, icon: Briefcase },
        { label: 'Putken arvo', value: currency(totalValue), icon: Euro },
        { label: 'Painotettu arvo', value: currency(weightedValue), icon: TrendingUp },
        { label: 'Myöhässä olevat tehtävät', value: overdueActivities.length, icon: Calendar },
      ].map((item) => <Card key={item.label}><CardContent className="p-5"><div className="flex justify-between text-sm text-text-secondary"><span>{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="mt-2 break-words font-mono text-2xl font-bold">{item.value}</p></CardContent></Card>)}</div>

      <Tabs defaultValue="pipeline" className="space-y-4"><TabsList><TabsTrigger value="pipeline">Myyntiputki</TabsTrigger><TabsTrigger value="activities">Aktiviteetit ({openActivities.length})</TabsTrigger></TabsList>
        <TabsContent value="pipeline"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{STAGES.map((stage) => <div key={stage} className="space-y-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Badge variant="outline" className={stageClass(stage)}>{stage}</Badge><span className="font-mono text-xs text-text-muted">{leadsByStage[stage].length}</span></div><Button variant="ghost" size="sm" onClick={() => openLeadCreate(stage)}><Plus size={14} /></Button></div><div className="space-y-3">{leadsByStage[stage].map((lead) => { const activities = relations.activities.filter((item) => item.leadId === lead.id && !item.completedAt); const probability = lead.probability ?? (stage === 'Sopimus' ? 100 : stage === 'Neuvottelu' ? 70 : stage === 'Tarjous tehty' ? 40 : 20); return <Card key={lead.id}><CardContent className="space-y-3 p-4"><div><p className="font-semibold">{lead.name}</p><p className="text-sm text-text-secondary">{lead.company || 'Ei asiakasta'}</p></div><div className="flex items-center justify-between"><span className="font-mono font-bold">{currency(lead.value)}</span><Badge variant="secondary">{probability}%</Badge></div><p className="text-xs text-text-secondary">{lead.assignee || 'Ei vastuuhenkilöä'} · {activities.length} avointa aktiviteettia</p><div className="flex justify-end gap-1 border-t pt-2"><Button variant="ghost" size="sm" onClick={() => openActivity(lead)}><Calendar size={14} /></Button>{stage !== 'Sopimus' && <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => advanceLead(lead)}><Handshake size={14} /></Button>}<Button variant="ghost" size="sm" onClick={() => openLeadEdit(lead)}><Edit3 size={14} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteLeadTarget(lead)}><Trash2 size={14} /></Button></div></CardContent></Card>; })}{!leadsByStage[stage].length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-text-muted">Ei mahdollisuuksia</div>}</div></div>)}</div></TabsContent>
        <TabsContent value="activities"><Card><CardContent className="p-0">{relations.activities.map((activity) => { const lead = crmLeads.find((item) => item.id === activity.leadId); const customer = customers.find((item) => item.id === activity.customerId); const overdue = !activity.completedAt && activity.dueAt && activity.dueAt < today; return <div key={activity.id} className={`grid gap-3 border-b px-5 py-4 lg:grid-cols-[150px_1.3fr_1fr_170px_120px] lg:items-center ${overdue ? 'bg-red-50/40' : ''}`}><div><Badge variant="outline">{activity.activityType}</Badge>{overdue && <Badge className="ml-1 border-0 bg-red-600 text-white">Myöhässä</Badge>}</div><div><p className="font-semibold">{activity.subject}</p><p className="text-xs text-text-secondary">{activity.description || 'Ei kuvausta'}</p></div><span className="text-sm">{lead?.name || customer?.name || 'Yleinen aktiviteetti'}</span><span className="text-sm">{dateTime(activity.dueAt)}</span><div className="flex justify-end gap-1">{activity.completedAt ? <Badge className="border-0 bg-emerald-50 text-emerald-700">Valmis</Badge> : <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => void completeActivity(activity)}><CheckCircle2 size={15} /></Button>}<Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteActivityTarget(activity)}><Trash2 size={15} /></Button></div></div>; })}{!relations.activities.length && <div className="p-12 text-center"><Calendar size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei aktiviteetteja</p></div>}</CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={leadDialog} onOpenChange={setLeadDialog}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingLead ? 'Muokkaa mahdollisuutta' : 'Uusi mahdollisuus'}</DialogTitle></DialogHeader>{errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={leadForm.name} onChange={(event) => setLeadForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-2"><Label>Asiakas</Label><Select value={leadForm.customerId || 'none'} onValueChange={(value) => value === 'none' ? setLeadForm((previous) => ({ ...previous, customerId: '' })) : selectCustomer(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei asiakaslinkkiä</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Yritys / asiakasnimi</Label><Input value={leadForm.company} onChange={(event) => setLeadForm((previous) => ({ ...previous, company: event.target.value }))} /></div><div className="space-y-2"><Label>Arvo €</Label><Input inputMode="decimal" value={leadForm.value} onChange={(event) => setLeadForm((previous) => ({ ...previous, value: event.target.value }))} /></div><div className="space-y-2"><Label>Vaihe</Label><Select value={leadForm.stage} onValueChange={(stage: CrmLeadStage) => setLeadForm((previous) => ({ ...previous, stage }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={leadForm.assigneeUserId || 'none'} onValueChange={(value) => value === 'none' ? setLeadForm((previous) => ({ ...previous, assigneeUserId: '', assignee: '' })) : selectAssignee(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Todennäköisyys %</Label><Input type="number" min="0" max="100" value={leadForm.probability} onChange={(event) => setLeadForm((previous) => ({ ...previous, probability: event.target.value }))} /></div><div className="space-y-2"><Label>Lähde</Label><Input value={leadForm.source} onChange={(event) => setLeadForm((previous) => ({ ...previous, source: event.target.value }))} /></div><div className="space-y-2"><Label>Päivämäärä</Label><Input type="date" value={leadForm.date} onChange={(event) => setLeadForm((previous) => ({ ...previous, date: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setLeadDialog(false)}>Peruuta</Button><Button onClick={saveLead}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={activityDialog} onOpenChange={setActivityDialog}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Uusi CRM-aktiviteetti</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tyyppi</Label><Select value={activityType} onValueChange={setActivityType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIVITY_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Määräaika</Label><Input type="datetime-local" value={activityDueAt} onChange={(event) => setActivityDueAt(event.target.value)} /></div><div className="space-y-2"><Label>Mahdollisuus</Label><Select value={activityLeadId || 'none'} onValueChange={(value) => setActivityLeadId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei mahdollisuutta</SelectItem>{crmLeads.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Asiakas</Label><Select value={activityCustomerId || 'none'} onValueChange={(value) => setActivityCustomerId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei asiakasta</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Otsikko *</Label><Input value={activitySubject} onChange={(event) => setActivitySubject(event.target.value)} /></div><div className="space-y-2"><Label>Vastuuhenkilö</Label><Select value={activityAssignedUserId || 'none'} onValueChange={(value) => setActivityAssignedUserId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei vastuuhenkilöä</SelectItem>{people.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.name}</SelectItem>)}</SelectContent></Select></div><div /><div className="space-y-2 sm:col-span-2"><Label>Kuvaus</Label><Textarea value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setActivityDialog(false)}>Peruuta</Button><Button onClick={() => void saveActivity()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteLeadTarget || deleteActivityTarget)} onOpenChange={(open) => { if (!open) { setDeleteLeadTarget(null); setDeleteActivityTarget(null); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko tieto?</AlertDialogTitle><AlertDialogDescription>Poistoa ei voi perua.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteLeadTarget ? (deleteCrmLead(deleteLeadTarget.id), setDeleteLeadTarget(null)) : void removeActivity()}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
