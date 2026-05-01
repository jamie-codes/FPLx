# Phase 43: Lineup Engine & Navigator - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 43 delivers:
1. A pure TypeScript lineup optimiser engine (`src/lib/optimise-lineup.ts`) that enumerates C(15,11)=1,365 subsets of the user's 15-player squad and selects the best starting XI, bench order, captain, and vice-captain by xPts.
2. A pitch-layout `OptimiserPanel` UI component (`src/components/optimiser/OptimiserPanel.tsx`) that displays the optimised lineup on a visual football field.
3. NAV-01: Squad section gains Transfers | Optimiser sub-tabs; Team ID state is lifted to page.tsx so both sub-tabs share squad data.

Requirements in scope: OPT-01, OPT-02, OPT-03, OPT-04, OPT-05, NAV-01.
Phase 44 (comparison output), Phase 45 (transfer-aware mode), and Phase 46 (chip modes) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Panel Layout
- **D-01:** OptimiserPanel uses a **pitch layout** — a visual football field graphic with players positioned by formation. GK at bottom (FPL convention), defenders above, midfielders, forwards at top.
- **D-02:** Formation label is shown explicitly (e.g., "Formation: 4-3-3") near the top of the panel, above the pitch. This makes it clear which shape was selected by the engine and why the DEF/MID/FWD split looks the way it does.
- **D-03:** Captain and VC are indicated with **(C)** and **(VC)** text labels next to the player name on the pitch. No armband icon needed — text label is sufficient.
- **D-04:** Bench is shown below the pitch as a horizontal row of 4 slots. GK bench slot is visually separated (isolated at slot 0, FPL rule OPT-04). Outfield bench positions ordered by xPts descending.

### Navigation (NAV-01)
- **D-05:** Squad section default sub-tab is **Transfers** — preserves existing muscle memory. The user explicitly navigates to Optimiser.
- **D-06:** `SubTab` union type in `page.tsx` gains `'transfers'` and `'optimiser'`. The Squad entry in `SECTIONS` changes from `subTabs: []` to two sub-tabs with `defaultSubTab: 'transfers'`.
- **D-07:** `sectionMemory` initial state changes: `squad: null` → `squad: 'transfers'`.
- **D-08:** The `activeSection !== 'squad'` guard on the desktop sub-tab row is removed — Squad now also shows a sub-tab row. The squad-specific spacer (`<div className="mb-6 hidden sm:block" />`) is also removed as a result.
- **D-09:** Content render guards change: `activeSection === 'squad' && <TransferPanel />` → `activeSection === 'squad' && activeSubTab === 'transfers' && <TransferPanel />` and `activeSection === 'squad' && activeSubTab === 'optimiser' && <OptimiserPanel ... />`.
- **D-10:** MobileNav: Squad sub-tab pills are shown when Squad section is active (same pill-row pattern as Analyse and Plan).

### Squad Data Access
- **D-11:** Team ID state is **lifted to `page.tsx`**. Both TransferPanel and OptimiserPanel receive `teamId` (and the loaded squad picks) as props. User enters Team ID once; both sub-tabs see the same squad. TransferPanel is refactored to accept `teamId` / `onTeamIdChange` / `squadPicks` props (or the relevant subset) rather than owning state locally.

### Engine Architecture
- **D-12:** Engine file: `src/lib/optimise-lineup.ts` — mirrors `chip-strategy-engine.ts` pattern (pure functions, no side effects, no imports beyond types).
- **D-13:** Engine input signature: `optimiseLineup({ picks: SquadPick[], players: MergedPlayer[], horizon: OptimiserHorizon })` where `OptimiserHorizon = 1 | 3 | 5`.
- **D-14:** Engine output type: `OptimisedLineup { starters: number[], bench: number[], captainId: number, vcId: number, formation: string }` where ids are FPL element IDs and `formation` is e.g. `'4-3-3'`.
- **D-15:** BGW exclusion uses `xPts_1gw === 0` as the BGW proxy — consistent with WR-02/WR-03 BGW exclusion logic in Differential Tracker. Players with zero 1-GW xPts are treated as BGW and hard-excluded from starting XI.
- **D-16:** BGW warning: if the available eligible starters (after BGW exclusion) < 11, an amber info banner is shown above the pitch (OPT-05). No pitch shown until at least 11 eligible players exist — or show partial with placeholder slots.

### Horizon Selector
- **D-17:** New type `OptimiserHorizon = 1 | 3 | 5` in `src/lib/types.ts`. The panel uses a 3-button pill toggle (1GW | 3GW | 5GW) — same visual pattern as GwToggle in GemTable, NOT the 5-option HorizonSelector from PlannerTab.
- **D-18:** Horizon state lives inside OptimiserPanel (local state), not lifted to page.tsx. No cross-tab persistence needed for the optimiser horizon.

### Claude's Discretion
- Exact CSS layout for the pitch (likely CSS Grid with absolute-positioned player circles or a `display: grid` with named template areas per formation). Use a green-tinted background div to suggest the pitch aesthetic — no complex SVG.
- Formation enum: support the common FPL formations (3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1) — the subset of valid FPL formations. Formation is auto-derived from the enumerated best-XI (count DEF/MID/FWD in starters).
- Player circle diameter, typography, and spacing follow existing Tailwind v4 patterns.
- No new npm dependencies — pure TypeScript engine, CSS-only pitch.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `REQUIREMENTS.md` §v1.6 Requirements — OPT-01 through OPT-05 and NAV-01 are the locked requirements for this phase. Read the full traceability table.

