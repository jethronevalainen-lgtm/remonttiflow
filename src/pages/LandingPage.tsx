import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FolderKanban,
  HardHat,
  LayoutDashboard,
  MessageSquareText,
  PackageCheck,
  Route,
  ShieldCheck,
  Smartphone,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';

interface Capability {
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
}

const capabilities: Capability[] = [
  {
    title: 'Projektit ja työkokonaisuudet',
    description:
      'Rakenna huoneistot, kohteet ja työvaiheet kerralla. Kohdista tekijät, aikataulut ja työselosteet ilman rinnakkaisia taulukoita.',
    detail: 'Kohteet · vaiheet · dokumentit · yhteystiedot',
    icon: FolderKanban,
    tone: 'bg-orange-50 text-orange-700',
  },
  {
    title: 'Työmääräykset ja resurssikalenteri',
    description:
      'Jaa avoimet työt asentajille, tarkastele oman tiimin kuormaa ja siirry kalenterista suoraan työmääräyksen tietoihin.',
    detail: 'Työnjako · tiimit · työvuorot · riippuvuudet',
    icon: CalendarRange,
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    title: 'Työaika, matkat ja palkka-aineisto',
    description:
      'Kerää tunnit, tauot, lisät ja matkakulut siellä missä työ tehdään. Vie tarkistettu aineisto hallinnolle yhtenä kokonaisuutena.',
    detail: 'Tunnit · hyväksyntä · matkakulut · palkkakaudet',
    icon: Clock3,
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    title: 'Laatu, turvallisuus ja luovutus',
    description:
      'Ohjaa tarkastukset, kuittaukset, turvallisuushavainnot ja luovutuksen dokumentointi samaan projektin tapahtumaketjuun.',
    detail: 'Tarkastukset · havainnot · kuittaukset · lomakkeet',
    icon: ShieldCheck,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'Tarjoukset ja määrälaskenta',
    description:
      'Kokoa määrät ja laskentavaiheet tarjoukseksi. Seuraa tilausarvoa, kustannuksia ja muutostöitä projektin toteutukseen asti.',
    detail: 'Määrät · tarjousversiot · kustannukset · muutostyöt',
    icon: CircleDollarSign,
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Tilaajayhteistyö ja viestintä',
    description:
      'Anna tilaajalle oma näkymä projekteihin, työpyyntöihin ja dokumentteihin. Pidä projektikeskustelut oikeiden vastuuhenkilöiden näkyvillä.',
    detail: 'Tilaajaportaali · työpyynnöt · viestit · tiedostot',
    icon: MessageSquareText,
    tone: 'bg-sky-50 text-sky-700',
  },
];

const lifecycle = [
  {
    number: '01',
    title: 'Laske ja tarjoa',
    description: 'Määrät, laskentavaiheet ja tarjous muodostavat kaupallisen lähtökohdan.',
    icon: BarChart3,
  },
  {
    number: '02',
    title: 'Rakenna projekti',
    description: 'Kohteet, työvaiheet, tekijät, yhteystiedot ja dokumentit yhteen.',
    icon: FolderKanban,
  },
  {
    number: '03',
    title: 'Aikatauluta ja jaa',
    description: 'Työmääräykset ja resurssit näkyvät työnjohdon yhteisessä kalenterissa.',
    icon: Route,
  },
  {
    number: '04',
    title: 'Toteuta ja dokumentoi',
    description: 'Tekijät kirjaavat työn, tunnit, havainnot ja kuittaukset mobiilisti.',
    icon: Smartphone,
  },
  {
    number: '05',
    title: 'Seuraa ja luovuta',
    description: 'Johto ja tilaaja näkevät etenemisen, kustannukset ja valmiin dokumentaation.',
    icon: FileCheck2,
  },
];

const roles = [
  {
    title: 'Työnjohto',
    description: 'Projektit, resurssit, aikataulu, poikkeamat ja hyväksynnät yhdessä näkymässä.',
    icon: HardHat,
  },
  {
    title: 'Projektikoordinaattori',
    description: 'Työmääräykset, yhteystiedot, asiakirjat ja tilaajayhteistyö järjestyksessä.',
    icon: ClipboardCheck,
  },
  {
    title: 'Työntekijä',
    description: 'Omat työt, työaika, ohjeet, tarkastukset ja turvallisuushavainnot mobiilissa.',
    icon: Wrench,
  },
  {
    title: 'Hallinto ja johto',
    description: 'Henkilöstö, palkka-aineisto, kustannukset, raportit ja organisaation hallinta.',
    icon: Building2,
  },
  {
    title: 'Tilaaja',
    description: 'Omat projektit, työpyynnöt, päätökset, viestit ja jaetut dokumentit.',
    icon: UsersRound,
  },
];

