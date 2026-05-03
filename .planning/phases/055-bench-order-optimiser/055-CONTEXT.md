# Phase 55: Bench Order Optimiser - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure-function library extension to `src/lib/optimise-lineup.ts`. Exports a new `benchOrder()` function that ranks the 3 outfield bench slots by `start_prob × xPts_horizon × fixtures.length` EV, with GK fixed at bench[0], formation-legality heuristic, BGW-to-slot-3 rule, DGW double-weighting, and BB chip awareness.

**Delivers:**
- `benchOrder()` exported from `src/lib/optimise-lineup.ts`
- Called internally by `optimiseLineup()`, replacing the existing naïve `horizonScore` sort in OPT-04
- Inline "Bench order doesn't affect score with Bench Boost active" note in `OptimiserPanel.tsx` bench section header (rendered when `chipMode === 'bench-boost'`)
- New test cases in `src/lib/optimise-lineup.test.ts` covering BENCH-01 scenarios

**Out of scope:**
- Any changes to captain/VC selection or starter XI logic
- Changes to `OptimisedLineup` type shape (`bench: number[]` unchanged)
- Per-club rotation priors or ML-based bench ranking

</domain>

<decisions>
## Implementation Decisions

### Integration Design
- **D-01:** `benchOrder()` is exported from `optimise-lineup.ts` AND called internally by `optimiseLineup()`. The function replaces the naïve `horizonScore` sort in the OPT-04 bench block. `OptimisedLineup.bench` comes out correctly ordered — no call-site changes in `OptimiserPanel`.
- **D-02:** `benchOrder()` signature: `benchOrder(benchOutfield: MergedPlayer[], starters: MergedPlayer[], horizon: OptimiserHorizon): MergedPlayer[]`. Receives the already-split bench outfield players and starters (from inside `optimiseLineup()`). Returns reordered outfield bench (caller prepends the bench GK at index 0).

### EV Scoring Formula
- **D-03:** Ranking score = `player.start_prob × player[horizonField] × player.fixtures.length`. This intentionally double-weights start probability: a rotation-risk bench player (low `start_prob`) ranks much lower than a nailed bench player with the same `xPts`. The `fixtures.length` multiplier handles DGW/BGW automatically — BGW players get ×0 (score = 0), but are handled by the slot-3 rule before scoring.
- **D-04:** `horizonField` from the existing `HORIZON_FIELD` map — same as `optimiseLineup()`.

### BGW / DGW Handling
- **D-05:** BGW detection via `player.fixtures.length === 0` (not `xPts_1gw === 0`). More precise: BGW means no fixture this GW. Injured players with fixtures still rank normally. This avoids conflating "no fixture" with "bad/unavailable player".
- **D-06:** BGW bench players (no fixture this GW) are unconditionally sorted to slot 3 (`bench[3]`) regardless of their EV score. If multiple BGW players, sort among themselves by EV desc and fill from slot 3 downward.
- **D-07:** DGW double-weighting is automatic from D-03: `fixtures.length === 2` multiplies EV by 2. No special DGW branch needed.

### Formation-Legality Heuristic
- **D-08:** Use a heuristic position-flex check (not full per-player simulation). For each bench outfield candidate, check whether their position, when added to the starters, keeps outfield counts within FPL formation bounds (`DEF ∈ [3,5], MID ∈ [2,5], FWD ∈ [1,3]`). If a candidate's position would violate all possible formations (e.g., a 4th FWD when starters already have 3 FWD and exactly 1 FWD is the minimum slot — meaning subbing them in for a non-FWD is what matters), demote them below formation-valid candidates. Reuse the same count-check logic already present in `optimiseLineup()`.
- **D-09:** Formation-legality is a tie-breaker rank (formation-valid candidates first, formation-invalid last), not a hard exclusion. EV score still determines order within each group.

### BB Chip Behaviour
- **D-10:** `benchOrder()` is a pure function with no chip-mode awareness. It always returns a correctly ordered bench.
- **D-11:** `OptimiserPanel.tsx` renders an inline muted note in the Bench section header when `chipMode === 'bench-boost'`: _"Bench order doesn't affect score with Bench Boost active"_. The bench rows still display (they show BB contributions); the note just informs the user that ordering is irrelevant.

