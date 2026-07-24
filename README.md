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

## Teknologia

- React 18, TypeScript ja Vite 5
- Tailwind CSS ja Radix UI / shadcn-komponentit
- React Router HashRouterilla
- TanStack Query
- Supabase Auth, PostgreSQL, Storage ja Edge Functions
- Vitest ja React Testing Library
- Playwright
- GitHub Actions
- Cloudflare Pages

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

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

GitHub Actionsin `CI`-workflow ajaa vastaavat tarkistukset jokaiselle pull requestille ja jokaiselle `main`-haaran pushille.

### E2E-tunnukset

Julkisen kirjautumisnäkymän ja virhetilan testit eivät tarvitse käyttäjätunnuksia. Kirjautumista ja suojattuja reittejä testaavat tapaukset käynnistyvät vain, kun ympäristössä ovat:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

GitHubissa nämä arvot tallennetaan salaisuuksiksi. Repositorioon ei saa commitoida oikeita käyttäjätunnuksia tai salasanoja.

## Tuotantoonvienti

`.github/workflows/deploy-production.yml` käynnistyy vasta, kun `main`-haaran CI on onnistunut. Workflow:

1. tarkistaa hyväksytyn commitin
2. asentaa lukitut riippuvuudet
3. ajaa tyyppitarkistuksen, lintin ja yksikkötestit
4. rakentaa tuotantobundlen
5. lisää `version.json`-tiedoston commit-tunnisteella
6. luo Cloudflare Pages -projektin tarvittaessa
7. julkaisee `dist`-hakemiston tuotantoon
8. ajaa Playwright-smoketestit julkaistua URL-osoitetta vasten

### Pakolliset GitHub Actions -salaisuudet

Repository Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN` — token, jolla on Account / Cloudflare Pages / Edit -oikeus
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare-tilin tunniste

### Valinnainen GitHub Actions -muuttuja

- `CLOUDFLARE_PAGES_PROJECT` — Pages-projektin nimi; oletus on `remonttiflow`

Deployn voi käynnistää myös käsin GitHub Actionsin **Deploy Production** -workflowsta.

## Tuotantoturvallisuus

- Tietokannan käyttöoikeudet ratkaistaan RLS-politiikoilla, ei käyttöliittymän piilotuksilla.
- Selain käyttää vain Supabasen publishable-avainta.
- Supabase Edge Functions säilyttävät palvelinavaimet palvelinympäristössä.
- Cloudflare Pagesiin julkaistaan CSP-, HSTS-, clickjacking-, MIME- ja referrer-suojausotsakkeet.
- Sovellus estetään hakukoneindeksoinnilta.
- Staattiset hashatut assetit välimuistitetaan pitkäksi aikaa, mutta `index.html` ja `version.json` eivät jää vanhaan välimuistiin.
- Jokainen tuotantodeploy varmennetaan commit-tunnisteella ja selaintestillä.

## Kehityskäytäntö

- Älä kirjoita suoraan `main`-haaraan.
- Tee rajattu feature- tai fix-haara.
- Avaa pull request.
- Yhdistä vasta vihreän CI:n jälkeen.
- Tietokantamuutokset toimitetaan versionoituina Supabase-migraatioina.
- Tuotantodatan muutoksia ei tehdä UI-testien sivuvaikutuksena.

## Tunnetut rajaukset

- AI-mallipalvelu ei ole vielä aktiivinen.
- Raporttiviennit ovat tällä hetkellä ensisijaisesti CSV-muodossa.
- Lomakkeiden yleinen liitetuki on erillinen jatkokehitys; työmaakuittauksissa liitteet ovat käytössä.
- Supabase Authin kutsusähköpostien brändäys ja lopullinen tuotantodomainin redirect-konfiguraatio pitää vahvistaa, kun lopullinen domain on päätetty.
