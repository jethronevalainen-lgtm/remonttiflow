# AGENTS.md

## Cursor Cloud specific instructions

VaKantti is a frontend-only SPA (React 18 + Vite 5 + TypeScript) against hosted
Supabase. Standard commands live in `README.md` / `package.json`.

### UI rule: never hide or truncate text

**No text in the application may be clipped, truncated, ellipsized, or otherwise
left incomplete.** Prefer wrapping (`break-words`) and growing vertically over
`truncate`, `line-clamp-*`, `text-ellipsis`, `whitespace-nowrap` with overflow
hidden, or “+N more” summaries that hide names/labels. Also avoid horizontal
scrolling as a way to fit more columns — redesign the layout instead.

This applies app-wide (lists, tables, badges, navigation, dialogs).

### Aikataulutus progress

`/aikataulutus` lists `project_phases`. The percentage is **not** a free-form
slider: it is `completed/total` linked `work_orders` (`Valmis`/`Peruttu` count).
Phases without linked work orders show “Ei työmääräyksiä” instead of a fake 0%.
DB trigger `private.refresh_project_phase_progress` keeps stored progress in sync
when work-order status changes.

### Resurssikalenteri team scope

`/tyovuorokalenteri` can show **all**, **my team**, or a chosen supervisor's team.
Teams come from `supervisor_team_members` bridged to calendar rows via
`employees.user_id` (`src/lib/calendarTeamFilter.ts`). Do not use `project_members`
for this filter.

### Resurssikalenteri → työmääräykset

Calendar create dialog can (1) assign an installer to an existing open work order,
(2) create a new work order for that day, or (3) add a manual shift. Work-order
paths go through `saveManagedWorkOrder` / `save_work_order_v2` so
`private.sync_work_order_calendar` owns the blue calendar cards. Pure helpers live
in `src/lib/calendarWorkOrderBooking.ts`. Clicking a work-order card opens
`/tyomaaraykset?edit=<id>`. Project-linked assignment still requires the person to
be on `project_members`.

### Project works: contacts + files

`/projektit/:id` (`ProjectWorks`) shows **Päähenkilöt ja yhteystiedot** plus
**Projektin tiedostot** above the work-plan list
(`ProjectContactsFilesPanel`). Files reuse `project_documents` /
`project-documents` storage via `uploadProjectDocument`. Customer contacts come
from `customer_contacts` when the project has `customerId`. Deep-link
`/projektit/:id/tyotila?tab=documents` opens the full documents tab.

### Project message alerts for supervisors

New `project_messages` rows create `app_notifications` of type
`project_message_new` for the project's `responsible_supervisor_id` and any
`supervisor` on `project_members` (see migration
`20260728114500_project_message_supervisor_notifications.sql`). Opening the
conversation marks the matching notification resolved via
`mark_project_messages_read`. Header path matching allows nested routes like
`/projektikeskustelut/:id`.
