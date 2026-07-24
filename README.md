# VaKantti

VaKantti on suomalainen rakennusalan työnohjaus- ja toiminnanohjausjärjestelmä. Repositorion tekninen nimi on edelleen `remonttiflow`.

## Nykyinen arkkitehtuuri

- React 18, TypeScript strict, Vite 5
- Tailwind CSS ja shadcn/ui
- React Router v6
- TanStack Query
- Supabase Auth, PostgreSQL, Row Level Security, Storage ja Edge Functions
- Vitest-yksikkötestit ja Playwright-E2E-testit
- GitHub Actions -laatuketju Node.js 22:lla

## Roolit

### Työntekijä

Työntekijällä ei ole organisaation yleisnäkymää. Hän näkee vain:

- omalle käyttäjälle määrätyt työmääräykset
- projektitiimille määrätyt työmääräykset, kun hän kuuluu kyseiseen projektiin
- omat projektit ja projektivaiheet
- omat työvuorot
- omat tunti-, matka- ja ajopäiväkirjaukset
- omat tai omiin töihin liittyvät työmaakuittaukset
- omat lomakelähetykset
- henkilökohtaiset viestit sekä organisaation tiedotteet

Työntekijä voi käynnistää, keskeyttää ja valmistaa oman työmääräyksensä. Hän ei voi muuttaa työn rajausta, vastuuhenkilöitä, projektia, määräaikaa tai prioriteettia.

### Työnjohtaja

Työnjohtaja hallitsee operatiivista tuotantoa:

- projektit ja projektitiimit
- työmääräykset ja vastuuhenkilöt
- aikataulut ja työvuorot
- tuntien ja kulujen hyväksyntä
- turvallisuus, päiväkirjat, kuittaukset ja lomakkeet
- asiakkaat, CRM, laskenta ja raportointi

### Admin

Adminilla on työnjohdon oikeuksien lisäksi:

- organisaation tietojen hallinta
- käyttäjäkutsut
- jäsenyyksien ja roolien hallinta
- viimeisen ylläpitäjän suojaus
- jäsenmuutosten audit trail

## Työn kohdistusmalli

VaKantti käyttää kahta erillistä kohdistusta:

1. `project_members` määrittää, mille työmaille käyttäjä on sijoitettu.
2. `work_order_assignees` määrittää työmääräyksen nimetyt vastuuhenkilöt.

Työmääräyksen `assignment_scope` on joko:

- `people`: työ näkyy vain nimetyille vastuuhenkilöille
- `project_team`: työ näkyy kaikille projektitiimin jäsenille

Kaikki rajaukset pakotetaan PostgreSQL:n RLS-politiikoissa. React-reittien ja navigaation suodatus on vain käyttöliittymäkerros, ei varsinainen tietoturvaraja.

## Tietoturvaperiaatteet

- Selain käyttää vain Supabasen publishable-avainta.
- Secret/service-role-avaimia käytetään vain palvelinpuolisissa Edge Function -toiminnoissa.
- Organisaatiorajat toteutetaan tietokannassa.
- Työntekijän työmääräyksen tilasiirtymät tarkistetaan RLS:n lisäksi tietokantatriggerillä.
- Talous- ja hallintatiedot on rajattu admin- ja supervisor-rooleille.
- Henkilökohtaiset viestit näkyvät vain lähettäjälle ja vastaanottajalle.

## Kehitys

```bash
npm ci
npm run dev
```

## Tarkistukset

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

GitHub Actions ajaa samat tarkistukset jokaiselle pull requestille. `main`-haaraan yhdistetään vain vihreän CI:n läpäisseet muutokset.

## Ympäristömuuttujat

Selain tarvitsee:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Palvelinsalaisuuksia ei saa lisätä `.env`-tiedostoihin, selaimen Vite-muuttujiin tai GitHub-repositorioon.

## Migraatiot

Tietokantamuutokset ovat `supabase/migrations/`-hakemistossa. Tiedoston version pitää vastata hosted Supabasen migraatiohistoriaa, jotta samaa muutosta ei yritetä suorittaa uudelleen.
