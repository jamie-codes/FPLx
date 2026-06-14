# COLD-01 Cold-Start Pre-Season Prior — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed GW1 player projections from the 2025/26 archive, blending prior→current as current-season minutes accrue, so the model is not blind at season start.

**Architecture:** New `pipeline/season_prior.py` builds a `code`-keyed prior lookup + (element_type, price_band) bucket fallback from the committed 2025/26 archive. `merge.py` adds a Layer-3 blend on the final `xg_per90`/`xa_per90` weighted by accrued minutes (`SEED_MINUTES=270`, lab-validated). `xmins.py` seeds start_rate/mins_per_start from the prior when current starts are thin. `run.py` builds the prior once and threads it through both. All new params default to no-op for backward compatibility.

**Tech Stack:** Python 3.11, pytest. Validation gate (exp08) already PASSED — `SEED_MINUTES=270`.

**Spec:** `docs/superpowers/specs/2026-06-14-cold01-pre-season-prior-design.md` (authoritative — read it).

---

### Task 1: `pipeline/season_prior.py` — prior lookups

**Files:**
- Create: `pipeline/season_prior.py`
- Test: `pipeline/tests/test_season_prior.py`

**What to build (exact contract):**

```python
SEED_MINUTES = 270   # ≈3 full matches; lab-fit via exp08 (beat 540/180/0 on held-out early window)

def build_prior_lookup(archive: dict) -> dict[int, dict]:
    """Keyed by player `code` (persistent across seasons; FPL id reshuffles).
    archive = capture_season.load_season_archive() → {'bootstrap','summaries' (int id→summary), ...}.
    Map archive bootstrap id→code first, then for each player sum
    expected_goals / expected_assists / minutes / starts over
    archive['summaries'][id]['history']. Keep only players with total_minutes >= 500.
    Returns {code: {'xg_per90','xa_per90','total_minutes','start_rate','mins_per_start'}}
      xg_per90 = sum(expected_goals)/total_minutes*90 ; xa_per90 likewise.
      start_rate = total_starts / n_history_rows ; mins_per_start = total_minutes/total_starts (0 if no starts)."""

def build_bucket_priors(archive: dict) -> dict[tuple[int,int], dict]:
    """Mean per-90 by (element_type, price_band) over the same ≥500-min eligible players.
    price_band from archive bootstrap now_cost: 0=budget(<55), 1=mid(55-84), 2=premium(>=85).
    Returns {(et, band): {'xg_per90','xa_per90'}} (means over eligible players in that bucket)."""

def price_band(now_cost: int) -> int:   # helper, used by build_bucket_priors and prior_for

def prior_for(code, element_type, now_cost, lookup, buckets) -> dict | None:
    """code match first → {xg_per90,xa_per90,start_rate,mins_per_start};
    else bucket match → {xg_per90,xa_per90} (no start fields);
    else None."""
```

- history rows: `expected_goals`/`expected_assists` are string decimals in element-summary history — coerce with float, default 0.0. `minutes`/`starts` are ints.
- Eligibility floor `>= 500` total minutes mirrors `suggest_squad`'s floor and `build_asof_signals`.

- [ ] **Step 1: Write failing tests** in `pipeline/tests/test_season_prior.py`:
  - `build_prior_lookup` sums a fabricated 2-player archive's history into correct per-90s; a <500-min player is excluded; key is `code` not `id`.
  - `build_bucket_priors` produces mean per-90 by (et, band); `price_band` boundaries (54→0, 55→1, 84→1, 85→2).
  - `prior_for`: code hit returns full dict; no code but bucket hit returns per-90-only dict; neither returns None.
- [ ] **Step 2:** Run tests, verify they fail (module missing).
- [ ] **Step 3:** Implement `pipeline/season_prior.py`.
- [ ] **Step 4:** Run tests, verify pass.
- [ ] **Step 5:** Commit.

---

### Task 2: `merge.py` — Layer-3 prior blend

**Files:**
- Modify: `pipeline/merge.py` (signature ~929; blend inserted after the USR-01 fallback that ends at line 1269, before the VG-01 block at 1271; `minutes` is read at 1286 — read `element.get('minutes', 0)` locally in the blend)
- Test: `pipeline/tests/test_merge.py` (add cases)

**Signature change:** add two optional params to `merge_players(...)`, defaulting to no-op:
```python
    prior_lookup: dict | None = None,    # COLD-01: code→prior dict (build_prior_lookup)
    bucket_priors: dict | None = None,   # COLD-01: (et,band)→prior dict (build_bucket_priors)
```

**Blend (insert right after line 1269, where xg_per90/xa_per90 are final):**
```python
        # COLD-01 Layer-3: blend prior-season per-90 toward current as minutes accrue.
        # No-op when no prior passed. Self-deactivates at cur_minutes >= SEED_MINUTES.
        if prior_lookup is not None or bucket_priors is not None:
            from season_prior import prior_for, SEED_MINUTES
            prior = prior_for(
                element.get('code', 0), element['element_type'], element['now_cost'],
                prior_lookup or {}, bucket_priors or {},
            )
            cur_minutes = element.get('minutes', 0)
            w = max(0.0, min(1.0, cur_minutes / SEED_MINUTES)) if SEED_MINUTES > 0 else 1.0
            if prior is not None and w < 1.0:
                prior_xg90 = prior.get('xg_per90', 0.0)
                prior_xa90 = prior.get('xa_per90', 0.0)
                cur_total = (xg_per90 or 0.0) + (xa_per90 or 0.0)
                prior_total = prior_xg90 + prior_xa90
                blended_total = (1 - w) * prior_total + w * cur_total
                share = prior_xg90 / prior_total if prior_total > 0 else 0.5
                xg_per90 = round(blended_total * share, 4)
                xa_per90 = round(blended_total * (1 - share), 4)
```
Put the `from season_prior import ...` at module top with the other imports instead of inline if that matches file convention — check the top of merge.py and follow it.

