# Phase 38: Data Freshness UX - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the existing `LastUpdated` component (already in the header, visible on all tabs) to show human-readable relative time ("3 hours ago") that ticks forward client-side in real time. The API, hook, and component already exist — this phase is a targeted upgrade to the display format and update behaviour.

</domain>

<decisions>
## Implementation Decisions

### Relative Time Format
- **D-01:** Use full-word relative format: "just now" (<1 min), "X min ago" (1–59 min), "X hours ago" (1–47 hr), "X days ago" (2+ days). No abbreviations ("3h ago" rejected).
- **D-02:** No prefix — "3 hours ago" not "Updated 3 hours ago". Keep it concise.

### Real-Time Update Mechanism
- **D-03:** Client-side interval only. A `setInterval` (e.g. every 30 seconds) re-formats the already-fetched timestamp. No additional API polling — the data itself doesn't change between pipeline runs, so refetching `/api/last-updated` on an interval is unnecessary.
- **D-04:** The existing `useLastUpdated` `staleTime: 1h` is fine — the query fetches once on mount. The component owns the ticking display.

### Stale Threshold & Colour
- **D-05:** Trust the API `stale: boolean` flag. When `stale === true`, text goes amber. No client-side age-based rule — the pipeline knows its own staleness threshold.
- **D-06:** Current amber class `text-amber-600` is correct. Normal state stays `text-zinc-400`.

### Placement
- **D-07:** Header only. The component already renders in the top-right header above all content — it's visible on every tab without scrolling. No additional anchoring in section sticky bars or tooltips needed. This satisfies FRE-01.

### Claude's Discretion
- Interval tick rate (30s suggested — adjust if too chatty)
- Whether to clear/reset the interval on unmount (standard React cleanup — planner decides)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Implementation (extend, don't replace)
- `src/components/LastUpdated.tsx` — current component: `LastUpdatedDisplay` (pure, testable) + `LastUpdated` (connected). Extend `LastUpdatedDisplay` to accept formatted string instead of raw timestamp, or add relative formatting logic here.
- `src/lib/hooks/useLastUpdated.ts` — TanStack Query hook returning `{ last_updated: string, stale: boolean }`. `staleTime: 1h`. No changes needed to the hook itself.
- `src/app/api/last-updated/route.ts` — API route reading `last_updated.json` from Vercel Blob or local cache. No changes needed.

### Requirements
- `FRE-01`: Every tab displays "Updated X ago" visible without scrolling → satisfied by header placement (D-07)
- `FRE-02`: Human-readable relative time, not ISO timestamp → D-01
- `FRE-03`: Updates in real time within a session → D-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LastUpdatedDisplay` (pure component, already testable): accepts `{ timestamp: string, stale: boolean }`. The plan should extend it to accept a pre-formatted `relativeTime: string` instead of raw timestamp, OR add a `formatRelativeTime(timestamp)` pure utility and call it from the component.
- `useLastUpdated` hook: already wired, no changes needed.

### Established Patterns
- Pure/connected component split already in place (DAT-02 pattern from prior phase): `LastUpdatedDisplay` is the pure render, `LastUpdated` is the connected wrapper. Keep this split — add interval logic in the connected component, keep the display component pure for tests.
- Tailwind dark mode: `dark:text-zinc-400` / `dark:text-amber-500` — match existing pattern.
- `'use client'` directive required (component uses hooks/side-effects).

### Integration Points
- `src/app/page.tsx` line 79: `<LastUpdated />` in the header — no change to placement needed.
- The interval must be cleaned up in `useEffect` return to avoid memory leaks.

</code_context>

<specifics>
## Specific Ideas

- "just now" for sub-1-minute freshness — friendly and reassuring
- The existing `stale` boolean and amber colour treatment are already correct; only the timestamp→relative-time conversion is new work

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 38-Data Freshness UX*
*Context gathered: 2026-04-29*
