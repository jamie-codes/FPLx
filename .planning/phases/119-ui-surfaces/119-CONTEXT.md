# Phase 119: UI Surfaces - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `useLineupNews` data into three UI surfaces so confirmed-absent and doubted players are visually flagged:

1. **UI-01** — `CaptainPicksPanel` `CandidateRow`: show a `StatusLabelBadge` per player when lineupNews is available and status is doubted or confirmed_absent
2. **UI-02** — `TransferPanel` `OpportunityCostTable` buy-candidate cells: prop-drill `lineupNewsMap` to show `StatusLabelBadge` for doubted/absent buy candidates
3. **UI-03** — `DecisionSummaryTab` Team News Alert: standalone section (below 2×2 card grid, above prose) listing all 15 owned squad players flagged doubted/absent via lineupNews
4. **UI-04** — `DecisionSummaryTab` threads `lineupNewsMap` into its `suggestTransfers()` call so OCS table rankings reflect availability penalties

Pure TypeScript/TSX changes — no Python, no new API routes, no new hooks (uses existing `useLineupNews`).

</domain>

<decisions>
## Implementation Decisions

### StatusLabelBadge Component

- **D-01:** Create a shared `src/components/shared/StatusLabelBadge.tsx` component — same pattern as `FragilityBadge`, `MinsRiskBadge`, `LifecycleLabelBadge`. Single source of truth for colors and label text.
- **D-02:** Visual treatment: colored pill with background (not text-only, not icon-only). `confirmed_absent` → red pill, `doubted` → amber pill, `confirmed_start` → (not shown, see D-04).
- **D-03:** Label text: full status_label with underscores replaced by spaces — "confirmed absent", "doubted". Do not abbreviate.

### Badge Visibility Rules

- **D-04:** Show `StatusLabelBadge` **only for doubted and confirmed_absent**. Omit for `confirmed_start` — it's the expected baseline and would add noise to every healthy player row.
- **D-05:** `unknown` status_label → no badge. Consistent with Phase 118 D-03 (unknown = availability_factor 1.0 = no penalty). No visual signal for no-information.

### NewsBanner Coexistence

- **D-06:** Show **both** `StatusLabelBadge` (lineupNews structured signal) and `NewsBanner` (FPL free-text news) when both are present. They carry different signal: structured status vs. raw injury text (e.g., "knock, 50% chance to play"). Do not suppress either.
- **D-07:** `StatusLabelBadge` renders before `NewsBanner` within the inline badge cluster in `CandidateRow` (structured signal first).

### Data Wiring — CaptainPicksPanel

- **D-08:** `CandidateRow` calls `useLineupNews()` directly inside the component. The query is already cached from other consumers — zero additional fetches. Lookup: `lineupNewsMap?.get(candidate.id)`.

### Data Wiring — OpportunityCostTable

- **D-09:** `OpportunityCostTable` receives `lineupNewsMap?: Map<number, LineupNewsPlayer>` as an **optional prop**. Backward-compatible — when absent, no badge renders. `TransferPanel` and `DecisionSummaryTab` (which already call `useLineupNews()` for UI-04) prop-drill it down.

### Team News Alert (UI-03)

- **D-10:** Placement: standalone section rendered **between the 2×2 card grid and `ProseSummaryBlock`**. Grid layout stays intact. Section renders conditionally — omitted entirely when no owned players have doubted/absent status.
- **D-11:** Scope: all **15 squad players** (not just starting XI). Bench players' availability matters — they may be forced into the XI.
- **D-12:** Data source: `useLineupNews()` map (same hook used for UI-04, already in component). Filter: `status_label === 'doubted' || status_label === 'confirmed_absent'`. The 48h staleness gate is already handled by the hook's `select` transform (returns `undefined` when stale). No additional 14-day gate needed here — the requirements' "within 14 days" language refers to NEWS-01 / NewsBanner FPL text, not lineupNews.

### UI-04 — suggestTransfers Wiring

- **D-13:** `DecisionSummaryTab` adds `useLineupNews()` hook call (alongside existing hooks) and passes `lineupNewsMap` into its `suggestTransfers()` call. Same for `computeOpportunityCostRows` if it threads through — verify the call chain in `DecisionSummaryTab`. Planner should check whether `suggestTransfers` is called directly or via an intermediate function in this file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §UI-01..UI-04 — exact requirement wording
- `.planning/ROADMAP.md` Phase 119 — 4 success criteria (captain badge, OCS badge, Team News Alert, OCS table penalties)

