# AGENTS.md

## Cursor Cloud specific instructions

VaKantti is a **frontend-only SPA** (React 18 + Vite 5 + TypeScript). There is no
custom application server: the entire backend is a **hosted Supabase project**
whose publishable browser credentials are baked into `src/lib/supabase/client.ts`.
Consequently:

- No local database, Docker, or backend service is needed. `npm run dev` alone
  runs the full app against the live hosted Supabase backend. Outbound network to
  `*.supabase.co` is required at runtime.
- Node 22 is required (`.node-version`). It is already present on the VM.
- Standard commands (dev/build/lint/typecheck/test/e2e and the `ship:check`
  quality gate) are documented in `README.md` and `package.json` scripts — refer
  to those rather than re-deriving them. The dev server serves at
  `http://localhost:5173/` and the app uses `HashRouter` (routes look like
  `/#/login`).

Non-obvious gotchas:

- **No self-registration.** The login page only signs in; accounts are created by
  an org admin. Authenticated flows need `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` in
  the Cursor Cloud environment (same names as the GitHub Actions secrets). GitHub
  repo secrets are **not** injected into cloud-agent VMs automatically — they must
  be mirrored as Cursor secrets. CI email for the multi-role smoke is often
  `admin@roles.vakantti.invalid` (see `.github/workflows/pr-quality-gate.yml`).
  Without the secrets you can still prove end-to-end health by submitting the
  login form and confirming the live backend returns an auth response.
- **Do not mutate production data as a test side effect.** The default Supabase
  target is the shared/production project. Do not create accounts or write data
  just to test; use the dedicated E2E test user instead.
- Playwright E2E (`npm run test:e2e`) auto-starts `npm run dev`. Install browsers
  with `npx playwright install chromium` (prefer without `--with-deps` here —
  apt can hang indefinitely in this VM). Unauthenticated mobile smoke works
  without secrets. Authenticated `e2e/smoke.spec.ts` also needs
  `E2E_PROVISION_TOKEN` from GitHub Actions OIDC (only issued inside
  `pr-quality-gate.yml`), so full multi-role smoke cannot run in the cloud
  agent VM even if the password secret is present — use CI for that path.
- `npm run check:migrations` prints many `warning:` lines about `private.` grants;
  these are expected and non-fatal — only a final `errors` count matters.
