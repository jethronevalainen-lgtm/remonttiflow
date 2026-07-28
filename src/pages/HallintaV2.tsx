import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  KeyRound,
  Mail,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

import CustomerAccessPicker from '@/components/admin/CustomerAccessPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS, useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import type { CustomerAccessAssignment, CustomerAccessCatalogItem } from '@/lib/customerPortalAccess';
import {
  fetchCustomerAccessCatalog,
  fetchCustomerUserAccess,
  inviteOrganizationMember,
  removeOrganizationMember,
  saveCustomerUserAccess,
  updateOrganizationDetails,
  updateOrganizationMemberRole,
  type OrganizationMemberView,
} from '@/lib/supabase/organizationAdmin';
import type { OrganizationRole } from '@/lib/supabase/types';

const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  admin: 'Hallitsee organisaatiota, käyttäjiä ja kaikkia toimintoja.',
  supervisor: 'Hallitsee työmaita, henkilöstöä, laskentaa ja hyväksyntöjä.',
  project_coordinator: 'Hallitsee projektien operatiivista työtä ja näkee työaikahistorian. Ei näe henkilöstö-, palkka-, matka- tai poissaolotietoja eikä saa alaisia.',
  worker: 'Näkee ja käyttää työntekijälle kuuluvia päivittäisiä toimintoja.',
  customer: 'Näkee vain hänelle sallitut asiakkuudet, projektit ja tilaajaviestinnän.',
};

const ROLE_BADGES: Record<OrganizationRole, string> = {
  admin: 'border-purple-200 bg-purple-50 text-purple-700',
  supervisor: 'border-orange-200 bg-orange-50 text-orange-700',
  project_coordinator: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  worker: 'border-blue-200 bg-blue-50 text-blue-700',
  customer: 'border-teal-200 bg-teal-50 text-teal-700',
};

interface CustomerInviteDraft {
  email: string;
  fullName: string;
  customerAccess: CustomerAccessAssignment[];
}

const EMPTY_CUSTOMER_INVITE: CustomerInviteDraft = {
  email: '',
  fullName: '',
  customerAccess: [],
};

