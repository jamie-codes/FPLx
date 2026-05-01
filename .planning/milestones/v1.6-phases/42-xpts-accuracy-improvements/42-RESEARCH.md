# Phase 42: xPts Accuracy Improvements — Research

**Researched:** 2026-04-30
**Domain:** Python pipeline (FPL element-summary history, xPts engine, accuracy backtest gate)
**Confidence:** HIGH — every claim verified against the live codebase

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **No `Co-Authored-By` trailers in git commits.** [VERIFIED: CLAUDE.md]
- **Next.js 16 has breaking changes from training data.** Read `node_modules/next/dist/docs/` before writing any Next.js code. (No Next.js code is required by this phase — pure Python pipeline.) [VERIFIED: AGENTS.md]
- **No new pip / npm dependencies.** [VERIFIED: STATE.md "Research: No new npm/pip deps needed"]
- **`difficulty_score` field must remain untouched** (6+ consumers). [VERIFIED: ROADMAP §Phase 27 cross-cutting]

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACC-01 | Recency-weighted xG+xA over last 3–5 GWs as a form signal that combines with fixture-based xPts | FPL element-summary `history[]` already provides `expected_goals` / `expected_assists` per round. Phase 29 `_compute_regression_signal` and Phase 40 `_group_history_by_gw` already iterate this exact data. Pipeline has the inputs needed; nothing new must be fetched. |
| ACC-02 | New signal must be backtested via `compute_accuracy_backtest` before being incorporated | The Phase 40 backtest (`pipeline/accuracy.py`) already replays a "model under test" via `_reconstruct_xpts`. Adding a second variant (form-blended) is a parallel column in the backtest output — no architectural change needed. |
| ACC-03 | Signal only ships if backtest hit rate > 16.7% baseline; otherwise disabled, baseline preserved | Implement an A/B gate inside the pipeline that compares baseline vs blended hit rate at backtest time and writes a flag (`form_signal_enabled: bool`) into the backtest output. `merge.py` reads the flag and either applies the form blend or falls back to baseline xPts. |
| ACC-04 | Reliably surface 6–8 pt mid-tier scorers (CS defenders, assist/bonus accumulators) alongside 10+ haulters | Current backtest only tracks haulters (10+ pts) — the mid-tier failure mode is invisible. Mid-tier coverage requires (a) a second `mid_tier_threshold` track in the backtest, and (b) addressing the structural undervaluation of CS defenders and bonus accumulators in the xPts formula. |

---

## Summary

Phase 42 is **pure Python pipeline work**. No UI work — the GemTable already renders `xPts_1gw`, so any improvement to the pipeline's xPts value flows automatically into the existing UI.

The phase has three loosely coupled deliverables that must ship together:

1. **Form signal computation** in `pipeline/merge.py` — recency-weighted xG+xA over the last 3–5 GWs per player, computed from the `summaries` dict that `merge_players()` already receives. The same data Phase 29's `_compute_regression_signal` reads.
2. **Backtest gate** in `pipeline/accuracy.py` — replay both variants (baseline xPts and form-blended xPts), compare overall hit rates, and write a boolean `form_signal_enabled` flag that controls whether the next `merge.py` run blends the form signal into `xPts_1gw`.
3. **Mid-tier scorer track** in `pipeline/accuracy.py` — extend the backtest to track a second threshold (6 actual pts) so the CS-defender / bonus-accumulator failure mode becomes measurable and gated.

The current backtest baseline of **16.7%** (xPts) was set at Phase 41 model rationalisation (`41-03-DECISION.md`). The phase MUST preserve this baseline if the new signal does not beat it — that is the entire point of ACC-03.

**Primary recommendation:** Add `_compute_form_signal()` next to `_compute_regression_signal()` in `merge.py` (same data, same shape). Add a second `_reconstruct_xpts_with_form()` variant in `accuracy.py` and a third "blended" track to the backtest output. Wire the gate so `run.py` reads `accuracy_backtest.json.summary.form_signal_enabled` and re-runs `merge_players` with `apply_form_blend=True/False` accordingly — OR simpler: compute the blend conditionally inside `_xpts_ngw` by reading the flag at module level. Pick whichever the planner prefers; both work.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form signal computation (per-player, last 3–5 GW xG+xA) | Pipeline / Backend (`merge.py`) | — | Pure transform over `summaries` dict; same tier as `_compute_regression_signal` |
| Backtest replay of both variants | Pipeline / Backend (`accuracy.py`) | — | Reuses existing reconstruction loop; no new HTTP calls |
| Backtest gate (16.7% threshold check) | Pipeline / Backend (`accuracy.py` summary section) | — | Pure comparison written into JSON output |
| Conditional blending into xPts_1gw | Pipeline / Backend (`merge.py` post-loop or `_xpts_ngw`) | — | Reads the gate flag; applies blend or skips |
| Mid-tier (6+ pt) tracking | Pipeline / Backend (`accuracy.py`) | — | Second haulter threshold track in backtest |
| Display of improved xPts | Browser / Client (existing GemTable, AccuracyTab) | — | No code changes — GemTable reads xPts_1gw which now reflects the blend |

**Critical:** No new tier touched. All work is inside the Python pipeline. The TypeScript / React surface is unchanged.

---

## Standard Stack

### Core (verified from pipeline/requirements.txt and existing pipeline/*.py)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib | 3.x | Math, statistics, datetime | Already used everywhere in pipeline [VERIFIED: pipeline/*.py] |
| pandas | >=2.2.0 | (already imported in some modules) | Available; not strictly needed for this phase [VERIFIED: requirements.txt] |
| pytest | (transitive via test infra) | Test runner — same as Phase 40 | [VERIFIED: pipeline/tests/conftest.py + pipeline/tests/test_accuracy.py] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `from collections import defaultdict` | stdlib | DGW aggregation (already used in `accuracy.py`) | `_group_history_by_gw` reuse |
| `from itertools import groupby` | stdlib | Already used in `_xpts_ngw` for DGW grouping | Re-use the same pattern |
| `from statistics import median` | stdlib | Already used in `merge.py` for differential medians | Re-use for sanity bounds if needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-90 form signal as standalone field | Multiplicative blend factor on xPts | Standalone is more inspectable; blend factor is more "drop-in." **Recommendation:** Compute and persist `form_xgxa_per90` AND apply a blend inside `_xpts_ngw` so both are available. |
| Backtest gate stored in config flag | Backtest gate stored in `accuracy_backtest.json.summary` | JSON-stored is auto-discoverable by every consumer (run.py, UI if needed); config flag risks drift. **Recommendation:** JSON. |
| Re-run pipeline twice to apply gate | Compute both blended and baseline xPts in one merge pass, pick at write time | Two-pass is simpler conceptually; one-pass is faster. Pipeline runs nightly — speed is irrelevant. **Recommendation:** Compute both, write both fields, pick which one becomes `xPts_1gw` based on gate. Keep both in `merged_players.json` for transparency. |

