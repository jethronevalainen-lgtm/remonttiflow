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
