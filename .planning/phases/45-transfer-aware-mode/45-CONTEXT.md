# Phase 45: Transfer-Aware Mode - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 45 delivers:
1. A "1 FT / 2 FTs" toggle that the user manually sets to declare their available free transfers.
2. An extended optimiser (or new function) that enumerates single and double transfer candidates from all ~500 FPL players (top-N per position by xPts) and ranks them by xPts gain.
3. A ranked "Transfer Suggestions" list rendered **below** the comparison table in `OptimiserPanel`, showing: Out player | In player | Cost (FREE or -4pts) | xPts gain per suggestion.
4. A break-even indicator on every -4pt hit suggestion: "Breaks even in X GWs based on xPts gain" (TFR-03).
5. Budget enforcement: suggestions that the user cannot afford (selling_price of outgoing + bank < now_cost of incoming) are filtered out silently. When `useMyTeam()` is unavailable (no FPL auth), `now_cost` is used as the sell-price proxy.

Requirements in scope: TFR-01, TFR-02, TFR-03.
Phase 46 (Chip Modes) is out of scope.

</domain>

<decisions>
## Implementation Decisions

### FT Count Input
- **D-01:** The user manually sets available free transfers via a **"1 FT / 2 FTs" toggle** displayed at the top of the transfer section (alongside or near the horizon toggle). No auto-detection from the FPL API — the user always knows their FT count, and the public API endpoint doesn't expose available-next-GW FTs directly.
- **D-02:** The toggle default is **1 FT** (most common scenario). The engine re-runs when the user changes it, just as it re-runs when the horizon changes.

