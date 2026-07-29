import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  ListChecks,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ROLE_LABELS, homeForRole } from '@/contexts/AuthContext';
import {
  CURRENT_ORG_STORAGE_KEY,
  useOrganization,
} from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import {
  demoRoleOrder,
  isDemoAccountEmail,
  isDemoOrganizationBusinessId,
  provisionDemoEnvironment,
  readDemoSourceOrganization,
  rememberDemoSourceOrganization,
} from '@/lib/supabase/demoEnvironment';
import type { OrganizationRole } from '@/lib/supabase/types';

type DemoRole = Exclude<OrganizationRole, 'admin'>;

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

const DEMO_ROLE_GUIDES: Record<DemoRole, {
  summary: string;
  checks: string[];
  boundary: string;
}> = {
  supervisor: {
    summary: 'Työnjohdon koko operatiivinen näkymä sekä henkilöstö- ja hyväksyntätoiminnot.',
    checks: ['Päivän poikkeamat ja myöhässä olevat työt', 'Projektit, resurssit ja aikataulut', 'Tuntien hyväksyntä ja henkilöstötoiminnot'],
    boundary: 'Organisaation järjestelmäasetukset kuuluvat vain ylläpitäjälle.',
  },
  project_coordinator: {
    summary: 'Projektien operatiivinen hallinta ilman työntekijöiden arkaluonteisia tietoja.',
    checks: ['Projektien tilanne ja aikataulut', 'Työmääräysten luonti ja kohdistus', 'Projektikohtainen työaika ja viestintä'],
    boundary: 'Henkilöstö-, palkka-, matka- ja poissaolotietojen ei pidä näkyä.',
  },
  worker: {
    summary: 'Työmaalla käytettävä oma työtila, jossa näkyvät vain käyttäjälle osoitetut asiat.',
    checks: ['Omat työmääräykset ja aloitus', 'Omat tuntikirjaukset ja korjauspyynnöt', 'Turvallisuushavainnot, puutteet ja viestit'],
    boundary: 'Muiden työntekijöiden tiedot, kaikki projektit ja taloustiedot eivät saa näkyä.',
  },
  customer: {
    summary: 'Tilaajaportaali, jossa näkyvät vain tilaajalle jaetut projektit ja aineistot.',
    checks: ['Omat projektit ja niiden tilanne', 'Jaetut dokumentit ja päätettävät muutokset', 'Tilaajaviestit, tiedotteet ja turvallisuushavainto'],
    boundary: 'Sisäiset työmääräykset, kustannukset ja henkilöstötiedot eivät saa näkyä.',
  },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export default function KayttajaEsikatseluV2() {
  const navigate = useNavigate();
  const { organizations, currentOrg } = useOrganization();
  const { members, loading, error } = useOrganizationAdmin();
  const {
    startPreview,
    stopPreview,
    previewTarget,
    isImpersonating,
    switching,
  } = useViewAs();
  const [search, setSearch] = useState('');
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);

  const isDemoOrganization = isDemoOrganizationBusinessId(currentOrg?.business_id);
  const rememberedSourceOrganizationId = readDemoSourceOrganization();
  const sourceOrganization = organizations.find((organization) => organization.id === rememberedSourceOrganizationId)
    ?? organizations.find((organization) => !isDemoOrganizationBusinessId(organization.business_id));
  const demoMembers = useMemo(
    () => members
      .filter((member) => isDemoAccountEmail(member.profile?.email) && member.role !== 'admin')
      .sort((a, b) => demoRoleOrder(a.role) - demoRoleOrder(b.role)),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return members;
    return members.filter((member) => [
      member.profile?.full_name,
      member.profile?.email,
      ROLE_LABELS[member.role],
    ].filter(Boolean).join(' ').toLocaleLowerCase('fi').includes(query));
  }, [members, search]);

  const actAsMember = async (member: (typeof members)[number]) => {
    const displayName = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
    setStartingUserId(member.userId);
    setOperationError(null);
    try {
      await startPreview({
        userId: member.userId,
        displayName,
        email: member.profile?.email ?? null,
        role: member.role,
      });
      navigate(homeForRole(member.role), { replace: true });
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Käyttäjänä toimimisen käynnistys epäonnistui.');
    } finally {
      setStartingUserId(null);
    }
  };

  const prepareDemoEnvironment = async () => {
    if (!currentOrg) return;
    const sourceId = isDemoOrganization
      ? sourceOrganization?.id ?? currentOrg.id
      : currentOrg.id;
    if (!isDemoOrganization) rememberDemoSourceOrganization(currentOrg.id);

    setProvisioning(true);
    setOperationError(null);
    try {
      const result = await provisionDemoEnvironment(sourceId);
      window.localStorage.setItem(CURRENT_ORG_STORAGE_KEY, result.organizationId);
      window.location.reload();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Demoympäristön luonti epäonnistui.');
      setProvisioning(false);
    }
  };

  const returnToSourceOrganization = () => {
    if (!sourceOrganization) return;
    window.localStorage.setItem(CURRENT_ORG_STORAGE_KEY, sourceOrganization.id);
    window.location.reload();
  };

  const returnToAdministrator = async () => {
    setOperationError(null);
    try {
      await stopPreview();
      navigate('/kayttajaesikatselu', { replace: true });
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Admin-istuntoon palaaminen epäonnistui.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Roolinäkymien tarkistus</h1>
          <p className="mt-1 max-w-3xl text-body-sm leading-6 text-text-secondary">
            Vertaa työnjohdon, projektikoordinaattorin, työntekijän ja tilaajan näkymiä oikeilla käyttöoikeuksilla.
          </p>
        </div>
        {isImpersonating && (
          <Button variant="outline" disabled={switching} onClick={() => void returnToAdministrator()}>
            Palaa roolivalintaan
          </Button>
        )}
      </div>

      <Card className={isDemoOrganization ? 'border-emerald-300 bg-emerald-50/60' : 'border-indigo-300 bg-indigo-50/60'}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isDemoOrganization ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {isDemoOrganization ? <CheckCircle2 size={22} /> : <Sparkles size={22} />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-950">Eristetty roolidemo</h2>
                  {isDemoOrganization && <Badge className="border-0 bg-emerald-600 text-white">DEMO</Badge>}
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
                  {isDemoOrganization
                    ? 'Demoprojektit, työmääräykset ja kirjaukset ovat erillään oikean yrityksen tiedoista. Voit kokeilla toimintoja turvallisesti.'
                    : 'Luo oma demo-organisaatio, neljä roolitiliä ja valmiit esimerkkitilanteet yhdellä painikkeella.'}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Demotileillä ei ole jaettavia salasanoja. Roolit avataan suojatulla käyttäjänä toimimisen istunnolla.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              {isDemoOrganization && sourceOrganization && (
                <Button variant="outline" className="gap-2" onClick={returnToSourceOrganization}>
                  <ArrowLeft size={16} /> Palaa: {sourceOrganization.name}
                </Button>
              )}
              <Button
                className="gap-2"
                variant={isDemoOrganization ? 'outline' : 'default'}
                disabled={provisioning || switching}
                onClick={() => void prepareDemoEnvironment()}
              >
                {isDemoOrganization ? <RefreshCw size={16} /> : <Building2 size={16} />}
                {provisioning
                  ? 'Valmistellaan…'
                  : isDemoOrganization
                    ? 'Palauta esimerkkikohteet lähtötilaan'
                    : 'Luo ja avaa demoympäristö'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isDemoOrganization && (
        <Card className="border-slate-200">
          <CardContent className="grid gap-4 p-5 md:grid-cols-3">
            {[
              ['1', 'Valitse rooli', 'Avaa yksi alla olevista neljästä roolinäkymästä.'],
              ['2', 'Tarkista ydintehtävät', 'Käy kortin tarkistuslista läpi sekä puhelimella että tietokoneella.'],
              ['3', 'Palaa ja vertaa', 'Yläpalkin Palaa roolivalintaan -painike palauttaa tähän näkymään.'],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-3 rounded-xl border bg-white p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">{number}</div>
                <div><p className="font-semibold text-slate-950">{title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{description}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isDemoOrganization && demoMembers.length > 0 && (
        <section className="space-y-3" aria-labelledby="demo-role-heading">
          <div>
            <h2 id="demo-role-heading" className="text-xl font-bold text-slate-950">Avaa roolin näkymä</h2>
            <p className="mt-1 text-sm text-slate-600">Kortti kertoo samalla, mitä kyseisellä roolilla pitää näkyä ja mitä ei.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {demoMembers.map((member) => {
              const name = member.profile?.full_name || member.profile?.email || ROLE_LABELS[member.role];
              const isCurrentTarget = isImpersonating && member.userId === previewTarget?.userId;
              const role = member.role as DemoRole;
              const guide = DEMO_ROLE_GUIDES[role];
              return (
                <Card key={member.userId} className="overflow-hidden border-slate-200 shadow-sm">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">{initials(name)}</div>
                      <Badge variant="outline" className={ROLE_BADGES[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                    </div>
                    <h3 className="mt-4 font-bold text-slate-950">{name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
                    <div className="mt-4 flex-1 rounded-xl border bg-slate-50 p-3">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><ListChecks size={14} /> Tarkista</p>
                      <ul className="mt-2 space-y-2">
                        {guide.checks.map((item) => (
                          <li key={item} className="flex gap-2 text-xs leading-5 text-slate-700"><Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />{item}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-3 flex gap-2 text-xs leading-5 text-slate-600"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-indigo-600" />{guide.boundary}</p>
                    <Button
                      className="mt-5 w-full gap-2"
                      disabled={Boolean(startingUserId) || isCurrentTarget}
                      aria-label={`Toimi käyttäjänä ${name}`}
                      onClick={() => void actAsMember(member)}
                    >
                      <Eye size={16} />
                      {startingUserId === member.userId ? 'Avataan…' : 'Avaa näkymä'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <Card className="border-amber-300 bg-amber-50/80">
        <CardContent className="flex items-start gap-3 p-5 text-sm text-amber-950">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">Esikatselu käyttää oikeita käyttöoikeuksia</p>
            <p className="mt-1 leading-6">
              Käyttäjänä tehdyt kirjaukset ja muutokset tallentuvat valittuun organisaatioon kyseisen roolin oikeuksilla. Käytä kokeiluihin demoympäristöä, älä oikeita käyttäjiä.
            </p>
          </div>
        </CardContent>
      </Card>

      {!isDemoOrganization && (
        <Card className="overflow-hidden">
          <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users size={20} /> {currentOrg?.name ?? 'Organisaatio'}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Todelliset käyttäjät näkyvät tässä vain ylläpidon ja ongelmanratkaisun tarpeisiin.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae käyttäjää tai roolia" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <div className="p-10 text-center text-sm text-slate-500">Ladataan käyttäjiä…</div>}
            {!loading && filteredMembers.map((member) => {
              const name = member.profile?.full_name || member.profile?.email || 'Nimetön käyttäjä';
              const email = member.profile?.email || '';
              const isCurrentTarget = isImpersonating && member.userId === previewTarget?.userId;
              return (
                <div
                  key={member.userId}
                  data-impersonation-email={email}
                  className="grid gap-4 border-b p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">{initials(name)}</div>
                    <div className="min-w-0 break-words"><p className="font-semibold">{name}</p><p className="text-sm text-slate-500">{email || 'Ei sähköpostia'}</p></div>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <Badge variant="outline" className={ROLE_BADGES[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{ROLE_HELP[member.role]}</p>
                  </div>
                  <Button
                    className="gap-2"
                    disabled={Boolean(startingUserId) || isCurrentTarget || member.role === 'admin'}
                    aria-label={`Toimi käyttäjänä ${name}`}
                    onClick={() => void actAsMember(member)}
                  >
                    <LogIn size={16} />
                    {member.role === 'admin'
                      ? 'Nykyinen ylläpitäjä'
                      : startingUserId === member.userId
                        ? 'Avataan…'
                        : 'Toimi käyttäjänä'}
                  </Button>
                </div>
              );
            })}
            {!loading && filteredMembers.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Käyttäjiä ei löytynyt.</div>}
          </CardContent>
        </Card>
      )}

      {(error || operationError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {operationError ?? error}
        </div>
      )}
    </div>
  );
}