### Prior Phase Context (MUST read)
- `.planning/phases/118-engine-integration/118-CONTEXT.md` — Phase 118 decisions: D-02 (0.01 floor), D-03 (unknown=1.0), D-07 (lineupNewsMap is optional everywhere), D-08 (only confirmed_absent triggers exclusion); D-09 (staleness gate in hook, not engines)
- `.planning/phases/115-team-news-wiring/115-CONTEXT.md` — Phase 115 NEWS-01/NEWS-02: NewsBanner staleness gate (14-day zinc suppression), NewsBanner wired into CaptainPicksPanel CandidateRow inline

### Components to Modify
- `src/components/captaincy/CaptainPicksPanel.tsx` — `CandidateRow` (add `useLineupNews()` call + `StatusLabelBadge`)
- `src/components/transfers/OpportunityCostTable.tsx` — buy-candidate cell (add `lineupNewsMap` prop + `StatusLabelBadge`)
- `src/components/squad/DecisionSummaryTab.tsx` — add `useLineupNews()`, thread into `suggestTransfers()`, add Team News Alert section

### New Component to Create
- `src/components/shared/StatusLabelBadge.tsx` — new shared badge, analogous to `src/components/shared/MinsRiskBadge.tsx` and `src/components/shared/FragilityBadge.tsx`

### Hook (read-only — already implemented)
- `src/lib/hooks/useLineupNews.ts` — returns `Map<number, LineupNewsPlayer> | undefined`; undefined when stale or absent; 6h staleTime (TanStack Query cached)

### Types (already defined — read for interface)
- `src/lib/types.ts` — `LineupNewsPlayer` (id, availability_factor, status_label, scraped_at), `StatusLabel` ('confirmed_start' | 'doubted' | 'confirmed_absent' | 'unknown')

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/shared/MinsRiskBadge.tsx` — closest analog: colored pill badge, no props beyond the label value. `StatusLabelBadge` follows the same pattern.
- `src/components/shared/FragilityBadge.tsx` — another pill badge with tier→color mapping. Confirms pill-with-background is the established shared-badge pattern.
- `src/components/news/NewsBanner.tsx` — `NewsBanner` is text-based (no background); `StatusLabelBadge` is distinct (pill). They coexist as different visual weights in the same row.
- `src/lib/hooks/useLineupNews.ts` — `useLineupNews()` already returns the map directly via `select` transform; no adapter needed.

### Established Patterns
- Shared badge components in `src/components/shared/` — no logic, pure presentation. `StatusLabelBadge` takes `statusLabel: StatusLabel | undefined` and returns null when undefined or unknown/confirmed_start.
- Optional prop backward-compat: `OpportunityCostTable` already has optional props (`totalsByPosition?`, `targetGw?`). Adding `lineupNewsMap?` follows the same pattern.
- Hook-in-component (no prop-drill): `CandidateRow` already imports `useNewsFlagEnabled` (via `NewsBanner` → `useAccuracy`). Calling `useLineupNews()` directly is consistent with CandidateRow being a client component with hook access.

### Integration Points
- `DecisionSummaryTab.tsx` already calls `suggestTransfers()` at line ~220 (ocsSuggestions memo). UI-04 adds `lineupNewsMap` to that call's params object.
- `TransferPanel.tsx` also calls `suggestTransfers()` and `OpportunityCostTable` — planner must check whether Phase 119 scopes TransferPanel's OCS table badge (UI-02) to TransferPanel and/or DecisionSummaryTab's embedded OCS. Success criterion 2 says "TransferPanel OCS buy-candidate rows" — TransferPanel is the primary target; DecisionSummaryTab gets it via prop-drill once TransferPanel is done.
- Team News Alert section in `DecisionSummaryTab` needs `myTeamData` (for squad pick IDs) + `lineupNewsMap`. Both are already derivable from hooks already present: `useMyTeam()` (existing) and `useLineupNews()` (added for UI-04).

</code_context>

<specifics>
## Specific Ideas

- `StatusLabelBadge` receives `statusLabel: StatusLabel | undefined` and returns null for `confirmed_start`, `unknown`, and `undefined`. Only renders for `doubted` (amber) and `confirmed_absent` (red).
- In `CandidateRow`, badge placement: after `mcLabel` and before `NewsBanner` in the inline flex cluster (structured signal first per D-07).
- Team News Alert empty state: when `lineupNewsMap` is undefined (stale/absent) or no owned players are flagged, render nothing (the section is completely absent — no "No alerts" placeholder).
- For `OpportunityCostTable` buy cell, `StatusLabelBadge` renders alongside the existing `RotationRiskBadge` and `NewsBanner` already in that cell.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 119-UI Surfaces*
*Context gathered: 2026-05-17*
