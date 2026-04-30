# Phase 46: Chip Modes - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 46 delivers:
1. A chip-mode selector in `OptimiserPanel` with four states: **None** (default), **Wildcard**, **Free Hit**, **Bench Boost**.
2. **Wildcard mode** (CHIP-01): A new `buildOptimalSquad()` pure engine that greedily selects the best 15-player squad from all available players (budget, formation rules, 3-per-club cap), scored by the user's active horizon. Output displayed in a `ChipSquadView` — position-grouped 15-player list with best XI highlighted.
3. **Free Hit mode** (CHIP-02): Same greedy squad engine as Wildcard but always uses `xPts_1gw` (1GW horizon), with a "this GW only — reverts next GW" notice. Same `ChipSquadView` output.
4. **Bench Boost mode** (CHIP-03): Re-uses the existing `optimiseLineup()` engine on the current squad. OptimiserPanel displays the enhanced comparison table with a Bench Boost headline showing total bench xPts. Bench section is visually prominent (not de-emphasised).

Requirements in scope: CHIP-01, CHIP-02, CHIP-03.
Phase 47+ and standalone squad builder are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Chip Mode Toggle

- **D-01:** Chip mode is selected via a **4-button pill toggle**: `None | WC | FH | BB`. It sits below the horizon selector and above the FT toggle row. Uses the same `role="group"` / `aria-pressed` pattern as `FtToggle.tsx`. Default state is `None` (matches current behaviour exactly). File: `src/components/optimiser/ChipModeToggle.tsx`.
- **D-02:** When **WC or FH** is active, the FT toggle is **hidden** (it is irrelevant — WC/FH rebuilds the squad from scratch; transfer cost is not applicable). When **BB** is active, the FT toggle remains visible (BB does not change the squad, so transfer suggestions are still relevant). When **None**, FT toggle visible as today.
- **D-03:** When WC or FH is active, the comparison table is **replaced** by `ChipSquadView`. The horizon selector remains visible — for WC it controls the scoring horizon; for FH it is greyed out / non-interactive (FH always scores by 1GW, shown with a tooltip).
- **D-04:** Chip mode state lives in `OptimiserPanel` local state (`useState<ChipMode>('none')`). No persistence needed — resets on page reload, which is fine (chip choices are situational).

### Wildcard / Free Hit Engine

- **D-05:** New pure-function engine file: `src/lib/chip-modes.ts`. Exports `buildOptimalSquad(params)` covering both WC and FH. Mirrors `src/lib/optimise-lineup.ts` pattern: no `'use client'`, no React, no side effects, importable in `@vitest-environment node` tests.
- **D-06:** `buildOptimalSquad` input: `{ players: MergedPlayer[], budget: number, horizon: OptimiserHorizon, teamCap?: number }`. Returns `ChipSquadResult | null` (null when < 15 available eligible players). Greedy algorithm: sort eligible players (status='a') by `HORIZON_FIELD[horizon]` descending, fill slots respecting `minSlots` / `maxSlots` per position, `teamCap = 3` per FPL club, running budget guard.
- **D-07:** Position quotas: exactly 2 GK, 3–5 DEF, 2–5 MID, 1–3 FWD, total = 15. Same slot constraints as the `computeFHResult()` algorithm in `chip-strategy-engine.ts` (verified). Do NOT import from chip-strategy-engine.ts — redeclare locally to keep engines decoupled.
- **D-08:** For **Free Hit**, `buildOptimalSquad` is always called with `horizon: 1` regardless of the user's selected horizon in the panel. The horizon selector in the panel is non-interactive (disabled appearance) when FH is active.
- **D-09:** BGW exclusion: WC and FH exclude players with `xPts_1gw === 0` (exact zero, same BGW proxy as Phase 43 D-15). For WC using horizon > 1, the xPts_1gw === 0 guard still applies (a BGW player is unreliable even in a longer horizon).
- **D-10:** `ChipSquadResult` type: `{ squad: ChipSquadPlayer[], bestXI: number[], formation: string, budgetUsed: number }`. `bestXI` is derived by running `optimiseLineup`-style enumeration on the 15 players returned by `buildOptimalSquad`. `ChipSquadPlayer`: `{ id, web_name, element_type, team, now_cost, xPts: number }`.

### Budget for WC / FH

- **D-11:** Budget source mirrors Phase 45 (D-09 from 45-CONTEXT.md) and `computeFHResult()` in chip-strategy-engine.ts:
  - **Authenticated** (`useMyTeam` data available): `sum(selling_price per pick from MyTeamResponse) + entry_history.bank` (all in integer tenths of £1m).
  - **Unauthenticated**: `CHIP_DEFAULT_BUDGET_TENTHS = 1000` (£100m standard FPL budget). Defined locally in `chip-modes.ts`.
