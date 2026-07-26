import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  UserCircle2,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ROLE_LABELS, useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import type { OrganizationRole } from '@/lib/supabase/types';

const ROLE_BADGES: Record<OrganizationRole, string> = {
  admin: 'border-purple-200 bg-purple-50 text-purple-700',
  supervisor: 'border-orange-200 bg-orange-50 text-orange-700',
  worker: 'border-blue-200 bg-blue-50 text-blue-700',
};

const ROLE_HELP: Record<OrganizationRole, string> = {
  admin: 'Kaikki työnjohdon toiminnot sekä organisaation hallinta.',
  supervisor: 'Tuotannon, projektien, henkilöstön ja hyväksyntöjen näkymät.',
  worker: 'Omat työt, kirjaukset, korjaukset, lomakkeet ja viestit.',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export default function KayttajaEsikatselu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { members, loading, error } = useOrganizationAdmin();
  const { startPreview, isPreviewing, previewTarget, stopPreview } = useViewAs();
  const [search, setSearch] = useState('');

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return members;
    return members.filter((member) => {
      const searchable = [
        member.profile?.full_name,
        member.profile?.email,
        ROLE_LABELS[member.role],
      ].filter(Boolean).join(' ').toLocaleLowerCase('fi');
      return searchable.includes(query);
    });
  }, [members, search]);

  const previewMember = (member: (typeof members)[number]) => {
    const email = member.profile?.email ?? null;
    const displayName = member.profile?.full_name || email || 'Nimetön käyttäjä';
    startPreview({
      userId: member.userId,
      displayName,
      email,
      role: member.role,
    });
    navigate('/dashboard');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-hero text-text-primary">Käyttäjänäkymän esikatselu</h1>
          <p className="mt-1 max-w-3xl text-body-sm leading-6 text-text-secondary">
            Tarkista navigaatio, sivut ja käyttöoikeusrajat sellaisina kuin valittu organisaation jäsen ne näkee.
          </p>
        </div>
        {isPreviewing && (
          <Button variant="outline" className="min-h-11 w-full gap-2 sm:w-auto" onClick={stopPreview}>
            Lopeta nykyinen esikatselu
          </Button>
        )}
      </div>

      <Card className="border-indigo-200 bg-indigo-50/70">
        <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <MonitorSmartphone size={23} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-indigo-950">Turvallinen, vain lukemiseen tarkoitettu esikatselu</p>
            <p className="mt-1 text-sm leading-6 text-indigo-800">
              Kirjautunutta Supabase-käyttäjää ei vaihdeta. Sovellus vaihtaa käyttöliittymän roolin ja käyttäjän nimen, ja yhteisen tietokerroksen tallennukset estetään esikatselun ajaksi.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-800">
            <ShieldCheck size={17} /> Admin-istunto säilyy
          </div>
        </CardContent>
      </Card>

      {previewTarget && (
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center">
          <Eye size={18} className="flex-shrink-0" />
          <p className="min-w-0 flex-1">
            Nyt esikatsellaan käyttäjää <strong>{previewTarget.displayName}</strong> roolissa <strong>{ROLE_LABELS[previewTarget.role]}</strong>.
          </p>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => navigate('/dashboard')}>
            Palaa esikatseluun
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users size={19} className="text-primary" /> {currentOrg?.name ?? 'Organisaatio'}
            </CardTitle>
            <p className="mt-1 text-sm text-text-secondary">Valitse käyttäjä, jonka näkymän haluat tarkistaa.</p>
          </div>
          <div className="relative w-full lg:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hae nimellä, sähköpostilla tai roolilla"
              className="min-h-11 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div className="p-10 text-center text-sm text-text-secondary">Ladataan käyttäjiä…</div>
          )}

          {!loading && filteredMembers.map((member) => {
            const name = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
            const isSelf = member.userId === user?.id;
            const isSelected = previewTarget?.userId === member.userId;
            return (
              <div
                key={member.userId}
                className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                    {initials(name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-text-primary">{name}</p>
                      {isSelf && <Badge variant="secondary">Sinä</Badge>}
                      {isSelected && <Badge className="bg-emerald-600">Esikatselussa</Badge>}
                    </div>
                    {member.profile?.email && (
                      <p className="mt-1 truncate text-sm text-text-secondary">{member.profile.email}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Badge variant="outline" className={ROLE_BADGES[member.role]}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                  <p className="mt-2 text-xs leading-5 text-text-secondary">{ROLE_HELP[member.role]}</p>
                </div>

                <Button
                  className="min-h-11 w-full gap-2 lg:w-auto"
                  variant={isSelected ? 'outline' : 'default'}
                  onClick={() => previewMember(member)}
                >
                  {member.profile ? <Eye size={16} /> : <UserCircle2 size={16} />}
                  {isSelected ? 'Avaa uudelleen' : 'Esikatsele käyttäjänä'}
                </Button>
              </div>
            );
          })}

          {!loading && filteredMembers.length === 0 && (
            <div className="p-10 text-center">
              <Users size={40} className="mx-auto mb-3 text-text-muted" />
              <p className="font-semibold">Käyttäjiä ei löytynyt</p>
              <p className="mt-1 text-sm text-text-secondary">Muuta hakua tai tarkista organisaation jäsenet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
