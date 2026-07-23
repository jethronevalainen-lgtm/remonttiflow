# VaKantti (aiemmin RemonttiFlow — repon nimi on edelleen `remonttiflow`)

Suomalainen rakennusalan työnohjaus- ja toiminnanohjausjärjestelmä.

> **Huom:** Projekti on prototyyppivaiheessa. Käyttöliittymä on laaja, mutta
> suurin osa näkymistä toimii vielä mock-datalla, autentikointi on
> roolinvaihto-prototyyppi eikä taustajärjestelmää (Supabase) ole vielä
> kytketty. Katso kohta [Tunnetut rajoitteet](#tunnetut-rajoitteet).

## Teknologia

- **Vite 5** + **React 18** + **TypeScript** (strict-tila)
- **Tailwind CSS** + **shadcn/ui** (Radix UI -primitiivit)
- **React Router v6**
- **Vitest** yksikkötesteihin, **Playwright** e2e-testeihin
- Tuleva taustajärjestelmä: **Supabase** (ei vielä kytketty, ks. `.env.example`)

## Edellytykset

- Node.js 20 tai uudempi (kehityksessä käytetty myös Node 24)
- npm 10+

## Asennus

```bash
npm ci
```

## Kehitys

```bash
npm run dev
```

Sovellus käynnistyy Vite-kehityspalvelimelle (oletuksena `http://localhost:5173`).

## npm-skriptit

| Komento | Kuvaus |
|---|---|
| `npm run dev` | Käynnistää Vite-kehityspalvelimen |
| `npm run build` | Tuotantobuild (`tsc` + `vite build`) kansioon `dist/` |
| `npm run lint` | ESLint-tarkistus (max 0 varoitusta) |
| `npm run typecheck` | TypeScript-tyyppitarkistus ilman käännöstä (`tsc --noEmit`) |
| `npm run test` | Aja yksikkötestit (Vitest, kertakajo) |
| `npm run test:e2e` | Aja e2e-testit (Playwright) |
| `npm run preview` | Esikatsele tuotantobuildia paikallisesti |

## Testaus

### Yksikkötestit

```bash
npm run test
```

Testit ajetaan Vitestillä kertakajona. Samat testit ajetaan myös CI-putkessa
jokaiselle pushille mainiin ja jokaiselle PR:lle.

### E2E-testit

```bash
npx playwright install --with-deps chromium   # kerran, selaimen asennus
npm run test:e2e
```

E2E-testit ajetaan Playwrightilla. Epäonnistuessa Playwright luo raportin
kansioon `playwright-report/` (CI:ssä raportti tallentuu artefaktiksi).

## CI

GitHub Actions -putki (`.github/workflows/ci.yml`) ajetaan jokaisesta
pushista `main`-haaraan ja jokaisesta pull requestista. Putki koostuu
kahdesta jobista:

1. **Typecheck, lint, unit tests & build** — `npm ci`, `npm run typecheck`,
   `npm run lint`, `npm run test`, `npm run build` (Node 20, npm-välimuisti)
2. **E2E (Playwright)** — `npm run test:e2e`; epäonnistuessa
   `playwright-report/` tallentuu artefaktiksi

Riippuvuuksien ja GitHub Actions -actionien versiopäivityksistä huolehtii
Dependabot (`.github/dependabot.yml`, viikoittain).

## Kehityskäytäntö: haarat ja PR:t

- **Mainiin ei koskaan commitoida suoraan.** Kaikki muutokset tehdään
  feature-haaroissa (`feat/...`, `fix/...`, `chore/...`) ja viedään mainiin
  pull requestin kautta.
- Jokainen PR täytetään PR-pohjan (`.github/pull_request_template.md`)
  mukaisesti: ongelma, juurisyy, ratkaisu, muutetut tiedostot, testitulokset,
  build-tulos jne.
- PR:n ehtona on vihreä CI (typecheck, lint, yksikkötestit, build, e2e).

## Projektirakenne

```
├── .github/              # CI-putki, PR-pohja, Dependabot
├── docs/                 # Projektidokumentaatio (esim. BASELINE_REPORT.md)
├── src/
│   ├── components/       # Omat komponentit ja shadcn/ui-komponentit (ui/)
│   ├── contexts/         # React-kontekstit (mm. AuthContext, AppDataContext)
│   ├── data/             # Alkuaineisto / mock-data (initialData)
│   ├── hooks/            # Omat hookit
│   ├── lib/              # Apufunktiot (mm. cn/utils)
│   ├── pages/            # Reititetyt näkymät (~21 sivua)
│   ├── App.tsx           # Reititys ja sovelluksen runko
│   └── main.tsx          # Sovelluksen käynnistyspiste
├── index.html            # Vite-HTML-pohja
├── vite.config.ts        # Vite-konfiguraatio
├── tailwind.config.js    # Tailwind-konfiguraatio
└── tsconfig*.json        # TypeScript-konfiguraatiot (strict)
```

## Tunnetut rajoitteet

- **Mock-data:** Suurin osa näkymistä käyttää edelleen sivukohtaista
  mock-dataa; jaettua datakerrosta (`AppDataContext`) ei ole kytketty
  näkymiin.
- **Autentikointi:** Kirjautuminen on roolinvaihto-prototyyppi — ei oikeaa
  tunnistautumista, ja käyttöoikeustarkistukset tehdään vain
  React-tasolla.
- **Taustajärjestelmä:** Supabasea ei ole vielä kytketty. Yhteyttä varten
  tarvittavat ympäristömuuttujat on kuvattu `.env.example`-tiedostossa, ja ne
  tulevat pakollisiksi PR:stä `feat/supabase-auth-and-multitenancy` alkaen.

Lisätietoja lähtötilanteen auditoinnista: `docs/BASELINE_REPORT.md`.
