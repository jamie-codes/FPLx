# Phase 52: xMins Confidence Engine - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Pipeline extension improving per-player probability distributions for xPts accuracy. Delivers three new/sharpened fields on `MergedPlayer`:
- `start_prob` (sharpened — edge-case robustness: new signings fallback, BGW guard, `starts` field consistency)
- `mins_60_prob` (new — Bernoulli P(player records ≥60 min this GW), used in `_cs_prob` gated formula)
- `sub_risk_label` (new additive field — probability-derived enum replacing the imprecise `likely_start` bucket)

The `_cs_prob` minutes-factor swap (`mins_60_prob` replacing `min(1.0, xmins/60.0)`) is gated behind `xmins_v2_enabled`. The `MinsRiskBadge` component gains an optional `mins60Prob` prop to surface the probability in tooltips at all existing use sites.

**Not in scope:** Per-club rotation priors (Pep/Slot/Arteta multipliers) — deferred. No new pipeline module file — all changes in `pipeline/xmins.py` and `pipeline/merge.py`.

</domain>

<decisions>
## Implementation Decisions

### CS Formula Change
- **D-01:** Replace `mins_factor = min(1.0, xmins / 60.0)` with `mins_factor = mins_60_prob` inside `_cs_prob` (full replacement — semantically correct: `mins_60_prob` is literally P(player earns CS pts)).
- **D-02:** Change gated behind `xmins_v2_enabled` flag in `accuracy_backtest.json` (same pattern as `form_signal_enabled` from Phase 42). Flag defaults to `false` on ship. Flip condition: `accuracy.py` shows xPts hit-rate non-regression (≥ current 16.7%).
- **D-03 (Claude's discretion):** `mins_60_prob` is always written to `MergedPlayer` regardless of flag value. Only the `_cs_prob` formula swap is gated. This lets BENCH-01 (Phase 55) and the MinsRiskBadge tooltip consume the field immediately without waiting for the accuracy gate.

### start_prob Sharpening
- **D-04:** Edge-case robustness only — no per-club rotation priors in this phase.
- **D-05:** Four specific fixes to `_compute_player_xmins`:
  1. **New signings / post-injury return** (< 3 starts): fall back to position-prior `start_prob` instead of tiny-sample `recent_start_rate`.
  2. **BGW guard**: `start_prob = 0.0` (and `mins_60_prob = 0.0`) when player has no upcoming fixture. Currently pipeline handles BGW at xPts level but `start_prob` on `MergedPlayer` still shows historical rate.
  3. **`starts` field consistency**: use `history[i]['starts'] == 1` exclusively for counting starts (not the `minutes > 60` proxy). Element-summary `starts` field is available and matches FPL's own definition.
  4. **`mins_60_prob` window alignment**: compute `mins_60_prob` on the same 10-game window (`recent = history[-10:]`) as `start_prob`.
- **D-06:** Position-prior values for the < 3 starts fallback: `GK=0.90, DEF=0.75, MID=0.65, FWD=0.60` (mapped from existing `mins_risk` threshold buckets for consistency).

### sub_risk_label
- **D-07:** `sub_risk_label` is an additive field on `MergedPlayer` — `mins_risk` preserved unchanged. No migration of consumers this phase. TypeScript: `sub_risk_label?: 'nailed' | 'sub_risk' | 'rotation_risk' | 'cameo' | 'injured'`.
- **D-08:** Probability-derived thresholds:
  - `nailed`: `start_prob ≥ 0.90 AND mins_60_prob ≥ 0.80`
  - `sub_risk`: `start_prob ≥ 0.65` (starts fairly reliably but minutes uncertain — replaces `likely_start`)
  - `cameo`: `avg_mins_started < 40 OR start_prob < 0.25`
  - `injured`: `status != 'a' OR news != ''`
  - `rotation_risk`: everything else

### UI Surface
- **D-09:** `MinsRiskBadge` gains optional `mins60Prob?: number` prop. When present, tooltip reads: `"<Label> — <X>% chance 60+ min"` (e.g., `"Nailed — 94% chance 60+ min"`). Badge label and colour unchanged.
- **D-10:** Pass `player.mins_60_prob` at all existing `MinsRiskBadge` use sites: `TransferPanel`, `CaptaincyPanel`, XPtsCell hover card. Components that currently don't have access to `mins_60_prob` do not need changes.

### Claude's Discretion
- Whether to gate the entire `_compute_player_xmins` call or just the `_cs_prob` formula: gate only the formula (D-03 above).
- Exact format of the tooltip string: Claude's choice as long as it shows the label and the percentage.
- `mins_60_prob` should use `count(games with minutes >= 60 AND starts == 1) / count(recent games with starts == 1)` as the denominator — conditioning on starts (not all appearances) since CS pts require starting.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline Files (MUST read — these are the files being extended)
- `pipeline/xmins.py` — `compute_xmins_stats()` and `_compute_player_xmins()` — full file; this is where `mins_60_prob` and `sub_risk_label` computation lives
- `pipeline/merge.py` lines 122–240 — `_cs_prob()`, `_cs_prob_1gw_for_fixtures()`, `_compute_xpts_fixture()` — the formula being changed; `BONUS_RATE` constant at line 22
- `pipeline/run.py` lines 155–190 — kwarg threading into `merge_players()`; `form_signal_enabled` gate pattern (lines 172–183) — MUST replicate for `xmins_v2_enabled`
- `pipeline/accuracy.py` — backtest gate structure; how `accuracy_backtest.json` `summary` fields are written and read

### TypeScript Types (MUST read — adding new fields)
- `src/lib/types.ts` lines 87, 139–156 — `MinsRisk` type, `MergedPlayer.start_prob`, `MergedPlayer.mins_risk`, `xPts_components_1gw` shape

### UI Component (MUST read — adding prop)
- `src/components/shared/MinsRiskBadge.tsx` (or equivalent) — current badge implementation; adding optional `mins60Prob` prop
- Check `src/components/transfers/TransferPanel.tsx`, `src/components/captaincy/CaptaincyPanel.tsx` for existing badge call sites

### Research Documents
- `.planning/research/ARCHITECTURE.md` — integration pattern for pre-merge compute steps (Pattern 1), optional field rollout (Pattern 3), risks R1 and R2
- `.planning/research/PITFALLS.md` — Pitfall C2 (MergedPlayer shape contract), C6 (xMins regression for non-Pep teams), M1 (history gaps), m1 (type update same-commit rule)
- `.planning/research/STACK.md` — MIN-01 section; `starts` field availability confirmed live 2026-05-02
- `.planning/research/FEATURES.md` — MIN-01 FPL-specific rules (60-min cliff, auto-sub trigger, Pep roulette, status flag semantics)

### Phase 52 Roadmap Entry
- `.planning/ROADMAP.md` §"Phase 52: xMins Confidence Engine" — success criteria (SC-1 through SC-4)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_compute_player_xmins(element, summary, finished_gws)` in `xmins.py` — extend in-place; add `mins_60_prob` computation block after the existing `start_prob` block
- `form_signal_enabled` gate pattern (`pipeline/run.py` lines 172–183 + `accuracy_backtest.json.summary`) — replicate as `xmins_v2_enabled` for the `_cs_prob` formula swap
- `_cs_prob(dd, xmins)` signature — extend to `_cs_prob(dd, xmins, mins_60_prob=None)` with fallback to `min(1.0, xmins/60.0)` when `mins_60_prob is None`; when `xmins_v2_enabled` is True, pass the per-player value

### Established Patterns
- New `MergedPlayer` fields: always optional (`?:`) in TypeScript with `??` fallback in consumers; always written (with sentinel 0.0 for BGW players) in Python
- Same-commit rule: if `merge.py` adds `player['mins_60_prob'] = ...`, then `src/lib/types.ts` must add `mins_60_prob?: number` in the same commit (Pitfall m1)
- TDD RED→GREEN: Python tests in `pipeline/` (extend `test_xmins.py`), TypeScript tests for badge prop in Vitest

### Integration Points
- `pipeline/merge.py` `merge_players()` function already receives `xmins_stats` kwarg and copies fields onto each player dict — `mins_60_prob` and `sub_risk_label` ride through the same copy block
- `_cs_prob(dd, xmins)` called from `_xpts_ngw` and `_cs_prob_1gw_for_fixtures` — need to check all call sites when adding the `mins_60_prob` parameter
- `MinsRiskBadge` currently receives `minsRisk: MinsRisk` — add `mins60Prob?: number` as optional second prop; no breaking change

</code_context>

<specifics>
## Specific Ideas

- `mins_60_prob` denominator: `count(games with minutes >= 60 AND starts == 1)` / `count(recent games with starts == 1)` — conditioning on starts (not all appearances) because non-starters virtually never play 60+ minutes and would dilute the signal.
- BGW guard: when a player has no upcoming fixture in `fixtures` (the list passed to `_xpts_ngw`), `start_prob` on the player record should NOT be set to 0.0 at the `xmins.py` level (it's a historical probability) — the `_compute_xpts_fixture` guard `if xmins <= 0 or start_prob <= 0: return zeros` already handles the xPts=0 case for BGW. The BGW guard in D-05 means: do not propagate a historical `start_prob` into `_compute_xpts_fixture` for a BGW player — the `xmins=0` path already handles this. Clarify in plan.
- `xmins_v2_enabled` in `accuracy_backtest.json`: follow exact same structure as `form_signal_enabled` — boolean field in the `summary` object, read at `run.py` with `accuracy_data.get('summary', {}).get('xmins_v2_enabled', False)`.

</specifics>

<deferred>
## Deferred Ideas

- **Per-club rotation priors** (Pep/Slot/Arteta multipliers): calibrated from historical data to reduce `start_prob` for rotation-prone squads. Deferred — out of scope for Phase 52 edge-case fixes.
- **Decision Summary rotation card**: Optional UI card in `DecisionSummaryTab` surfacing "rotation risk this GW" from `sub_risk_label`. Deferred — Phase 52 is pipeline + badge tooltip only.
- **`mins_risk` deprecation / `sub_risk_label` consumer migration**: `recommend.ts`, `gem-score.ts`, `RotationRiskBadge` still read `mins_risk`. Migrate to `sub_risk_label` in v1.9.

</deferred>

---

*Phase: 52-xmins-confidence-engine*
*Context gathered: 2026-05-02*