- **D-12:** Budget is passed as an integer (tenths of £1m) into `buildOptimalSquad`. The UI displays it as `£X.Xm` (divide by 10). No user-editable budget field — the FPL rules define the budget.

### Bench Boost View

- **D-13:** BB mode calls the existing `optimiseLineup()` engine on the current 15-man squad (no new engine). The **comparison table is preserved** but the headline row changes to: `Bench Boost | Bench xPts: X.X | Start xPts: X.X | Total: X.X` where bench xPts = sum of the 4 bench players' horizon xPts.
- **D-14:** In BB mode, the bench section in the comparison table loses its `opacity-60` / de-emphasis — bench players are shown at full opacity since they all score in BB. Changed bench rows still get green accent borders.
- **D-15:** A one-line notice below the headline: `"All 15 players score points — bench contributions included above."` Renders only when BB mode is active.

### Chip Squad View (WC / FH)

- **D-16:** New component `src/components/optimiser/ChipSquadView.tsx`. Receives `ChipSquadResult` and renders position-grouped sections (GK / DEF / MID / FWD + Bench). Best XI players highlighted with green left accent border; bench players de-emphasised (`opacity-60`). Each row: `[name] | [pos] | £X.Xm | +X.X xPts`.
- **D-17:** Headline above the squad: `Wildcard  |  Formation: 4-3-3  |  Budget: £XX.Xm used` or `Free Hit (this GW only)  |  Formation: 4-3-3  |  Budget: £XX.Xm used`.
- **D-18:** For Free Hit, a notice row below the headline: `"This squad is optimised for this GW only. Your actual squad reverts after it ends."` Uses amber (`text-amber-600 dark:text-amber-500`) to distinguish from the normal view.
- **D-19:** On mobile, chip squad rows follow the same card pattern as existing mobile comparison cards (single-column, green left border for XI, opacity for bench).

### Claude's Discretion

- Exact Tailwind classes for `ChipModeToggle.tsx` — follow `FtToggle.tsx` pattern exactly; same sizing, border style, and active/inactive colour tokens.
- Whether `ChipModeToggle` renders a 4-button row or a separate toggle per chip — 4-button row recommended (mirrors FtToggle multi-button pattern and `GwToggle`).
- Tie-break in `buildOptimalSquad` when two players have equal horizon xPts — lower `now_cost` wins (same greedy convention as existing engines; cheaper player first gives better budget utilisation).
- Loading / error states for `buildOptimalSquad` in `OptimiserPanel` — use the same null-guard pattern as `optimiseLineup`: if `buildOptimalSquad` returns null (< 15 eligible players), show an amber warning banner (mirrors BGW warning from D-16 in Phase 43 CONTEXT).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v1.6 Requirements — CHIP-01, CHIP-02, CHIP-03 are the locked requirements for this phase. Read the full traceability table.

### Existing Engines (must read before writing chip-modes.ts)
- `src/lib/optimise-lineup.ts` — Pure lineup optimiser. Phase 46 calls this for BB mode (unchanged) and uses it to derive `bestXI` from WC/FH squad (D-10). Read the BGW exclusion logic (line 44–53) and combination enumeration before implementing.
- `src/lib/chip-strategy-engine.ts` — `computeFHResult()` (line 272–) is the reference greedy squad builder. Read the slot-fill algorithm, budget logic, and position quota constants. Do NOT import from this file — `chip-modes.ts` redeclares locally (D-07).
- `src/lib/suggest-transfers.ts` — Reference for Phase 45 engine pattern (pure function, no React). Check budget parameter shape (bank + sellPrices Map) — chip-modes.ts uses the same pattern (D-11).

### Types
- `src/lib/types.ts` — `OptimiserHorizon`, `OptimisedLineup`, `TransferSuggestion`. New types `ChipMode`, `ChipSquadPlayer`, `ChipSquadResult` will be added here.
- `src/lib/squad-adapter.ts` — `SquadPick`, `MyTeamPickSchema` (has `selling_price`), `EntryHistorySchema` (has `bank`). Budget arithmetic uses integer tenths throughout.

### Phase 45 Foundations (must read before modifying OptimiserPanel)
- `.planning/phases/45-transfer-aware-mode/45-CONTEXT.md` — D-09 to D-11: budget source pattern, FT toggle interaction. Phase 46 hides FT toggle when WC/FH active (D-02).
- `src/components/optimiser/OptimiserPanel.tsx` — Phase 45 implementation. Phase 46 adds chip mode state, `ChipModeToggle`, and conditional rendering of `ChipSquadView` vs comparison table.
- `src/components/optimiser/FtToggle.tsx` — Visual template for `ChipModeToggle.tsx`. Same `role="group"`, `aria-pressed`, `min-h-[44px]` constraints.

