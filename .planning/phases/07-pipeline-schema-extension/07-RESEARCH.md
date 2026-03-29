# Phase 7: Pipeline Schema Extension - Research

**Researched:** 2026-03-29
**Domain:** Python pipeline extension (projected points + xmins), TypeScript schema update
**Confidence:** HIGH

## Summary

Phase 7 extends the existing Python pipeline (`pipeline/merge.py`, `pipeline/defcon.py`, `pipeline/run.py`) to compute and write six new fields into `merged_players.json`: three projected-points horizons (`proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw`) and three minutes-risk fields (`xmins`, `start_prob`, `mins_risk`). These fields then flow through to the `/api/players` API route and are typed on the `MergedPlayer` TypeScript interface. No new API routes or UI components are created in this phase — this is pure pipeline + type schema work.

The projection engine relies on two signals already present in the FPL bootstrap: `ep_next` (FPL's fixture-adjusted single-GW expected points) and `points_per_game` (season average). Multi-GW projections multiply `points_per_game` by `start_prob` and a fixture difficulty modifier derived from the already-computed `difficulty_score` in `fixtures[]`. The element-summary fetch required for accurate xmins must be shared with `defcon.py` via a dict cache in `run.py` — not fetched a second time.

**Primary recommendation:** Compute projected points in `merge.py` (receives all necessary inputs), create a new `pipeline/xmins.py` module for xmins/start_prob/mins_risk, and lift element-summary fetching into `run.py` as a shared cache dict passed to both `defcon.py` and `xmins.py`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-01 | Projected pts next 1 GW per player (absolute FPL pts) | `ep_next` field in FPL bootstrap is fixture-adjusted single-GW projection in absolute pts (range 0–12). Scale by `chance_of_playing_next_round` for injury awareness. |
| PROJ-02 | Projected pts next 3 GWs per player | Sum `points_per_game * start_prob * difficulty_modifier` across player's next 3 GW fixtures from `fixtures[]` array. DGW: 2 fixtures in same `event_id` = double contribution. |
| PROJ-03 | Projected pts next 5 GWs per player | Same formula as PROJ-02, across next 5 GW fixtures. Current `fixtures[]` already stores up to 5 upcoming fixtures per player. |
| MINS-01 | Expected minutes and start probability per player | `xmins` from element-summary per-match history (last 10 games avg); `start_prob` from `starts / finished_gws` adjusted by `chance_of_playing_next_round`; `mins_risk` categorical string. Element-summary already fetched for defcon — share via run.py cache. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python requests | 2.32.3 (installed) | FPL API HTTP client | Already used in fpl_client.py |
| pandas | 2.2.3 (installed) | Data manipulation (Understat) | Already used in understat_client.py |
| Python statistics | stdlib | mean/stdev for xmins calc | No dependency overhead |
| TypeScript (Zod 4) | Already installed | MergedPlayer type extension | Existing pattern in fpl-adapter.ts |
| Vitest | 4.1.2 (installed) | Tests for new TS logic | Existing test infrastructure |

### No New Dependencies Required
All computation can be done with the existing Python stdlib (`statistics` module) plus the already-available `requests` and `pandas`. No new `requirements.txt` entries needed.

**Version verification:** All packages confirmed via `pip3 --version`, `npm list`, and `python -c "import pandas; print(pandas.__version__)"`. No installation required.

## Architecture Patterns

### Recommended Project Structure Changes
```
pipeline/
├── run.py              # MODIFIED: lift element-summary fetch here as shared cache
├── merge.py            # MODIFIED: add proj_pts computation to merge_players()
├── defcon.py           # MODIFIED: accept pre-fetched summaries dict, remove own fetch
├── xmins.py            # NEW: compute xmins, start_prob, mins_risk from summaries
└── fpl_client.py       # UNCHANGED: get_element_summary() already exists

src/lib/
└── types.ts            # MODIFIED: extend MergedPlayer interface with 6 new fields

tests/lib/
└── merge.test.ts       # MODIFIED: add tests for new projected-pts fields (skipped, pipeline-dependent)
```

### Pattern 1: Shared Element-Summary Cache in run.py
**What:** Fetch element-summaries once in `run.py`, store in a dict `{player_id: summary_dict}`, pass to both `defcon.compute_defcon_stats()` and `xmins.compute_xmins_stats()`.
**When to use:** Any module needing per-match history. Prevents duplicate API calls.
**Example:**
```python
# In run.py (pseudo-code pattern, not final implementation)
summaries: dict[int, dict] = {}
for element in bootstrap['elements']:
    if element.get('starts', 0) > 0:
        try:
            summaries[element['id']] = get_element_summary(element['id'])
            time.sleep(0.1)
        except Exception as exc:
            print(f"Warning: skipping id={element['id']}: {exc}")

defcon_stats = compute_defcon_stats(bootstrap, difficulty_scores, summaries)
xmins_stats = compute_xmins_stats(bootstrap, summaries, finished_gws)
```

**Scope:** 459 players with `starts > 0` at GW31. At 0.1s each = ~46 seconds total. This is the same total as defcon.py alone currently (it skips GKs, fetching ~425). Net change: +34 GK fetches = ~3 extra seconds.

### Pattern 2: Projected Points in merge.py
**What:** Add proj_pts computation at the end of `merge_players()`, using `bootstrap` element fields and already-computed `team_fixtures[team_id]`.
**When to use:** merge.py already has all required inputs: bootstrap elements, fixtures, difficulty_scores.
**Inputs available in merge.py:**
- `element['ep_next']` — string, FPL's own 1-GW projection
- `element['points_per_game']` — string, season average PPG
- `element['chance_of_playing_next_round']` — int|None (0/25/50/75/100/None)
- `element['starts']`, `element['minutes']` — season aggregates
- `team_fixtures[team_id]` — list of FixtureEntry-shaped dicts with `difficulty_score` and `event_id`

### Pattern 3: xmins.py Module
**What:** New module `pipeline/xmins.py` with `compute_xmins_stats(bootstrap, summaries, finished_gws) -> dict[int, dict]` returning `{player_id: {xmins, start_prob, mins_risk}}`.
**When to use:** Called from run.py after shared element-summary fetch.

### Projected Points Formula

**proj_pts_1gw:**
```python
ep_next = float(element.get('ep_next', 0) or 0)
chance = element.get('chance_of_playing_next_round')
# chance=None means no injury flag (treat as 100%)
availability = (chance / 100.0) if chance is not None else 1.0
proj_pts_1gw = round(ep_next * availability, 2)
```

**proj_pts_3gw and proj_pts_5gw:**
```python
ppg = float(element.get('points_per_game', 0) or 0)
start_prob = computed_start_prob  # from xmins module or local computation
fixtures = team_fixtures.get(team_id, [])

# Group fixtures by event_id to detect DGW (2 fixtures in same GW)
# Then project across first N unique GW slots
# For each fixture slot: pts_contribution = ppg * start_prob * difficulty_modifier
# difficulty_modifier = 1.0 - (difficulty_score * 0.5)  # range 0.5–1.0
```

**DGW handling:** `team_fixtures` stores fixtures as a flat list ordered by event_id. A DGW produces two entries with the same `event_id`. For proj_pts_3gw: take fixture entries until 3 unique `event_id` values are consumed; sum all fixture contributions within those GWs. A DGW player will contribute twice for that GW — naturally producing higher projected points.

**BGW handling:** If a team has no fixture in a GW (BGW), that GW contributes 0 points. The existing `team_fixtures` only stores upcoming fixtures — BGW gaps are implicit.

### xmins Formula

**Using element-summary (for players with summaries available):**
```python
history = [m for m in summary.get('history', []) if m.get('minutes', 0) > 0]
recent = history[-10:]  # last 10 appearances
# FPL element-summary history has a 'starts' field (binary 0/1 per match)
starts_recent = [m for m in recent if m.get('starts', 0) == 1]
avg_mins_started = statistics.mean([m['minutes'] for m in starts_recent]) if starts_recent else 0
recent_start_rate = len(starts_recent) / len(recent) if recent else 0
```

**Bootstrap-only fallback (when no element-summary or starts=0):**
```python
avg_mins_per_start = element['minutes'] / element['starts'] if element['starts'] > 0 else 0
season_start_rate = element['starts'] / finished_gws if finished_gws > 0 else 0
```

**start_prob (injury-adjusted):**
```python
chance = element.get('chance_of_playing_next_round')
availability = (chance / 100.0) if chance is not None else 1.0
# status != 'a' with non-blank news -> availability already reflects injury
start_prob = round(season_start_rate * availability, 4)
```

**xmins:**
```python
xmins = round(avg_mins_started * start_prob, 1)
```

**mins_risk classification (from STATE.md locked decision):**
```python
# Only classify rotation risk for status='a' AND news=''
# Others: injury context, not rotation-classified
if element['status'] != 'a' or element.get('news', ''):
    mins_risk = 'injured'   # injured/suspended/flagged
elif start_prob >= 0.85:
    mins_risk = 'nailed'
elif start_prob >= 0.65:
    mins_risk = 'likely_start'
elif avg_mins_started < 30 or season_start_rate < 0.2:
    mins_risk = 'cameo'
else:
    mins_risk = 'rotation_risk'
```

**Note:** The badge labels (Nailed / Likely start / Rotation risk / Cameo risk) are Phase 8 UI work. Phase 7 writes the raw `mins_risk` string value to `merged_players.json`.

### Anti-Patterns to Avoid
- **Separate element-summary fetch in xmins.py:** Never. Fetching in run.py once and passing as a dict is the locked decision.
- **Normalising projected points (0-1 scale):** Never. `normalise()` from gem-score.ts must NOT be applied. Output is absolute FPL points.
- **Applying gem-score normalisation to proj_pts:** Requirements explicitly state absolute pts (2–15 range for regular starters). The `normalise()` in gem-score.ts is for gem composite only.
- **Zero-filling ep_next for injured players:** Use `ep_next * availability` not `ep_next or 0` — `ep_next` may already be 0 for injured players but the multiplication ensures consistency.
- **Using `element_type == 1` exclusion for xmins:** GKs need xmins too. Unlike defcon.py (which skips GKs by design), xmins.py must cover all positions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FPL expected points | Custom ML model | FPL's `ep_next` field | FPL already publishes fixture-adjusted expected pts per player — accurate, maintained, requires no model training |
| Availability probability | Scrape injury news text | `chance_of_playing_next_round` (0/25/50/75/100) | FPL already quantifies injury probability as integer steps |
| Per-match history | Custom scraper | FPL `element-summary` API | Already used by defcon.py; returns full match-by-match history with `minutes` and `starts` fields |
| Statistics computation | numpy | Python stdlib `statistics` | For mean of ≤10 values, stdlib is sufficient; no new dependency |

**Key insight:** FPL's `ep_next` is the most important signal in the pipeline — it already encodes fixture difficulty, player form, and availability into a single float. Phase 7's job is to wrap it correctly (injury-adjust, extend to multi-GW) not replace it.

## Common Pitfalls

### Pitfall 1: ep_next is a string field
**What goes wrong:** `float('6.7')` works, but `float(None)` raises TypeError if field is missing.
**Why it happens:** FPL API returns `ep_next` as a string (like `form` and `points_per_game`). Can also be missing for newly promoted players.
**How to avoid:** Use `float(element.get('ep_next', 0) or 0)` — the `or 0` catches empty string `''`.
**Warning signs:** TypeError in pipeline log on first run with fresh bootstrap.

### Pitfall 2: fixtures[] stores fixture count not GW count
**What goes wrong:** `sum(ppg * w for f in fixtures[:3])` projects only 3 fixtures, not 3 GWs. A DGW player who has 2 fixtures in the first GW would only get 1 GW of coverage.
**Why it happens:** `merge.py` stores up to `FIXTURE_LOOKAHEAD=5` fixture entries, not 5 GWs. DGW teams have 2 entries sharing the same `event_id`.
**How to avoid:** Group by `event_id` first, then iterate through unique GW groups. Sum contributions per GW group, accumulate until N GW groups consumed.
**Warning signs:** DGW player proj_pts_3gw equals single-GW player of same form — missing the doubling.

### Pitfall 3: chance_of_playing_next_round = None vs 0
**What goes wrong:** `(chance / 100.0)` raises TypeError when `chance` is None. Treating None as 0 marks fit players as 0% available.
**Why it happens:** FPL sets `chance_of_playing_next_round = null` for fully fit players (no injury flag). It is only set to 0/25/50/75/100 when there is an injury concern.
**How to avoid:** `availability = (chance / 100.0) if chance is not None else 1.0`
**Warning signs:** All null-chance players showing proj_pts = 0.0.

### Pitfall 4: element-summary API rate limit
**What goes wrong:** 429 Too Many Requests if fetches run too fast.
**Why it happens:** FPL API is undocumented and not designed for bulk use. defcon.py already uses `time.sleep(0.1)`.
**How to avoid:** Maintain `time.sleep(0.1)` in the shared fetch loop in run.py. Do NOT add a second sleep in defcon.py or xmins.py since they no longer fetch directly.
**Warning signs:** Pipeline errors on 40th+ request in a run.

### Pitfall 5: defcon.py refactor breaks existing interface
**What goes wrong:** defcon.py currently calls `get_element_summary()` internally. After refactor, it receives `summaries` dict. Signature change must be reflected in run.py call site.
**Why it happens:** Shared-cache refactor changes the function signature of `compute_defcon_stats()`.
**How to avoid:** Update `run.py` call site in the same plan as the defcon.py refactor. Test with `python pipeline/run.py --dry-run` to catch import errors early.
**Warning signs:** TypeError on `compute_defcon_stats(bootstrap, difficulty_scores)` — old signature still called.

### Pitfall 6: Stale merged_players.json in test fixtures
**What goes wrong:** `tests/lib/merge.test.ts` reads the local cache file. If tests are run before `python pipeline/run.py`, the cache lacks the new fields and tests fail.
**Why it happens:** Pipeline output tests are integration tests that depend on a pipeline run. The test file uses `it.skip()` for this reason (existing pattern from Phase 6).
**How to avoid:** Mark pipeline-output tests with `it.skip()` and note that they require a pipeline run. Add Vitest unit tests for the TypeScript type guards that don't read from cache.
**Warning signs:** Test failures on CI before pipeline has been run.

### Pitfall 7: MergedPlayer type diverges from actual JSON output
**What goes wrong:** TypeScript type says `proj_pts_1gw: number` but the JSON has `proj_pts_1gw: null` for players with `ep_next = '0.0'`.
**Why it happens:** ep_next is 0.0 for bench/unavailable players — but 0.0 is a valid number, not null. The field should always be a number (never null) since we can always compute 0.0 for unavailable players.
**How to avoid:** Ensure Python pipeline writes `0.0` (not `null`) for all 6 new fields on every player, including those with no fixtures, injured players, and GKs with no ep_next.
**Warning signs:** TypeScript type error: `Type 'null' is not assignable to type 'number'` in downstream consumers.

### Pitfall 8: mins_risk classification for returning injured players
**What goes wrong:** A player with `status='d'` (doubtful) and `news='Knock - 50% chance'` gets classified as `injured` but may have been a regular starter previously. Phase 8 badge then shows wrong category.
**Why it happens:** The STATE.md decision says "rotation risk classification gated on status == 'a' with blank news". This intentionally catches all non-'a' players as injured/unavailable.
**How to avoid:** This is the correct behaviour per the locked decision. Phase 8 can refine badge labels if needed. Phase 7 must faithfully implement the locked classification.

## Code Examples

### Shared Element-Summary Fetch (run.py pattern)
```python
# Source: defcon.py existing pattern (time.sleep(0.1) confirmed working)
import time
from fpl_client import get_element_summary

summaries: dict[int, dict] = {}
for element in bootstrap['elements']:
    if element.get('starts', 0) == 0:
        continue
    try:
        summaries[element['id']] = get_element_summary(element['id'])
    except Exception as exc:
        print(f"  Warning: skipping id={element['id']}: {exc}")
    time.sleep(0.1)
```

### DGW-Aware Multi-GW Projection
```python
# Group fixtures by event_id, then sum across N GW groups
def _proj_pts_ngw(
    ppg: float,
    start_prob: float,
    fixtures: list,  # list of fixture dicts with event_id and difficulty_score
    n_gws: int,
) -> float:
    from itertools import groupby
    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total = 0.0
    for _event_id, gw_fixtures in grouped[:n_gws]:
        for fix in gw_fixtures:
            # difficulty_modifier: easy fixtures give more expected pts
            difficulty_modifier = 1.0 - (fix['difficulty_score'] * 0.5)
            total += ppg * start_prob * difficulty_modifier
    return round(total, 2)
```

### MergedPlayer TypeScript Extension
```typescript
// In src/lib/types.ts — extend existing MergedPlayer interface
export interface MergedPlayer {
  // ... existing fields unchanged ...

  // Projected points (PROJ-01/02/03) — absolute FPL pts, never normalised
  proj_pts_1gw: number        // expected pts next 1 GW (FPL ep_next, injury-adjusted)
  proj_pts_3gw: number        // expected pts next 3 GWs (ppg-based, DGW-aware)
  proj_pts_5gw: number        // expected pts next 5 GWs (ppg-based, DGW-aware)

  // Minutes risk (MINS-01)
  xmins: number               // expected minutes per GW (0–90)
  start_prob: number          // probability of starting (0.0–1.0)
  mins_risk: 'nailed' | 'likely_start' | 'rotation_risk' | 'cameo' | 'injured'
}
```

### xmins from element-summary history
```python
import statistics

def _compute_xmins(element: dict, summary: dict | None, finished_gws: int) -> dict:
    """Compute xmins, start_prob, mins_risk for one player."""
    starts = element.get('starts', 0)
    minutes = element.get('minutes', 0)
    chance = element.get('chance_of_playing_next_round')
    availability = (chance / 100.0) if chance is not None else 1.0

    # Per-match data from element-summary (preferred)
    if summary and starts > 0:
        history = [m for m in summary.get('history', []) if m.get('minutes', 0) > 0]
        recent = history[-10:]
        starts_in_recent = [m for m in recent if m.get('starts', 0) == 1]
        if starts_in_recent:
            avg_mins_started = statistics.mean(m['minutes'] for m in starts_in_recent)
            recent_start_rate = len(starts_in_recent) / max(len(recent), 1)
        else:
            avg_mins_started = 0.0
            recent_start_rate = 0.0
    else:
        # Bootstrap-only fallback
        avg_mins_started = minutes / starts if starts > 0 else 0.0
        recent_start_rate = starts / finished_gws if finished_gws > 0 else 0.0

    start_prob = round(recent_start_rate * availability, 4)
    xmins = round(avg_mins_started * start_prob, 1)

    # mins_risk classification (locked: only 'a' + blank news = rotation classification)
    status = element.get('status', 'a')
    news = element.get('news', '')
    if status != 'a' or news:
        mins_risk = 'injured'
    elif start_prob >= 0.85:
        mins_risk = 'nailed'
    elif start_prob >= 0.65:
        mins_risk = 'likely_start'
    elif avg_mins_started < 30 or recent_start_rate < 0.25:
        mins_risk = 'cameo'
    else:
        mins_risk = 'rotation_risk'

    return {'xmins': xmins, 'start_prob': start_prob, 'mins_risk': mins_risk}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| defcon.py fetches element-summary internally | Shared fetch in run.py, passed as dict | Phase 7 (this phase) | Pipeline run time stays flat despite adding xmins module |
| No projected points in merged data | proj_pts_1gw/3gw/5gw computed in merge.py | Phase 7 (this phase) | All v1.1 downstream phases (8–11) can consume proj_pts without separate computation |
| No minutes risk data | xmins, start_prob, mins_risk in merged data | Phase 7 (this phase) | Enables Phase 8 rotation badges and Phase 10 captaincy |

**Locked decisions from STATE.md:**
- `proj_pts_*` fields must be absolute FPL points — `normalise()` from gem-score.ts must NOT be applied
- element-summary fetches shared between defcon.py and xmins.py via run.py cache — never fetched twice
- rotation risk classification gated on `status == 'a'` with blank `news`

## Open Questions

1. **`starts` field in element-summary history**
   - What we know: defcon.py uses `m['minutes'] > 45` as a proxy for starts in some places (the history filtering uses `minutes > 0`)
   - What's unclear: Whether `summary['history'][n]['starts']` is reliably present in the 2025/26 FPL API
   - Recommendation: Implement with `m.get('starts', 0) == 1` as primary, fallback to `m['minutes'] > 60` as proxy for started. Use a WINDOW_STARTED_THRESHOLD constant.

2. **ep_next for players with BGW next round**
   - What we know: `ep_next` is 0.0 for players not in the next GW lineup
   - What's unclear: Whether FPL sets ep_next=0 for BGW teams or reflects the next available fixture
   - Recommendation: Use ep_next as-is for proj_pts_1gw. If 0, proj_pts_1gw = 0 — correct for BGW.

3. **difficulty_modifier weighting formula**
   - What we know: `difficulty_score` ranges 0.0 (easiest) to 1.0 (hardest), computed from rolling xGA
   - What's unclear: The exact weight reduction for hard fixtures. `1.0 - (score * 0.5)` gives 0.5–1.0 range.
   - Recommendation: Use `1.0 - (difficulty_score * 0.5)` as a reasonable starting point. The Phase 7 planner can confirm or adjust this constant.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | Pipeline execution | Yes | 3.11.9 | — |
| requests | FPL API client | Yes | 2.32.3 | — |
| pandas | Understat data | Yes | 2.2.3 | — |
| python-dotenv | .env loading | Yes | installed | — |
| Node.js | TypeScript build | Yes | 25.8.1 | — |
| Vitest | Test runner | Yes | 4.1.2 | — |

**No missing dependencies.** Phase 7 uses only the existing Python stdlib (`statistics` module, no install needed) and the already-installed packages.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | proj_pts_1gw is non-negative float on every player | unit | `npx vitest run tests/lib/merge.test.ts` | Yes (add tests) |
| PROJ-02 | proj_pts_3gw >= proj_pts_1gw for all players | unit | `npx vitest run tests/lib/merge.test.ts` | Yes (add tests) |
| PROJ-03 | DGW player proj_pts_3gw > equivalent single-GW player | unit | `npx vitest run tests/lib/merge.test.ts` | Yes (add tests) |
| MINS-01 | xmins in [0, 90], start_prob in [0, 1], mins_risk valid string | unit | `npx vitest run tests/lib/merge.test.ts` | Yes (add tests) |

**Note on pipeline integration tests:** Tests that read `pipeline/cache/merged_players.json` must be marked `it.skip()` per the established project pattern (see `tests/lib/merge.test.ts` lines 6–34). Pipeline output can be verified manually with `python pipeline/run.py` after implementation.

**TypeScript-only unit tests** can be written without a pipeline run by constructing minimal `MergedPlayer` fixture objects in test helpers — following the `makeMergedPlayer()` pattern in `tests/lib/gem-score.test.ts`.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/merge.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
The existing `tests/lib/merge.test.ts` file exists but has placeholder tests. New test cases for projected points and xmins fields need to be added in Wave 0 or Plan 1:
- [ ] Tests for `proj_pts_1gw` / `proj_pts_3gw` / `proj_pts_5gw` field presence and range validation
- [ ] Test for DGW doubling: fixture with 2 entries sharing `event_id` produces higher proj_pts_3gw
- [ ] Tests for `xmins` (0–90), `start_prob` (0.0–1.0), `mins_risk` (valid enum value)
- [ ] Test for `chance_of_playing_next_round = null` handled correctly (not TypeError)

## Sources

### Primary (HIGH confidence)
- FPL bootstrap-static API (live data inspection) — `ep_next`, `points_per_game`, `chance_of_playing_next_round`, `starts_per_90`, `starts`, `minutes`, `status`, `news` field verification
- `pipeline/defcon.py` (project source) — element-summary usage pattern, `time.sleep(0.1)` rate limiting, `summaries['history']` structure
- `pipeline/merge.py` (project source) — `team_fixtures` dict structure, `difficulty_score`, `FIXTURE_LOOKAHEAD=5` constant
- `pipeline/run.py` (project source) — existing orchestration pattern, save/upload flow
- `pipeline/cache/fpl_fixtures.json` (live data) — fixture structure, DGW detection (no DGWs in GW32–38 currently)
- `pipeline/cache/fpl_bootstrap.json` (live data) — 825 players, 459 starters, ep_next range 0–11.5 verified
- `.planning/STATE.md` (project decisions) — locked decisions on shared element-summary cache, absolute pts, rotation risk classification
- `tests/lib/merge.test.ts` (project source) — established pattern for pipeline-dependent test skipping

### Secondary (MEDIUM confidence)
- FPL element-summary API `history[].starts` field — confirmed present in FPL 2024/25+ based on defcon.py structure; should verify on first pipeline run

### Tertiary (LOW confidence)
- difficulty_modifier weighting formula `1.0 - (score * 0.5)` — reasonable estimate; exact formula TBD by planner

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and used in project
- Architecture: HIGH — based on reading actual source files, live FPL API data, and locked decisions
- Pitfalls: HIGH — derived from code inspection of existing patterns and the locked decision constraints
- Projected points formula: MEDIUM — ep_next usage is confirmed; multi-GW weighting formula is a reasonable design choice not validated against FPL scoring accuracy
- xmins formula: MEDIUM — bootstrap fields confirmed; element-summary `starts` field needs live verification

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (30 days; FPL API structure stable mid-season)
