# VaKantti — Production Readiness -suunnitelma

Lähtöauditointi: `docs/BASELINE_REPORT.md`.

## Valmiit vaiheet

### Vaihe 0 — Baseline ✅

- Repository, käyttöpolut, mock-data, tietoturva ja build-tila auditoitu.

### PR 1 — CI, testit ja virheenkäsittely ✅

- ESLint, Prettier, Vitest, React Testing Library ja Playwright.
- GitHub Actions: typecheck, lint, test, build ja E2E.
- ErrorBoundary, 404 sekä yhteiset loading/empty/error-tilat.

### PR 2 — Brändi ja sovelluspohja ✅

- VaKantti-brändi keskitetty.
- Domain-tyypit deduplikoitu.
- Asiakkaat, CRM ja työmääräykset saivat toimivat paikalliset CRUD-näkymät.

### PR 3 — Supabase Auth ja moniasiakkuus ✅

- Oikea sähköposti/salasana-kirjautuminen.
- Organisaatiojäsenyydet ja roolit.
- RLS-politiikat ja auditointitaulu.
- Hosted Supabase -projekti käytössä.

## Nykyinen työ

### PR 18 — Yhteinen Supabase-domain- ja query-kerros 🚧

- Korjaa frontendin vanhentuneet Supabase-tyypit vastaamaan hosted-skeemaa.
- Poistaa kaksois-AuthProviderin.
- Vaihtaa AppDataContextin localStoragesta organisaatiorajattuun Supabase + React Query -kerrokseen.
- Kytkee Asiakkaat-, CRM-, Työmääräykset-, Tuntikirjaukset- ja Työturvallisuus-sivut oikeaan tietokantaan.
- Lisää näkyvät lataus- ja virhetilat.
- Yhtenäistää Node.js 22:n CI- ja tuotantobuildeihin.
- Koventaa SECURITY DEFINER -funktiot ja optimoi RLS:n sekä vierasavaimet.

## Seuraavat toteutusvaiheet

### A. Poista jäljellä oleva sivukohtainen mock-data

- Dashboard
- Projektit
- Henkilöstö
- Kalusto
- Päiväkirjat
- Jätehuolto
- Viestintä
- Matkakulut
- Työvuorokalenteri

Kaikki sivut käyttävät samaa organisaatiorajattua query-kerrosta.

### B. Laajenna tuotannon CRUD-työnkulut

- projektien luonti, muokkaus, arkistointi ja projektinäkymä
- henkilöstön ja kaluston CRUD
- tuntien hyväksyntä tallennettuna tietokantaan
- turvallisuushavaintojen tila- ja vastuuhenkilötyönkulku
- päiväkirjojen tallennus ja lukitus

### C. Dokumentit ja liitteet

- Supabase Storage
- työmaakuvat, päiväkirjaliitteet, turvallisuusliitteet ja projektidokumentit
- tiedostotyyppi-, koko- ja käyttöoikeusrajat

### D. Raportointi ja talous

- oikeasta datasta muodostuvat dashboardit
- budjetti vs. toteuma
- tunti-, turvallisuus-, kalusto- ja jätereportit
- CSV/Excel/PDF-viennit

### E. AI

- nykyinen vastaussimulaatio poistetaan
- palvelinpuoliset, organisaatiorajatut AI-työkalut
- projektitilanne, päiväkirjaluonnos, kustannuspoikkeamat ja riskit
- AI-kutsujen audit trail

### F. Tuotantovalmiuden viimeistely

- staging/production-erottelu
- virheseuranta
- varmuuskopio- ja palautusohje
- tietojen vienti/poisto
- mobiilin offline-jono
- saavutettavuus- ja suorituskykytestit

## Avoin ulkoinen asetus

- Supabase Authin leaked-password protection on vielä kytkettävä päälle Dashboardin Auth-asetuksista. Tämä ei ole SQL-migraatio eikä nykyinen connector tarjoa asetuksen muuttamista.
