# Phase 132: Deadline Day Banner - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 132 adds a persistent deadline countdown banner above the section nav in `page.tsx`. The banner:
1. Fetches the next GW's `deadline_time` from the FPL bootstrap via a new `useNextDeadline` hook
2. Counts down to that deadline with a 60-second tick, showing `"GWX deadline in Xh Ym"`
3. Escalates visual urgency through three states: zinc neutral (>24h), amber (2–24h), red + position:sticky (<2h)
4. Allows per-GW dismiss via localStorage — banner reappears automatically when the next GW's deadline becomes active
5. Renders null when no upcoming deadline exists (off-season, no `is_next` event)

</domain>

<decisions>
## Implementation Decisions

### Data Source (DL-01)
- **D-01:** New `useNextDeadline` hook calls `/api/fpl/bootstrap-static/` directly — same pattern as `useSettledGws`. No new Route Handler. TanStack Query `staleTime: 60 * 60 * 1000` (1h). Returns `{ id: number; deadline_time: string } | null` — null when no `is_next` event exists.
- **D-02:** Next event detection: `events.find(e => e.is_next) ?? null`. If null → banner renders null. No fallback to `is_current` — a past-deadline current event is not actionable.

### Countdown Tick + Format (DL-01)
- **D-03:** `setInterval` at 60 000ms — mirrors `LastUpdated.tsx`. No 1-second sub-interval. Format: always `"Xh Ym"` (e.g. "GW32 deadline in 14h 22m"). Claude decides how to handle the "0h Ym" case (e.g. "0h 45m" vs "45m") — either is fine; consistency with the format is what matters.
- **D-04:** Banner label format: `"GW{id} deadline in {hours}h {minutes}m"`. Hours and minutes are floor-rounded. Once deadline_time is in the past, banner hides (same as off-season null case).

### Urgency States (DL-02)
- **D-05:** Three states computed from `msRemaining`:
  - `'neutral'`: `>= 24 * 60 * 60 * 1000` — zinc colour scheme, normal document flow
  - `'amber'`: `>= 2 * 60 * 60 * 1000` and `< 24h` — amber colour scheme, normal flow
  - `'red'`: `< 2 * 60 * 60 * 1000` — red colour scheme + `position: sticky, top: 0` with z-index above the section nav
- **D-06:** State transitions fire automatically via the 60s tick — no page reload required (DL-02 SC-2).

### Dismiss Behaviour (DL-03)
- **D-07:** Dismiss button is visible in **all three urgency states** including red. User always has the option to dismiss.
- **D-08:** localStorage key: `deadline-dismissed:GW{id}` (e.g. `deadline-dismissed:GW33`). On render, if `localStorage.getItem('deadline-dismissed:GW{id}') !== null` → banner is hidden. When the next GW's `is_next` event advances (i.e. `id` changes), the stored key won't match, so the banner automatically reappears.
- **D-09:** localStorage read/write wrapped in try/catch (private browsing / SSR guard) — same pattern as page.tsx Phase 98 lines 132–137.

### Off-Season Behaviour
- **D-10:** If `useNextDeadline` returns null (no `is_next` event), the banner component renders null. No placeholder, no "Season complete" state. The banner slot disappears entirely until FPL activates next season's GW schedule.

### Claude's Discretion
- Exact sub-hour format (`"0h 45m"` vs `"45m"`) — either is acceptable; pick the cleaner one
- Whether `useNextDeadline` lives in `src/lib/hooks/` alongside `useSettledGws` or inside a banner-specific module
- Exact z-index value for the sticky red state (must sit above the section nav)
- Whether `DeadlineBanner` is a standalone component file or colocated with its hook

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DL-01 (countdown display), DL-02 (3-state urgency), DL-03 (per-GW dismiss). Read requirement text and acceptance criteria before planning.

### Bootstrap fetch pattern (hook to follow)
- `src/lib/hooks/useSettledGws.ts` — exact pattern for a hook that calls `/api/fpl/bootstrap-static/`, uses `parseFPLBootstrap`, and wraps with TanStack Query. `useNextDeadline` should follow the same structure.
- `src/lib/fpl-adapter.ts` — `FPLEventSchema` (includes `is_next`, `deadline_time`), `parseFPLBootstrap`. Import from here; do NOT re-define schema types.

### Timer pattern
- `src/components/LastUpdated.tsx` — canonical `setInterval`/`clearInterval` in `useEffect` pattern. `useNextDeadline` or `DeadlineBanner` should follow the same dependency-array discipline.

### localStorage per-GW dismiss pattern
- `src/app/page.tsx` lines 127–138 — Phase 98 PGW-04 per-GW auto-surface pattern using `localStorage.getItem/setItem` with `pgw-reviewed:GW{N}` key and try/catch guard. Use same structure for `deadline-dismissed:GW{id}`.

### Nav integration
- `src/app/page.tsx` — banner renders above the section nav. Read the full file to understand nav structure and where to inject `<DeadlineBanner />`. Banner is NOT a SubTab — it's a top-level layout element.
- `src/components/nav/MobileNav.tsx` — understand mobile nav layout to ensure sticky banner doesn't conflict with mobile bottom bar.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseFPLBootstrap` (`src/lib/fpl-adapter.ts`) — validates bootstrap shape; re-use directly in `useNextDeadline`
- `FPLEvent.is_next` + `FPLEvent.deadline_time` — already typed; `events.find(e => e.is_next)?.deadline_time` is the deadline source
- `setInterval`/`clearInterval` pattern (`LastUpdated.tsx`) — direct template for the 60s countdown tick

### Established Patterns
- TanStack Query hook: `staleTime: 60 * 60 * 1000`, `retry: 1`, query disabled when data absent — see `useSettledGws`
- localStorage try/catch guard: always wrap `getItem`/`setItem` in try/catch for SSR / private browsing safety (page.tsx lines 132–137)
- Colour-scheme pattern: `bg-X-50 text-X-700 dark:bg-X-950 dark:text-X-300` for banner urgency states — check existing amber/red alert patterns in codebase

### Integration Points
- `src/app/page.tsx` — add `<DeadlineBanner />` immediately above the section nav (before the `<nav>` / desktop tab row). Import hook and component here.
- `src/lib/types.ts` — check if any new types are needed; `FPLEvent` is already defined; only add types if `useNextDeadline` returns a new shape

</code_context>

<specifics>
## Specific Ideas

- The banner text follows the ROADMAP.md example exactly: `"GW32 deadline in 14h 22m"` — keep it concise, no extra copy
- Red sticky z-index must sit above the section nav (which has its own stacking context); inspect nav z-index before setting banner z-index
- The dismiss button should be visually minimal (×, not "Dismiss") — consistent with off-screen dismissal patterns in the app

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 132-deadline-day-banner*
*Context gathered: 2026-05-22*
