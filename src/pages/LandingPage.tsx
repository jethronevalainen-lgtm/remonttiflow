import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderKanban,
  HardHat,
  PackageCheck,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const features: Feature[] = [
  {
    title: 'Projektit ja työvaiheet',
    description: 'Kokoa kohteet, työvaiheet, vastuuhenkilöt ja eteneminen yhteen hallittavaan kokonaisuuteen.',
    icon: FolderKanban,
  },
  {
    title: 'Aikataulut ja työnjako',
    description: 'Suunnittele työ, jaa tehtävät asentajille ja pidä työnjohdon tilannekuva ajan tasalla.',
    icon: CalendarDays,
  },
  {
    title: 'Työaika ja matkakulut',
    description: 'Kerää työvuorot, tauot, lisät ja hyväksytyt matkakulut hallitusti palkka-aineistoa varten.',
    icon: Clock3,
  },
  {
    title: 'Tarkastukset ja luovutukset',
    description: 'Tee tarkastukset, itselleluovutukset ja kuittaukset vakioidulla tavalla suoraan työmaalta.',
    icon: ClipboardCheck,
  },
  {
    title: 'Kalusto ja henkilöstö',
    description: 'Näe kaluston vastuuhenkilöt, henkilöstön tiedot ja käytännön resurssit samassa järjestelmässä.',
    icon: PackageCheck,
  },
  {
    title: 'Raportointi ja seuranta',
    description: 'Muodosta päätöksenteon kannalta selkeä näkymä projektien, työn ja kustannusten tilanteeseen.',
    icon: BarChart3,
  },
];

const workflow = [
  {
    number: '01',
    title: 'Suunnittele',
    description: 'Perusta projekti, työvaiheet, aikataulu ja vastuuhenkilöt.',
  },
  {
    number: '02',
    title: 'Ohjaa',
    description: 'Jaa työt, seuraa toteutusta ja reagoi poikkeamiin ajoissa.',
  },
  {
    number: '03',
    title: 'Dokumentoi',
    description: 'Tallenna tunnit, tarkastukset, kuittaukset, kulut ja keskustelut.',
  },
  {
    number: '04',
    title: 'Raportoi',
    description: 'Kokoa toteuma johdolle, palkkahallintoon ja tilaajayhteistyöhön.',
  },
];

const roles = [
  {
    title: 'Työnjohto',
    description: 'Yksi tilannekuva projekteista, aikatauluista, tekijöistä, tarkastuksista ja poikkeamista.',
    icon: HardHat,
  },
  {
    title: 'Työntekijät',
    description: 'Omat työt, työaika, turvallisuus, keskustelut ja kirjaukset selkeästi mobiilissa.',
    icon: UsersRound,
  },
  {
    title: 'Hallinto ja johto',
    description: 'Henkilöstö, palkka-aineisto, matkakulut, raportit ja organisaation hallinta roolien mukaan.',
    icon: Building2,
  },
];

