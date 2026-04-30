# Phase 44: Comparison Output - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 44 delivers:
1. A comparison view inside `OptimiserPanel` that **replaces** the Phase 43 pitch layout — the position-grouped table IS the primary output after optimisation runs.
2. A headline row above the table: `Formation: 4-3-3 | Changes: N players | +X.X xPts gain` (CMP-02).
3. A full 15-slot position-grouped table (GK / DEF / MID / FWD sections for the XI + a Bench section) showing current FPL lineup vs optimised lineup side-by-side with per-slot xPts (CMP-01).
4. Mobile stacking: table columns become vertical per-slot rows on `< sm` breakpoint; only changed rows are highlighted (CMP-03).

Requirements in scope: CMP-01, CMP-02, CMP-03.
Phase 45 (transfer-aware mode) and Phase 46 (chip modes) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### View Integration
- **D-01:** The comparison table **replaces** Phase 43's pitch layout. `OptimiserPanel` no longer renders the green pitch div, player circles, or bench row. The comparison table is the sole output once `optimiseLineup()` returns a result.
- **D-02:** The horizon selector (1GW | 3GW | 5GW pill toggle) is retained — it sits above the headline row, unchanged from Phase 43.

### Comparison Table Structure
- **D-03:** Table is **position-grouped**: sections headed GK / DEF / MID / FWD for the starting XI, followed by a **Bench** section for the 4 bench slots. All 15 player slots shown.
- **D-04:** Each row has four columns: `Current player name | Current xPts | → | Optimised player name | Optimised xPts | delta pill`. Unchanged rows leave the delta cell empty.
- **D-05:** "Current lineup" is derived from `SquadPick.position <= 11` (starting XI) and `position >= 12` (bench). This is the user's FPL-submitted lineup from the `useSquad` hook — no additional computation required.
- **D-06:** Bench row delta shows a **Promoted** or **Dropped** badge (not a numeric xPts delta) for changed bench slots. Starting-XI row deltas show numeric `+X.X xPts` pill.

### Headline Row (CMP-02)
- **D-07:** The headline lives between the horizon selector and the table: `Formation: 4-3-3  │  Changes: N players  │  +X.X xPts gain`. Formation is the string from `OptimisedLineup.formation`. Total xPts gain is the sum of per-changed-starter delta (bench excluded from total, per D-06 rationale).

### Change Highlight Style (CMP-01, CMP-03)
- **D-08:** Changed rows get a **green 2px left accent border** (`border-l-2 border-green-500`) and a **green delta pill** (`+X.X xPts` in `text-green-400` with `bg-green-950 rounded px-1`). Unchanged rows are plain.
- **D-09:** On mobile (`< sm`), the two-column layout stacks: current player block above, optimised player block below, within each row card. Changed row cards get the same green left border. The Bench section and unchanged rows are visually de-emphasised (e.g. `opacity-60` on unchanged mobile cards — Claude's discretion).

### Claude's Discretion
- Exact Tailwind classes for the table layout (`grid` vs `table` vs `flex` columns) — follow existing TanStack Table/Tailwind v4 patterns; do NOT add TanStack Table for this view, plain HTML/Tailwind is sufficient.
- Mobile: whether to show a compact "Changes: N" badge above the stacked list (CMP-03 mentions "Changes badge" — interpret as a count badge in the headline area, not a per-row badge, since per-row highlighting already fulfils the requirement).
- Typography sizing follows 43-UI-SPEC.md spacing scale (xs/sm tokens).
- Bench GK slot is listed as a single row in the Bench section (no visual separator needed — the Bench section header provides context).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `REQUIREMENTS.md` §v1.6 Requirements — CMP-01, CMP-02, CMP-03 are the locked requirements for this phase. Read the full traceability table.

### Phase 43 Foundations (must understand before modifying OptimiserPanel)
- `.planning/phases/43-lineup-engine-navigator/43-CONTEXT.md` — All Phase 43 decisions (D-01 through D-18). Phase 44 replaces the pitch rendering (D-01 through D-04 from Phase 43) but preserves the engine, horizon selector, and data loading.
- `src/lib/optimise-lineup.ts` — The pure engine. Phase 44 does not change this file.
- `src/lib/types.ts` — `OptimisedLineup`, `OptimiserHorizon` types. No new types expected.

### Component to modify
- `src/components/optimiser/OptimiserPanel.tsx` — Phase 43 implementation. Phase 44 removes the pitch rendering block and replaces it with the comparison table. The `useSquad`, `usePlayers`, `useQuery`, horizon state, and `optimiseLineup()` call are all preserved.

### Squad data layer
- `src/lib/squad-adapter.ts` — `SquadPick` type with `position` (1–15) and `multiplier` fields. `position <= 11` = current starter; `position >= 12` = current bench.
- `src/lib/hooks/useSquad.ts` — Existing hook; no change needed.

### Design tokens
- `.planning/phases/43-lineup-engine-navigator/43-UI-SPEC.md` — Spacing scale, colour tokens, and component patterns to carry forward (Tailwind v4, no shadcn, Lucide React icons).

### Tests (must update)
- `src/components/optimiser/OptimiserPanel.test.tsx` — Phase 43 tests include pitch-specific assertions (player circles, bench row). These must be replaced with comparison table assertions.

### Next.js docs
- `node_modules/next/dist/docs/` — Read relevant guide before writing any Next.js code (AGENTS.md mandate).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/optimiser/OptimiserPanel.tsx` — Horizon selector, data loading (`useSquad`, `usePlayers`), `optimiseLineup()` call, BGW warning banner, empty/loading/error states all survive unchanged. Only the pitch rendering block is replaced.
- `src/lib/hooks/useSquad.ts` — Returns `SquadPicksResponse` with `picks[]`; `position <= 11` gives current XI directly — no new hook needed.
- Amber BGW warning banner (D-16 from Phase 43) — keep as-is; still relevant when eligible players < 11.

### Established Patterns
- `border-l-2 border-{colour}` accent border pattern used in existing alert/badge components — use this for changed row highlight.
- `text-[10px]` and `text-xs` are the existing small-label sizes (from PlayerCircle and badge patterns).
- `opacity-75` for bench items already in Phase 43 `PlayerCircle` — carry forward for unchanged bench rows on mobile.
- No new npm dependencies — plain Tailwind v4 table layout.

### Integration Points
- `src/components/optimiser/OptimiserPanel.tsx`: Remove `PlayerCircle`, pitch `div`, bench row, and formation label (pitch position). Replace with headline row + comparison table. Horizon selector stays. BGW banner stays.
- `src/app/page.tsx`: No changes needed — navigation wiring is Phase 43 work.
- `src/components/optimiser/OptimiserPanel.test.tsx`: Pitch/bench assertions replaced with table/headline assertions.

</code_context>

<specifics>
## Specific Ideas

- **Headline row format:** `Formation: 4-3-3  │  Changes: 2 players  │  +1.8 xPts gain` — all on one line, pipe-separated, above the table.
- **Changed row:** green 2px left border + green `+2.2 xPts` pill at row end. Unchanged rows: no border, no pill.
- **Bench changed rows:** `Promoted` badge (green) or `Dropped` badge (zinc/muted) instead of numeric delta.
- **Mobile:** single-column per row — current player block on top, optimised below, within a card. Changed cards get the green left border. Headline collapses to two lines if needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 44-Comparison Output*
*Context gathered: 2026-04-30*
