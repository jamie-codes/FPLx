# Phase 118: Engine Integration - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `suggestTransfers()`, `optimiseLineup()`, and `benchOrder()` to accept an optional `lineupNewsMap?: Map<number, LineupNewsPlayer>` parameter and apply availability penalties when present. Pure TypeScript function extensions — no Python, no UI, no new API routes. TDD-safe with mock data.

The three engines are modified as follows:
- `suggestTransfers()`: multiply buy-candidate scores by `availability_factor` (with 0.01 floor for absent players) so doubted and absent players sink in the suggestion ranking
- `optimiseLineup()`: exclude confirmed-absent players from the C(15,11) starter enumeration (alongside existing BGW exclusion), causing them to automatically fall to bench
- `benchOrder()`: set evScore=0 for confirmed-absent bench outfield players, sinking them to the last bench slot

When `lineupNewsMap` is absent or undefined (no data, stale data filtered by hook), all three engines produce identical output to their pre-ENGN state.

</domain>

<decisions>
## Implementation Decisions

### Penalty Multiplier Design (suggestTransfers)

- **D-01:** Use `availability_factor` directly as the score multiplier for buy candidates in `suggestTransfers()` — not flat `status_label`-based fixed values. A 25%-chance player (availability_factor=0.25) is penalized much harder than a 75%-chance player (0.75), which is more accurate than treating all "doubted" labels identically at ×0.70.
- **D-02:** For `availability_factor = 0.0` (confirmed_absent), apply a **0.01 floor** so absent players score near-zero but do not disappear from suggestions. If multiplied by 0.0 exactly, xPtsGain ≤ 0 and the player is filtered out of the output — the 0.01 floor ensures they appear at the bottom of position buckets so the user sees they were considered and deprioritized (not silently dropped).
- **D-03:** For `availability_factor = null` (unknown status) → treat as 1.0 (no penalty). No information = no assumption.
- **D-04:** Apply the penalty **inside `scorePlayer()` for buy candidates** — not as a post-hoc adjustment to xPtsGain. This means the penalized score drives both the top-30 in-pool sort and the final xPtsGain calculation. Absent players won't make the in-pool top-30 at all.

### optimiseLineup() and benchOrder() Depth

- **D-05:** Confirmed-absent players are **excluded from the C(15,11) starter enumeration** in `optimiseLineup()`, alongside the existing BGW exclusion (which uses `xPts_1gw === 0`). A confirmed-absent Salah with high historical xPts must not be picked as a starter.
- **D-06:** In `benchOrder()`, set `evScore = 0` for confirmed-absent bench outfield players. They sort to the end of the active partition (after all healthy and doubted players), consistent with BGW treatment (which also produces evScore=0 via `fixtures.length === 0`).
- **D-07:** If excluding confirmed-absent players from `eligible` drops the count below 11 → **return null**, same as the existing BGW null-return path. The UI already handles `optimiseLineup()` returning null via its empty-state.
- **D-08:** Only `confirmed_absent` (`status_label === 'confirmed_absent'`) gets the starter-exclusion and bench EV=0 treatment. **Doubted players (availability_factor 0.25–0.75) are not excluded from starters and are not zeroed in bench ordering.** Their buy-side deprioritization is handled by the `suggestTransfers()` multiplier (D-01); it is still worth trying to start a 75%-chance player.

### Staleness Gate Responsibility

- **D-09:** The INFRA-02 staleness check (lineup_news.json with `scraped_at` older than 48 hours → treat as neutral) belongs in Phase 117's `useLineupNews` hook as a **`select` transform** — the hook returns `undefined` when the root `scraped_at` is >48h old. Engines receive `undefined` `lineupNewsMap` and produce unpenalized output naturally. Engines stay pure and timestamp-unaware. **Planner must verify `src/lib/hooks/useLineupNews.ts` has the select transform before planning Phase 118 engine changes; if missing, close as Phase 117 gap first.**

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Engine Integration (ENGN-01, ENGN-02) — exact requirement wording and success criteria
- `.planning/REQUIREMENTS.md` §Infrastructure (INFRA-02) — 48h staleness gate that governs when engines receive a non-null lineupNewsMap
- `.planning/ROADMAP.md` Phase 118 — 4 success criteria (confirmed-absent scores near-zero, doubted visibly downranked, absent bench sinks to last slot, no degradation when map absent/stale)