function initials(member: OrganizationMemberView) {
  const source = member.profile?.full_name || member.profile?.email || '?';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function validateCustomerAccess(access: CustomerAccessAssignment[]): string | null {
  if (access.length === 0) return 'Valitse tilaajalle vähintään yksi asiakkuus.';
  const invalid = access.find((item) => item.accessScope === 'selected_projects' && item.projectIds.length === 0);
  return invalid ? 'Valitse rajattuun asiakkuuteen vähintään yksi projekti.' : null;
}

function invitationBadge(member: OrganizationMemberView) {
  if (member.invitationStatus === 'pending') {
    return <Badge className="border-0 bg-amber-50 text-amber-700">Kutsu lähetetty</Badge>;
  }
  if (member.invitationStatus === 'disabled') {
    return <Badge className="border-0 bg-red-50 text-red-700">Käyttö estetty</Badge>;
  }
  return <Badge className="border-0 bg-emerald-50 text-emerald-700">Aktiivinen</Badge>;
}

export default function HallintaV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg, refreshOrganizations } = useOrganization();
  const { members, loading, error, refresh } = useOrganizationAdmin();

  const [organizationName, setOrganizationName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<CustomerAccessCatalogItem[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<CustomerInviteDraft>(EMPTY_CUSTOMER_INVITE);
  const [accessTarget, setAccessTarget] = useState<OrganizationMemberView | null>(null);
  const [accessDraft, setAccessDraft] = useState<CustomerAccessAssignment[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationMemberView | null>(null);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrganizationName(currentOrg?.name ?? '');
    setBusinessId(currentOrg?.business_id ?? '');
  }, [currentOrg?.business_id, currentOrg?.name]);

  useEffect(() => {
    if (!currentOrg) return;
    void fetchCustomerAccessCatalog(currentOrg.id)
      .then(setCatalog)
      .catch((caught) => setOperationError(caught instanceof Error ? caught.message : 'Tilaajatietojen haku epäonnistui.'));
  }, [currentOrg]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return members;
    return members.filter((member) =>
      `${member.profile?.full_name ?? ''} ${member.profile?.email ?? ''} ${ROLE_LABELS[member.role]}`
        .toLocaleLowerCase('fi')
        .includes(query),
    );
  }, [members, search]);

  const counts = useMemo(() => ({
    admin: members.filter((member) => member.role === 'admin').length,
    supervisor: members.filter((member) => member.role === 'supervisor').length,
    projectCoordinator: members.filter((member) => member.role === 'project_coordinator').length,
    worker: members.filter((member) => member.role === 'worker').length,
    customer: members.filter((member) => member.role === 'customer').length,
    pending: members.filter((member) => member.invitationStatus === 'pending').length,
  }), [members]);

  const clearMessages = () => {
    setOperationError(null);
    setSuccessMessage(null);
  };

  const saveOrganization = async () => {
    clearMessages();
    if (!currentOrg) return;
    if (!organizationName.trim()) {
      setOperationError('Organisaation nimi on pakollinen.');
      return;
    }
    setSaving(true);
    try {
      await updateOrganizationDetails(currentOrg.id, { name: organizationName, businessId: businessId || null });
      await refreshOrganizations();
      setSuccessMessage('Organisaation tiedot päivitettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Organisaation päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const sendCustomerInvite = async () => {
    clearMessages();
    if (!currentOrg) return;
    const email = inviteDraft.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOperationError('Anna kelvollinen sähköpostiosoite.');
      return;
    }
    if (!inviteDraft.fullName.trim()) {
      setOperationError('Anna tilaajakäyttäjän nimi.');
      return;
    }
    const validation = validateCustomerAccess(inviteDraft.customerAccess);
    if (validation) {
      setOperationError(validation);
      return;
    }
    setSaving(true);
    try {
      const result = await inviteOrganizationMember({
        organizationId: currentOrg.id,
        email,
        fullName: inviteDraft.fullName,
        role: 'customer',
        customerAccess: inviteDraft.customerAccess,
      });
      await refresh();
      setInviteOpen(false);
      setInviteDraft(EMPTY_CUSTOMER_INVITE);
      setSuccessMessage(result.message);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilaajakutsu epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openCustomerAccess = async (member: OrganizationMemberView) => {
    if (!currentOrg) return;
    clearMessages();
    setSaving(true);
    try {
      const access = await fetchCustomerUserAccess(currentOrg.id, member.userId);
      setAccessDraft(access);
      setAccessTarget(member);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilaajaoikeuksien haku epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const saveAccess = async () => {
    if (!currentOrg || !accessTarget) return;
    const validation = validateCustomerAccess(accessDraft);
    if (validation) {
      setOperationError(validation);
      return;
    }
    setSaving(true);
    try {
      await saveCustomerUserAccess({ organizationId: currentOrg.id, userId: accessTarget.userId, access: accessDraft });
      setAccessTarget(null);
      setSuccessMessage('Tilaajan asiakkuus- ja projektioikeudet päivitettiin.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tilaajaoikeuksien tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (member: OrganizationMemberView, role: OrganizationRole) => {
    clearMessages();
    if (!currentOrg || member.userId === user?.id || member.role === role || role === 'customer') return;
    setSaving(true);
    try {
      await updateOrganizationMemberRole(currentOrg.id, member.userId, role);
      await refresh();
      setSuccessMessage('Käyttäjän käyttöoikeusrooli päivitettiin. Henkilön tehtävänimike säilyi erillisenä henkilöstökortilla.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Roolin päivitys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async () => {
    clearMessages();
    if (!currentOrg || !deleteTarget || deleteTarget.userId === user?.id) return;
    setSaving(true);
    try {
      await removeOrganizationMember(currentOrg.id, deleteTarget.userId);
      await refresh();
      setDeleteTarget(null);
      setSuccessMessage('Käyttäjän pääsy organisaatioon poistettiin. Henkilöstö- ja työhistoriaa ei poistettu.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrg) {
    return <Card><CardContent className="p-12 text-center"><AlertTriangle size={40} className="mx-auto mb-3 text-amber-600" /><p className="font-semibold">Aktiivista organisaatiota ei ole valittu.</p></CardContent></Card>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-hero text-text-primary">Organisaation hallinta</h1><p className="mt-1 text-body-sm text-text-secondary">Yrityksen tiedot, käyttäjätilit ja käyttöoikeuksien valvonta</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/henkilosto')} className="gap-2"><Users size={16} /> Lisää henkilöstö</Button>
          <Button onClick={() => { clearMessages(); setInviteDraft(EMPTY_CUSTOMER_INVITE); setInviteOpen(true); }} className="gap-2"><UserPlus size={16} /> Kutsu tilaaja</Button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        Sisäinen henkilö lisätään vain <strong>Henkilöstö</strong>-näkymästä. Siellä kutsuja määrittää ensin henkilöstötiedot, käyttöoikeusroolin ja tiimin. Tämä näkymä toimii käyttäjätilien ja oikeuksien tarkastuspaikkana.
      </div>

      {(error || operationError) && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="break-words">{operationError ?? error}</span></div>}
      {successMessage && <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /><span className="break-words">{successMessage}</span></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Käyttäjiä</p><p className="mt-1 text-2xl font-bold">{members.length}</p>{counts.pending > 0 && <p className="mt-1 text-xs text-amber-700">{counts.pending} kutsua odottaa</p>}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Ylläpitäjiä</p><p className="mt-1 text-2xl font-bold text-purple-700">{counts.admin}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Työnjohtajia</p><p className="mt-1 text-2xl font-bold text-orange-700">{counts.supervisor}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Projektikoordinaattoreita</p><p className="mt-1 text-2xl font-bold text-indigo-700">{counts.projectCoordinator}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Työntekijöitä</p><p className="mt-1 text-2xl font-bold text-blue-700">{counts.worker}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Tilaajia</p><p className="mt-1 text-2xl font-bold text-teal-700">{counts.customer}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building2 size={19} className="text-primary" /> Organisaation tiedot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="organization-name">Nimi *</Label><Input id="organization-name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} maxLength={160} /></div>
            <div className="space-y-2"><Label htmlFor="business-id">Y-tunnus</Label><Input id="business-id" value={businessId} onChange={(event) => setBusinessId(event.target.value)} placeholder="1234567-8" maxLength={20} /></div>
            <Button onClick={() => void saveOrganization()} disabled={saving} className="w-full gap-2"><Save size={16} /> {saving ? 'Tallennetaan…' : 'Tallenna tiedot'}</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="flex items-center gap-2 text-lg"><Users size={19} className="text-primary" /> Käyttäjätilit</CardTitle><div className="relative sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae nimellä tai sähköpostilla…" className="pl-9" /></div></div></CardHeader>
          <CardContent className="p-0">
            {filteredMembers.map((member) => {
              const isSelf = member.userId === user?.id;
              const name = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
              return (
                <div key={member.userId} className="grid gap-4 border-b border-slate-100 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(140px,0.55fr)_220px_auto] lg:items-center">
                  <div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">{initials(member)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-medium">{name}</p>{isSelf && <Badge variant="secondary">Sinä</Badge>}<Badge variant="outline" className={ROLE_BADGES[member.role]}>{ROLE_LABELS[member.role]}</Badge></div>{member.profile?.email && <p className="mt-1 flex items-start gap-1 text-xs text-text-secondary"><Mail size={12} className="mt-0.5 shrink-0" /><span className="break-all">{member.profile.email}</span></p>}</div></div>
                  <div>{invitationBadge(member)}{member.invitedAt && member.invitationStatus === 'pending' && <p className="mt-1 text-xs text-text-muted">Lähetetty {new Date(member.invitedAt).toLocaleDateString('fi-FI')}</p>}</div>
                  {member.role === 'customer' ? (
                    <Button variant="outline" className="gap-2" disabled={saving} onClick={() => void openCustomerAccess(member)}><KeyRound size={15} /> Tilaajaoikeudet</Button>
                  ) : (
                    <Select value={member.role} disabled={saving || isSelf} onValueChange={(role: OrganizationRole) => void changeRole(member, role)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Ylläpitäjä</SelectItem><SelectItem value="supervisor">Työnjohtaja</SelectItem><SelectItem value="project_coordinator">Projektikoordinaattori</SelectItem><SelectItem value="worker">Työntekijä</SelectItem></SelectContent></Select>
                  )}
                  <Button variant="ghost" size="sm" className="text-danger" disabled={saving || isSelf} onClick={() => { clearMessages(); setDeleteTarget(member); }} aria-label={`Poista ${name}`}><Trash2 size={16} /></Button>
                </div>
              );
            })}
            {!loading && filteredMembers.length === 0 && <div className="p-12 text-center"><Users size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Käyttäjiä ei löytynyt</p></div>}
            {loading && <div className="p-8 text-center text-sm text-text-secondary">Ladataan käyttäjiä…</div>}
          </CardContent>
        </Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck size={19} className="text-primary" /> Roolien oikeudet</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-5">{(Object.keys(ROLE_LABELS) as OrganizationRole[]).map((role) => <div key={role} className="rounded-lg border border-slate-200 p-4"><Badge variant="outline" className={ROLE_BADGES[role]}>{ROLE_LABELS[role]}</Badge><p className="mt-3 text-sm leading-6 text-text-secondary">{ROLE_DESCRIPTIONS[role]}</p></div>)}</CardContent></Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Kutsu tilaajakäyttäjä</DialogTitle></DialogHeader>
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">Tämä kutsu on vain ulkoiselle tilaajalle. Sisäinen henkilöstö lisätään Henkilöstö-näkymästä.</div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="invite-email">Sähköposti *</Label><Input id="invite-email" type="email" autoComplete="email" value={inviteDraft.email} onChange={(event) => setInviteDraft((previous) => ({ ...previous, email: event.target.value }))} placeholder="nimi@yritys.fi" /></div><div className="space-y-2"><Label htmlFor="invite-name">Nimi *</Label><Input id="invite-name" value={inviteDraft.fullName} onChange={(event) => setInviteDraft((previous) => ({ ...previous, fullName: event.target.value }))} maxLength={120} /></div></div>
          <CustomerAccessPicker catalog={catalog} value={inviteDraft.customerAccess} onChange={(customerAccess) => setInviteDraft((previous) => ({ ...previous, customerAccess }))} disabled={saving} />
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Kutsun otsikko</p><p className="mt-1 font-semibold">Sinut on kutsuttu käyttämään VaKanttia</p></div>
          <DialogFooter><Button variant="outline" onClick={() => setInviteOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void sendCustomerInvite()} disabled={saving} className="gap-2"><UserPlus size={15} /> {saving ? 'Lähetetään…' : 'Lähetä tilaajakutsu'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(accessTarget)} onOpenChange={(open) => !open && setAccessTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Tilaajan käyttöoikeudet</DialogTitle></DialogHeader>
          <p className="break-words text-sm text-slate-600">{accessTarget?.profile?.full_name || accessTarget?.profile?.email || 'Tilaaja'} näkee vain alla valitut asiakkuudet ja projektit.</p>
          <CustomerAccessPicker catalog={catalog} value={accessDraft} onChange={setAccessDraft} disabled={saving} />
          <DialogFooter><Button variant="outline" onClick={() => setAccessTarget(null)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveAccess()} disabled={saving} className="gap-2"><Save size={15} /> Tallenna oikeudet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista käyttäjän pääsy organisaatioon</DialogTitle></DialogHeader><p className="break-words text-sm leading-6 text-text-secondary">Poistetaanko <strong>{deleteTarget?.profile?.full_name || deleteTarget?.profile?.email || 'käyttäjä'}</strong> organisaatiosta? Käyttäjätiliä, henkilöstökorttia tai työhistoriaa ei poisteta, mutta pääsy tämän organisaation tietoihin päättyy.</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Peruuta</Button><Button variant="destructive" onClick={() => void removeMember()} disabled={saving}>Poista pääsy</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