- [ ] **Step 1: Write failing tests** in `pipeline/tests/test_merge.py`:
  - prior used at `cur_minutes=0` → output xg_per90/xa_per90 equal the prior, re-split by prior share.
  - vanishes at `cur_minutes >= 270` → current xg_per90/xa_per90 unchanged.
  - no-op when neither prior arg passed (assert an existing-style player unchanged).
  - new-entrant (code not in lookup) uses bucket prior.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement signature + blend.
- [ ] **Step 4:** Run `pipeline/tests/test_merge.py`, verify pass + no existing test regressed.
- [ ] **Step 5:** Commit.

---

### Task 3: `xmins.py` — prior start seed

**Files:**
- Modify: `pipeline/xmins.py` (`compute_xmins_stats` 106-150; `_compute_player_xmins` 153; cold branches at 180-181 and 197-198; `avg_mins_started` at 195/204)
- Test: `pipeline/tests/test_xmins.py` (add cases)

**Thread a `code`-keyed start-seed map** through both functions, default `None`:
```python
def compute_xmins_stats(..., start_seed: dict | None = None) -> dict:
    # pass start_seed.get(element.get('code')) into _compute_player_xmins as prior_start
def _compute_player_xmins(..., prior_start: dict | None = None) -> dict:
```
`prior_start` is `{'start_rate','mins_per_start'}` (from `prior_for`, the code-hit branch) or None.

**Behaviour:** in BOTH the summary branch (`len(starts_in_recent) < 3`, line 180-181) and the bootstrap branch (`starts < 3`, line 197-198), when `prior_start` is present use:
```python
            start_prob = round(prior_start['start_rate'] * availability, 4)
            if avg_mins_started == 0.0:
                avg_mins_started = prior_start['mins_per_start']
```
instead of the flat `POSITION_PRIOR[...]`. Fall back to the existing `POSITION_PRIOR` path when `prior_start is None`. The `starts>=3` / sufficient-recent-starts paths are unchanged (self-deactivation).

- [ ] **Step 1: Write failing tests** in `pipeline/tests/test_xmins.py`:
  - cold player (starts<3) with `prior_start` → start_prob = start_rate*availability and xmins>0 (seeded mins_per_start), not the flat POSITION_PRIOR value.
  - cold player with no `prior_start` → unchanged flat POSITION_PRIOR behaviour.
  - player with starts>=3 → unchanged regardless of prior_start.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement threading + seed.
- [ ] **Step 4:** Run `pipeline/tests/test_xmins.py`, verify pass + no regression.
- [ ] **Step 5:** Commit.

---

### Task 4: `run.py` — build prior once + thread it

**Files:**
- Modify: `pipeline/run.py` (compute_xmins_stats call ~485; merge_players call ~498)
- Test: `pipeline/tests/test_run.py` (add a case)

**Build the prior once, before the xmins/merge calls** (inside the same GW-gated block, near where other shared caches are built):
```python
    # COLD-01: build the cold-start prior once from the latest completed-season archive.
    # Non-fatal if the archive is absent → empty lookups → pure no-op.
    prior_lookup, bucket_priors, start_seed = {}, {}, {}
    try:
        from capture_season import load_season_archive
        from season_prior import build_prior_lookup, build_bucket_priors, prior_for, price_band
        _archive = load_season_archive()
        prior_lookup = build_prior_lookup(_archive)
        bucket_priors = build_bucket_priors(_archive)
        # start_seed: code → {start_rate, mins_per_start} for players present in the code lookup
        start_seed = {
            code: {'start_rate': p['start_rate'], 'mins_per_start': p['mins_per_start']}
            for code, p in prior_lookup.items()
        }
        print(f"COLD-01 prior: {len(prior_lookup)} players, {len(bucket_priors)} buckets")
    except FileNotFoundError:
        print("COLD-01 prior: no season archive — cold-start blend disabled (no-op)")
    except Exception as e:
        print(f"COLD-01 prior: skipped ({e})")
```
Follow run.py's existing non-fatal step convention if it differs from a bare try/except.

Then pass to the existing calls:
- `compute_xmins_stats(..., start_seed=start_seed)`
- `merge_players(..., prior_lookup=prior_lookup, bucket_priors=bucket_priors)`

- [ ] **Step 1: Write failing test** in `pipeline/tests/test_run.py`: a test asserting the prior is built and threaded (e.g. monkeypatch `load_season_archive` to return a tiny archive, assert merge receives non-empty `prior_lookup`), and a test that a missing archive (FileNotFoundError) leaves the pipeline running with empty lookups (non-fatal).
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement wiring.
- [ ] **Step 4:** Run `pipeline/tests/test_run.py`, verify pass.
- [ ] **Step 5:** Commit.

---

### Task 5: Full-suite verification

- [ ] Run the full pipeline test suite (`cd pipeline; python -m pytest -q`); all green.
- [ ] Confirm new params are backward-compatible no-ops (existing tests untouched green is the proof).
- [ ] Commit any final fixups.

---

## Out of scope (do NOT touch)
- `suggest_squad.py` / NextSeasonPlannerTab (separate `ppm` path).
- Previous-league Understat for foreign signings (bucket proxy covers entrants).
- Any UI change — the prior flows through `xg_per90`/`xmins` automatically.