### Engine Files to Modify
- `src/lib/suggest-transfers.ts` — `SuggestTransfersParams` interface + `suggestTransfers()` function; `scorePlayer()` helper is where D-04 penalty applies; in-pool sort at ~line 138
- `src/lib/optimise-lineup.ts` — `optimiseLineup()` eligible-filter at ~line 48; `benchOrder()` `evScore` helper at ~line 190
- `src/lib/suggest-transfers.test.ts` — existing test file; new TDD tests for ENGN-01 go here
- `src/lib/optimise-lineup.test.ts` — existing test file; new TDD tests for ENGN-02 go here

### Types (already defined by Phase 117)
- `src/lib/types.ts` — `LineupNewsPlayer` (id, availability_factor, status_label, scraped_at), `StatusLabel`, `LineupNews` — all available from Phase 117 Plan 02 commits

### Hook to Verify (Phase 117 gap)
- `src/lib/hooks/useLineupNews.ts` — must have the 48h staleness select transform (INFRA-02). Verify before implementing; add if missing as a Phase 117 gap.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HORIZON_FIELD` map in `optimise-lineup.ts` — exported, already used by `suggest-transfers.ts` via import; no new exports needed
- BGW exclusion pattern in `optimiseLineup()` (`eligible = picks.filter(pick => p.xPts_1gw !== 0)`) — extend this filter to also exclude confirmed_absent players via lineupNewsMap lookup
- `evScore` lambda in `benchOrder()` (`start_prob * xPts * fixtures.length`) — set to 0 when player is confirmed_absent in lineupNewsMap
- `VALID_ELEMENT_TYPES` guard already in `suggest-transfers.ts` — similar defensive pattern for lineupNewsMap lookups

### Established Patterns
- Optional param pattern: `targetGw?: number` in `SuggestTransfersParams` (Phase 101 GWT-01) — `lineupNewsMap` follows the same optional-with-undefined-equals-disabled pattern
- BGW null return: `if (eligible.length < 11) return null` — D-07 reuses this exact path for absent-player exclusion
- TDD red-green cycle: existing test files use Vitest with plain MergedPlayer mocks — Phase 118 tests use the same pattern with mock `LineupNewsPlayer` entries

### Integration Points
- **Phase 118 adds params only** — no call-site wiring in components. `TransferPanel`, `DecisionSummaryTab`, and `OptimiserTab` thread `lineupNewsMap` in Phase 119 (UI-01..UI-04).
- `cap-transfer-suggestions.ts` (`capByPosition`) operates on the output of `suggestTransfers()` — no changes needed; availability penalties already baked into xPtsGain before capping
- `opportunity-cost.ts` (`computeOpportunityCostRows`) also consumes `suggestTransfers()` output — same: no changes needed

</code_context>

<specifics>
## Specific Ideas

- The `scorePlayer` helper in `suggest-transfers.ts` is a local closure that currently captures `targetGw` and `field` from the outer scope. For the availability penalty, a natural extension: `const availFactor = lineupNewsMap ? Math.max(0.01, lineupNewsMap.get(p.id)?.availability_factor ?? 1.0) : 1.0` applied at the return — only for buy candidates (not the sell-side `scorePlayer` call).
- The sell side of `suggestTransfers()` intentionally uses the unpenalized `scorePlayer(sell)` — we are not boosting the urgency of selling doubted/absent owned players here (that's surfaced by Phase 119 UI-03 Team News Alert and existing WHY-01 rejection reasons).
- TDD tests should cover: (1) absent buy candidate appears at bottom with near-zero xPtsGain; (2) doubted buy candidate is ranked below equally-rated healthy candidate; (3) lineupNewsMap=undefined produces identical output to pre-ENGN call; (4) optimiseLineup with absent player excludes them from starters; (5) benchOrder places absent player after all healthy bench outfielders.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 118-Engine Integration*
*Context gathered: 2026-05-17*