### Claude's Discretion
- Exact wording of the BB inline note (suggested: `"Bench order doesn't affect score with Bench Boost active"` per ROADMAP)
- Whether formation-invalid candidates at slot 3 get a visual indicator in OptimiserPanel (no user preference expressed — default to no indicator, keep UI minimal)
- Internal implementation of the formation-flex check (mirror the existing position-count validation from `optimiseLineup()` directly)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Files Being Modified
- `src/lib/optimise-lineup.ts` — full file; `benchOrder()` is added here and called from `optimiseLineup()`. The OPT-04 bench sort block (lines ~126–142) is replaced.
- `src/lib/optimise-lineup.test.ts` — full file; new test cases added for BENCH-01 (formation-locked slot-1, BGW-to-slot-3, DGW double-weight, BB bypass).

### Types (MUST read — no new fields needed but confirm)
- `src/lib/types.ts` lines ~76–84 — `FixtureEntry` (has `event_id` — use `fixtures.length` for DGW detection); lines ~141–144 — `start_prob`, `mins_60_prob?`, `sub_risk_label?` (all available from Phase 52); lines ~192–199 — `OptimiserHorizon`, `OptimisedLineup.bench: number[]` (shape unchanged).

### Optimiser UI (MUST read — adding BB inline note)
- `src/components/optimiser/OptimiserPanel.tsx` — full file; bench section at line ~401 (`{ section: 'Bench', items: pairSection(...) }`); existing BB detection at line ~487–492 (`chipMode === 'bench-boost'` block); the new inline note goes in the Bench section header render.

### Roadmap (MUST read — success criteria are the acceptance bar)
- `.planning/ROADMAP.md` §"Phase 55: Bench Order Optimiser" — 5 success criteria (BENCH-01 through SC-5).

### Prior Phase Context (MUST read — start_prob and fixtures conventions)
- `.planning/phases/052-xmins-confidence-engine/052-CONTEXT.md` — D-03 (mins_60_prob always written regardless of flag), D-05 (BGW guard conventions), D-06 (position-prior values). Confirms `start_prob` is always present and reliable.
- `.planning/phases/054-price-change-predictor/054-CONTEXT.md` — reference for pattern conventions in this milestone (Phase 54 shipped immediately before).

### Existing Pattern Reference
- `src/lib/chip-modes.ts` — see how `optimiseLineup()` is called externally (synthetic picks pattern at lines ~86–97); confirms no chip-mode parameter flows into `optimiseLineup()`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HORIZON_FIELD` map (`optimise-lineup.ts` line 9): `Record<OptimiserHorizon, 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'>`. `benchOrder()` uses this same map for the `horizonField` lookup.
- Formation validation logic (lines ~90–97 of `optimise-lineup.ts`): position-count checks (`defCount`, `midCount`, `fwdCount` bounds). Reuse the same bounds for the D-08 formation-flex heuristic.
- `horizonScore` helper (line ~62): already defined as `(p[field] as number | undefined) ?? 0`. Reuse or mirror in `benchOrder()`.

### Established Patterns
- Bench array convention: `bench = [benchGkId, ...outfieldBenchIds]` (GK always index 0). `benchOrder()` returns only the outfield slice; caller prepends GK.
- BGW proxy in `optimiseLineup()`: `xPts_1gw === 0` for starter eligibility. `benchOrder()` uses `fixtures.length === 0` for bench slot-3 rule (different semantics — D-05).
- Pure-function pattern: no side effects, no React imports. Mirror the existing file's style.
- `?? 0` fallback on all optional `MergedPlayer` fields.

### Integration Points
- `optimiseLineup()` bench assembly block (lines ~126–142): replace `benchOutfield.sort((a, b) => horizonScore(b) - horizonScore(a))` call with `benchOrder(benchOutfield, starterPlayers, horizon)`. Collect `starterPlayers` from `bestStarterIds.map(id => playerMap.get(id)!)` before calling.
- `OptimiserPanel.tsx` bench section header: find the `section: 'Bench'` conditional render and add the inline muted note when `chipMode === 'bench-boost'`.
- No changes needed to `OptimisedLineup` type, `chip-modes.ts`, or any other consumer — `bench: number[]` shape is unchanged.

</code_context>

<specifics>
## Specific Ideas

- The EV score formula: `score = player.start_prob * (player[horizonField] ?? 0) * player.fixtures.length`. BGW players (fixtures.length === 0) get score 0 but are already redirected to slot 3 before the sort.
- Formation-flex check: given the starters' current position counts, adding bench candidate at their position should not push any count above its FPL ceiling (DEF > 5, MID > 5, FWD > 3). If it would, they're formation-constrained (demote to after formation-valid candidates).
- BB inline note style: small italic muted text, same visual weight as the existing `"bench"` label in `SquadView.tsx` line 168. No new component needed — just a `<span>` or `<p>` with `text-xs text-zinc-400 dark:text-zinc-500 italic`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 55-bench-order-optimiser*
*Context gathered: 2026-05-03*