### Transfer Candidate Pool
- **D-03:** The engine considers **top-30 players per position** (GK/DEF/MID/FWD) from `usePlayers()` by the active horizon's xPts field as "In" candidates. Players already in the user's 15-man squad are excluded from the "In" pool (can't transfer in a player you already own).
- **D-04:** The engine enumerates all valid (out, in) pairs where `out` is from the current 15-man squad and `in` is from the top-30-per-position pool. For 2-FT mode, enumerate all valid (out1, in1, out2, in2) pairs. Ranking is by net xPts gain of the full transfer set applied to the optimised lineup.
- **D-05:** Hit transfers (beyond free transfers) are **included** in the suggestions. Each hit suggestion clearly shows "-4pts" cost and the TFR-03 break-even indicator.

### UI Layout
- **D-06:** Transfer suggestions appear **below the comparison table** within the same `OptimiserPanel` section. The section is headed "Transfer Suggestions". The FT toggle sits at the top of this section (or inline with the horizon selector row — Claude's discretion on exact placement).
- **D-07:** Each suggestion row shows: `Out: [player name] → In: [player name] | FREE / -4pts | +X.X xPts`. For hit suggestions, a second line reads "Breaks even in X GWs".
- **D-08:** If no improvements are found (all feasible transfers reduce xPts), show an empty state: "Your current squad is already optimal for this horizon."

### Budget Enforcement
- **D-09:** Budget source priority: `selling_price` from `useMyTeam()` (authenticated) → `now_cost` from `usePlayers()` (unauthenticated fallback). No user-visible difference in behaviour — the fallback is silent.
- **D-10:** Suggestions that the user **cannot afford** are filtered out (hard filter). Available budget = sum of `selling_price` (or `now_cost`) of outgoing players + `entry_history.bank` (in tenths of £1m). A suggestion is shown only when available budget ≥ `now_cost` of incoming player(s). Bank is available from `SquadPicksResponse.entry_history.bank` — no extra API call needed.
- **D-11:** Transfer-aware mode does NOT require FPL login. Budget filtering degrades gracefully to `now_cost` when unauthenticated.

### Claude's Discretion
- Whether the FT toggle is inline with the horizon selector (same row) or below it — follow the OptimiserPanel layout established in Phase 44.
- Exact ranking tie-breaker when xPts gain is equal across suggestions (e.g., sort by player form or lower cost).
- Whether 2-FT enumeration uses a greedy approach (best single transfer, then best second transfer) vs full pair enumeration — full pair enumeration is correct but O(n²); greedy is faster but may miss the optimal pair. For top-30 per position, full pair enumeration is ~3,600 pairs max — acceptable.
- Mobile layout for the transfer suggestion rows (same responsive pattern as Phase 44 mobile cards).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v1.6 Requirements — TFR-01, TFR-02, TFR-03 are the locked requirements for this phase. Read the full traceability table.

### Phase 43 & 44 Foundations
- `src/lib/optimise-lineup.ts` — Pure engine. Phase 45 adds a new `suggestTransfers()` function alongside it (does NOT modify `optimiseLineup()`).
- `src/lib/types.ts` — `OptimisedLineup`, `OptimiserHorizon`, `MergedPlayer` types. New `TransferSuggestion` type will be added here.
- `src/components/optimiser/OptimiserPanel.tsx` — Phase 44 comparison table implementation. Phase 45 adds the transfer section below it.
- `.planning/phases/44-comparison-output/44-CONTEXT.md` — Phase 44 decisions (D-01 through D-09), especially the UI layout decisions.

### Auth & Budget Infrastructure
- `src/lib/hooks/useMyTeam.ts` — Authenticated hook returning `MyTeamResponse` (includes `selling_price` per pick). Already exists.
- `src/app/api/fpl/my-team/route.ts` — Proxies FPL `/api/my-team/` with cookie-based auth. Already exists.
- `src/lib/squad-adapter.ts` — `MyTeamPickSchema` (has `selling_price`), `EntryHistorySchema` (has `bank`, `event_transfers`). Budget arithmetic uses integer tenths of £1m throughout.
- `src/components/transfers/TransferPanel.tsx` — Existing transfer panel (v1.3 GW Planner) — check for reusable row/badge patterns before writing new ones.

### Prior Research Decisions (from PROJECT.md)
- Budget arithmetic: always integer tenths; use `selling_price` (not `now_cost`) in transfer-aware mode — already settled, now with fallback to `now_cost` when unauthenticated (D-09).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useMyTeam(enabled: boolean)` — Returns `MyTeamResponse` with `selling_price` per pick. Pass `enabled = authenticated` to avoid unnecessary calls.
- `useSquad(submittedId)` — Already called in `OptimiserPanel`; `entry_history.bank` is available from its response for budget calc.
- `TransferPanel.tsx` — Existing transfer row patterns (Out → In layout) may be reusable or at least serve as a visual reference.
- `HORIZON_FIELD` — Already exported from `src/lib/optimise-lineup.ts`; import it in the new `suggestTransfers()` rather than duplicating (IN-01 from Phase 44 code review).

### Established Patterns
- Pure function engine pattern: `optimiseLineup()` has no React imports — `suggestTransfers()` must follow the same pattern (pure TS, no side effects, importable in tests).
- `useMemo` for engine calls: the optimised lineup is memoised on `[squadData, playersData, horizon]`. The transfer suggestions memo should add `ftCount` to its dependency array.
- TanStack Query for data hooks: `useMyTeam`, `useSquad`, `usePlayers` all use TanStack Query with defined stale times.

### Integration Points
- `OptimiserPanel.tsx` is the sole integration point for Phase 45 UI — the transfer section renders conditionally after the comparison table when `lineup !== null`.
- `suggestTransfers()` takes the same inputs as `optimiseLineup()` plus `ftCount: 1 | 2`, `playerPool: MergedPlayer[]` (the full players list), and optionally `bank: number` + `sellPrices: Map<number, number>` for budget filtering.

</code_context>

<specifics>
## Specific Ideas

- The "Breaks even in X GWs" copy from TFR-03 is the literal desired format. Break-even formula: `Math.ceil(4 / xPtsGainPerGw)` where `xPtsGainPerGw` is the horizon-averaged gain (e.g., for 3GW horizon, use `xPts_3gw` gain / 3 to get per-GW rate).
- Suggestion row format confirmed: `Out: [name] → In: [name] | FREE / -4pts | +X.X xPts`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 45-Transfer-Aware Mode*
*Context gathered: 2026-04-30*
