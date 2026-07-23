# RemonttiFlow — Production Readiness: suunnitelma

Lähde: REMONTTIFLOW — PRO masterprompt. Baseline: `docs/BASELINE_REPORT.md` (commit eeb1691).

## Vaihe 0 — Baseline ✅ VALMIS
Rinnakkainen 5-agenttinen auditointi suoritettu. Havainnot baseline-raportissa.

## PR 1 — `chore/stabilize-ci-and-tests` (tämä sessio)
Stage-gate: kaikki aallot vihreänä ennen commitia.

- Aalto 1a (rinnakkain, eri tiedostot):
  - Agentti Tooling: ESLint-konfiguraatio, Prettier, Vitest + RTL -setup, Playwright-riippuvuus, npm-skriptit (typecheck/test/test:e2e/format), kaikki package.json- ja lockfile-muutokset + npm install. EI koske src/:iin.
  - Agentti GitHub-Infra: `.github/workflows/ci.yml`, PR-template, dependabot, `.env.example`, README-uudistus (asennus/kehitys/testaus/CI). EI koske package.json:iin eikä src/:iin.
  - Agentti App-Robustness: ErrorBoundary, NotFound-sivu + catch-all-reitti, loading/empty/error-state-komponentit, main.tsx/App.tsx-kytkennät. Omistaa src/App.tsx ja src/main.tsx.
- Aalto 1b (rinnakkain, 1a:n jälkeen):
  - Agentti Unit-Tests: yksikkötestit (utils, AuthContext, useAppData) — vain uusia testitiedostoja.
  - Agentti E2E: playwright.config + kriittinen smoke (sovellus latautuu, dashboard renderöityy, roolinvaihto).
  - Agentti Lint-Fix: korjaa kaikki lint-virheet src/:ssä niin että `--max-warnings 0` menee läpi.
- Gate: itse ajan `tsc`, `lint`, `test`, `build`, e2e-smoke. Sitten commit + push + PR.

## PR 2 — `refactor/brand-and-app-foundation` (tämä sessio)
- Agentti Brand: `src/config/brand.ts`, Navbar/Header/AI/index.html-kytkennät. Brändinimi pidetään toistaiseksi VaKantti (odottaa käyttäjän päätöstä), konfiguroituna yhteen paikkaan.
- Agentti Types: `src/types/index.ts`, domain-tyyppien deduplikointi (Employee/Equipment/TimeEntry), useAppData + initialData importtaavat tyypeistä.
- Agentti DataLayer (jälkeen): AppDataProvider mount, Asiakkaat/CRM/Tyomaaraykset oikeaksi CRUD-näkymäksi jaetusta datasta, 3 feikki-Tallenna-painiketta tallentamaan, StubPage/use-mobile poisto.

## Estetty (odottaa käyttäjältä)
- PR 3+ (Supabase-auth, multitenancy, RLS, oikea backend): vaatii Supabase-projektipäätöksen ja salaisuudet.
- Brändin lopullinen nimi.