**Installation:** **None required.** No new pip packages. All work uses Python stdlib + the existing pipeline modules. [VERIFIED: STATE.md no-deps constraint + pipeline/requirements.txt unchanged]

---

## Architecture Patterns

### System Architecture Diagram

```
                    FPL element-summary history[]
                    (already fetched by run.py — `summaries` dict)
                                |
                                v
                    ┌─────────────────────────────────┐
                    │  merge.py                       │
                    │  ─────────                      │
                    │  _compute_regression_signal()   │  (existing)
                    │  _compute_form_signal()    NEW  │
                    │       │                         │
                    │       v                         │
                    │  player['form_xgxa_per90']      │
                    │  player['form_signal_window']   │
                    │                                 │
                    │  _xpts_ngw() — reads flag,      │
                    │       blends form_xgxa_per90    │
                    │       into xPts_1gw if enabled  │
                    └─────────────────────────────────┘
                                |
                                v  merged_players.json
                                |
                    ┌─────────────────────────────────┐
                    │  run.py                         │
                    │  -----                          │
                    │  Reads gate flag from existing  │
                    │  accuracy_backtest.json BEFORE  │
                    │  calling merge_players()        │
                    └─────────────────────────────────┘
                                |
                                v
                    ┌─────────────────────────────────┐
                    │  accuracy.py                    │
                    │  -----------                    │
                    │  compute_accuracy_backtest():   │
                    │    - reconstruct baseline xPts  │  (existing)
                    │    - reconstruct blended xPts   │  NEW
                    │    - compare hit rates          │  NEW
                    │    - track 10+ haulters         │  (existing)
                    │    - track 6+ mid-tier scorers  │  NEW
                    │    - write form_signal_enabled  │  NEW
                    └─────────────────────────────────┘
                                |
                                v
                       accuracy_backtest.json
                       summary: {
                         xpts_hit_rate: 0.167,         (baseline)
                         xpts_blended_hit_rate: 0.X,    NEW
                         form_signal_enabled: bool      NEW
                         mid_tier_hit_rate: 0.X         NEW
                       }
```

### Recommended Project Structure

```
pipeline/
├── merge.py                          # Modified — adds _compute_form_signal + blend in _xpts_ngw
├── accuracy.py                       # Modified — adds blended track + mid-tier track + gate
├── run.py                            # Modified — reads gate flag before merge
├── tests/
│   ├── conftest.py                   # Unchanged
│   ├── test_accuracy.py              # Modified — new test cases for blended track + gate + mid-tier
│   └── test_form_signal.py           # NEW — tests for _compute_form_signal in merge.py
└── cache/
    ├── accuracy_backtest.json        # Modified — new summary fields
    └── merged_players.json           # Modified — new form_xgxa_per90 field per player
```

### Pattern 1: Form Signal Computation (mirrors `_compute_regression_signal`)

**What:** Per-player recency-weighted xG+xA over the last N unique rounds in `history[]`.

**When to use:** Inside `merge.merge_players()` post-element loop, after `_compute_regression_signal` runs (same data source).

```python
# Source: derived from pipeline/merge.py:_compute_regression_signal pattern (verified)
# and pipeline/accuracy.py:_group_history_by_gw (verified)

def _compute_form_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,    # 3 GWs × 90 min minimum
) -> tuple[float | None, int]:
    """Compute recency-weighted xG+xA per-90 over the last `window_gws` rounds.

    Returns (form_xgxa_per90, gws_used) or (None, 0) when insufficient data.

    Recency weight: linear from 1.0 (most recent) to 0.5 (oldest in window).
    Rationale: form is a recency-decayed signal; uniform weighting would lag
    real-time form changes. Linear decay is simple and inspectable; no need
    for exponential without backtest evidence.
    """
    if not history:
        return None, 0

    # DGW-aware aggregation — same as accuracy._group_history_by_gw
    history_sorted = sorted(history, key=lambda h: h['round'])
    by_round: dict[int, dict] = {}
    for entry in history_sorted:
        r = entry.get('round')
        if r is None:
            continue
        agg = by_round.setdefault(r, {'minutes': 0, 'expected_goals': 0.0, 'expected_assists': 0.0})
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)

    unique_rounds = sorted(by_round.keys())
    last_rounds = unique_rounds[-window_gws:]
    if len(last_rounds) < 3:
        return None, 0   # need at least 3 GW samples

    played = [by_round[r] for r in last_rounds if by_round[r]['minutes'] > 0]
    total_mins = sum(p['minutes'] for p in played)
    if total_mins < min_minutes:
        return None, 0

    # Linear recency weights: most recent = 1.0, oldest in window = 0.5
    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]   # asc — oldest first

    weighted_xgxa = sum(
        (p['expected_goals'] + p['expected_assists']) * w
        for p, w in zip(played, weights)
    )
    weighted_mins = sum(p['minutes'] * w for p, w in zip(played, weights))

    if weighted_mins <= 0:
        return None, 0

    form_per90 = round((weighted_xgxa / weighted_mins) * 90, 4)
    return form_per90, len(last_rounds)
```

**Field naming convention:** Match existing pipeline fields:
- `form_xgxa_per90: float | None` (mirrors `xg_per90`, `xa_per90`)
- `form_xgxa_window_gws: int` (analogous to `pts_gw_count`)

### Pattern 2: Form Blend in `_xpts_ngw` (or post-loop)

**What:** Combine fixture-based xPts with form signal. Two design choices to consider in planning:

**Option A — Blend at the per-90 input layer (cleanest):**

```python
# Source: derived from merge._xpts_ngw signature (verified line 198)
# Inside merge_players() loop, before calling _xpts_ngw:

if form_signal_enabled and form_per90 is not None:
    # Blend baseline (season xG+xA per-90) with recent form (last 3-5 GW xG+xA per-90)
    # alpha = 0.4 means form contributes 40% of the per-90 input.
    BLEND_ALPHA = 0.4
    season_xgxa_per90 = (xg_per90 or 0.0) + (xa_per90 or 0.0)
    blended_xgxa_per90 = (1 - BLEND_ALPHA) * season_xgxa_per90 + BLEND_ALPHA * form_per90

    # Re-split the blended total proportionally to the season ratio
    if season_xgxa_per90 > 0:
        xg_share = (xg_per90 or 0.0) / season_xgxa_per90
        blended_xg_per90 = blended_xgxa_per90 * xg_share
        blended_xa_per90 = blended_xgxa_per90 * (1 - xg_share)
    else:
        # No season data — split 50/50 (rare; mostly promoted-team players)
        blended_xg_per90 = blended_xgxa_per90 * 0.5
        blended_xa_per90 = blended_xgxa_per90 * 0.5

    # Pass blended values into _xpts_ngw
    xpts_1gw, xpts_components_1gw = _xpts_ngw(
        blended_xg_per90, blended_xa_per90, ...
    )
```

