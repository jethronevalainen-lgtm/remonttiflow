# VaKantti

VaKantti on suomalainen rakennusalan työnhallinta- ja toiminnanohjaussovellus. Repositorion nimi on historiallisista syistä `remonttiflow`.

## Nykytila

Sovellus ei ole enää pelkkä käyttöliittymäprototyyppi. Käytössä ovat muun muassa:

- Supabase Auth -kirjautuminen
- organisaatio- ja roolipohjainen moniasiakkuus
- PostgreSQL Row Level Security
- projektit, asiakkaat, CRM, henkilöstö ja kalusto
- työmääräykset, työvuorot, aikataulutus ja tuntikirjaukset
- työmaapäiväkirjat, turvallisuushavainnot ja jätehuolto
- matka- ja ajopäiväkirjat
- kustannus- ja määrälaskenta
- dynaamiset lomakkeet ja raportointi
- allekirjoitetut työmaakuittaukset liitteineen
- organisaation käyttäjä- ja roolihallinta

AI-näkymä on tarkoituksellisesti pois käytöstä, kunnes palvelinpuolinen mallipalvelu ja sen käyttöehdot on konfiguroitu.

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

- Secret/service-role-avaimia käytetään vain palvelinpuolisissa Edge Function -toiminnoissa.
- Organisaatiorajat toteutetaan tietokannassa.
- Työntekijän työmääräyksen tilasiirtymät tarkistetaan RLS:n lisäksi tietokantatriggerillä.
- Talous- ja hallintatiedot on rajattu admin- ja supervisor-rooleille.
- Henkilökohtaiset viestit näkyvät vain lähettäjälle ja vastaanottajalle.

## Teknologia

- React 18, TypeScript ja Vite 5
- Tailwind CSS ja Radix UI / shadcn-komponentit
- React Router HashRouterilla
- TanStack Query
- Supabase Auth, PostgreSQL, Storage ja Edge Functions
- Vitest ja React Testing Library
- Playwright
- Cloudflare Pagesin natiivi GitHub-integraatio

## Paikallinen kehitys

Edellytykset:

- Node.js 22
- npm 10 tai uudempi

Asenna riippuvuudet ja käynnistä kehityspalvelin:

```bash
npm ci
npm run dev
```

Sovellus käyttää oletuksena hosted Supabase -projektin julkista selainkonfiguraatiota. Eri backend voidaan määrittää kopioimalla `.env.example` tiedostoksi `.env` ja vaihtamalla `VITE_SUPABASE_URL` sekä `VITE_SUPABASE_ANON_KEY`.

**Älä koskaan sijoita frontendin ympäristömuuttujiin service-role-avainta, Cloudflare-tokenia tai muuta salaista arvoa.**

## Laatuportit

Kaikki tuotantoon vaadittavat tarkistukset ajetaan yhdellä komennolla:

```bash
npm run ship:check
```

Komento suorittaa järjestyksessä:

1. TypeScript-tyyppitarkistuksen
2. ESLintin ilman sallittuja varoituksia
3. Vitest-yksikkötestit
4. tuotantobuildin
5. `dist/version.json`-julkaisutunnisteen luonnin

Muut komennot:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

## E2E-tunnukset

Julkisen kirjautumisnäkymän ja virhetilan testit eivät tarvitse käyttäjätunnuksia. Kirjautumista ja suojattuja reittejä testaavat tapaukset käynnistyvät vain, kun ympäristössä ovat:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

Käytä erillistä testikäyttäjää. Repositorioon ei saa commitoida oikeita käyttäjätunnuksia tai salasanoja.

## Migraatiot

Tietokantamuutokset ovat `supabase/migrations/`-hakemistossa. Tiedoston version pitää vastata hosted Supabasen migraatiohistoriaa, jotta samaa muutosta ei yritetä suorittaa uudelleen.

## Tuotantoonvienti

Normaali tuotantopolku on Cloudflare Pagesin oma GitHub-integraatio:

```text
feature-haara → pull request → Cloudflare preview + laatuportit
→ merge mainiin → automaattinen tuotantobuild → Cloudflare Pages
```

Tämä polku ei käytä GitHub Actions -minuutteja.

### Cloudflare Pages -projektin asetukset

- Git repository: `jethronevalainen-lgtm/remonttiflow`
- Production branch: `main`
- Framework preset: `Vite`
- Build command: `npm run ship:check`
- Build output directory: `dist`
- Root directory: repository root
- Node.js: `.node-version` määrittää version 22
- Preview deployments: käytössä kaikille pull request -haaroille
- Automatic production deployments: käytössä vain `main`-haaralle

`wrangler.jsonc` säilyttää Pages-outputin ja yhteensopivuuspäivän versionhallinnassa.

Cloudflare Pages lisää buildiin automaattisesti muun muassa `CF_PAGES_COMMIT_SHA`- ja `CF_PAGES_BRANCH`-arvot. `scripts/write-version.mjs` kirjoittaa ne julkaisuun tiedostoksi `/version.json`, joten tuotannossa oleva commit voidaan todistaa ilman arvailua.

GitHubin `.github/workflows/ci.yml` on jätetty vain manuaaliseksi varajärjestelmäksi. Normaali PR- ja tuotantoketju ei riipu siitä.

## Tuotantoturvallisuus

- Tietokannan käyttöoikeudet ratkaistaan RLS-politiikoilla, ei käyttöliittymän piilotuksilla.
- Selain käyttää vain Supabasen publishable-avainta.
- Supabase Edge Functions säilyttävät palvelinavaimet palvelinympäristössä.
- Cloudflare Pagesiin julkaistaan CSP-, HSTS-, clickjacking-, MIME- ja referrer-suojausotsakkeet.
- Sovellus estetään hakukoneindeksoinnilta.
- Staattiset hashatut assetit välimuistitetaan pitkäksi aikaa, mutta `index.html` ja `version.json` eivät jää vanhaan välimuistiin.
- Jokainen build tuottaa commit-, branch- ja ympäristötiedot sisältävän `version.json`-tiedoston.
- Cloudflare Pages säilyttää deployment-historian nopeaa rollbackia varten.

## Kehityskäytäntö

- Älä kirjoita suoraan `main`-haaraan.
- Tee rajattu feature- tai fix-haara.
- Avaa pull request.
- Tarkista Cloudflare preview ja build-status.
- Yhdistä vasta vihreän Cloudflare-tarkistuksen jälkeen.
- Tietokantamuutokset toimitetaan versionoituina Supabase-migraatioina, joiden versio vastaa hosted Supabasen migraatiohistoriaa.
- Tuotantodatan muutoksia ei tehdä UI-testien sivuvaikutuksena.

## Tunnetut rajaukset

- AI-mallipalvelu ei ole vielä aktiivinen.
- Raporttiviennit ovat tällä hetkellä ensisijaisesti CSV-muodossa.
- Lomakkeiden yleinen liitetuki on erillinen jatkokehitys; työmaakuittauksissa liitteet ovat käytössä.
- Supabase Authin kutsusähköpostien brändäys ja lopullinen tuotantodomainin redirect-konfiguraatio pitää vahvistaa, kun lopullinen domain on päätetty.
