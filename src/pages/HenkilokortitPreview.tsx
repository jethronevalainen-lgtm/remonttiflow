import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CreditCard,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  listAccessibleEmployeeCards,
  listSupervisorTeamMembers,
  type EmployeeCard,
} from '@/lib/supabase/workforceHr';
import { restrictEmployeeCardsForPreview } from '@/lib/workforcePreview';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function dateLabel(value?: string) {
  if (!value) return 'Ei määritetty';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function euro(value?: number) {
  if (value == null) return 'Ei määritetty';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value / 100);
}

function valueOrDash(value?: string | number | null) {
  return value == null || value === '' ? '—' : String(value);
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{valueOrDash(value)}</p>
    </div>
  );
}

export default function HenkilokortitPreview() {
  const { currentOrg } = useOrganization();
  const { effectiveRole, effectiveUserId } = useViewAs();
  const organizationId = currentOrg?.id;
  const [cards, setCards] = useState<EmployeeCard[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!organizationId || !effectiveRole || !effectiveUserId) {
        if (!cancelled) {
          setCards([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [allCards, assignments] = await Promise.all([
          listAccessibleEmployeeCards(organizationId),
          effectiveRole === 'supervisor'
            ? listSupervisorTeamMembers(organizationId)
            : Promise.resolve([]),
        ]);
        const visibleCards = restrictEmployeeCardsForPreview(
          allCards,
          assignments,
          effectiveRole,
          effectiveUserId,
        );

        if (!cancelled) {
          setCards(visibleCards);
          setSelectedEmployeeId((current) => (
            visibleCards.some((card) => card.employeeId === current)
              ? current
              : visibleCards[0]?.employeeId ?? ''
          ));
        }
      } catch (caught) {
        if (!cancelled) {
          setCards([]);
          setError(caught instanceof Error ? caught.message : 'Henkilötietojen haku epäonnistui.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [effectiveRole, effectiveUserId, organizationId]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.employeeId === selectedEmployeeId) ?? cards[0],
    [cards, selectedEmployeeId],
  );

  const title = effectiveRole === 'worker'
    ? 'Omat henkilöstö- ja palkkatiedot'
    : 'Oman tiimin henkilökortit';

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 size={28} className="animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1400px] space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              <ShieldCheck size={16} /> Roolin mukainen esikatselu
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Esikatselussa näytetään vain valitun käyttäjän oikeustasolle kuuluvat henkilötiedot.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs text-slate-400">Näkyviä henkilöitä</p>
            <p className="mt-1 text-2xl font-bold">{cards.length}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {!error && cards.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <LockKeyhole size={44} className="mx-auto mb-3 text-slate-300" />
          <h2 className="font-semibold text-slate-900">Henkilökorttia ei löytynyt</h2>
          <p className="mt-1 text-sm text-slate-500">
            Käyttäjää ei ole yhdistetty työntekijäkorttiin tai hänelle ei ole määritetty näkyvää HR-tiimiä.
          </p>
        </div>
      ) : selectedCard ? (
        <div className={`grid min-w-0 gap-6 ${cards.length > 1 ? 'xl:grid-cols-[320px_minmax(0,1fr)]' : ''}`}>
          {cards.length > 1 && (
            <Card className="h-fit overflow-hidden border-slate-200 shadow-sm xl:sticky xl:top-0">
              <CardContent className="p-0">
                {cards.map((card) => (
                  <button
                    key={card.employeeId}
                    type="button"
                    onClick={() => setSelectedEmployeeId(card.employeeId)}
                    className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition-colors ${selectedCard.employeeId === card.employeeId ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                      {initials(card.employeeName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-950">{card.employeeName}</p>
                      <p className="truncate text-sm text-slate-500">{card.employeeRole} · {card.department}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="min-w-0 space-y-5">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="flex flex-col gap-5 bg-gradient-to-r from-white to-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-orange-500 text-xl font-bold text-white">
                    {initials(selectedCard.employeeName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold text-slate-950">{selectedCard.employeeName}</h2>
                    <p className="mt-1 truncate text-sm text-slate-500">{selectedCard.employeeRole} · {selectedCard.department}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedCard.employeeStatus}</Badge>
                      <Badge variant="outline">{selectedCard.employmentType || 'Työsuhdemuoto puuttuu'}</Badge>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Voimassa oleva palkka</p>
                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {selectedCard.payType === 'Tuntipalkka'
                      ? `${euro(selectedCard.hourlyWageCents)} / h`
                      : euro(selectedCard.monthlySalaryCents)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{selectedCard.payType || 'Palkkatapaa ei määritetty'}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Viikkotyöaika', value: selectedCard.weeklyHours ? `${selectedCard.weeklyHours} h` : '—', icon: BriefcaseBusiness },
                { label: 'Työsuhde alkanut', value: dateLabel(selectedCard.startDate), icon: Building2 },
                { label: 'Työehtosopimus', value: selectedCard.collectiveAgreement || '—', icon: ShieldCheck },
                { label: 'Oma työnjohto', value: selectedCard.supervisorNames.join(', ') || '—', icon: UsersRound },
              ].map((item) => (
                <Card key={item.label} className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <item.icon size={17} className="shrink-0 text-orange-600" />
                    </div>
                    <p className="mt-2 break-words font-semibold text-slate-900">{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="employment">
              <TabsList className="h-auto w-full flex-wrap justify-start rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="employment">Työsuhde</TabsTrigger>
                <TabsTrigger value="compensation">Palkka ja lisät</TabsTrigger>
                <TabsTrigger value="tax">Pankki ja verotus</TabsTrigger>
                <TabsTrigger value="contact">Yhteystiedot</TabsTrigger>
              </TabsList>

              <TabsContent value="employment" className="mt-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Työsuhdemuoto" value={selectedCard.employmentType} />
                    <Detail label="Työsuhteen alkupäivä" value={dateLabel(selectedCard.startDate)} />
                    <Detail label="Ammattiliitto" value={selectedCard.unionName} />
                    <Detail label="Työterveyspalvelu" value={selectedCard.occupationalHealthProvider} />
                    <Detail label="Työsuhteen huomautukset" value={selectedCard.employmentNotes} />
                    <Detail label="Palkanlaskennan huomautukset" value={selectedCard.payrollNotes} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compensation" className="mt-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Palkkatapa" value={selectedCard.payType} />
                    <Detail label="Kuukausipalkka" value={selectedCard.monthlySalaryCents == null ? undefined : euro(selectedCard.monthlySalaryCents)} />
                    <Detail label="Tuntipalkka" value={selectedCard.hourlyWageCents == null ? undefined : `${euro(selectedCard.hourlyWageCents)} / h`} />
                    <Detail label="Viikkotyöaika" value={selectedCard.weeklyHours ? `${selectedCard.weeklyHours} h` : undefined} />
                    <Detail label="Palkanmaksukausi" value={selectedCard.payPeriod} />
                    <Detail label="Ehtojen voimassaolo" value={`${dateLabel(selectedCard.compensationValidFrom)} – ${selectedCard.compensationValidTo ? dateLabel(selectedCard.compensationValidTo) : 'toistaiseksi'}`} />
                    <Detail label="Iltalisä" value={selectedCard.eveningAllowanceCents == null ? undefined : `${euro(selectedCard.eveningAllowanceCents)} / h`} />
                    <Detail label="Yölisä" value={selectedCard.nightAllowanceCents == null ? undefined : `${euro(selectedCard.nightAllowanceCents)} / h`} />
                    <Detail label="Lauantailisä" value={selectedCard.saturdayAllowanceCents == null ? undefined : `${euro(selectedCard.saturdayAllowanceCents)} / h`} />
                    <Detail label="Sunnuntailisä" value={selectedCard.sundayAllowanceCents == null ? undefined : `${euro(selectedCard.sundayAllowanceCents)} / h`} />
                    <Detail label="Päiväraha" value={selectedCard.dailyAllowanceCents == null ? undefined : euro(selectedCard.dailyAllowanceCents)} />
                    <Detail label="Ateriakorvaus" value={selectedCard.mealAllowanceCents == null ? undefined : euro(selectedCard.mealAllowanceCents)} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tax" className="mt-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="IBAN" value={selectedCard.iban} />
                    <Detail label="BIC" value={selectedCard.bic} />
                    <Detail label="Veroprosentti" value={selectedCard.taxPercent == null ? undefined : `${selectedCard.taxPercent} %`} />
                    <Detail label="Lisäprosentti" value={selectedCard.additionalTaxPercent == null ? undefined : `${selectedCard.additionalTaxPercent} %`} />
                    <Detail label="Tuloraja" value={selectedCard.taxIncomeLimitCents == null ? undefined : euro(selectedCard.taxIncomeLimitCents)} />
                    <Detail label="Verokortti voimassa" value={`${dateLabel(selectedCard.taxCardValidFrom)} – ${selectedCard.taxCardValidTo ? dateLabel(selectedCard.taxCardValidTo) : 'toistaiseksi'}`} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact" className="mt-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Sähköposti" value={selectedCard.email} />
                    <Detail label="Puhelin" value={selectedCard.phone} />
                    <Detail label="Syntymäaika" value={dateLabel(selectedCard.dateOfBirth)} />
                    <Detail label="Henkilötunnuksen loppuosa" value={selectedCard.personalIdentityCodeLast4} />
                    <Detail label="Katuosoite" value={selectedCard.streetAddress} />
                    <Detail label="Postinumero ja kaupunki" value={[selectedCard.postalCode, selectedCard.city].filter(Boolean).join(' ')} />
                    <Detail label="Maa" value={selectedCard.country} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
              <UserRound size={18} className="shrink-0" />
              Tämä näkymä on vain luku -tilassa ja käyttää esikatselukäyttäjän henkilöstörajausta.
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