**Option B — Multiplicative form factor (simpler, less inspectable):**

```python
# Apply form factor AFTER _xpts_ngw returns
form_factor = 1.0 + 0.4 * ((form_per90 - season_xgxa_per90) / max(season_xgxa_per90, 0.01))
form_factor = max(0.5, min(2.0, form_factor))   # clamp to [0.5x, 2x]
xpts_1gw_blended = xpts_1gw * form_factor
```

**Recommendation:** Option A. It feeds the form signal into the existing Poisson math, so `xPts_components_1gw` (goal/assist/CS/bonus split) remains internally consistent. Option B is shorter but breaks the invariant that components sum to total.

### Pattern 3: Backtest Gate (mirrors existing accuracy.py summary aggregation)

**What:** Inside `compute_accuracy_backtest`, run reconstruction TWICE (baseline + blended), compute both overall hit rates, and write a boolean gate flag.

```python
# Source: extension of pipeline/accuracy.py:compute_accuracy_backtest (verified)
# Pseudo-code — placement is inside the existing per-GW loop:

# ... existing baseline reconstruction ...
xpts_baseline = _reconstruct_xpts(entry, element_type, difficulty_score)

# NEW: blended reconstruction using historical form signal
form_per90_at_gw = _reconstruct_form_signal(grouped, gw, window_gws=5)
xpts_blended = _reconstruct_xpts_with_form(
    entry, element_type, difficulty_score, form_per90_at_gw, blend_alpha=0.4,
)

per_gw_rows[gw].append({
    'player_id': element_id,
    'player_name': player_name,
    'team_short': team_short,
    'element_type': element_type,
    'actual_pts': actual_pts,
    'xpts_predicted': xpts_baseline,
    'xpts_blended_predicted': xpts_blended,    # NEW
})

# After both passes complete, in the summary aggregation:
overall_xpts_hit = total_xpts_flagged / total_haulters if total_haulters > 0 else 0.0
overall_blended_hit = total_blended_flagged / total_haulters if total_haulters > 0 else 0.0

# THE GATE:
form_signal_enabled = overall_blended_hit > overall_xpts_hit

return {
    'generated_at': ...,
    'gws_covered': target_gws_desc,
    'summary': {
        'xpts_hit_rate': round(overall_xpts_hit, 4),
        'xpts_blended_hit_rate': round(overall_blended_hit, 4),     # NEW
        'form_signal_enabled': form_signal_enabled,                  # NEW — the gate
        'mid_tier_hit_rate': round(overall_mid_tier_hit, 4),         # NEW (ACC-04)
        'mid_tier_blended_hit_rate': round(overall_mid_tier_blended_hit, 4),  # NEW
        'gws': gw_summaries,
    },
    ...
}
```

### Pattern 4: Mid-Tier Scorer Track (ACC-04)

**What:** Add a second haulter-equivalent track at threshold 6 (mid-tier scorers). Uses identical ranking logic.

```python
# Source: extension of pipeline/accuracy.py constants (verified)
HAULTER_THRESHOLD = 10        # existing — D-09
MID_TIER_THRESHOLD = 6        # NEW — ACC-04
TOP_N_PREDICTED = 10          # existing — D-10
TOP_N_PREDICTED_MID = 30      # NEW — broader top-N for mid-tier (CS defenders rarely rank top 10 by xPts)

# In the per-GW loop, after gw_haulters is built, also build:
gw_mid_tier = [r for r in rows if MID_TIER_THRESHOLD <= r['actual_pts'] < HAULTER_THRESHOLD]
mid_tier_count = len(gw_mid_tier)

# Track separately so haulter hit-rate is unchanged.
xpts_mid_flagged_count = sum(
    1 for r in gw_mid_tier
    if xpts_rank_by_id.get(r['player_id'], 9999) <= TOP_N_PREDICTED_MID
)
```

**Critical:** Use a wider top-N (30 not 10) for mid-tier ranking. CS defenders and bonus accumulators by definition do not have top-10 xPts; they have top-30 xPts plus high-floor consistency. Top-10 only would set this metric to ~0% by construction.

### Pattern 5: Reading the Gate from `run.py`

**What:** `run.py` reads the previous run's `accuracy_backtest.json.summary.form_signal_enabled` BEFORE calling `merge_players()`, then passes the flag through.

```python
# Source: pattern derived from existing run.py cache reads (e.g. set_pieces_snapshot)
# Insert before the merge_players() call (line 169):

# Read previous backtest gate flag (default: disabled — preserve baseline)
form_signal_enabled = False
backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
try:
    with open(backtest_path, 'r', encoding='utf-8') as f:
        prev_backtest = json.load(f)
    form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
except (FileNotFoundError, json.JSONDecodeError):
    pass   # First run or corrupt file — keep baseline

print(f"Form signal blend: {'ENABLED' if form_signal_enabled else 'DISABLED'}")

merged, captain_picks = merge_players(
    bootstrap, fixtures, understat, id_map,
    xmins_stats=xmins_stats, summaries=summaries,
    form_signal_enabled=form_signal_enabled,    # NEW kwarg
)
```

**Bootstrap / cold-start behaviour:** First run after this phase ships will have an old-shape `accuracy_backtest.json` lacking `form_signal_enabled`. The `.get('form_signal_enabled', False)` default preserves the baseline. After the first run with new accuracy.py code, the flag is written. From the second run onwards the gate is live.

### Anti-Patterns to Avoid

