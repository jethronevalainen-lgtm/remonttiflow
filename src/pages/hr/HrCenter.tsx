import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, BadgeEuro, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2,
  ClipboardCheck, Download, FileText, GraduationCap, History, CreditCard, Loader2, MapPin,
  MessageSquare, Plus, Save, Search, ShieldCheck, Target, Trash2, UsersRound, Wrench,
} from 'lucide-react';

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
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import { useResourceManagement } from '@/hooks/useResourceManagement';
import { localDateIso } from '@/lib/localDateTime';
import {
  createEmployeeConversation, createEmployeeDocumentUrl, createEmployeeGoal, createEmployeeHrTask,
  createEmployeeSkill, createEmployeeTraining, deleteEmployeeDocument, deleteHrRecord, loadHrWorkspace,
  saveEmploymentProfile, updateHrTaskStatus, uploadEmployeeDocument,
  type EmployeeDocument, type EmploymentProfileInput, type HrWorkspaceData,
} from '@/lib/supabase/hrManagement';
import { listEmployeeSupervisorAssignments, type EmployeeSupervisorAssignment } from '@/lib/supabase/employeeSupervisors';
import { listAccessibleEmployeeCards, type EmployeeCard } from '@/lib/supabase/workforceHr';

const EMPTY_DATA: HrWorkspaceData = {
  employmentProfiles: [], skills: [], trainings: [], goals: [], conversations: [], tasks: [], documents: [], events: [],
};
const EMPTY_EMPLOYMENT: EmploymentProfileInput = {
  employeeNumber: '', personalEmail: '', workLocation: '', costCenter: '', jobLevel: '', contractType: '',
  contractStartDate: '', contractEndDate: '', probationEndDate: '', noticePeriod: '', workingTimeModel: '',
  remoteWorkPolicy: '', managerNotes: '',
};
type DialogType = 'skill' | 'training' | 'goal' | 'conversation' | 'task' | 'document' | null;
type ManagedTable = 'employee_skills' | 'employee_training_records' | 'employee_goals' | 'employee_conversations' | 'employee_hr_tasks';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{hint && <p className="text-xs leading-5 text-text-secondary">{hint}</p>}</div>;
}
function dateLabel(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}
function dateTimeLabel(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}
function euro(cents?: number) {
  if (cents == null) return '—';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
function daysUntil(value?: string) {
  if (!value) return null;
  const target = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date(`${localDateIso()}T00:00:00`).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - today) / 86_400_000);
}
function deadlineTone(value?: string) {
  const days = daysUntil(value);
  if (days == null) return 'text-text-secondary';
  if (days < 0) return 'text-red-700';
  if (days <= 30) return 'text-amber-700';
  return 'text-text-secondary';
}
function statusTone(status: string) {
  if (['Valmis', 'Suoritettu', 'Pidetty', 'Aktiivinen'].includes(status)) return 'bg-emerald-50 text-emerald-700';
  if (['Käynnissä', 'Sovittu', 'Ilmoittautunut'].includes(status)) return 'bg-blue-50 text-blue-700';
  if (['Peruttu', 'Keskeytetty', 'Ohitettu'].includes(status)) return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}
function EventLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    employee_skills_insert: 'Osaaminen lisätty', employee_skills_update: 'Osaamista päivitetty',
    employee_training_records_insert: 'Koulutus lisätty', employee_goals_insert: 'Tavoite lisätty',
    employee_conversations_insert: 'Keskustelu kirjattu', employee_hr_tasks_insert: 'HR-tehtävä lisätty',
    employee_hr_tasks_update: 'HR-tehtävää päivitetty', employee_documents_insert: 'Dokumentti lisätty',
    employee_documents_delete: 'Dokumentti poistettu', employee_employment_profiles_insert: 'Työsuhdetiedot luotu',
    employee_employment_profiles_update: 'Työsuhdetietoja päivitetty',
  };
  return <>{labels[type] ?? type.replaceAll('_', ' ')}</>;
}
function EmptyState({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center"><Icon className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm text-text-secondary">{description}</p></div>;
}

export default function HrCenter() {
  const { user } = useAuth();
  const { currentOrg, actualRole } = useOrganization();
  const { employees, equipment } = useAppDataContext();
  const { members } = useOrganizationAdmin();
  const resources = useResourceManagement();
  const organizationId = currentOrg?.id;
  const canManage = actualRole === 'admin' || actualRole === 'supervisor';
  const isAdmin = actualRole === 'admin';

  const [data, setData] = useState<HrWorkspaceData>(EMPTY_DATA);
  const [cards, setCards] = useState<EmployeeCard[]>([]);
  const [assignments, setAssignments] = useState<EmployeeSupervisorAssignment[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [employmentForm, setEmploymentForm] = useState<EmploymentProfileInput>(EMPTY_EMPLOYMENT);
  const [skillForm, setSkillForm] = useState({ name: '', category: 'Ammattiosaaminen', current: '3', target: '4', source: 'esihenkilö', notes: '' });
  const [trainingForm, setTrainingForm] = useState({ title: '', provider: '', status: 'Suunniteltu', startDate: '', validUntil: '', notes: '' });
  const [goalForm, setGoalForm] = useState({ title: '', description: '', category: 'Työ', status: 'Sovittu', progress: '0', targetDate: '' });
  const [conversationForm, setConversationForm] = useState({ type: '1:1', scheduledAt: '', status: 'Suunniteltu', summary: '', actions: '', followUp: '' });
  const [taskForm, setTaskForm] = useState({ phase: 'Perehdytys', title: '', description: '', dueDate: '' });
  const [documentForm, setDocumentForm] = useState<{ title: string; type: string; issueDate: string; validUntil: string; visibility: EmployeeDocument['visibility']; notes: string; file: File | null }>({
    title: '', type: 'Työsopimus', issueDate: '', validUntil: '', visibility: 'HR ja esihenkilö', notes: '', file: null,
  });

  const load = useCallback(async () => {
    if (!organizationId) { setData(EMPTY_DATA); setCards([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [nextData, nextCards, nextAssignments] = await Promise.all([
        loadHrWorkspace(organizationId), listAccessibleEmployeeCards(organizationId),
        canManage ? listEmployeeSupervisorAssignments(organizationId) : Promise.resolve([]),
      ]);
      setData(nextData); setCards(nextCards); setAssignments(nextAssignments);
      const allowedIds = new Set(nextCards.map((card) => card.employeeId));
      const firstId = employees.find((employee) => allowedIds.has(employee.id) && !employee.archivedAt)?.id ?? '';
      setSelectedEmployeeId((current) => allowedIds.has(current) ? current : firstId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'HR-keskuksen tietojen haku epäonnistui.');
    } finally { setLoading(false); }
  }, [canManage, employees, organizationId]);
  useEffect(() => { void load(); }, [load]);

  const cardByEmployeeId = useMemo(() => new Map(cards.map((card) => [card.employeeId, card])), [cards]);
  const visibleEmployees = useMemo(() => {
    const allowed = new Set(cards.map((card) => card.employeeId));
    return employees.filter((employee) => allowed.has(employee.id) && !employee.archivedAt);
  }, [cards, employees]);
  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return visibleEmployees;
    return visibleEmployees.filter((employee) => [employee.name, employee.role, employee.department, employee.email].some((value) => value.toLocaleLowerCase('fi').includes(query)));
  }, [search, visibleEmployees]);
  const selectedEmployee = visibleEmployees.find((employee) => employee.id === selectedEmployeeId) ?? visibleEmployees[0];
  const selectedCard = selectedEmployee ? cardByEmployeeId.get(selectedEmployee.id) : undefined;
  const employmentProfile = selectedEmployee ? data.employmentProfiles.find((profile) => profile.employeeId === selectedEmployee.id) : undefined;
  const employeeSkills = selectedEmployee ? data.skills.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const employeeTrainings = selectedEmployee ? data.trainings.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const employeeGoals = selectedEmployee ? data.goals.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const employeeConversations = selectedEmployee ? data.conversations.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const employeeTasks = selectedEmployee ? data.tasks.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const employeeDocuments = selectedEmployee ? data.documents.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const employeeEvents = selectedEmployee ? data.events.filter((item) => item.employeeId === selectedEmployee.id).slice(0, 50) : [];
  const employeeCertifications = selectedEmployee ? resources.certifications.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const employeeAbsences = selectedEmployee ? resources.absences.filter((item) => item.employeeId === selectedEmployee.id) : [];
  const assignedEquipment = selectedEmployee?.userId ? equipment.filter((item) => item.responsibleUserId === selectedEmployee.userId && !item.archivedAt) : [];

  const supervisorName = useMemo(() => {
    if (!selectedEmployee) return '—';
    const assignment = assignments.find((item) => item.employeeId === selectedEmployee.id);
    if (!assignment) return selectedCard?.supervisorNames.join(', ') || 'Ei nimetty';
    const member = members.find((item) => item.userId === assignment.supervisorUserId);
    return member?.profile?.full_name || member?.profile?.email || selectedCard?.supervisorNames.join(', ') || 'Työnjohtaja';
  }, [assignments, members, selectedCard?.supervisorNames, selectedEmployee]);

  useEffect(() => {
    setEmploymentForm(employmentProfile ? {
      employeeNumber: employmentProfile.employeeNumber ?? '', personalEmail: employmentProfile.personalEmail ?? '',
      workLocation: employmentProfile.workLocation ?? '', costCenter: employmentProfile.costCenter ?? '',
      jobLevel: employmentProfile.jobLevel ?? '', contractType: employmentProfile.contractType ?? '',
      contractStartDate: employmentProfile.contractStartDate ?? selectedEmployee?.startDate ?? '',
      contractEndDate: employmentProfile.contractEndDate ?? '', probationEndDate: employmentProfile.probationEndDate ?? '',
      noticePeriod: employmentProfile.noticePeriod ?? '', workingTimeModel: employmentProfile.workingTimeModel ?? '',
      remoteWorkPolicy: employmentProfile.remoteWorkPolicy ?? '', managerNotes: employmentProfile.managerNotes ?? '',
    } : { ...EMPTY_EMPLOYMENT, contractStartDate: selectedEmployee?.startDate ?? '' });
  }, [employmentProfile, selectedEmployee?.id, selectedEmployee?.startDate]);

  const completeness = useMemo(() => {
    if (!selectedEmployee) return { percent: 0, missing: [] as string[] };
    const checks = [
      ['Sähköposti', selectedEmployee.email], ['Puhelin', selectedEmployee.phone],
      ['Työsuhdetyyppi', selectedEmployee.employmentType], ['Työnumero', employmentProfile?.employeeNumber],
      ['Työpiste', employmentProfile?.workLocation], ['Kustannuspaikka', employmentProfile?.costCenter],
      ['Sopimustyyppi', employmentProfile?.contractType], ['Palkkaehdot', selectedCard?.payType],
      ['Esihenkilö', supervisorName !== 'Ei nimetty' && supervisorName !== '—' ? supervisorName : ''],
      ['Sovellustunnus', selectedEmployee.userId ? 'ok' : ''],
      ['Osaaminen', employeeSkills.length ? 'ok' : ''], ['Dokumentit', employeeDocuments.length ? 'ok' : ''],
    ] as const;
    const missing = checks.filter(([, value]) => !value).map(([label]) => label);
    return { percent: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
  }, [employeeDocuments.length, employeeSkills.length, employmentProfile, selectedCard?.payType, selectedEmployee, supervisorName]);

  const expiringCount = useMemo(() => {
    const documents = data.documents.filter((item) => { const days = daysUntil(item.validUntil); return days != null && days >= 0 && days <= 30; }).length;
    const certifications = resources.certifications.filter((item) => { const days = daysUntil(item.expiresAt); return days != null && days >= 0 && days <= 30; }).length;
    return documents + certifications;
  }, [data.documents, resources.certifications]);
  const openTaskCount = data.tasks.filter((item) => item.status !== 'Valmis' && item.status !== 'Ohitettu').length;
  const overdueGoalCount = data.goals.filter((item) => { const days = daysUntil(item.targetDate); return days != null && days < 0 && item.status !== 'Valmis' && item.status !== 'Keskeytetty'; }).length;

  const run = async (action: () => Promise<void>, message: string) => {
    setSaving(true); setError(null); setSuccess(null);
    try { await action(); await load(); setSuccess(message); setDialog(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };
  const saveEmployment = async () => {
    if (!organizationId || !selectedEmployee || !user) return;
    await run(() => saveEmploymentProfile({ organizationId, employeeId: selectedEmployee.id, userId: user.id, input: employmentForm }), 'Työsuhde- ja organisaatiotiedot tallennettiin.');
  };
  const remove = async (table: ManagedTable, id: string, message: string) => {
    if (!organizationId || !canManage) return;
    await run(() => deleteHrRecord(table, organizationId, id), message);
  };
  const openDocument = async (item: EmployeeDocument) => {
    try { const url = await createEmployeeDocumentUrl(item.storagePath); window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Dokumentin avaaminen epäonnistui.'); }
  };

  if (loading) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return <div className="space-y-6">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><ShieldCheck size={16} />VaKantti HR</div><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Henkilöstön koko elinkaari yhdessä näkymässä</h2><p className="mt-3 text-sm leading-6 text-slate-300">Työsuhteet, palkat, osaaminen, koulutukset, tavoitteet, keskustelut, dokumentit, perehdytys ja poistuminen samassa työntekijäkortissa.</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
          { label: 'Henkilöstö', value: visibleEmployees.length, icon: UsersRound },
          { label: 'Avoimet HR-tehtävät', value: openTaskCount, icon: ClipboardCheck },
          { label: 'Vanhenee 30 pv', value: expiringCount, icon: CalendarDays },
          { label: 'Myöhässä tavoitteita', value: overdueGoalCount, icon: Target },
        ].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-400">{item.label}</p><item.icon size={17} className="text-orange-300" /></div><p className="mt-2 text-2xl font-bold">{item.value}</p></div>)}</div>
      </div>
    </div>
    {error && <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
    {success && <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /><span>{success}</span></div>}

    {!visibleEmployees.length ? <EmptyState icon={UsersRound} title="Ei näkyviä työntekijöitä" description="HR-oikeudet tai työnjohtajan tiimijako määrittävät näkyvän henkilöstön." /> :
      <div className="grid min-w-0 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden border-slate-200 shadow-sm xl:sticky xl:top-4"><CardContent className="p-0"><div className="border-b border-slate-200 p-4"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Hae työntekijää…" /></div></div><div className="max-h-[72vh] overflow-y-auto">{filteredEmployees.map((employee) => {
          const profile = data.employmentProfiles.find((item) => item.employeeId === employee.id);
          const payDefined = Boolean(cardByEmployeeId.get(employee.id)?.payType);
          return <button key={employee.id} type="button" onClick={() => setSelectedEmployeeId(employee.id)} className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition ${selectedEmployee?.id === employee.id ? 'bg-orange-50' : 'hover:bg-slate-50'}`}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">{initials(employee.name)}</div><div className="min-w-0 flex-1"><p className="break-words font-semibold text-slate-950">{employee.name}</p><p className="break-words text-sm text-slate-500">{employee.role} · {employee.department}</p><div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline" className="text-[10px]">{employee.status}</Badge>{payDefined && <Badge className="border-0 bg-emerald-50 text-[10px] text-emerald-700">Palkka</Badge>}{!employee.userId && <Badge className="border-0 bg-orange-50 text-[10px] text-orange-800">Ei tunnusta</Badge>}{!profile && <Badge className="border-0 bg-amber-50 text-[10px] text-amber-700">Täydennä HR</Badge>}</div></div></button>;
        })}</div></CardContent></Card>

        {selectedEmployee && <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden border-slate-200 shadow-sm"><CardContent className="bg-gradient-to-r from-white to-slate-50 p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-orange-500 text-xl font-bold text-white">{initials(selectedEmployee.name)}</div><div className="min-w-0"><h3 className="break-words text-2xl font-bold text-slate-950">{selectedEmployee.name}</h3><p className="mt-1 text-sm text-slate-500">{selectedEmployee.role} · {selectedEmployee.department}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{selectedEmployee.status}</Badge><Badge variant="outline">{selectedEmployee.employmentType || 'Työsuhdemuoto puuttuu'}</Badge><Badge variant="outline">Esihenkilö: {supervisorName}</Badge>{!selectedEmployee.userId && <Badge className="border-0 bg-orange-50 text-orange-800">Ei sovellustunnusta</Badge>}</div></div></div><div className="min-w-[230px] rounded-2xl border border-slate-200 bg-white px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-wider text-slate-400">HR-profiilin valmius</p><p className="font-bold text-slate-950">{completeness.percent} %</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${completeness.percent}%` }} /></div><p className="mt-2 break-words text-xs text-slate-500">{completeness.missing.length ? `Puuttuu: ${completeness.missing.join(', ')}` : 'Keskeiset tiedot ovat kunnossa.'}</p>{!selectedEmployee.userId && <p className="mt-2 break-words text-xs text-orange-800">Henkilö voidaan lisätä projektitiimiin ilman kutsua. Sovellustunnus tarvitaan työmääräysten kohdistukseen ja kirjautumiseen.</p>}</div></div></CardContent></Card>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
            { label: 'Työnumero', value: employmentProfile?.employeeNumber || '—', icon: CreditCard },
            { label: 'Työpiste', value: employmentProfile?.workLocation || '—', icon: MapPin },
            { label: 'Kustannuspaikka', value: employmentProfile?.costCenter || '—', icon: Building2 },
            { label: 'Palkka', value: selectedCard?.payType === 'Tuntipalkka' ? `${euro(selectedCard.hourlyWageCents)} / h` : selectedCard?.payType === 'Kuukausipalkka' ? `${euro(selectedCard.monthlySalaryCents)} / kk` : '—', icon: BadgeEuro },
          ].map((item) => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{item.label}</p><item.icon size={17} className="text-orange-600" /></div><p className="mt-2 break-words font-semibold text-slate-900">{item.value}</p></CardContent></Card>)}</div>

          <Tabs defaultValue="overview" className="space-y-4"><TabsList className="h-auto w-full flex-wrap justify-start rounded-xl bg-slate-100 p-1"><TabsTrigger value="overview">Yhteenveto</TabsTrigger><TabsTrigger value="employment">Työsuhde</TabsTrigger><TabsTrigger value="skills">Osaaminen</TabsTrigger><TabsTrigger value="development">Tavoitteet ja keskustelut</TabsTrigger><TabsTrigger value="documents">Dokumentit</TabsTrigger><TabsTrigger value="lifecycle">Elinkaari</TabsTrigger></TabsList>

            <TabsContent value="overview" className="space-y-4"><div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-slate-200"><CardContent className="p-5"><h4 className="flex items-center gap-2 font-semibold"><BriefcaseBusiness size={18} className="text-orange-600" />Työsuhteen tila</h4><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-text-secondary">Alkanut</dt><dd className="font-medium">{dateLabel(employmentProfile?.contractStartDate || selectedEmployee.startDate)}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-secondary">Sopimus</dt><dd className="font-medium">{employmentProfile?.contractType || selectedEmployee.employmentType || '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-secondary">Koeaika päättyy</dt><dd className={`font-medium ${deadlineTone(employmentProfile?.probationEndDate)}`}>{dateLabel(employmentProfile?.probationEndDate)}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-secondary">Viikkotyöaika</dt><dd className="font-medium">{selectedCard?.weeklyHours ? `${selectedCard.weeklyHours} h` : '—'}</dd></div></dl></CardContent></Card>
              <Card className="border-slate-200"><CardContent className="p-5"><h4 className="flex items-center gap-2 font-semibold"><GraduationCap size={18} className="text-orange-600" />Osaaminen ja pätevyydet</h4><div className="mt-4 grid grid-cols-2 gap-3">{[['Osaamisia', employeeSkills.length], ['Pätevyyksiä', employeeCertifications.length], ['Koulutuksia', employeeTrainings.length], ['Avoimia tavoitteita', employeeGoals.filter((item) => item.status !== 'Valmis' && item.status !== 'Keskeytetty').length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-text-secondary">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div></CardContent></Card>
              <Card className="border-slate-200"><CardContent className="p-5"><h4 className="flex items-center gap-2 font-semibold"><Wrench size={18} className="text-orange-600" />Kalusto ja poissaolot</h4><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-text-secondary">Vastuulla olevaa kalustoa</span><strong>{assignedEquipment.length}</strong></div><div className="flex justify-between gap-3"><span className="text-text-secondary">Poissaoloja historiassa</span><strong>{employeeAbsences.length}</strong></div><div className="flex justify-between gap-3"><span className="text-text-secondary">Dokumentteja</span><strong>{employeeDocuments.length}</strong></div><div className="flex justify-between gap-3"><span className="text-text-secondary">Avoimia HR-tehtäviä</span><strong>{employeeTasks.filter((item) => item.status !== 'Valmis' && item.status !== 'Ohitettu').length}</strong></div></div></CardContent></Card>
            </div>
            <Card className="border-slate-200"><CardContent className="p-5"><h4 className="font-semibold">Huomiota vaativat asiat</h4><div className="mt-4 grid gap-3 md:grid-cols-2">{[
              ...employeeDocuments.filter((item) => { const days = daysUntil(item.validUntil); return days != null && days <= 30; }).map((item) => ({ title: item.title, detail: `Dokumentti voimassa ${dateLabel(item.validUntil)}`, days: daysUntil(item.validUntil) })),
              ...employeeCertifications.filter((item) => { const days = daysUntil(item.expiresAt); return days != null && days <= 30; }).map((item) => ({ title: item.certificationType, detail: `Pätevyys voimassa ${dateLabel(item.expiresAt)}`, days: daysUntil(item.expiresAt) })),
              ...employeeGoals.filter((item) => { const days = daysUntil(item.targetDate); return days != null && days < 0 && item.status !== 'Valmis'; }).map((item) => ({ title: item.title, detail: `Tavoite myöhässä · ${dateLabel(item.targetDate)}`, days: daysUntil(item.targetDate) })),
            ].slice(0, 6).map((item) => <div key={`${item.title}-${item.detail}`} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-medium text-amber-950">{item.title}</p><p className="mt-1 text-sm text-amber-800">{item.detail}{item.days != null && item.days < 0 ? ` · ${Math.abs(item.days)} päivää sitten` : ''}</p></div></div>)}{!employeeDocuments.some((item) => { const days = daysUntil(item.validUntil); return days != null && days <= 30; }) && !employeeCertifications.some((item) => { const days = daysUntil(item.expiresAt); return days != null && days <= 30; }) && !employeeGoals.some((item) => { const days = daysUntil(item.targetDate); return days != null && days < 0 && item.status !== 'Valmis'; }) && <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 md:col-span-2"><CheckCircle2 size={18} />Ei avoimia määräaikahuomioita.</div>}</div></CardContent></Card></TabsContent>

            <TabsContent value="employment"><Card className="border-slate-200"><CardContent className="space-y-6 p-5 sm:p-6"><div><h4 className="font-semibold text-slate-950">Työsuhde- ja organisaatiotiedot</h4><p className="mt-1 text-sm text-text-secondary">Rakenteiset tiedot raportointiin, perehdytykseen ja henkilöstösuunnitteluun.</p></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Työnumero"><Input disabled={!canManage} value={employmentForm.employeeNumber ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, employeeNumber: event.target.value }))} /></Field>
              <Field label="Henkilökohtainen sähköposti"><Input disabled={!canManage} type="email" value={employmentForm.personalEmail ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, personalEmail: event.target.value }))} /></Field>
              <Field label="Työpiste / toimipaikka"><Input disabled={!canManage} value={employmentForm.workLocation ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, workLocation: event.target.value }))} /></Field>
              <Field label="Kustannuspaikka"><Input disabled={!canManage} value={employmentForm.costCenter ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, costCenter: event.target.value }))} /></Field>
              <Field label="Tehtävätaso"><Input disabled={!canManage} value={employmentForm.jobLevel ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, jobLevel: event.target.value }))} placeholder="Esimerkiksi ammattityöntekijä" /></Field>
              <Field label="Sopimustyyppi"><Input disabled={!canManage} value={employmentForm.contractType ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, contractType: event.target.value }))} placeholder="Vakituinen / määräaikainen" /></Field>
              <Field label="Sopimus alkaa"><Input disabled={!canManage} type="date" value={employmentForm.contractStartDate ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, contractStartDate: event.target.value }))} /></Field>
              <Field label="Sopimus päättyy"><Input disabled={!canManage} type="date" value={employmentForm.contractEndDate ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, contractEndDate: event.target.value }))} /></Field>
              <Field label="Koeaika päättyy"><Input disabled={!canManage} type="date" value={employmentForm.probationEndDate ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, probationEndDate: event.target.value }))} /></Field>
              <Field label="Irtisanomisaika"><Input disabled={!canManage} value={employmentForm.noticePeriod ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, noticePeriod: event.target.value }))} placeholder="Esimerkiksi 14 päivää" /></Field>
              <Field label="Työaikamalli"><Input disabled={!canManage} value={employmentForm.workingTimeModel ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, workingTimeModel: event.target.value }))} placeholder="37,5 h / ma–pe" /></Field>
              <Field label="Etätyökäytäntö"><Input disabled={!canManage} value={employmentForm.remoteWorkPolicy ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, remoteWorkPolicy: event.target.value }))} /></Field>
              <div className="md:col-span-2 xl:col-span-3"><Field label="Esihenkilön HR-huomiot" hint="Luottamuksellinen tieto. Näkyy vain organisaation adminille ja työntekijän nimetylle työnjohtajalle."><Textarea disabled={!canManage} value={employmentForm.managerNotes ?? ''} onChange={(event) => setEmploymentForm((previous) => ({ ...previous, managerNotes: event.target.value }))} rows={4} /></Field></div>
            </div>{canManage && <div className="flex justify-end"><Button className="gap-2" onClick={() => void saveEmployment()} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Tallenna työsuhdetiedot</Button></div>}</CardContent></Card></TabsContent>

            <TabsContent value="skills" className="space-y-4"><div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-slate-200"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold">Osaamisprofiili</h4><p className="text-sm text-text-secondary">Yhteinen 1–5-arviointi ja tavoitetaso.</p></div>{canManage && <Button size="sm" onClick={() => setDialog('skill')}><Plus size={15} className="mr-1" />Osaaminen</Button>}</div>{employeeSkills.length ? <div className="space-y-3">{employeeSkills.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.skillName}</p><p className="text-xs text-text-secondary">{item.category} · arvio: {item.assessmentSource}</p></div>{canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void remove('employee_skills', item.id, 'Osaaminen poistettiin.')}><Trash2 size={14} /></Button>}</div><div className="mt-3 flex items-center gap-3"><span className="text-xs text-text-secondary">Nykyinen {item.currentLevel}/5</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${item.currentLevel * 20}%` }} /></div><span className="text-xs font-medium">Tavoite {item.targetLevel}/5</span></div>{item.notes && <p className="mt-3 text-sm text-slate-600">{item.notes}</p>}</div>)}</div> : <EmptyState icon={GraduationCap} title="Osaamisprofiili puuttuu" description="Lisää keskeiset ammattitaidot ja tavoitetasot." />}</CardContent></Card>
              <Card className="border-slate-200"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold">Koulutushistoria</h4><p className="text-sm text-text-secondary">Suunnitellut ja suoritetut koulutukset.</p></div>{canManage && <Button size="sm" onClick={() => setDialog('training')}><Plus size={15} className="mr-1" />Koulutus</Button>}</div>{employeeTrainings.length ? <div className="space-y-3">{employeeTrainings.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge className={`border-0 ${statusTone(item.status)}`}>{item.status}</Badge></div><p className="mt-1 text-sm text-text-secondary">{item.provider || 'Kouluttaja puuttuu'} · {dateLabel(item.startDate)}</p>{item.validUntil && <p className={`mt-1 text-xs ${deadlineTone(item.validUntil)}`}>Voimassa {dateLabel(item.validUntil)}</p>}</div>{canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void remove('employee_training_records', item.id, 'Koulutus poistettiin.')}><Trash2 size={14} /></Button>}</div>)}</div> : <EmptyState icon={GraduationCap} title="Ei koulutushistoriaa" description="Kirjaa koulutukset, osallistumiset ja voimassaolot." />}</CardContent></Card>
            </div><Card className="border-slate-200"><CardContent className="p-5"><h4 className="font-semibold">Pätevyydet</h4><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{employeeCertifications.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold">{item.certificationType}</p><p className="mt-1 text-sm text-text-secondary">{item.certificationNumber || 'Ei numeroa'}</p><p className={`mt-2 text-xs ${deadlineTone(item.expiresAt)}`}>Voimassa {dateLabel(item.expiresAt)}</p></div>)}{!employeeCertifications.length && <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={CreditCard} title="Ei pätevyyksiä" description="Pätevyydet hallitaan henkilörekisterin Pätevyydet-välilehdellä." /></div>}</div></CardContent></Card></TabsContent>

            <TabsContent value="development" className="space-y-4"><div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-slate-200"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold">Tavoitteet</h4><p className="text-sm text-text-secondary">Sovitut tavoitteet, eteneminen ja määräajat.</p></div>{canManage && <Button size="sm" onClick={() => setDialog('goal')}><Plus size={15} className="mr-1" />Tavoite</Button>}</div>{employeeGoals.length ? <div className="space-y-3">{employeeGoals.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge className={`border-0 ${statusTone(item.status)}`}>{item.status}</Badge></div><p className={`mt-1 text-xs ${deadlineTone(item.targetDate)}`}>Tavoitepäivä {dateLabel(item.targetDate)}</p></div>{canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void remove('employee_goals', item.id, 'Tavoite poistettiin.')}><Trash2 size={14} /></Button>}</div><div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${item.progress}%` }} /></div><span className="text-sm font-semibold">{item.progress} %</span></div>{item.description && <p className="mt-3 text-sm text-slate-600">{item.description}</p>}</div>)}</div> : <EmptyState icon={Target} title="Ei asetettuja tavoitteita" description="Lisää työn, osaamisen tai urakehityksen tavoitteita." />}</CardContent></Card>
              <Card className="border-slate-200"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold">Keskustelut</h4><p className="text-sm text-text-secondary">1:1-, kehitys-, suoritus- ja tukikeskustelut.</p></div>{canManage && <Button size="sm" onClick={() => setDialog('conversation')}><Plus size={15} className="mr-1" />Keskustelu</Button>}</div>{employeeConversations.length ? <div className="space-y-3">{employeeConversations.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.conversationType}</p><Badge className={`border-0 ${statusTone(item.status)}`}>{item.status}</Badge></div><p className="mt-1 text-xs text-text-secondary">{dateTimeLabel(item.scheduledAt)}</p></div>{canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void remove('employee_conversations', item.id, 'Keskustelu poistettiin.')}><Trash2 size={14} /></Button>}</div>{item.summary && <p className="mt-3 text-sm text-slate-600">{item.summary}</p>}{item.agreedActions && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><strong>Sovitut toimet:</strong> {item.agreedActions}</div>}</div>)}</div> : <EmptyState icon={MessageSquare} title="Ei kirjattuja keskusteluja" description="Aikatauluta tai kirjaa 1:1- ja kehityskeskustelut." />}</CardContent></Card>
            </div></TabsContent>

            <TabsContent value="documents"><Card className="border-slate-200"><CardContent className="space-y-5 p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="font-semibold">Työntekijän dokumentit</h4><p className="mt-1 text-sm text-text-secondary">Työsopimukset, verokortit, todistukset, lomakkeet ja muut henkilöstöasiakirjat.</p></div>{canManage && <Button onClick={() => setDialog('document')}><Plus size={16} className="mr-2" />Lisää dokumentti</Button>}</div>{employeeDocuments.length ? <div className="overflow-hidden rounded-xl border border-slate-200">{employeeDocuments.map((item) => <div key={item.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_150px_160px_auto] lg:items-center"><div className="min-w-0"><p className="break-words font-semibold">{item.title}</p><p className="break-words text-xs text-text-secondary">{item.originalFilename}</p></div><div><Badge variant="outline">{item.documentType}</Badge><p className="mt-1 text-xs text-text-secondary">{item.visibility}</p></div><p className={`text-sm ${deadlineTone(item.validUntil)}`}>{item.validUntil ? `Voimassa ${dateLabel(item.validUntil)}` : 'Ei määräaikaa'}</p><p className="text-sm text-text-secondary">{item.sizeBytes ? `${(item.sizeBytes / 1024 / 1024).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} Mt` : '—'}</p><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => void openDocument(item)} aria-label={`Avaa ${item.title}`}><Download size={15} /></Button>{canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => organizationId && void run(() => deleteEmployeeDocument({ organizationId, id: item.id, storagePath: item.storagePath }), 'Dokumentti poistettiin.')} aria-label={`Poista ${item.title}`}><Trash2 size={15} /></Button>}</div></div>)}</div> : <EmptyState icon={FileText} title="Ei dokumentteja" description="Lisää työntekijän sopimukset, todistukset ja muut HR-asiakirjat." />}</CardContent></Card></TabsContent>

            <TabsContent value="lifecycle" className="space-y-4"><div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-slate-200"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold">Perehdytys ja työsuhteen tehtävät</h4><p className="text-sm text-text-secondary">Vastuuta ja seuraa perehdytys-, muutos- ja poistumistehtäviä.</p></div>{canManage && <Button size="sm" onClick={() => setDialog('task')}><Plus size={15} className="mr-1" />Tehtävä</Button>}</div>{employeeTasks.length ? <div className="space-y-3">{employeeTasks.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge className={`border-0 ${statusTone(item.status)}`}>{item.status}</Badge></div><p className="mt-1 text-xs text-text-secondary">{item.phase} · määräpäivä {dateLabel(item.dueDate)}</p></div>{canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void remove('employee_hr_tasks', item.id, 'HR-tehtävä poistettiin.')}><Trash2 size={14} /></Button>}</div>{item.description && <p className="mt-3 text-sm text-slate-600">{item.description}</p>}{canManage && item.status !== 'Valmis' && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => organizationId && user && void run(() => updateHrTaskStatus({ organizationId, id: item.id, userId: user.id, status: 'Käynnissä' }), 'HR-tehtävä päivitettiin.')}>Käynnissä</Button><Button size="sm" onClick={() => organizationId && user && void run(() => updateHrTaskStatus({ organizationId, id: item.id, userId: user.id, status: 'Valmis' }), 'HR-tehtävä valmistui.')}>Merkitse valmiiksi</Button></div>}</div>)}</div> : <EmptyState icon={ClipboardCheck} title="Ei HR-tehtäviä" description="Luo perehdytys-, työsuhdemuutos- tai poistumistehtäviä." />}</CardContent></Card>
              <Card className="border-slate-200"><CardContent className="space-y-4 p-5"><div><h4 className="font-semibold">HR-tapahtumahistoria</h4><p className="text-sm text-text-secondary">Automaattinen tapahtumaketju työntekijän HR-tietojen muutoksista.</p></div>{employeeEvents.length ? <div className="relative space-y-4 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-slate-200">{employeeEvents.map((item) => <div key={item.id} className="relative flex gap-3"><div className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-orange-500" /><div className="min-w-0 flex-1 rounded-xl bg-slate-50 p-3"><p className="font-medium"><EventLabel type={item.eventType} /></p><p className="mt-1 break-words text-sm text-slate-600">{item.title}</p><p className="mt-1 text-xs text-text-secondary">{dateTimeLabel(item.eventDate)}</p></div></div>)}</div> : <EmptyState icon={History} title="Ei tapahtumia" description="Tapahtumahistoria alkaa muodostua, kun HR-tietoja lisätään tai muutetaan." />}</CardContent></Card>
            </div></TabsContent>
          </Tabs>
        </div>}
      </div>}

    <Dialog open={dialog === 'skill'} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Lisää osaaminen</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Osaaminen *"><Input value={skillForm.name} onChange={(event) => setSkillForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Esimerkiksi laatoitus" /></Field></div><Field label="Kategoria"><Input value={skillForm.category} onChange={(event) => setSkillForm((previous) => ({ ...previous, category: event.target.value }))} /></Field><Field label="Arvion lähde"><Select value={skillForm.source} onValueChange={(source) => setSkillForm((previous) => ({ ...previous, source }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['työntekijä','esihenkilö','HR','näyttö','muu'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Nykyinen taso 1–5"><Input inputMode="numeric" value={skillForm.current} onChange={(event) => setSkillForm((previous) => ({ ...previous, current: event.target.value }))} /></Field><Field label="Tavoitetaso 1–5"><Input inputMode="numeric" value={skillForm.target} onChange={(event) => setSkillForm((previous) => ({ ...previous, target: event.target.value }))} /></Field><div className="sm:col-span-2"><Field label="Huomiot"><Textarea value={skillForm.notes} onChange={(event) => setSkillForm((previous) => ({ ...previous, notes: event.target.value }))} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Peruuta</Button><Button disabled={saving || !skillForm.name.trim()} onClick={() => organizationId && selectedEmployee && user && void run(() => createEmployeeSkill({ organizationId, employeeId: selectedEmployee.id, userId: user.id, skillName: skillForm.name, category: skillForm.category, currentLevel: Math.min(5, Math.max(1, Number(skillForm.current) || 1)), targetLevel: Math.min(5, Math.max(1, Number(skillForm.target) || 1)), assessmentSource: skillForm.source, notes: skillForm.notes }), 'Osaaminen lisättiin.')}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialog === 'training'} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Lisää koulutus</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Koulutus *"><Input value={trainingForm.title} onChange={(event) => setTrainingForm((previous) => ({ ...previous, title: event.target.value }))} /></Field></div><Field label="Järjestäjä"><Input value={trainingForm.provider} onChange={(event) => setTrainingForm((previous) => ({ ...previous, provider: event.target.value }))} /></Field><Field label="Tila"><Select value={trainingForm.status} onValueChange={(status) => setTrainingForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Suunniteltu','Ilmoittautunut','Käynnissä','Suoritettu','Peruttu'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Alkaa"><Input type="date" value={trainingForm.startDate} onChange={(event) => setTrainingForm((previous) => ({ ...previous, startDate: event.target.value }))} /></Field><Field label="Voimassa asti"><Input type="date" value={trainingForm.validUntil} onChange={(event) => setTrainingForm((previous) => ({ ...previous, validUntil: event.target.value }))} /></Field><div className="sm:col-span-2"><Field label="Huomiot"><Textarea value={trainingForm.notes} onChange={(event) => setTrainingForm((previous) => ({ ...previous, notes: event.target.value }))} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Peruuta</Button><Button disabled={saving || !trainingForm.title.trim()} onClick={() => organizationId && selectedEmployee && user && void run(() => createEmployeeTraining({ organizationId, employeeId: selectedEmployee.id, userId: user.id, title: trainingForm.title, provider: trainingForm.provider, status: trainingForm.status, startDate: trainingForm.startDate, validUntil: trainingForm.validUntil, notes: trainingForm.notes }), 'Koulutus lisättiin.')}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialog === 'goal'} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Lisää tavoite</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Tavoite *"><Input value={goalForm.title} onChange={(event) => setGoalForm((previous) => ({ ...previous, title: event.target.value }))} /></Field></div><Field label="Kategoria"><Input value={goalForm.category} onChange={(event) => setGoalForm((previous) => ({ ...previous, category: event.target.value }))} /></Field><Field label="Tila"><Select value={goalForm.status} onValueChange={(status) => setGoalForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Luonnos','Sovittu','Käynnissä','Valmis','Keskeytetty'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Edistyminen %"><Input inputMode="numeric" value={goalForm.progress} onChange={(event) => setGoalForm((previous) => ({ ...previous, progress: event.target.value }))} /></Field><Field label="Tavoitepäivä"><Input type="date" value={goalForm.targetDate} onChange={(event) => setGoalForm((previous) => ({ ...previous, targetDate: event.target.value }))} /></Field><div className="sm:col-span-2"><Field label="Kuvaus"><Textarea value={goalForm.description} onChange={(event) => setGoalForm((previous) => ({ ...previous, description: event.target.value }))} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Peruuta</Button><Button disabled={saving || !goalForm.title.trim()} onClick={() => organizationId && selectedEmployee && user && void run(() => createEmployeeGoal({ organizationId, employeeId: selectedEmployee.id, userId: user.id, title: goalForm.title, description: goalForm.description, category: goalForm.category, status: goalForm.status, progress: Math.min(100, Math.max(0, Number(goalForm.progress) || 0)), targetDate: goalForm.targetDate }), 'Tavoite lisättiin.')}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialog === 'conversation'} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Kirjaa tai aikatauluta keskustelu</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Keskustelutyyppi"><Select value={conversationForm.type} onValueChange={(type) => setConversationForm((previous) => ({ ...previous, type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['1:1','Kehityskeskustelu','Suoritusarvio','Varhainen tuki','Työhön paluu','Muu'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Tila"><Select value={conversationForm.status} onValueChange={(status) => setConversationForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Suunniteltu','Pidetty','Siirretty','Peruttu'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Ajankohta"><Input type="datetime-local" value={conversationForm.scheduledAt} onChange={(event) => setConversationForm((previous) => ({ ...previous, scheduledAt: event.target.value }))} /></Field><Field label="Seuraava seuranta"><Input type="date" value={conversationForm.followUp} onChange={(event) => setConversationForm((previous) => ({ ...previous, followUp: event.target.value }))} /></Field><div className="sm:col-span-2"><Field label="Yhteenveto"><Textarea value={conversationForm.summary} onChange={(event) => setConversationForm((previous) => ({ ...previous, summary: event.target.value }))} /></Field></div><div className="sm:col-span-2"><Field label="Sovitut toimet"><Textarea value={conversationForm.actions} onChange={(event) => setConversationForm((previous) => ({ ...previous, actions: event.target.value }))} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Peruuta</Button><Button disabled={saving} onClick={() => organizationId && selectedEmployee && user && void run(() => createEmployeeConversation({ organizationId, employeeId: selectedEmployee.id, userId: user.id, conversationType: conversationForm.type, scheduledAt: conversationForm.scheduledAt, status: conversationForm.status, summary: conversationForm.summary, agreedActions: conversationForm.actions, nextFollowUpDate: conversationForm.followUp }), 'Keskustelu tallennettiin.')}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialog === 'task'} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Lisää HR-tehtävä</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Vaihe"><Select value={taskForm.phase} onValueChange={(phase) => setTaskForm((previous) => ({ ...previous, phase }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Perehdytys','Työsuhdemuutos','Poistuminen','Muu'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Määräpäivä"><Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((previous) => ({ ...previous, dueDate: event.target.value }))} /></Field><div className="sm:col-span-2"><Field label="Tehtävä *"><Input value={taskForm.title} onChange={(event) => setTaskForm((previous) => ({ ...previous, title: event.target.value }))} /></Field></div><div className="sm:col-span-2"><Field label="Kuvaus"><Textarea value={taskForm.description} onChange={(event) => setTaskForm((previous) => ({ ...previous, description: event.target.value }))} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Peruuta</Button><Button disabled={saving || !taskForm.title.trim()} onClick={() => organizationId && selectedEmployee && user && void run(() => createEmployeeHrTask({ organizationId, employeeId: selectedEmployee.id, userId: user.id, phase: taskForm.phase, title: taskForm.title, description: taskForm.description, dueDate: taskForm.dueDate }), 'HR-tehtävä lisättiin.')}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialog === 'document'} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Lisää HR-dokumentti</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Tiedosto *" hint="PDF, Word tai kuva. Enimmäiskoko 15 Mt."><Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setDocumentForm((previous) => ({ ...previous, file: event.target.files?.[0] ?? null, title: previous.title || event.target.files?.[0]?.name.replace(/\.[^.]+$/, '') || '' }))} /></Field></div><div className="sm:col-span-2"><Field label="Otsikko *"><Input value={documentForm.title} onChange={(event) => setDocumentForm((previous) => ({ ...previous, title: event.target.value }))} /></Field></div><Field label="Dokumenttityyppi"><Select value={documentForm.type} onValueChange={(type) => setDocumentForm((previous) => ({ ...previous, type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Työsopimus','Verokortti','Palkkadokumentti','Todistus','Pätevyys','Työterveys','Kehityskeskustelu','Muu'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Näkyvyys"><Select value={documentForm.visibility} onValueChange={(value) => setDocumentForm((previous) => ({ ...previous, visibility: value === 'Vain HR' || value === 'Työntekijä' ? value : 'HR ja esihenkilö' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{isAdmin && <SelectItem value="Vain HR">Vain HR</SelectItem>}<SelectItem value="HR ja esihenkilö">HR ja esihenkilö</SelectItem><SelectItem value="Työntekijä">Myös työntekijä</SelectItem></SelectContent></Select></Field><Field label="Päiväys"><Input type="date" value={documentForm.issueDate} onChange={(event) => setDocumentForm((previous) => ({ ...previous, issueDate: event.target.value }))} /></Field><Field label="Voimassa asti"><Input type="date" value={documentForm.validUntil} onChange={(event) => setDocumentForm((previous) => ({ ...previous, validUntil: event.target.value }))} /></Field><div className="sm:col-span-2"><Field label="Huomiot"><Textarea value={documentForm.notes} onChange={(event) => setDocumentForm((previous) => ({ ...previous, notes: event.target.value }))} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Peruuta</Button><Button disabled={saving || !documentForm.file || !documentForm.title.trim()} onClick={() => organizationId && selectedEmployee && user && documentForm.file && void run(() => uploadEmployeeDocument({ organizationId, employeeId: selectedEmployee.id, userId: user.id, file: documentForm.file as File, title: documentForm.title, documentType: documentForm.type, issueDate: documentForm.issueDate, validUntil: documentForm.validUntil, visibility: isAdmin ? documentForm.visibility : documentForm.visibility === 'Työntekijä' ? 'Työntekijä' : 'HR ja esihenkilö', notes: documentForm.notes }), 'Dokumentti lisättiin.')}>Lataa dokumentti</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