function scrollToProduct() {
  document.getElementById('tuote')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ProductPreview() {
  const workRows = [
    { target: 'A12 · Keittiö', phase: 'Kalusteasennus', person: 'Jussi H.', width: '72%' },
    { target: 'A14 · Kylpyhuone', phase: 'Vedeneristys', person: 'Emma S.', width: '48%' },
    { target: 'B03 · Keittiö', phase: 'Sähkötyöt', person: 'Aleksi R.', width: '30%' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-orange-500/30 via-sky-500/10 to-transparent blur-3xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-900 p-2 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <p className="text-xs font-semibold text-slate-300 break-words">Projektin työtila · Suipkuja PTS</p>
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
            Ajantasainen
          </span>
        </div>

        <div className="rounded-b-[1.25rem] bg-slate-100 p-3 text-slate-950 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {['Tilannekuva', 'Työt', 'Aikataulu', 'Dokumentit'].map((item, index) => (
              <span
                key={item}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold',
                  index === 0 ? 'bg-slate-950 text-white' : 'bg-white text-slate-600',
                )}
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Työmääräykset', value: '45', note: '12 työn alla' },
              { label: 'Eteneminen', value: '68 %', note: 'valmiista töistä' },
              { label: 'Tänään paikalla', value: '6', note: '2 tiimiä' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 break-words">{item.label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight">{item.value}</p>
                <p className="mt-1 text-[11px] text-slate-500 break-words">{item.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">Huoneistojen työvaiheet</p>
                  <p className="mt-0.5 text-xs text-slate-500">Kohdekohtainen eteneminen ja tekijät</p>
                </div>
                <CalendarRange className="h-5 w-5 text-orange-500" aria-hidden="true" />
              </div>
              <div className="mt-3 space-y-2.5">
                {workRows.map((row) => (
                  <div key={row.target} className="rounded-lg bg-slate-50 p-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <div>
                        <p className="text-xs font-bold break-words">{row.target}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 break-words">
                          {row.phase} · {row.person}
                        </p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 flex-none text-emerald-500" aria-hidden="true" />
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: row.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl bg-slate-950 p-3 text-white shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Huomioitavaa
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold break-words">2 tarkastusta erääntyy</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400 break-words">Vastuuhenkilöt on ilmoitettu.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold break-words">1 uusi projektiviesti</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400 break-words">Työnjohto sai ilmoituksen.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                  Tilaajalle
                </p>
                <p className="mt-2 text-xs font-semibold text-emerald-950 break-words">
                  Viikkoraportti ja dokumentit jaettu
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#07111f] text-white">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Siirry sisältöön
      </a>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07111f]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label={`${BRAND.name} etusivu`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-sm font-black tracking-tight shadow-lg shadow-orange-500/20">
              {BRAND.shortName}
            </span>
            <span>
              <span className="block text-base font-bold leading-none tracking-tight">{BRAND.name}</span>
              <span className="mt-1 block text-xs leading-tight text-slate-400">{BRAND.tagline}</span>
            </span>
          </Link>

          <nav aria-label="Etusivun navigaatio" className="order-3 flex w-full flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300 md:order-2 md:w-auto">
            <a href="#tuote" className="transition hover:text-white">Ratkaisu</a>
            <a href="#tyonkulku" className="transition hover:text-white">Työnkulku</a>
            <a href="#roolit" className="transition hover:text-white">Roolit</a>
          </nav>

          <Button asChild className="order-2 h-10 bg-orange-500 px-4 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400 md:order-3">
            <Link to="/login">
              Kirjaudu sisään
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <main id="main-content">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(249,115,22,0.22),transparent_31%),radial-gradient(circle_at_82%_20%,rgba(14,165,233,0.17),transparent_30%),linear-gradient(180deg,#07111f_0%,#0b1728_100%)]" />
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1.5 text-sm font-semibold text-orange-200">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Rakennus- ja remonttiliikkeen yhteinen työtila
              </div>

              <h1 className="mt-6 text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.04]">
                Johda koko urakka tarjouksesta luovutukseen.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
                {BRAND.name} yhdistää projektit, huoneistokohtaiset työt, resurssit, työajan,
                laadun, kustannukset ja tilaajayhteistyön yhdeksi ajantasaiseksi toimintamalliksi.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-orange-500 px-6 text-base text-white shadow-xl shadow-orange-500/25 hover:bg-orange-400">
                  <Link to="/login">
                    Avaa oma työtila
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={scrollToProduct}
                  className="h-12 border-white/20 bg-white/5 px-6 text-base text-white shadow-none hover:bg-white/10 hover:text-white"
                >
                  Katso mitä voit tehdä
                </Button>
              </div>

              <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {['Työnjohto ja kenttä samassa tiedossa', 'Roolikohtaiset työtilat', 'Mobiiliin sopivat työnkulut'].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="break-words">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.035]">
          <div className="mx-auto grid w-full max-w-7xl gap-px px-4 py-5 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              { value: '5 roolia', label: 'jokaiselle oma tarkoituksenmukainen näkymä' },
              { value: '1 tietoketju', label: 'tarjouksesta työmaalle ja palkka-aineistoon' },
              { value: 'Ajantasainen', label: 'tilannekuva johdolle, tekijälle ja tilaajalle' },
            ].map((item) => (
              <div key={item.value} className="border-white/10 px-4 py-3 sm:border-l first:sm:border-l-0">
                <p className="text-xl font-black text-white break-words">{item.value}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400 break-words">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="tuote" className="scroll-mt-28 bg-slate-50 py-16 text-slate-950 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Nykyinen VaKantti</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Vähemmän järjestelmien väliin jäävää työtä.
                </h2>
              </div>
              <p className="max-w-3xl text-lg leading-8 text-slate-600 break-words">
                Suunnitelma ei jää erilleen toteutuksesta. Työmääräys yhdistyy kalenteriin,
                tekijään, tunteihin, tarkastuksiin ja projektin etenemään — ja tilaaja saa näkyvyyden
                hänelle kuuluviin asioihin.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {capabilities.map((capability) => (
                <article key={capability.title} className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-xl hover:shadow-slate-200/70 sm:p-6">
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl', capability.tone)}>
                    <capability.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight break-words">{capability.title}</h3>
                  <p className="mt-3 flex-1 leading-7 text-slate-600 break-words">{capability.description}</p>
                  <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-wide text-slate-500 break-words">
                    {capability.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="tyonkulku" className="scroll-mt-28 bg-[#07111f] py-16 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-300">Sama tieto kulkee mukana</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Yksi työnkulku koko projektin elinkaarelle.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-300 break-words">
                Jokainen vaihe jatkaa siitä, mihin edellinen jäi. Tietoa ei tarvitse rakentaa
                uudelleen tarjouksen, työnjohdon, työmaan ja raportoinnin välillä.
              </p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-5">
              {lifecycle.map((item, index) => (
                <article key={item.number} className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black tracking-[0.16em] text-orange-300">{item.number}</span>
                    <item.icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold break-words">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400 break-words">{item.description}</p>
                  {index < lifecycle.length - 1 && (
                    <span className="mt-5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15 text-orange-300 md:absolute md:-right-5 md:top-1/2 md:z-10 md:mt-0 md:-translate-y-1/2">
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="roolit" className="scroll-mt-28 bg-white py-16 text-slate-950 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Oikea työtila jokaiselle</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Kaikki eivät tarvitse kaikkea. Kaikki tarvitsevat oikean tiedon.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600 break-words">
                Roolipohjaiset näkymät pitävät päivittäisen työn selkeänä ja organisaation tiedot
                hallittuina.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {roles.map((role) => (
                <article key={role.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                    <role.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold break-words">{role.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 break-words">{role.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 grid gap-4 rounded-3xl bg-slate-100 p-5 sm:grid-cols-3 sm:p-7">
              {[
                {
                  title: 'Organisaatiokohtaiset tiedot',
                  description: 'Käyttöoikeudet ja tietokantarivit rajataan organisaation ja roolin mukaan.',
                  icon: ShieldCheck,
                },
                {
                  title: 'Työmaakäyttöön suunniteltu',
                  description: 'Keskeiset työntekijän kirjaukset ja työlistat toimivat selkeästi mobiilissa.',
                  icon: Smartphone,
                },
                {
                  title: 'Hallittu henkilöstö ja kalusto',
                  description: 'Henkilöt, tiimit, pätevyydet, kalusto ja vastuuhenkilöt löytyvät samasta paikasta.',
                  icon: PackageCheck,
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl bg-white p-4">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-bold break-words">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 break-words">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-16 text-slate-950 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative isolate overflow-hidden rounded-3xl bg-[#07111f] px-5 py-12 text-center text-white shadow-2xl shadow-slate-300 sm:px-10 sm:py-16">
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.23),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.15),transparent_30%)]" />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-lg font-black shadow-lg shadow-orange-500/25">
                {BRAND.shortName}
              </div>
              <h2 className="mx-auto mt-6 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">
                Kun projekti muuttuu, yhteinen tilannekuva muuttuu mukana.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300 break-words">
                Kirjaudu organisaatiosi työtilaan ja jatka siitä, missä työsi nyt on.
                Käyttäjätilit ja käyttöoikeudet hallinnoi organisaation ylläpitäjä.
              </p>
              <Button asChild size="lg" className="mt-8 h-12 bg-orange-500 px-7 text-base text-white hover:bg-orange-400">
                <Link to="/login">
                  Kirjaudu sisään
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#07111f]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="font-semibold text-slate-200">{BRAND.name}</p>
            <p className="mt-1 break-words">© {new Date().getFullYear()} {BRAND.tagline}.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="#tuote" className="transition hover:text-white">Ratkaisu</a>
            <a href="#tyonkulku" className="transition hover:text-white">Työnkulku</a>
            <Link to="/login" className="font-semibold text-slate-200 transition hover:text-white">
              Kirjautuminen
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
