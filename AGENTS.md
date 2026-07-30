# AGENTS.md

## Runtime, verification and production safety

VaKantti is a frontend-only React 18 + Vite 5 + TypeScript SPA against hosted Supabase. Use Node.js 22 as defined in `.node-version`. Standard commands live in `README.md` and `package.json`.

Run the repository-defined verification commands instead of inventing parallel checks:

```bash
npm ci
npm run check:migrations
npm run typecheck
npm run lint
npm run test
npm run build
```

Before production publication, run the complete gate:

```bash
npm run ship:check
```

Use the existing Playwright setup for browser verification. Authenticated and multi-role tests must use the CI-managed test environment and configured secrets.

Safety rules:

- Treat the configured Supabase target as production unless the environment explicitly proves otherwise.
- Do not create, modify or delete production records merely to demonstrate that a feature works.
- Never expose secret or `service_role` keys, tokens, test-account addresses, password derivation or credential procedures in frontend code, logs, pull requests or documentation.
- Preserve organization scoping, project scoping and Row Level Security in every data-access change.
- Keep repository migration filenames aligned with the migration history actually applied to production.
- Start from current `main`. Compare old branches semantically against current `main`; a conflict-free merge can still regress newer behavior.
- Add or update tests for business rules, permissions, calculations and status transitions. Verify mobile layouts for changed user-facing flows.
- After database changes, verify the resulting schema and policies with read-only SQL and run Supabase security advisors.

## UI rule: never hide or truncate text

**No text in the application may be clipped, truncated, ellipsized, or otherwise
left incomplete.** Prefer wrapping (`break-words`) and growing vertically over
`truncate`, `line-clamp-*`, `text-ellipsis`, `whitespace-nowrap` with overflow
hidden, or “+N more” summaries that hide names/labels. Also avoid horizontal
scrolling as a way to fit more columns — redesign the layout instead.

This applies app-wide (lists, tables, badges, navigation, dialogs).

## UI rule: cards and grids must align

The shared `Card` primitive is a full-height flex column. Cards placed in the same
grid row must use the available row height so their top and bottom edges align.
Keep grid containers at the default stretch alignment or use `items-stretch` and
`auto-rows-fr` for repeated summary cards.

Use `h-fit` only for an intentionally compact standalone card or a populated
sticky sidebar. Do not use it for empty states, KPI cards, comparison cards, or
other sibling panels that should appear symmetrical. Use `min-h-*` rather than a
fixed height so wrapped text remains fully visible. For KPI cards, reserve a
consistent title area and push the supporting text to the bottom of the card.

## Aikataulutus progress

`/aikataulutus` lists `project_phases`. The percentage is **not** a free-form
slider: it is `completed/total` linked `work_orders` (`Valmis`/`Peruttu` count).
Phases without linked work orders show “Ei työmääräyksiä” instead of a fake 0%.
DB trigger `private.refresh_project_phase_progress` keeps stored progress in sync
when work-order status changes.

## Resurssikalenteri team scope

`/tyovuorokalenteri` can show **all**, **my team**, or a chosen supervisor's team.
Teams come from `supervisor_team_members` bridged to calendar rows via
`employees.user_id` (`src/lib/calendarTeamFilter.ts`). Do not use `project_members`
for this filter.

## Resurssikalenteri → työmääräykset

Calendar create dialog can (1) assign an installer to an existing open work order,
(2) create a new work order for that day, or (3) add a manual shift. Work-order
paths go through `saveManagedWorkOrder` / `save_work_order_v2` so
`private.sync_work_order_calendar` owns the blue calendar cards. Pure helpers live
in `src/lib/calendarWorkOrderBooking.ts`. Clicking a work-order card opens
`/tyomaaraykset?edit=<id>`. Project-linked assignment still requires the person to
be on `project_members`.

## Project works: contacts + files

`/projektit/:id` (`ProjectWorks`) shows **Päähenkilöt ja yhteystiedot** plus
**Projektin tiedostot** above the work-plan list
(`ProjectContactsFilesPanel`). Files reuse `project_documents` /
`project-documents` storage via `uploadProjectDocument`. Customer contacts come
from `customer_contacts` when the project has `customerId`. Deep-link
`/projektit/:id/tyotila?tab=documents` opens the full documents tab.

## Project message alerts for supervisors

New `project_messages` rows create `app_notifications` of type
`project_message_new` for the project's `responsible_supervisor_id` and any
`supervisor` on `project_members` (see migration
`20260728114500_project_message_supervisor_notifications.sql`). Opening the
conversation marks the matching notification resolved via
`mark_project_messages_read`. Header path matching allows nested routes like
`/projektikeskustelut/:id`.
