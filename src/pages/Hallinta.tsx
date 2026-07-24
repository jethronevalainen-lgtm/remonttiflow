import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Mail,
  Phone,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import {
  inviteOrganizationMember,
  removeOrganizationMember,
  updateOrganizationDetails,
  updateOrganizationMemberRole,
  type OrganizationMemberView,
} from '@/lib/supabase/organizationAdmin';
import type { OrganizationRole } from '@/lib/supabase/types';

const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  admin: 'Hallitsee organisaatiota, käyttäjiä ja kaikkia toimintoja.',
  supervisor: 'Hallitsee työmaita, henkilöstöä, laskentaa ja hyväksyntöjä.',
  worker: 'Näkee ja käyttää työntekijälle kuuluvia päivittäisiä toimintoja.',
};

const ROLE_BADGES: Record<OrganizationRole, string> = {
  admin: 'border-purple-200 bg-purple-50 text-purple-700',
  supervisor: 'border-orange-200 bg-orange-50 text-orange-700',
  worker: 'border-blue-200 bg-blue-50 text-blue-700',
};

interface InviteDraft {
  email: string;
  fullName: string;
  role: OrganizationRole;
}

const EMPTY_INVITE: InviteDraft = {
  email: '',
  fullName: '',
  role: 'worker',
};