### Phase 43/44 UI Patterns
- `.planning/phases/43-lineup-engine-navigator/43-UI-SPEC.md` — Spacing scale, colour tokens. Carry forward for `ChipSquadView` and `ChipModeToggle`.
- `src/components/gem-table/GwToggle.tsx` — `PresetToggle` segmented button pattern; reference for multi-option toggle styling.

### Auth & Budget Infrastructure
- `src/lib/hooks/useMyTeam.ts` — Returns `MyTeamResponse` with `selling_price` per pick and `entry_history.bank`. Budget calculation for WC/FH (D-11).
- `src/lib/hooks/useAuthStatus.ts` — Check `isAuthenticated` before accessing `useMyTeam` data.

### Next.js docs
- `node_modules/next/dist/docs/` — Read relevant guide before writing any Next.js code (AGENTS.md mandate).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `optimiseLineup(picks, players, horizon)` — Already handles BGW exclusion, formation enumeration, captain/VC selection. Call this on the 15-player squad from `buildOptimalSquad` to get `bestXI` + formation for WC/FH (D-10).
- `HORIZON_FIELD` (exported from `optimise-lineup.ts`) — Already maps `1 | 3 | 5` to `xPts_1gw | xPts_3gw | xPts_5gw`. Import in `chip-modes.ts` for consistent field selection.
- `FtToggle.tsx` — Direct visual template for `ChipModeToggle.tsx`. Same pill pattern, same a11y attributes.
- `useMyTeam(enabled)` + `useAuthStatus()` — Already in `OptimiserPanel.tsx` for Phase 45 budget calculation. Phase 46 re-uses both for WC/FH budget (D-11).
- `useSquad(submittedId)` — Already wired in `OptimiserPanel`; `entry_history.bank` available from its response for budget.

### Established Patterns
- Pure engine files (`chip-strategy-engine.ts`, `optimise-lineup.ts`, `suggest-transfers.ts`) — no `'use client'`, no React, typed I/O, `@vitest-environment node` tests.
- `useMemo` for engine calls in `OptimiserPanel` — add `chipMode` to the dependency array of both `lineup` and new `chipSquad` memos.
- Greedy slot-fill in `computeFHResult()`: sort by score desc → iterate → check position quota → check team cap → check budget → accept. Phase 46 replicates this in `buildOptimalSquad`.
- Amber warning banner (Phase 43 D-16, Phase 44): same `text-amber-600 dark:text-amber-500` pattern for FH reversion notice and "< 15 eligible players" edge case.
- `border-l-2 border-green-500` green accent pattern for changed rows — reuse for best-XI rows in `ChipSquadView`.

### Integration Points
- `OptimiserPanel.tsx`: Add `chipMode` state, `ChipModeToggle` render, hide FT toggle when WC/FH active, new `chipSquad` memo calling `buildOptimalSquad`, conditional rendering of `ChipSquadView` vs comparison table.
- `src/lib/types.ts`: Add `ChipMode = 'none' | 'wildcard' | 'free-hit' | 'bench-boost'`, `ChipSquadPlayer`, `ChipSquadResult`.
- `src/lib/chip-modes.ts`: New file — pure `buildOptimalSquad` function + `computeBenchBoostXPts` helper.
- `src/components/optimiser/ChipModeToggle.tsx`: New file.
- `src/components/optimiser/ChipSquadView.tsx`: New file.
- No changes to `page.tsx`, `MobileNav.tsx`, or any route handlers needed.

</code_context>

<specifics>
## Specific Ideas

- **ChipModeToggle copy**: `None | Wildcard | Free Hit | Bench Boost` — full labels, not abbreviations. Users may not know "WC / FH / BB" shorthands.
- **FH reversion notice**: amber text, italicised — `"This squad is optimised for this GW only. Your actual FPL squad reverts after the gameweek ends."` (D-18)
- **BB headline format**: `Bench Boost  │  Bench xPts: 4.2  │  Start xPts: 21.8  │  Total: 26.0` — three metrics so the user sees the incremental BB value immediately.
- **WC/FH budget display**: `Budget used: £83.2m / £100.0m` — shows headroom at a glance.
- **Chip squad position labels**: GK / DEF / MID / FWD section headers matching existing comparison table section headers — reuse the same heading style.

</specifics>

<deferred>
## Deferred Ideas

- **Formation preference picker for WC/FH** — user locks a preferred DEF-MID-FWD shape before WC/FH optimisation. Deferred to v1.7 (already in REQUIREMENTS.md Future Requirements).
- **Player locking in WC/FH** — pin must-include players before building scratch squad. Deferred to v1.7.
- **Multi-chip comparison** — show WC vs FH vs current squad side-by-side. Deferred — out of scope for Phase 46.

</deferred>

---

*Phase: 46-Chip Modes*
*Context gathered: 2026-04-30*
