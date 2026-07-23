# RemonttiFlow — Baseline-raportti (Vaihe 0)

Päivämäärä: 2026-07-23
Lähtötilanteen commit: `eeb1691` (`main`, synkronoitu origin/main kanssa)
Node v24.15.0, npm 11.12.1

## Komentojen tilanne

| Komento | Tulos |
|---|---|
| `npm ci` | ✅ (node_modules olemassa, lockfile toimii) |
| `npx tsc --noEmit` | ✅ 0 virhettä (strict, noUnusedLocals päällä) |
| `npm run build` | ✅ onnistuu (~8 s, bundle 1.16 MB / gzip 324 kB, chunk-varoitus) |
| `npm run lint` | ❌ **ESLint-konfiguraatio puuttuu kokonaan** |
| `npm run test` | ❌ ei testirajapintaa (Vitest/RTL puuttuu) |
| E2E | ❌ Playwright puuttuu |
| CI | ❌ ei `.github/workflows`-kansiota |

## Keskeiset havainnot (5 rinnakkaista auditointia)

### 1. Datakerros on kuollutta koodia
- `useAppData` (13 domain-tyyppiä, 14 localStorage-avainta `vakantti-v1-*`), `AppDataContext`, `initialData` (45 seed-riviä) ovat täysin kytketyt mutta **AppDataProvidera ei ole mountattu missään**. 0 kuluttajaa.
- **18/21 sivua** käyttää sivukohtaista mock-dataa (44 mock-vakiota); 0 sivua käyttää jaettua kerrosta.
- Sivujen mock-data on ristiriidassa keskenään (eri projektinimet, eri status-enumit suomeksi/englanniksi).

### 2. Placeholderit ja kuolleet painikkeet
- `Asiakkaat`, `CRM`, `Tyomaaraykset` ovat 79-rivisiä "kehitetään pian" -kuoria (fake-luvut, ei dataa).
- **46 painiketta 17 tiedostossa ilman onClickia** — mm. "Uusi projekti", "Uusi asiakas", kaikki Vie/Tulosta-painikkeet.
- **3 "Tallenna"-painiketta vain sulkee dialogin** (Tuntikirjaukset:976, Tyovuorokalenteri:837, Tyoturvallisuus:386) — käyttäjän syöte katoaa.
- AI-sivu: 8 toimimatonta työkalukorttia + kovakoodattu avainsana-chat (setTimeout-simulaatio).
- Globaali haku (Header) ei tee mitään; ilmoitukset staattisia.

### 3. Autentikointi on teatteria
- Ei oikeaa kirjautumista: `login(role)` asettaa kovakoodatun käyttäjän; **auto-login supervisorina joka latauksella** (AuthContext.tsx:58).
- "Vaihda roolia" -valikosta kuka tahansa saa admin-oikeudet yhdellä klikkauksella.
- Kaikki käyttöoikeustarkistukset vain React-tasolla (RoleGuard × 16 reittiä); `logout()` on kuollut koodi.
- `ROLE_ROUTES` (AuthContext.tsx:37) käyttämätön ja ristiriidassa live-guardien kanssa.
- Ei 404-reittiä. Ei salaisuuksia repossa (hyvä).

### 4. Brändi: VaKantti vs RemonttiFlow
- UI 100 % **VaKantti** (title, Navbar, Header, AI, mock-sähköpostit, localStorage-prefix `vakantti-v1`, package.json `vakantti`).
- **RemonttiFlow** vain README.md:ssä ja git-remotessa.
- Suositus: yksi `src/config/brand.ts`; lopullinen nimi vaatii liiketoimintapäätöksen (ks. avoimet kysymykset).

### 5. Tyypit ja dead code
- 13 keskitettyä interfacea `useAppData.ts`:ssa (väärä paikka); 4 entiteettiä duplikoitu sivuille (Employee ×3 varianttia, Equipment, TimeEntry) ristiriitaisilla enum-arvoilla.
- Kuollutta: `StubPage.tsx`, `use-mobile.ts`, `AppDataContext.tsx` (+ transitiivisesti useAppData/initialData/useLocalStorage).
- 41/53 `src/components/ui/*`-primitiiviä käyttämättä.

## PR-suunnitelma (masterpromptin mukainen)

1. `chore/stabilize-ci-and-tests` — tämä sessio
2. `refactor/brand-and-app-foundation` — tämä sessio
3. `feat/supabase-auth-and-multitenancy` — **estetty: vaatii Supabase-projektin luontipäätöksen (kustannus) ja ympäristömuuttujat**
4. …loppuphin PR:t 4–11 edellyttävät vaiheen 3 valmistumista.

## Avoimet kysymykset käyttäjälle

1. **Brändi:** masterprompt olettaa RemonttiFlow'n, mutta koko tuote on jo VaKantti. Kumpi on lopullinen nimi?
2. **Supabase:** saanko luoda uuden Supabase-projektin tilillesi (maksu/tier-päätös), vai onko olemassa oleva projekti?