function initials(member: OrganizationMemberView) {
  const source = member.profile?.full_name || member.profile?.email || '?';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export default function Hallinta() {
  const { user } = useAuth();
  const { currentOrg, refreshOrganizations } = useOrganization();
  const { members, loading, error, refresh } = useOrganizationAdmin();

  const [organizationName, setOrganizationName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>(EMPTY_INVITE);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationMemberView | null>(null);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrganizationName(currentOrg?.name ?? '');
    setBusinessId(currentOrg?.business_id ?? '');
  }, [currentOrg?.business_id, currentOrg?.name]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return members;
    return members.filter((member) =>
      `${member.profile?.full_name ?? ''} ${member.profile?.email ?? ''} ${ROLE_LABELS[member.role]}`
        .toLocaleLowerCase('fi')
        .includes(query),
    );
  }, [members, search]);

  const adminCount = members.filter((member) => member.role === 'admin').length;
  const supervisorCount = members.filter((member) => member.role === 'supervisor').length;
  const workerCount = members.filter((member) => member.role === 'worker').length;

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
      await updateOrganizationDetails(currentOrg.id, {
        name: organizationName,
        businessId: businessId || null,
      });
      await refreshOrganizations();
      setSuccessMessage('Organisaation tiedot päivitettiin.');
    } catch (caught) {
      setOperationError(
        caught instanceof Error ? caught.message : 'Organisaation päivitys epäonnistui.',
      );
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    clearMessages();
    if (!currentOrg) return;
    const email = inviteDraft.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOperationError('Anna kelvollinen sähköpostiosoite.');
      return;
    }

    setSaving(true);
    try {
      const result = await inviteOrganizationMember({
        organizationId: currentOrg.id,
        email,
        fullName: inviteDraft.fullName,
        role: inviteDraft.role,
      });
      await refresh();
      setInviteOpen(false);
      setInviteDraft(EMPTY_INVITE);
      setSuccessMessage(result.message);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Kutsu epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (member: OrganizationMemberView, role: OrganizationRole) => {
    clearMessages();
    if (!currentOrg || member.userId === user?.id || member.role === role) return;
    setSaving(true);
    try {
      await updateOrganizationMemberRole(currentOrg.id, member.userId, role);
      await refresh();
      setSuccessMessage('Käyttäjän rooli päivitettiin.');
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
      setSuccessMessage('Käyttäjä poistettiin organisaatiosta.');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrg) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle size={40} className="mx-auto mb-3 text-amber-600" />
          <p className="font-semibold">Aktiivista organisaatiota ei ole valittu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Organisaation hallinta</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Yrityksen tiedot, käyttäjät ja käyttöoikeusroolit
          </p>
        </div>
        <Button onClick={() => { clearMessages(); setInviteOpen(true); }} className="gap-2">
          <UserPlus size={16} /> Kutsu käyttäjä
        </Button>
      </div>

      {(error || operationError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {operationError ?? error}
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> {successMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Käyttäjiä</p><p className="mt-1 font-mono text-2xl font-bold">{members.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Ylläpitäjiä</p><p className="mt-1 font-mono text-2xl font-bold text-purple-700">{adminCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Työnjohtajia</p><p className="mt-1 font-mono text-2xl font-bold text-orange-700">{supervisorCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Työntekijöitä</p><p className="mt-1 font-mono text-2xl font-bold text-blue-700">{workerCount}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 size={19} className="text-primary" /> Organisaation tiedot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organization-name">Nimi *</Label>
              <Input
                id="organization-name"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-id">Y-tunnus</Label>
              <Input
                id="business-id"
                value={businessId}
                onChange={(event) => setBusinessId(event.target.value)}
                placeholder="1234567-8"
                maxLength={20}
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-text-secondary">
              Organisaation tunniste: <span className="font-mono">{currentOrg.id}</span>
            </div>
            <Button onClick={() => void saveOrganization()} disabled={saving} className="w-full gap-2">
              <Save size={16} /> {saving ? 'Tallennetaan…' : 'Tallenna tiedot'}
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users size={19} className="text-primary" /> Käyttäjät
              </CardTitle>
              <div className="relative sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Hae nimellä tai sähköpostilla..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredMembers.map((member) => {
              const isSelf = member.userId === user?.id;
              const name = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
              return (
                <div
                  key={member.userId}
                  className="grid gap-4 border-b border-slate-100 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_180px_48px] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                      {initials(member)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{name}</p>
                        {isSelf && <Badge variant="secondary">Sinä</Badge>}
                        <Badge variant="outline" className={ROLE_BADGES[member.role]}>
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                        {member.profile?.email && <span className="flex items-center gap-1"><Mail size={12} /> {member.profile.email}</span>}
                        {member.profile?.phone && <span className="flex items-center gap-1"><Phone size={12} /> {member.profile.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <Select
                    value={member.role}
                    disabled={saving || isSelf}
                    onValueChange={(role: OrganizationRole) => void changeRole(member, role)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Ylläpitäjä</SelectItem>
                      <SelectItem value="supervisor">Työnjohtaja</SelectItem>
                      <SelectItem value="worker">Työntekijä</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    disabled={saving || isSelf}
                    onClick={() => { clearMessages(); setDeleteTarget(member); }}
                    aria-label={`Poista ${name}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              );
            })}
            {!loading && filteredMembers.length === 0 && (
              <div className="p-12 text-center">
                <Users size={42} className="mx-auto mb-3 text-text-muted" />
                <p className="font-semibold">Käyttäjiä ei löytynyt</p>
              </div>
            )}
            {loading && <div className="p-8 text-center text-sm text-text-secondary">Ladataan käyttäjiä…</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck size={19} className="text-primary" /> Roolien oikeudet
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {(Object.keys(ROLE_LABELS) as OrganizationRole[]).map((role) => (
            <div key={role} className="rounded-lg border border-slate-200 p-4">
              <Badge variant="outline" className={ROLE_BADGES[role]}>{ROLE_LABELS[role]}</Badge>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kutsu käyttäjä organisaatioon</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Sähköposti *</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={inviteDraft.email}
                onChange={(event) => setInviteDraft((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="nimi@yritys.fi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nimi</Label>
              <Input
                id="invite-name"
                value={inviteDraft.fullName}
                onChange={(event) => setInviteDraft((previous) => ({ ...previous, fullName: event.target.value }))}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Rooli</Label>
              <Select
                value={inviteDraft.role}
                onValueChange={(role: OrganizationRole) => setInviteDraft((previous) => ({ ...previous, role }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker">Työntekijä</SelectItem>
                  <SelectItem value="supervisor">Työnjohtaja</SelectItem>
                  <SelectItem value="admin">Ylläpitäjä</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-text-secondary">{ROLE_DESCRIPTIONS[inviteDraft.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void sendInvite()} disabled={saving} className="gap-2">
              <UserPlus size={15} /> {saving ? 'Lähetetään…' : 'Lähetä kutsu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Poista käyttäjä organisaatiosta</DialogTitle></DialogHeader>
          <p className="text-sm leading-6 text-text-secondary">
            Poistetaanko <strong>{deleteTarget?.profile?.full_name || deleteTarget?.profile?.email || 'käyttäjä'}</strong> organisaatiosta? Käyttäjätiliä ei poisteta, mutta pääsy tämän organisaation tietoihin päättyy.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Peruuta</Button>
            <Button variant="destructive" onClick={() => void removeMember()} disabled={saving}>Poista organisaatiosta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
