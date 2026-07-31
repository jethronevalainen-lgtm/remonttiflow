import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function dateLabel(value?: string) {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function euro(value?: number) {
  if (value == null) return '—';
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value / 100);
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value == null || value === '' ? '—' : String(value);
  return (
    <div className="flex h-full min-h-[5.75rem] flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-auto break-words pt-2 text-sm font-semibold leading-snug text-slate-900">{displayValue}</p>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BriefcaseBusiness;
}) {
  return (
    <Card className="min-h-[7.5rem] border-slate-200/80 shadow-sm">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex min-h-8 items-start justify-between gap-3">
          <p className="break-words text-xs font-medium text-slate-500">{label}</p>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Icon size={16} />
          </span>
        </div>
        <p className="mt-auto break-words pt-3 text-base font-semibold leading-snug text-slate-900">{value}</p>
      </CardContent>
    </Card>
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

  const summaryMetrics = selectedCard
    ? [
        {
          label: 'Viikkotyöaika',
          value: selectedCard.weeklyHours ? `${selectedCard.weeklyHours} h` : '—',
          icon: BriefcaseBusiness,
        },
        {
          label: 'Työsuhde alkanut',
          value: dateLabel(selectedCard.startDate),
          icon: Building2,
        },
        {
          label: 'Työehtosopimus',
          value: selectedCard.collectiveAgreement || '—',
          icon: ShieldCheck,
        },
        {
          label: 'Oma työnjohto',
          value: selectedCard.supervisorNames.join(', ') || '—',
          icon: UsersRound,
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 size={28} className="animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mx-auto max-w-[1400px] space-y-6"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 18%, rgba(251,146,60,0.22), transparent 42%), radial-gradient(circle at 88% 12%, rgba(148,163,184,0.18), transparent 36%)',
          }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-stretch sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              <ShieldCheck size={16} /> Roolin mukainen esikatselu
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm text-slate-300">Vain esikatseltavan käyttäjän oikeuksiin kuuluvat henkilökortit näytetään.</p>
          </div>
          <div className="flex min-h-[5.5rem] min-w-[10rem] flex-col rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs font-medium text-slate-400">Näkyviä henkilöitä</p>
            <p className="mt-auto pt-2 text-2xl font-bold">{cards.length}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {!error && !selectedCard ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <LockKeyhole size={44} className="mx-auto mb-3 text-slate-300" />
          <h2 className="font-semibold text-slate-900">Henkilökorttia ei löytynyt</h2>
          <p className="mt-1 text-sm text-slate-500">Käyttäjää ei ole yhdistetty työntekijäkorttiin tai näkyvää HR-tiimiä ei ole määritetty.</p>
        </div>
      ) : selectedCard ? (
        <div className={`grid min-w-0 items-start gap-6 ${cards.length > 1 ? 'xl:grid-cols-[300px_minmax(0,1fr)]' : ''}`}>
          {cards.length > 1 && (
            <Card className="h-fit overflow-hidden border-slate-200/80 shadow-sm xl:sticky xl:top-4">
              <CardContent className="p-0">
                {cards.map((card) => {
                  const selected = selectedCard.employeeId === card.employeeId;
                  return (
                    <button
                      key={card.employeeId}
                      type="button"
                      onClick={() => setSelectedEmployeeId(card.employeeId)}
                      className={`flex min-h-[5.25rem] w-full items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition-colors ${
                        selected
                          ? 'border-l-4 border-l-orange-500 bg-orange-50/90'
                          : 'border-l-4 border-l-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                        {initials(card.employeeName)}
                      </div>
                      <div className="min-w-0 break-words">
                        <p className="font-semibold">{card.employeeName}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{card.employeeRole} · {card.department}</p>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <motion.div
            key={selectedCard.employeeId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="space-y-5"
          >
            <Card className="overflow-hidden border-slate-200/80 shadow-sm">
              <CardContent className="grid gap-5 bg-gradient-to-br from-white via-white to-slate-50 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)] sm:items-stretch sm:p-6">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-orange-500 text-xl font-bold text-white shadow-sm shadow-orange-500/25">
                    {initials(selectedCard.employeeName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-bold tracking-tight text-slate-950">{selectedCard.employeeName}</h2>
                    <p className="mt-1 break-words text-sm text-slate-500">{selectedCard.employeeRole} · {selectedCard.department}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedCard.employeeStatus}</Badge>
                      <Badge variant="outline">{selectedCard.employmentType || 'Työsuhdemuoto puuttuu'}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex min-h-[6.5rem] flex-col rounded-2xl bg-slate-950 px-5 py-4 text-white">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Voimassa oleva palkka</p>
                  <p className="mt-auto break-words pt-3 text-xl font-bold leading-snug">
                    {selectedCard.payType === 'Tuntipalkka'
                      ? `${euro(selectedCard.hourlyWageCents)} / h`
                      : euro(selectedCard.monthlySalaryCents)}
                  </p>
                  <p className="mt-1 break-words text-xs text-slate-400">
                    {selectedCard.payType || 'Palkkatapaa ei määritetty'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryMetrics.map((item) => (
                <SummaryMetric key={item.label} label={item.label} value={item.value} icon={item.icon} />
              ))}
            </div>

            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="grid auto-rows-fr items-stretch gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Sähköposti" value={selectedCard.email} />
                <Detail label="Puhelin" value={selectedCard.phone} />
                <Detail label="Työsuhdemuoto" value={selectedCard.employmentType} />
                <Detail label="Ammattiliitto" value={selectedCard.unionName} />
                <Detail label="IBAN" value={selectedCard.iban} />
                <Detail label="Veroprosentti" value={selectedCard.taxPercent == null ? undefined : `${selectedCard.taxPercent} %`} />
                <Detail label="Katuosoite" value={selectedCard.streetAddress} />
                <Detail label="Postinumero ja kaupunki" value={[selectedCard.postalCode, selectedCard.city].filter(Boolean).join(' ')} />
                <Detail label="Maa" value={selectedCard.country} />
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
              <UserRound size={18} className="shrink-0" /> Tämä näkymä on vain luku -tilassa ja käyttää esikatselukäyttäjän henkilöstörajausta.
            </div>
          </motion.div>
        </div>
      ) : null}
    </motion.div>
  );
}
