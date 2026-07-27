import { useMemo, useState } from 'react';
import { Eye, Search, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ROLE_LABELS, homeForRole } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import type { CustomerPreviewScope } from '@/lib/customerPortalAccess';
import { fetchCustomerUserAccess } from '@/lib/supabase/organizationAdmin';
import type { OrganizationRole } from '@/lib/supabase/types';

const ROLE_BADGES: Record<OrganizationRole, string> = {
  admin: 'border-purple-200 bg-purple-50 text-purple-700',
  supervisor: 'border-orange-200 bg-orange-50 text-orange-700',
  project_coordinator: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  worker: 'border-blue-200 bg-blue-50 text-blue-700',
  customer: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const ROLE_HELP: Record<OrganizationRole, string> = {
  admin: 'Kaikki toiminnot sekä organisaation hallinta.',
  supervisor: 'Projektit, henkilöstö, työajat, palkka-aineisto ja hyväksynnät.',
  project_coordinator: 'Projektien operatiivinen hallinta ja työaikahistoria ilman henkilöstö-, palkka-, matka- tai poissaolotietoja.',
  worker: 'Omat työt, kirjaukset, korjaukset, lomakkeet ja viestit.',
  customer: 'Vain sallitut asiakkuudet, projektit, dokumentit ja tilaajaviestintä.',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export default function KayttajaEsikatseluV2() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { members, loading, error } = useOrganizationAdmin();
  const { startPreview, stopPreview, previewTarget, isPreviewing } = useViewAs();
  const [search, setSearch] = useState('');
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return members;
    return members.filter((member) => [
      member.profile?.full_name,
      member.profile?.email,
      ROLE_LABELS[member.role],
    ].filter(Boolean).join(' ').toLocaleLowerCase('fi').includes(query));
  }, [members, search]);

  const previewMember = async (member: (typeof members)[number]) => {
    const displayName = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
    setStartingUserId(member.userId);
    setOperationError(null);
    try {
      let customerPreview: CustomerPreviewScope | undefined;
      if (member.role === 'customer') {
        if (!currentOrg) throw new Error('Organisaatiota ei ole valittu.');
        const access = await fetchCustomerUserAccess(currentOrg.id, member.userId);
        customerPreview = {
          customerIds: access.map((item) => item.customerId),
          projectIds: access.flatMap((item) => item.projectIds),
          accessScope: 'selected_projects',
        };
      }
      startPreview({
        userId: member.userId,
        displayName,
        email: member.profile?.email ?? null,
        role: member.role,
        customerPreview,
      });
      navigate(homeForRole(member.role));
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Esikatselun käynnistys epäonnistui.');
    } finally {
      setStartingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Käyttäjänäkymän esikatselu</h1>
          <p className="mt-1 max-w-3xl text-body-sm leading-6 text-text-secondary">
            Tarkista navigaatio ja tietorajaukset käyttäjän todellisella roolilla.
          </p>
        </div>
        {isPreviewing && <Button variant="outline" onClick={stopPreview}>Lopeta esikatselu</Button>}
      </div>

      <Card className="border-indigo-200 bg-indigo-50/70">
        <CardContent className="flex items-start gap-3 p-5 text-sm text-indigo-900">
          <ShieldCheck size={20} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">Admin-istunto säilyy</p><p className="mt-1 leading-6">Esikatselu muuttaa vain käyttöliittymän aktiivisen roolin. Palvelimen RLS-rajat säilyvät käytössä.</p></div>
        </CardContent>
      </Card>

      {(error || operationError) && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{operationError ?? error}</div>}
      {previewTarget && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Esikatselussa: <strong>{previewTarget.displayName}</strong> · {ROLE_LABELS[previewTarget.role]}</div>}

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><Users size={20} /> {currentOrg?.name ?? 'Organisaatio'}</CardTitle>
          <div className="relative w-full sm:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae käyttäjää tai roolia" className="pl-9" /></div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && <div className="p-10 text-center text-sm text-slate-500">Ladataan käyttäjiä…</div>}
          {!loading && filteredMembers.map((member) => {
            const name = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
            return (
              <div key={member.userId} className="grid gap-4 border-b p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">{initials(name)}</div><div className="min-w-0"><p className="truncate font-semibold">{name}</p><p className="truncate text-sm text-slate-500">{member.profile?.email || 'Ei sähköpostia'}</p></div></div>
                <div className="rounded-xl border bg-slate-50 p-3"><Badge variant="outline" className={ROLE_BADGES[member.role]}>{ROLE_LABELS[member.role]}</Badge><p className="mt-2 text-xs leading-5 text-slate-600">{ROLE_HELP[member.role]}</p></div>
                <Button className="gap-2" disabled={Boolean(startingUserId)} onClick={() => void previewMember(member)}><Eye size={16} />{startingUserId === member.userId ? 'Avataan…' : 'Esikatsele'}</Button>
              </div>
            );
          })}
          {!loading && filteredMembers.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Käyttäjiä ei löytynyt.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