- **Re-fetching element-summary data:** The `summaries` dict is already built by `run.py` (lines 146-157). Pass it through; never re-fetch.
- **Splitting form signal into separate xG and xA fields:** The signal is xG+xA combined per-90. The Poisson formula needs them separate, but the form input is naturally xG+xA. Re-split via the season ratio at blend time (Pattern 2 Option A).
- **Tightening `min_minutes` to 900 like the regression signal:** The regression signal looks at season-long over/under-performance — it needs many samples for statistical power. The form signal looks at recent-GW deviations — it needs FEWER samples (3+ GWs is the minimum useful window). Use `min_minutes=270` (3×90) not 900.
- **Hard-coding gate threshold to 16.7%:** The gate is a strict comparison `blended > baseline`. The baseline is whatever the current backtest measures, not a frozen number. ACC-03 says "above the current 16.7% baseline" but that 16.7% is the current OBSERVED baseline; the gate must compare against the FRESHLY MEASURED baseline at every run. If xPts naturally drifts to 18% next month, the new bar becomes 18%, not 16.7%.
- **Silent gate flip:** When the gate flips from enabled → disabled (or vice versa), the change is significant. `run.py` should emit a clear print line so the developer noticed at next pipeline run. (Not a UI surface — just stdout.)
- **Adding `_proj_pts_ngw` reconstruction back:** Phase 41 removed proj_pts. `pipeline/accuracy.py` and `pipeline/tests/test_accuracy.py` still mention it (the lib was untouched in the rationalisation sweep — see Pitfall 1). DO NOT add a new proj_pts variant. The phase only operates on xPts.

---

## accuracy.py / accuracy_backtest.json — Current Shape (verified live)

**Live `pipeline/cache/accuracy_backtest.json` summary (read 2026-04-30):**

```json
{
  "generated_at": "2026-04-30T08:41:19.099589+00:00",
  "gws_covered": [34, 33, 32, 31, 30],
  "summary": {
    "xpts_hit_rate": 0.1667,           // <-- THIS IS THE 16.7% BASELINE
    "proj_pts_hit_rate": 0.0897,       // legacy field — see Pitfall 1
    "gws": [
      { "gw": 34, "haulter_count": 10, "xpts_flagged": 0, "proj_pts_flagged": 1, "xpts_hit_rate": 0.0,    "proj_pts_hit_rate": 0.1   },
      { "gw": 33, "haulter_count": 29, "xpts_flagged": 6, "proj_pts_flagged": 3, "xpts_hit_rate": 0.2069, "proj_pts_hit_rate": 0.1034 },
      { "gw": 32, "haulter_count": 16, "xpts_flagged": 3, "proj_pts_flagged": 2, "xpts_hit_rate": 0.1875, "proj_pts_hit_rate": 0.125 },
      { "gw": 31, "haulter_count": 10, "xpts_flagged": 2, "proj_pts_flagged": 1, "xpts_hit_rate": 0.2,    "proj_pts_hit_rate": 0.1   },
      { "gw": 30, "haulter_count": 13, "xpts_flagged": 2, "proj_pts_flagged": 0, "xpts_hit_rate": 0.1538, "proj_pts_hit_rate": 0.0   }
    ]
  },
  "haulters": [ ... 78 entries ... ],
  "players": [ ... per-player breakdown ... ]
}
```

**Total haulters in window:** 10 + 29 + 16 + 10 + 13 = **78**.
**Flagged by xPts:** 0 + 6 + 3 + 2 + 2 = **13**. 13/78 = 16.67% — confirms baseline. [VERIFIED: live JSON]

**Per-GW signal:** GW34 hit rate is 0.0% — concerning. The most recent GW had ZERO haulters in the top-10 xPts predictions. The blended signal must improve specifically on this kind of GW.

**Mid-tier visibility today:** Zero. The current backtest does not record 6–8 pt scorers. ACC-04 is invisible from the existing data — adding the mid-tier track is the only way to measure the success criterion. [VERIFIED: accuracy.py constants — only HAULTER_THRESHOLD = 10]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DGW aggregation in form signal | Custom round-by-round loop | Reuse `_group_history_by_gw()` from `accuracy.py` (or its inline equivalent in `_compute_regression_signal`) | DGW already solved twice in codebase |
| Per-90 normalisation from history | Custom division | Match the pattern at `merge.py:684-686` (`xg_per90 = (xg / minutes) * 90`) | Identical math; one source of truth |
| Backtest replay infrastructure | New backtest module | Extend `accuracy.py:compute_accuracy_backtest()` | Already has summaries → per-GW reconstruction → ranking → hit-rate pipeline |
| Top-N ranking | New sort util | Reuse `xpts_ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)` (accuracy.py line 145) | Same pattern, second sort key |
| Recency weighting | Exponential decay, half-life calculus | Linear decay 1.0 → 0.5 across window (Pattern 1) | No backtest evidence supports exotic decay; linear is inspectable |
| Gate persistence | Config file, env var, separate JSON | Add to `accuracy_backtest.json.summary` | Single source; auto-discovered by every consumer |
| New pip dep for "form" library | None | Don't even research alternatives | Constraint: zero new deps |

**Key insight:** Every primitive needed for this phase already exists in `merge.py` or `accuracy.py`. The phase is **composition of existing patterns**, not new library work.

---

## Common Pitfalls

### Pitfall 1: `proj_pts` legacy reference in `pipeline/accuracy.py` and `test_accuracy.py`

**What goes wrong:** Phase 41 removed `proj_pts` from `merge.py`, `types.ts`, and front-end code, but `pipeline/accuracy.py` (lines 121, 173-175, 211-212, 247) and `pipeline/tests/test_accuracy.py` (line 159+, 208+) still compute and assert proj_pts. The cache file `merged_players.json` still contains `proj_pts_1gw/3gw/5gw` (it was last written before the rationalisation sweep). [VERIFIED: grep + live cache read]

**Why it happens:** The Phase 41 cleanup focused on consumers (UI, types, planner) and the `merge.py` writer. The accuracy backtest module reconstructs historical proj_pts independently for the backtest only — it does not depend on `merged_players.json` having those fields. So tests still pass and the file still works, but the dead path is there.

**How to avoid:** **Decision required during planning:** Either
- (a) **Sweep proj_pts from accuracy.py and test_accuracy.py during Phase 42** — clean break, scope creep but cheap (one extra task, ~30 mins).
- (b) **Leave proj_pts in accuracy.py untouched, treat it as legacy reconstruction** — minimal scope, but the JSON output retains `proj_pts_*` fields that nothing reads.

Recommended: (a). It is the correct end-state, cleanup is small, and Phase 42 already touches accuracy.py.

**Warning signs:** Test names like `test_proj_pts_reconstruction` still passing while no consumer of `proj_pts_*` exists.

### Pitfall 2: Form signal as `xG+xA` vs separate `xG` and `xA`

**What goes wrong:** The xPts engine (`_compute_xpts_fixture`) uses xG and xA SEPARATELY because they have different point values per position (e.g. MID goal = 5 pts, MID assist = 3 pts). If the form signal is a single combined `xgxa_per90`, the blend must re-split it before passing to `_xpts_ngw`.

