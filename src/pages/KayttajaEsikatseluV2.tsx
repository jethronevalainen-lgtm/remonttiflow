import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Eye,
  FolderKanban,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  UserCircle2,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS, homeForRole, useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import type { CustomerAccessCatalogItem, CustomerAccessScope, CustomerPreviewScope } from '@/lib/customerPortalAccess';
import {
  fetchCustomerAccessCatalog,
  fetchCustomerUserAccess,
  logCustomerPortalPreview,
} from '@/lib/supabase/organizationAdmin';
import type { OrganizationRole } from '@/lib/supabase/types';

const ROLE_BADGES: Record<OrganizationRole, string> = {
  admin: 'border-purple-200 bg-purple-50 text-purple-700',
  supervisor: 'border-orange-200 bg-orange-50 text-orange-700',
  worker: 'border-blue-200 bg-blue-50 text-blue-700',
  customer: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const ROLE_HELP: Record<OrganizationRole, string> = {
  admin: 'Kaikki työnjohdon toiminnot sekä organisaation hallinta.',
  supervisor: 'Tuotannon, projektien, henkilöstön ja hyväksyntöjen näkymät.',
  worker: 'Omat työt, kirjaukset, korjaukset, lomakkeet ja viestit.',
  customer: 'Vain sallitut asiakkuudet, projektit, dokumentit ja tilaajaviestintä.',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function explicitScopeForAssignments(
  catalog: CustomerAccessCatalogItem[],
  assignments: Awaited<ReturnType<typeof fetchCustomerUserAccess>>,
): CustomerPreviewScope {
  const customerIds = assignments.map((item) => item.customerId);
  const projectIds = assignments.flatMap((item) => {
    if (item.accessScope === 'selected_projects') return item.projectIds;
    return catalog.find((customer) => customer.customerId === item.customerId)?.projects.map((project) => project.id) ?? [];
  });
  return { customerIds, projectIds: [...new Set(projectIds)], accessScope: 'selected_projects' };
}

export default function KayttajaEsikatseluV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { members, loading, error } = useOrganizationAdmin();
  const { startPreview, isPreviewing, previewTarget, stopPreview } = useViewAs();
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<CustomerAccessCatalogItem[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [accessScope, setAccessScope] = useState<CustomerAccessScope>('all_projects');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    void fetchCustomerAccessCatalog(currentOrg.id)
      .then((items) => {
        setCatalog(items);
        setSelectedCustomerIds((current) => current.length ? current : items[0] ? [items[0].customerId] : []);
      })
      .catch((caught) => setOperationError(caught instanceof Error ? caught.message : 'Tilaajaesikatselun tietoja ei saatu ladattua.'));
  }, [currentOrg]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return members;
    return members.filter((member) => {
      const searchable = [member.profile?.full_name, member.profile?.email, ROLE_LABELS[member.role]]
        .filter(Boolean).join(' ').toLocaleLowerCase('fi');
      return searchable.includes(query);
    });
  }, [members, search]);

  const selectedCustomers = useMemo(
    () => catalog.filter((customer) => selectedCustomerIds.includes(customer.customerId)),
    [catalog, selectedCustomerIds],
  );
  const selectableProjects = useMemo(
    () => selectedCustomers.flatMap((customer) => customer.projects.map((project) => ({ ...project, customerName: customer.customerName }))),
    [selectedCustomers],
  );

  const toggleCustomer = (customerId: string, checked: boolean) => {
    setSelectedCustomerIds((current) => checked
      ? [...new Set([...current, customerId])]
      : current.filter((id) => id !== customerId));
    if (!checked) {
      const removedProjectIds = new Set(catalog.find((item) => item.customerId === customerId)?.projects.map((project) => project.id) ?? []);
      setSelectedProjectIds((current) => current.filter((id) => !removedProjectIds.has(id)));
    }
  };

  const toggleProject = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((current) => checked
      ? [...new Set([...current, projectId])]
      : current.filter((id) => id !== projectId));
  };

  const startCustomerPreview = async (scope: CustomerPreviewScope, displayName: string, userId = 'customer-preview-scenario') => {
    if (!currentOrg) return;
    if (scope.customerIds.length === 0) {
      setOperationError('Valitse vähintään yksi tilaaja-asiakkuus.');
      return;
    }
    if (scope.accessScope === 'selected_projects' && scope.projectIds.length === 0) {
      setOperationError('Valitse rajattuun esikatseluun vähintään yksi projekti.');
      return;
    }
    setStarting(true);
    setOperationError(null);
    try {
      await logCustomerPortalPreview(currentOrg.id, scope);
      startPreview({ userId, displayName, email: null, role: 'customer', customerPreview: scope });
      navigate('/tilaajan-tyot');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilaajaesikatselun käynnistys epäonnistui.');
    } finally {
      setStarting(false);
    }
  };

  const previewMember = async (member: (typeof members)[number]) => {
    const email = member.profile?.email ?? null;
    const displayName = member.profile?.full_name || email || 'Nimetön käyttäjä';
    if (member.role === 'customer') {
      if (!currentOrg) return;
      setStarting(true);
      try {
        const assignments = await fetchCustomerUserAccess(currentOrg.id, member.userId);
        const scope = explicitScopeForAssignments(catalog, assignments);
        await startCustomerPreview(scope, displayName, member.userId);
      } catch (caught) {
        setOperationError(caught instanceof Error ? caught.message : 'Tilaajan oikeuksia ei saatu avattua.');
        setStarting(false);
      }
      return;
    }
    startPreview({ userId: member.userId, displayName, email, role: member.role });
    navigate(homeForRole(member.role));
  };

  const scenarioScope: CustomerPreviewScope = {
    customerIds: selectedCustomerIds,
    projectIds: accessScope === 'selected_projects' ? selectedProjectIds : [],
    accessScope,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h1 className="text-hero text-text-primary">Käyttäjänäkymän esikatselu</h1><p className="mt-1 max-w-3xl text-body-sm leading-6 text-text-secondary">Tarkista navigaatio, sivut ja tietorajaukset sellaisina kuin käyttäjä tai tilaaja ne näkee.</p></div>
        {isPreviewing && <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={stopPreview}>Lopeta nykyinen esikatselu</Button>}
      </div>

      <Card className="border-indigo-200 bg-indigo-50/70"><CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><MonitorSmartphone size={23} /></div><div className="min-w-0"><p className="font-semibold text-indigo-950">Turvallinen, vain lukemiseen tarkoitettu esikatselu</p><p className="mt-1 text-sm leading-6 text-indigo-800">Admin-istunto säilyy. Tilaajaesikatselun tiedot haetaan erillisillä palvelinpuolisilla preview-RPC:illä, jotka palauttavat vain tilaajalle sallitut kentät.</p></div><div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-800"><ShieldCheck size={17} /> Admin-istunto säilyy</div></CardContent></Card>

      {(error || operationError) && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><span>{operationError ?? error}</span></div>}

      <Card className="overflow-hidden border-teal-200">
        <CardHeader className="border-b bg-gradient-to-r from-teal-50 to-white"><CardTitle className="flex items-center gap-2 text-lg"><Building2 size={20} className="text-teal-700" /> Tilaajanäkymän esikatselu</CardTitle><p className="text-sm leading-6 text-slate-600">Muodosta isännöitsijän, yritysasiakkaan tai yksittäisen projektin asiakkaan näkymä ilman oikean käyttäjän kutsumista.</p></CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2"><Label>Asiakkuudet</Label><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{catalog.map((customer) => <label key={customer.customerId} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><Checkbox checked={selectedCustomerIds.includes(customer.customerId)} onCheckedChange={(checked) => toggleCustomer(customer.customerId, checked === true)} /><span className="min-w-0"><span className="block truncate font-medium text-slate-950">{customer.customerName}</span><span className="block text-xs text-slate-500">{customer.projects.length} projektia</span></span></label>)}</div>{catalog.length === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Luo ensin asiakas ja projekti, jotta tilaajanäkymää voidaan esikatsella.</p>}</div>
          <div className="space-y-2"><Label>Näkyvyyden laajuus</Label><Select value={accessScope} onValueChange={(value: CustomerAccessScope) => setAccessScope(value)}><SelectTrigger className="max-w-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all_projects">Kaikki valittujen asiakkuuksien projektit</SelectItem><SelectItem value="selected_projects">Vain valitut projektit</SelectItem></SelectContent></Select></div>
          {accessScope === 'selected_projects' && <div className="space-y-2"><Label className="flex items-center gap-2"><FolderKanban size={16} /> Projektit</Label><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{selectableProjects.map((project) => <label key={project.id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><Checkbox checked={selectedProjectIds.includes(project.id)} onCheckedChange={(checked) => toggleProject(project.id, checked === true)} /><span className="min-w-0"><span className="block truncate font-medium text-slate-950">{project.name}</span><span className="block truncate text-xs text-slate-500">{project.customerName} · {project.location || project.status}</span></span></label>)}</div></div>}
          <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-teal-950">Esikatseluskenaario</p><p className="mt-1 text-sm text-teal-800">{selectedCustomerIds.length} asiakkuutta · {accessScope === 'all_projects' ? 'kaikki projektit' : `${selectedProjectIds.length} valittua projektia`}</p></div><Button className="gap-2 bg-teal-600 hover:bg-teal-700" disabled={starting || catalog.length === 0} onClick={() => void startCustomerPreview(scenarioScope, selectedCustomers.map((item) => item.customerName).join(', ') || 'Tilaaja')}><Eye size={16} /> Esikatsele tilaajana</Button></div>
        </CardContent>
      </Card>

      {previewTarget && <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center"><Eye size={18} className="shrink-0" /><p className="min-w-0 flex-1">Nyt esikatsellaan käyttäjää <strong>{previewTarget.displayName}</strong> roolissa <strong>{ROLE_LABELS[previewTarget.role]}</strong>.</p><Button size="sm" className="w-full sm:w-auto" onClick={() => navigate(homeForRole(previewTarget.role))}>Palaa esikatseluun</Button></div>}

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="flex items-center gap-2 text-lg"><Users size={19} className="text-primary" /> {currentOrg?.name ?? 'Organisaatio'}</CardTitle><p className="mt-1 text-sm text-text-secondary">Valitse olemassa oleva käyttäjä ja tarkista hänen todelliset roolinsa ja tilaajakytkentänsä.</p></div><div className="relative w-full lg:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae nimellä, sähköpostilla tai roolilla" className="min-h-11 pl-9" /></div></CardHeader>
        <CardContent className="p-0">
          {loading && <div className="p-10 text-center text-sm text-text-secondary">Ladataan käyttäjiä…</div>}
          {!loading && filteredMembers.map((member) => {
            const name = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
            const isSelf = member.userId === user?.id;
            const isSelected = previewTarget?.userId === member.userId;
            return <div key={member.userId} className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto] lg:items-center"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">{initials(name)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold text-text-primary">{name}</p>{isSelf && <Badge variant="secondary">Sinä</Badge>}{isSelected && <Badge className="bg-emerald-600">Esikatselussa</Badge>}</div>{member.profile?.email && <p className="mt-1 truncate text-sm text-text-secondary">{member.profile.email}</p>}</div></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><Badge variant="outline" className={ROLE_BADGES[member.role]}>{ROLE_LABELS[member.role]}</Badge><p className="mt-2 text-xs leading-5 text-text-secondary">{ROLE_HELP[member.role]}</p></div><Button className="min-h-11 w-full gap-2 lg:w-auto" variant={isSelected ? 'outline' : 'default'} disabled={starting} onClick={() => void previewMember(member)}>{member.profile ? <Eye size={16} /> : <UserCircle2 size={16} />}{isSelected ? 'Avaa uudelleen' : 'Esikatsele käyttäjänä'}</Button></div>;
          })}
          {!loading && filteredMembers.length === 0 && <div className="p-10 text-center"><Users size={40} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Käyttäjiä ei löytynyt</p></div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