### Existing engine analogue
- `src/lib/chip-strategy-engine.ts` — Structural pattern for `optimise-lineup.ts`: pure functions, no side effects, typed I/O, testable in isolation. Read before writing the engine.

### Navigation wiring (must read before touching page.tsx or MobileNav)
- `src/app/page.tsx` — Current SubTab union, SECTIONS constant, sectionMemory state, Squad special-casing, and content render guards. Every Squad-related special case must be updated atomically.
- `src/components/nav/MobileNav.tsx` — Current MobileNav pill-row logic. Squad section must gain pill-row support matching the Analyse/Plan pattern.

### Squad data layer
- `src/lib/squad-adapter.ts` — `SquadPick`, `EntryHistory`, `MyTeamPick` types and Zod schemas. Engine input `picks: SquadPick[]` is this type.
- `src/app/api/squad/[teamId]/route.ts` — Existing route for public squad picks. No new route needed.

### Type system
- `src/lib/types.ts` — `MergedPlayer`, `PlannerHorizon`, and all shared types. New `OptimiserHorizon = 1 | 3 | 5` type added here.

### TransferPanel (must understand before refactoring state)
- `src/components/transfers/TransferPanel.tsx` — Currently owns teamId state. Phase 43 lifts teamId to page.tsx; TransferPanel becomes a controlled component accepting teamId as prop.

### Tests (must update when nav changes)
- `src/app/page.test.tsx` — Phase nav tests. SubTab union change and Squad sub-tab additions will require test updates.
- `src/components/nav/MobileNav.test.tsx` — MobileNav tests. Squad pill-row additions require test updates.

### Next.js docs
- `node_modules/next/dist/docs/` — Read relevant guide before writing any Next.js code (AGENTS.md mandate).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/chip-strategy-engine.ts` — Direct structural template for `optimise-lineup.ts`. Same pure-function pattern, same import discipline.
- `src/components/gem-table/GwToggle.tsx` — `PresetToggle` segmented button visual pattern to reuse for the 3-button OptimiserHorizon selector (1GW | 3GW | 5GW).
- `src/lib/squad-adapter.ts` — `SquadPick` type is the engine's pick input. No new adapter needed.
- `src/components/squad/SquadView.tsx` — Has `POSITION_LABELS`, `StatusBadge`, and position-grouping logic that may inform OptimiserPanel player card structure.
- `src/app/api/squad/[teamId]/route.ts` — Existing public picks route; no new route needed.

### Established Patterns
- Pure engine files in `src/lib/` follow the chip-strategy-engine.ts pattern: typed exports, no React imports, no side effects.
- TanStack Query hooks in `src/lib/hooks/` with `useQuery`, 6h staleTime, typed generics. If a new hook is needed for squad-join data, follow `useAccuracy.ts` / `usePlayers.ts`.
- Sub-tab content guards: `activeSection !== 'squad' && activeSubTab === 'X' && <ComponentX />`. After D-09, Squad follows the same pattern as other sections.
- Component directory: new `src/components/optimiser/` directory following `src/components/accuracy/`, `src/components/captaincy/` pattern.
- No `Co-Authored-By` in git commits (CLAUDE.md).

### Integration Points
- `page.tsx`: Team ID state lifted here (D-11). Squad section gets sub-tabs (D-06, D-08, D-09). TransferPanel and OptimiserPanel both mounted from here with shared teamId prop.
- `MobileNav.tsx`: Squad must gain pill-row (same pattern as Analyse/Plan pill-rows). `SECTIONS` const from page.tsx already drives the mobile nav — updating SECTIONS propagates automatically IF MobileNav's guard for Squad is relaxed.
- `src/lib/types.ts`: Add `OptimiserHorizon = 1 | 3 | 5` and `OptimisedLineup` type.

</code_context>

<specifics>
## Specific Ideas

- Pitch layout: GK at bottom (FPL convention), forwards at top. Pitch background: subtle green-tinted `bg-green-950` or `bg-emerald-950` dark div. No SVG — CSS only.
- Formation label placed above the pitch, inline with the horizon selector: `[Formation: 4-3-3]    [1GW] [3GW] [5GW]`
- Player circles on the pitch: player web_name truncated, xPts shown below, (C)/(VC) badge inline.
- BGW amber banner (D-16): shown above pitch when eligible starters < 11. Uses same amber styling as `LastUpdated` stale colour (`text-amber-600 dark:text-amber-500`, amber border).

</specifics>

<deferred>
## Deferred Ideas

- **Pitch orientation toggle** (portrait vs landscape) — not needed for v1.6; pitch is portrait only.
- **Formation preference picker** — user locks a preferred formation before optimisation. Deferred to REQUIREMENTS.md Future Requirements.
- **Player locking** — user pins must-start players. Deferred to REQUIREMENTS.md Future Requirements.
- **Captain swap what-if** — simulation. Deferred.

None of the above came up during discussion — all are already in REQUIREMENTS.md deferred list.

</deferred>

---

*Phase: 43-Lineup Engine & Navigator*
*Context gathered: 2026-04-30*