**How to avoid:** Pattern 2 Option A: re-split blended value proportionally to the season-long `xg_per90 / (xg_per90 + xa_per90)` ratio. For promoted-team players with no season ratio, default 50/50.

**Warning signs:** Goal-heavy strikers see their assist component spike (or vice versa) after the blend — symptom of mis-split.

### Pitfall 3: Gate stability across GWs

**What goes wrong:** If the blend marginally beats baseline one week (16.8% > 16.7%) and falls below the next week (16.5% < 16.7%), the gate flips on/off causing xPts to swing between two values. Users see noisy ratings.

**How to avoid:** Two options:
- (a) Require margin: `form_signal_enabled = blended_hit > baseline_hit + 0.02` (require 2-pt-pct improvement).
- (b) Hysteresis: once enabled, keep enabled unless blended drops more than X below baseline.

Recommended: (a) — simpler. 2pp margin is meaningful given the 78-haulter sample size (1 haulter ≈ 1.3pp).

**Warning signs:** Looking at week-over-week `accuracy_backtest.json` and seeing the flag flip repeatedly.

### Pitfall 4: Mid-tier top-N must be wider than 10

**What goes wrong:** The current haulter threshold uses TOP_N_PREDICTED=10 (top 10 xPts predictions per GW are "flagged"). Reusing this for the 6+ mid-tier track will show ~0% hit rate by construction — CS defenders and bonus accumulators rarely have top-10 xPts (they have top-30 xPts with high floor).

**How to avoid:** Add a separate `TOP_N_PREDICTED_MID = 30` constant. Track mid-tier flagging against the wider net. The metric only makes sense if the cohort being measured has a realistic chance of being in the predicted set. [ASSUMED]

**Warning signs:** `mid_tier_hit_rate: 0.0` in every GW — symptom of too-narrow predicted set.

### Pitfall 5: BGW players in form signal

**What goes wrong:** A player who has played 4 GWs of the last 5 (one BGW) would have form_per90 computed from 4 entries. If the form signal is later applied to xPts for an UPCOMING BGW (player has zero fixtures next GW), the blend matters even if the upcoming xPts is already 0.

**How to avoid:** Pattern 1 already handles this — `_compute_form_signal` returns `(None, 0)` when `len(last_rounds) < 3`. In `_xpts_ngw`, if `form_per90 is None`, skip the blend — fall back to season-rate inputs. The Phase 30 `xPts_1gw=0 BGW exclusion` pattern already exists in `merge.py:843` (`if xpts_val:` skip).

**Warning signs:** Promoted-team players (status='a', 0 minutes season-to-date) emit `NaN` from the form signal. The min_minutes guard prevents this, but verify with a unit test.

### Pitfall 6: Reconstruction-vs-real divergence in backtest

**What goes wrong:** `_reconstruct_xpts` in accuracy.py uses `expected_goals` from the historical entry as the GW-of-prediction xG (D-02 reconstruction). The form signal in `merge.py` uses the LAST 3-5 GWs of history. When you reconstruct a backtest for GW32, the form signal must be computed from history strictly BEFORE GW32 — not including GW32 itself.

**How to avoid:** In the backtest reconstruction, build form_per90 from `prior_entries` (entries with `round < gw`) not from `entry` itself. Pattern: same as `_reconstruct_proj_pts` does for rolling PPG — see `accuracy.py:110-112`.

**Warning signs:** Blended hit rate suspiciously close to perfect — the reconstruction is leaking the answer.

### Pitfall 7: FPL element-summary `expected_goals` is a string

**What goes wrong:** FPL API returns `expected_goals` and `expected_assists` as string decimals (e.g. `"0.45"`), not floats. Direct arithmetic without conversion produces TypeErrors or string concatenation.

**How to avoid:** `accuracy.py:289` already handles this: `agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)`. Reuse the exact same `float(... or 0)` idiom in `_compute_form_signal`. Also defensive: `merge.py:_safe_float` exists for the same purpose. [VERIFIED: accuracy.py + merge.py]

**Warning signs:** Pipeline crashes on first element-summary fetch with TypeError "unsupported operand type for +".

### Pitfall 8: Blend coefficient `BLEND_ALPHA` is a hyperparameter — what value?

**What goes wrong:** `BLEND_ALPHA = 0.4` is an arbitrary choice. Too high (0.8) and the model becomes pure form (volatile, ignores fixture). Too low (0.1) and the form signal cannot move the prediction.

**How to avoid:** The backtest is the truth — sweep `BLEND_ALPHA ∈ {0.2, 0.3, 0.4, 0.5}` and pick the one with highest blended_hit_rate. The pipeline's nightly run can do this in <30 seconds (5 reconstructions × ~600 players × 5 GWs each). [ASSUMED — sweep cost not measured]

Add `_run_blend_alpha_sweep(...)` as a helper inside accuracy.py and write the winning alpha into `accuracy_backtest.json.summary.blend_alpha_used`. The `merge.py` blend reads this value, not a hardcoded constant. This makes the system self-tuning.

**Warning signs:** Hardcoded `BLEND_ALPHA` in merge.py with a comment "TODO: tune."

---

## Code Examples

### Form signal field on MergedPlayer

```typescript
// Source: derived from src/lib/types.ts MergedPlayer (verified)
// Add to MergedPlayer interface:
form_xgxa_per90?: number | null      // recency-weighted xG+xA per 90 over last 3-5 GWs;
                                     // null when insufficient history (<3 GWs or <270 mins)
form_xgxa_window_gws?: number        // count of GWs the form signal spans (3-5);
                                     // 0 when form_xgxa_per90 is null
```

These are optional / nullable — same convention as `xPts_1gw`, `regression_signal`, `differential_flag` (all phases follow this pattern). [VERIFIED: types.ts lines 142-166]

### Updated AccuracyBacktest type (TypeScript)

```typescript
// Source: src/lib/types.ts AccuracyBacktest (verified)
// New optional fields added — UI consumers don't break if absent
export interface AccuracySummary {
  xpts_hit_rate: number
  xpts_blended_hit_rate?: number          // NEW — blended-model overall hit rate
  form_signal_enabled?: boolean           // NEW — gate flag (read by next merge run)
  blend_alpha_used?: number               // NEW — tuned alpha if sweep applied
  mid_tier_hit_rate?: number              // NEW — 6+ pt scorer hit rate for baseline
  mid_tier_blended_hit_rate?: number      // NEW — same for blended
  gws: AccuracyGwSummary[]
}
```

UI is OPTIONAL in this phase. AccuracyTab.tsx will silently ignore unknown summary fields (its rendering only reads xpts_hit_rate and the gws array). No UI changes are required for ACC-01 through ACC-04. [VERIFIED: AccuracyTab.tsx — TODO author may inspect later]