function scrollToFeatures() {
  document.getElementById('ominaisuudet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function LandingPage() {
  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-slate-950 text-white">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Siirry sisältöön
      </a>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label={`${BRAND.name} etusivu`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-sm font-black tracking-tight text-white shadow-lg shadow-orange-500/20">
              {BRAND.shortName}
            </span>
            <span>
              <span className="block text-base font-bold leading-none tracking-tight">{BRAND.name}</span>
              <span className="mt-1 block text-[11px] leading-tight text-slate-400 sm:text-xs">{BRAND.tagline}</span>
            </span>
          </Link>

          <Button asChild className="h-10 bg-orange-500 px-4 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400">
            <Link to="/login">
              Kirjaudu sisään
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <main id="main-content">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(249,115,22,0.19),transparent_35%),radial-gradient(circle_at_85%_30%,rgba(59,130,246,0.16),transparent_32%)]" />
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1.5 text-sm font-medium text-orange-200">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Rakennus- ja remonttiliikkeen toiminnanohjaus
              </div>

              <h1 className="text-balance text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.05]">
                Työmaa, työnjohto ja hallinto yhdessä järjestelmässä.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
                {BRAND.name} kokoaa projektit, työvaiheet, työajat, tarkastukset, kulut, kaluston ja raportoinnin samaan selkeään työtilaan.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-orange-500 px-6 text-base text-white shadow-xl shadow-orange-500/20 hover:bg-orange-400">
                  <Link to="/login">
                    Avaa VaKantti
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={scrollToFeatures}
                  className="h-12 border-white/20 bg-white/5 px-6 text-base text-white shadow-none hover:bg-white/10 hover:text-white"
                >
                  Tutustu ominaisuuksiin
                </Button>
              </div>

              <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {['Roolipohjaiset näkymät', 'Mobiili työmaakäyttö', 'Yksi yhteinen tilannekuva'].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-orange-500/25 via-blue-500/10 to-transparent blur-3xl" />
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-4">
                <div className="rounded-2xl bg-slate-100 p-4 text-slate-950 sm:p-5">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Esimerkkinäkymä</p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Työnjohdon tilannekuva</h2>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Päivitetty</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Aktiiviset projektit', value: '12', icon: FolderKanban },
                      { label: 'Työt tänään', value: '28', icon: ClipboardCheck },
                      { label: 'Avoimet kuittaukset', value: '4', icon: CheckCircle2 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2 text-slate-500">
                          <span className="text-xs font-medium leading-4">{item.label}</span>
                          <item.icon className="h-4 w-4 flex-none text-orange-500" aria-hidden="true" />
                        </div>
                        <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">Keittiöremontit · vaiheistus</p>
                          <p className="mt-0.5 text-xs text-slate-500">15 huoneistoa · 6 asentajaa</p>
                        </div>
                        <span className="text-sm font-bold text-slate-700">68 %</span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[68%] rounded-full bg-orange-500" />
                      </div>
                      <div className="mt-4 space-y-2">
                        {[
                          ['A12 · kalusteasennus', 'Työn alla'],
                          ['A14 · sähkötyöt', 'Tänään'],
                          ['B03 · itselleluovutus', 'Odottaa'],
                        ].map(([task, status]) => (
                          <div key={task} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                            <span className="min-w-0 break-words font-medium text-slate-700">{task}</span>
                            <span className="flex-none font-semibold text-slate-500">{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-900 p-4 text-white shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tänään huomioitavaa</p>
                      <div className="mt-4 space-y-4">
                        <div className="flex gap-3">
                          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-orange-500/15 text-orange-300">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold">2 tarkastusta erääntyy</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">Vastuuhenkilöt ja kohteet näkyvät suoraan työlistalla.</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                            <WalletCards className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold">Palkkakausi tarkistettavana</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">Tunnit ja hyväksytyt matkakulut yhdessä koosteessa.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ominaisuudet" className="scroll-mt-24 border-y border-slate-200 bg-white py-16 text-slate-950 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Kokonaisuus ilman sirpaleita</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Kaikki olennainen päivittäisen työn johtamiseen.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                VaKantti yhdistää työmaan käytännön tekemisen, työnjohdon ohjauksen ja hallinnon tarvitsemat tiedot samaan järjestelmään.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-white hover:shadow-xl hover:shadow-slate-200/60 sm:p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white transition group-hover:bg-orange-500">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 leading-7 text-slate-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="max-w-xl">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">Yksi toimintamalli</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Tieto syntyy työn mukana, ei jälkikäteen.</h2>
                <p className="mt-4 text-lg leading-8 text-slate-300">
                  Kun tehtävät, toteuma ja dokumentointi ovat samassa ketjussa, työnjohto näkee tilanteen ilman erillisten taulukoiden ja viestiketjujen kokoamista.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {workflow.map((step) => (
                  <article key={step.number} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 sm:p-6">
                    <span className="text-sm font-black tracking-[0.16em] text-orange-300">{step.number}</span>
                    <h3 className="mt-4 text-xl font-bold">{step.title}</h3>
                    <p className="mt-2 leading-7 text-slate-400">{step.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-100 py-16 text-slate-950 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Oikea näkymä jokaiselle roolille</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Sama tieto, eri tarpeisiin.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Käyttäjä näkee vain työnsä kannalta olennaiset toiminnot ja tiedot. Organisaation ylläpito ja käyttöoikeudet pysyvät hallittuina.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {roles.map((role) => (
                <article key={role.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <role.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{role.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{role.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16 text-slate-950 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl bg-slate-950 px-5 py-10 text-center text-white shadow-2xl shadow-slate-300 sm:px-10 sm:py-14">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-lg font-black shadow-lg shadow-orange-500/25">
                {BRAND.shortName}
              </div>
              <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Avaa organisaatiosi VaKantti-työtila.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                Käyttäjätilit ja käyttöoikeudet hallinnoi organisaation ylläpitäjä. Kirjaudu sisään omilla tunnuksillasi.
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

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {BRAND.name}. {BRAND.tagline}.</p>
          <Link to="/login" className="font-medium text-slate-300 transition hover:text-white">Kirjautuminen</Link>
        </div>
      </footer>
    </div>
  );
}