### Test scaffold for `_compute_form_signal`

```python
# Source: pattern derived from pipeline/tests/test_accuracy.py (verified)
import pytest
from merge import _compute_form_signal

def test_form_signal_returns_none_when_insufficient_history():
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.0},
    ]   # only 2 GWs — below 3 minimum
    form, n = _compute_form_signal(history)
    assert form is None
    assert n == 0

def test_form_signal_recency_weighting():
    """Most recent GW should dominate."""
    # Player with 0 xG+xA in older GWs, 1.0 in most recent
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.0, 'expected_assists': 0.0}
        for i in range(1, 5)
    ]
    history.append({'round': 5, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.2})
    form, n = _compute_form_signal(history, window_gws=5)
    # Without recency, simple mean = 1.0/5 = 0.2 per game = 0.222 per 90
    # With linear weights 0.5..1.0 most-recent-weighted: form > 0.222
    assert form is not None
    assert form > 0.30   # recency boost confirmed
    assert n == 5

def test_form_signal_dgw_aggregation():
    """DGW entries (same round) sum, not duplicate."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.4, 'expected_assists': 0.2},
        {'round': 3, 'minutes': 60, 'expected_goals': 0.2, 'expected_assists': 0.1},  # DGW match 1
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.2},  # DGW match 2
    ]
    form, n = _compute_form_signal(history)
    assert form is not None
    assert n == 3   # 3 unique rounds, not 4 entries
```

### Test scaffold for backtest gate

```python
# Source: pattern derived from pipeline/tests/test_accuracy.py (verified)

def test_backtest_writes_form_signal_enabled_flag():
    """ACC-03: backtest output includes form_signal_enabled."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'form_signal_enabled' in result['summary']
    assert isinstance(result['summary']['form_signal_enabled'], bool)
    assert 'xpts_blended_hit_rate' in result['summary']

def test_backtest_gate_disabled_when_blended_no_better():
    """ACC-03: identical blended/baseline => gate disabled."""
    # Static history: form signal == season rate, blend has no effect
    history = [_hist(gw, 90, 6, xg=0.5, xa=0.3) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    # blended ≈ baseline ⇒ gate disabled (assuming margin requirement)
    assert result['summary']['form_signal_enabled'] is False

def test_backtest_mid_tier_track():
    """ACC-04: mid-tier (6-9 pt) scorers tracked separately from haulters."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 32)]
    history.append(_hist(32, 90, 7, xg=0.3, xa=0.2))   # mid-tier (6-9 pts)
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    assert 'mid_tier_hit_rate' in result['summary']
    # Player scored 7 pts → mid-tier, NOT haulter
    haulter_ids = {h['player_id'] for h in result['haulters']}
    assert 1 not in haulter_ids
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Season-long xG/xA only (Phase 28 xPts engine) | Recency-weighted form signal blended | This phase (Phase 42) | 16.7% → ?% hit rate (gated) |
| Single 10+ pt haulter track | Haulter + mid-tier (6+) tracks | This phase | ACC-04 mid-tier visibility |
| Hardcoded xPts (no gate) | Backtest-gated blend (auto-disabled if no improvement) | This phase | Safety: never ships a worse model |
| `proj_pts` legacy reconstruction in accuracy.py | (recommended) Removed during Phase 42 | This phase (optional, see Pitfall 1) | Cleanup |

**Deprecated/outdated:**
- The `proj_pts_*` reconstruction in `accuracy.py` and `test_accuracy.py` is dead code post-Phase 41 — recommended removal in this phase (Pitfall 1).
- The `_reconstruct_proj_pts` helper relies on `total_points / minutes * 90` PPG — never used by anything except backtest. Decision: remove with the rest of proj_pts.

---

## Runtime State Inventory

> Phase 42 is a pipeline computation change, not a rename or migration. Most categories have nothing.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `pipeline/cache/merged_players.json` will gain new fields (`form_xgxa_per90`, `form_xgxa_window_gws`); `accuracy_backtest.json` will gain new summary keys | Cache file rewritten on next pipeline run — no migration needed (overwrite is the standard pattern). UI is forward-compatible (TypeScript optional fields). |
| Live service config | None — no n8n / Datadog / Tailscale state references this phase | None |
| OS-registered state | None | None |
| Secrets / env vars | None — phase uses existing FPL API endpoints with existing headers; no new env vars | None |
| Build artifacts | `pipeline/__pycache__/accuracy.cpython-*.pyc` will be invalidated on `accuracy.py` change | Auto-handled by Python; verified `accuracy.py` is not imported with circular dep risk (it imports from merge.py via deferred import line 299) |

**Stale cache concern:** Existing deployed pipelines reading the OLD `accuracy_backtest.json` (without `form_signal_enabled`) must default to `False` (Pattern 5). Verified the proposed `run.py` change uses `.get('form_signal_enabled', False)`.

---

## Environment Availability

> All dependencies are present. No external tools or services are needed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 stdlib (collections, datetime, math, statistics, itertools) | merge.py + accuracy.py | Yes | 3.x (matches existing) | — |
| pandas | (some pipeline modules) | Yes | >=2.2.0 | — |
| pytest | pipeline test runner | Yes (via existing test infra) | (transitive) | — |
| FPL element-summary API | Already fetched by run.py:148-156 | Yes — running daily | n/a | — |
| `pipeline/cache/accuracy_backtest.json` | Gate flag read | Yes — exists from Phase 40 | 2026-04-30 | If absent (cold start), default to `form_signal_enabled=False` (preserve baseline) |

**Missing dependencies:** None. The phase has zero external dependencies beyond what is already running.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. [VERIFIED: config.json line 19]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (pipeline tests) |
| Config file | `pipeline/tests/conftest.py` (sys.path injection) |
| Quick run command | `python -m pytest pipeline/tests/test_accuracy.py pipeline/tests/test_form_signal.py -x` |
| Full suite command | `python -m pytest pipeline/tests/ -v` |
| TypeScript suite (regression) | `npx vitest run` (verifies no front-end regression from MergedPlayer field additions) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACC-01 | `_compute_form_signal` returns recency-weighted xG+xA per-90 | unit | `python -m pytest pipeline/tests/test_form_signal.py::test_form_signal_recency_weighting -x` | Wave 0 — NEW file |
| ACC-01 | Form signal handles DGW aggregation | unit | `python -m pytest pipeline/tests/test_form_signal.py::test_form_signal_dgw_aggregation -x` | Wave 0 |
| ACC-01 | Form signal returns None when <3 GWs / <270 min | unit | `python -m pytest pipeline/tests/test_form_signal.py::test_form_signal_returns_none_when_insufficient_history -x` | Wave 0 |
| ACC-01 | `merge_players` writes `form_xgxa_per90` field | unit | `python -m pytest pipeline/tests/test_merge.py::test_merge_writes_form_signal -x` | Wave 0 — may need new file or extend existing |
| ACC-01 | Form-blended xPts differs from baseline when form ≠ season | unit | `python -m pytest pipeline/tests/test_merge.py::test_blend_changes_xpts -x` | Wave 0 |
| ACC-02 | `compute_accuracy_backtest` writes `xpts_blended_hit_rate` | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_writes_blended_track -x` | Wave 0 — extend existing file |
| ACC-02 | Backtest reconstruction does not leak future GW into form signal | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_form_signal_uses_strictly_prior_gws -x` | Wave 0 |
| ACC-03 | Gate flag set when blended > baseline + margin | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_gate_enabled_when_blend_improves -x` | Wave 0 |
| ACC-03 | Gate flag false when blended ≤ baseline | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_gate_disabled_when_blended_no_better -x` | Wave 0 |
| ACC-03 | `run.py` reads gate from prev run; defaults to False if absent | unit | `python -m pytest pipeline/tests/test_run.py::test_form_signal_gate_default_false -x` | Wave 0 — NEW or extend existing |
| ACC-04 | `mid_tier_hit_rate` populated in summary | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_mid_tier_track -x` | Wave 0 |
| ACC-04 | 6-pt actual scorer NOT in haulters list | unit | (above) | Wave 0 |
| ACC-04 | Mid-tier uses TOP_N_PREDICTED_MID = 30 | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_mid_tier_top_n_wider -x` | Wave 0 |
| Regression | Front-end TypeScript suite still green (new optional fields don't break) | unit | `npx vitest run` | Existing — no new tests |

### Sampling Rate

- **Per task commit:** `python -m pytest pipeline/tests/test_form_signal.py pipeline/tests/test_accuracy.py -x`
- **Per wave merge:** `python -m pytest pipeline/tests/ -v` + `npx vitest run`
- **Phase gate:** Full suite green + manual sanity run: `python pipeline/run.py` and visually inspect `accuracy_backtest.json.summary` for new fields and gate flag value

### Wave 0 Gaps

- [ ] `pipeline/tests/test_form_signal.py` — NEW file covering `_compute_form_signal` (ACC-01)
- [ ] `pipeline/tests/test_accuracy.py` — EXTEND with blended-track, gate, mid-tier, no-leak tests (ACC-02, ACC-03, ACC-04)
- [ ] `pipeline/tests/test_merge.py` — likely NEW or extend existing test for blend integration
- [ ] (Optional) `pipeline/tests/test_run.py` — NEW test for the gate-read pattern in run.py

*(Existing infrastructure — pytest, conftest.py sys.path injection — covers all needs. No new test framework setup required.)*

---

## Open Questions (RESOLVED)

*All five open questions resolved during `/gsd-discuss-phase` (locked decisions D-01..D-05) and planner discretion. Each recommendation below is prefixed `RESOLVED:` with the chosen answer.*

1. **Should the `proj_pts` reconstruction be removed from `accuracy.py` during this phase?**
   - What we know: Phase 41 removed proj_pts everywhere except `pipeline/accuracy.py` and `pipeline/tests/test_accuracy.py` (verified via grep). The current cache `merged_players.json` still has `proj_pts_1gw` etc. because it's from the last run — that field will disappear on next pipeline run.
   - What's unclear: Was this an oversight in Phase 41 or intentional retention?
   - **RESOLVED:** YES — proj_pts cleanup is in scope for Phase 42. Plan 02 Task 3 purges all proj_pts references from `pipeline/accuracy.py` and `pipeline/tests/test_accuracy.py`. Rationale: ~30 mins of work; eliminates future confusion. Low-risk strict deletion.

2. **`BLEND_ALPHA` — fixed value or auto-tuned by sweep?**
   - What we know: Pattern 2 specifies the blend math but not the coefficient. Range 0.2–0.5 is reasonable a priori.
   - What's unclear: Whether to ship a hardcoded value (faster, less correct) or sweep alpha values within `compute_accuracy_backtest` and pick the winner (slower, more correct).
   - **RESOLVED:** FIXED at `BLEND_ALPHA = 0.4` (planner decision). No alpha sweep in Phase 42 — ship a single defensible value, write `blend_alpha_used = 0.4` to summary so the choice is visible/auditable, and revisit sweeping in a future phase if the gate underwhelms. Rationale: scope discipline (Phase 42 already covers ACC-01..ACC-04 across two plans); a sweep is a v1.7 enhancement, not a Phase-42 requirement.

3. **Recency weighting — linear, exponential, or none?**
   - What we know: Pattern 1 proposes linear 1.0 → 0.5 over the window. No backtest evidence supports exotic schemes.
   - What's unclear: Whether uniform mean (0.5 weight everywhere) might actually beat linear in this dataset.
   - **RESOLVED:** LINEAR 1.0 -> 0.5 across the window (most-recent-weighted, oldest in window weighted 0.5). Hardcoded; not parameterised. Rationale: linear is inspectable, no backtest evidence supports exotic decay (Pitfall 8), and we are not sweeping alpha (Q2 RESOLVED) so a parameterised weight scheme adds zero value in Phase 42.

4. **Gate margin — 0pp (any improvement) or 2pp (meaningful)?**
   - What we know: Pitfall 3 documents the flapping risk. With 78 haulters in the window, 1 haulter ≈ 1.3pp.
   - What's unclear: How much margin actually stabilises the gate.
   - **RESOLVED:** 2pp MARGIN with strict greater-than: `form_signal_enabled = (overall_xpts_blended_hit - overall_xpts_hit) > GATE_MARGIN_PP` where `GATE_MARGIN_PP = 0.02`. Rationale: with 78 haulters in window, 1 haulter ~ 1.3pp, so 2pp = meaningful (>=2 haulters of difference). Strict `>` (not `>=`) per Pitfall 3 anti-flap guidance.

5. **Mid-tier signal — backtest-only metric or also gated?**
   - What we know: ACC-04 says "the model reliably surfaces 6-8 pt scorers."
   - What's unclear: Is the mid-tier track passive (just measure) or active (gate the form signal on mid-tier hit rate, not haulter hit rate)?
   - **RESOLVED:** PASSIVE — mid-tier (6-9 pt) cohort is tracked in the backtest output (`mid_tier_hit_rate`, `mid_tier_blended_hit_rate`) for visibility but the gate decision uses haulter hit rate only (the existing Phase 40 definition). If a future phase wants to gate on mid-tier, that is a v1.7 decision.

---

## Assumptions Log

> Claims tagged `[ASSUMED]` need user/discuss-phase confirmation before locking.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Linear recency weighting (1.0 → 0.5 across window) is a reasonable starting point | Pattern 1 | Low — wrong weight scheme means slightly worse hit rate; iteration is cheap |
| A2 | `BLEND_ALPHA = 0.4` is a reasonable mid-point | Pattern 2 | Medium — wrong alpha could mean form signal has too much or too little impact. **Mitigate via sweep (Pitfall 8).** |
| A3 | `TOP_N_PREDICTED_MID = 30` for mid-tier (vs 10 for haulters) | Pattern 4 | Medium — wrong N means mid-tier metric is misleading. Sanity check: does any CS defender land in top 30 xPts predictions? Verify against live backtest data. |
| A4 | 2pp margin requirement on gate stabilises flapping | Pitfall 3 | Low — margin is a parameter; can tune if observed flapping persists |
| A5 | Removing proj_pts reconstruction from accuracy.py during Phase 42 is in scope | Pitfall 1 + Open Q1 | Low — purely cleanup, no functional risk |
| A6 | Auto-sweeping alpha within `compute_accuracy_backtest` adds <30s to nightly run | Open Q2 | Low — can measure; if too slow, fall back to hardcoded alpha |
| A7 | Min-minutes threshold for form signal is 270 (3×90), NOT 900 like regression signal | Pattern 1 + Anti-Patterns | Medium — too high a threshold excludes too many players; too low admits noise. 270 is a defensible 3-GW floor. |
| A8 | New optional fields on `MergedPlayer` and `AccuracySummary` are backward-compatible — no front-end changes required | Code Examples | Low — TypeScript optional fields cannot break existing readers; verified by inspection of GemTable, AccuracyTab, and Insights consumers |

**Assumptions requiring user confirmation:** A2, A3, A7 are tunables that should be discussed in `/gsd-discuss-phase` before locking — they affect the model's behaviour and need user judgement on whether to "tune now" or "ship with defaults and tune later."

---

## Sources

### Primary (HIGH confidence — verified by direct read)

- `pipeline/merge.py` (full read) — `_compute_xpts_fixture`, `_xpts_ngw`, `_compute_xpts_sigma`, `_compute_regression_signal`, `_compute_differential_flag`, `_compute_captain_picks`, `merge_players` full flow
- `pipeline/accuracy.py` (full read) — `compute_accuracy_backtest`, `_reconstruct_xpts`, `_reconstruct_proj_pts`, `_group_history_by_gw`, constants `HAULTER_THRESHOLD`/`TOP_N_PREDICTED`/`MIN_MINUTES`
- `pipeline/run.py` (full read) — pipeline orchestration, summaries dict construction, save() pattern, accuracy backtest invocation site
- `pipeline/fpl_client.py` (full read) — `get_element_summary` returns `history[]` per round
- `pipeline/xmins.py` (partial read) — pattern for reading `summary.history` per player
- `pipeline/tests/test_accuracy.py` (full read) — existing test scaffold pattern (`_hist`, `_build_minimal_inputs`)
- `pipeline/tests/conftest.py` — sys.path injection so tests can `from accuracy import ...`
- `pipeline/cache/accuracy_backtest.json` (live data 2026-04-30) — confirmed 16.7% baseline, 78 haulters in window
- `pipeline/cache/merged_players.json` (sampled first 3 players) — confirmed `xPts_1gw`, `xg_per90`, `xa_per90`, `start_prob`, `xmins` all present; `proj_pts_*` STILL present (stale from pre-Phase 41 run; will disappear on next run)
- `pipeline/cache/predictions_snapshot.json` (sampled) — current GW=35, contains both `proj_pts_1gw` and `xPts_1gw` per player
- `src/lib/types.ts` (full read) — MergedPlayer, ScoredPlayer, AccuracyBacktest, AccuracySummary, AccuracyHaulter shapes
- `src/app/api/players/route.ts` (full read) — confirms `last_gw_actual_pts` join via `accuracy_backtest.json.players[].gws[]` lookup
- `.planning/phases/40-accuracy-pipeline/40-CONTEXT.md` — Phase 40 backtest design (D-01 through D-12)
- `.planning/phases/41-accuracy-ui-model-rationalisation/41-CONTEXT.md` and `41-RESEARCH.md` — Phase 41 UI surface and proj_pts removal scope
- `.planning/phases/41-accuracy-ui-model-rationalisation/41-03-DECISION.md` — confirms 16.7% xPts vs 9.0% proj_pts hit rate; xPts is the surviving model
- `.planning/phases/41-accuracy-ui-model-rationalisation/VERIFICATION.md` — confirms Phase 41 cleanup; flags `proj_pts` references in `pipeline/accuracy.py` not in scope of that verification
- `.planning/REQUIREMENTS.md` (full read) — ACC-01 through ACC-04 verbatim
- `.planning/STATE.md` — confirms "no new pip/npm deps" constraint, balanced model profile
- `.planning/ROADMAP.md` — phase ordering, dependencies, depends-on chain
- `.planning/PROJECT.md` (head) — milestone v1.6 scope, current position
- `.planning/config.json` — workflow.nyquist_validation = true; balanced profile

### Secondary (MEDIUM confidence)

- None — all research questions resolved by direct codebase inspection.

---

## Metadata

**Confidence breakdown:**

- Form signal computation pattern: HIGH — directly mirrors `_compute_regression_signal` and `_group_history_by_gw`, both verified live
- Backtest gate placement: HIGH — `compute_accuracy_backtest` structure verified; gate is a single new field in the existing `summary` dict
- Backtest reconstruction safety (no leak): HIGH — pattern verified via `_reconstruct_proj_pts` which already constrains to `prior_entries`
- Mid-tier track scope: MEDIUM — implementation pattern is direct, but the right `TOP_N_PREDICTED_MID` value is `[ASSUMED]` (A3)
- Blend coefficient default: MEDIUM — `BLEND_ALPHA = 0.4` is `[ASSUMED]` (A2); recommendation is to sweep (A6)
- Recency weighting: MEDIUM — linear is `[ASSUMED]` (A1) but documented as a parameter
- proj_pts cleanup: HIGH — verified via grep that proj_pts is dead post-Phase 41 in src/, lives only in accuracy.py + test_accuracy.py
- Test framework: HIGH — verified pytest conftest.py exists, Phase 40 tests use the same pattern

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable Python pipeline; FPL API stable; Phase 41 just shipped — context fresh)

## RESEARCH COMPLETE
