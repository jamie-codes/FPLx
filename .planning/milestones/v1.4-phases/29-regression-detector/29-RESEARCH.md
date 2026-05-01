# Phase 29: Regression Detector - Research

**Researched:** 2026-04-28
**Domain:** Pipeline math (per-match xG/xA) + TypeScript badge component + TanStack column integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use the soccerdata library to fetch per-player per-match xG/xA from Understat. *(See Critical Finding below — FPL element-summary supersedes this.)*
- **D-02:** Pipeline writes per-match data to a separate intermediate cache file (`pipeline/cache/understat_per_match.json`). `merge.py` reads the cache, computes regression signal, and attaches to `merged_players.json`. *(See Critical Finding below — no intermediate cache file needed.)*
- **D-03:** If the per-match fetch fails, the pipeline skips regression signal fields gracefully and does not hard-fail. Players with no `regression_signal` field render `—` in the Signal column.
- **D-04:** BUY signal is a green pill badge labeled "BUY"; SELL signal is an amber pill badge labeled "SELL". Follows the `VarianceBadge` / `MinsRiskBadge` visual envelope (text-xs, rounded, px-2 py-1).
- **D-05:** Signals appear in a dedicated "Signal" column in GemTable — narrow, sortable.
- **D-06:** Signal column follows the landscape-aware responsive visibility pattern: hidden on mobile portrait, visible on landscape and desktop.
- **D-07:** Fixed 5 GW lookback window. No toggle.
- **D-08:** Fixed absolute threshold: ±0.5 xG+xA per match.
- **D-09:** `delta = mean(actual_goals + actual_assists) - mean(xG + xA)` per match, averaged over the 5-GW window. BUY if `delta < -0.5`. SELL if `delta > +0.5`. Otherwise no signal.
- **D-10:** Minimum 900 minutes played over the 5-GW window. Players below this gate show `—`.

### Claude's Discretion

- Tooltip content for BUY/SELL badges.
- Column position in GemTable column order (after xPts, before Fixture Badges).
- soccerdata cache TTL (now moot — no soccerdata call needed).
- Pipeline module location (now moot — computation lives in `merge.py` using existing `summaries` dict).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-03 | System fetches and stores per-match xG/xA per player from Understat (pipeline currently only has season-aggregate) | FPL element-summary history already provides `expected_goals`/`expected_assists` per match (StatsBomb model) — already fetched via `summaries` dict in `run.py`. No new HTTP calls needed. |
| REG-01 | User can see a buy signal on players whose actual goals/assists are below their xG/xA over the last 5–10 GW (min 900 min) | Compute delta from element-summary `history` (round + goals_scored + assists + expected_goals + expected_assists). Attach `regression_signal='buy'` to `merged_players.json`. |
| REG-02 | User can see a sell signal on players whose actual goals/assists are above their xG/xA over the last 5–10 GW (min 900 min) | Same as REG-01 but `regression_signal='sell'`. |

</phase_requirements>

---

## Summary

Phase 29 requires per-player per-match xG/xA to compute a 5-GW regression signal. The locked decision D-01 assumed this data would require the soccerdata library to scrape Understat. **Research found that the FPL element-summary API already provides `expected_goals` and `expected_assists` per match, in the `history` array that `run.py` already fetches for every player with `starts > 0`**. The data is present in the `summaries` dict that is already passed to `merge_players()` — no new HTTP calls, no new library usage, no intermediate cache file, no rate limiting risk.

The `history` array contains one entry per match played with `round` (FPL GW number, int), `goals_scored` (int), `assists` (int), `expected_goals` (string — requires `float()` cast), `expected_assists` (string), and `minutes` (int). Double-gameweek rounds produce two entries with the same `round` value; blank gameweeks produce no entry. The 5-GW window is defined as the last 5 unique `round` values present in the history. The 900-minute gate sums `minutes` across those entries (excluding `minutes == 0`).

The UI work is a clean additive extension: a new `RegressionSignalBadge` component following `VarianceBadge`'s visual envelope, a new `signal` column in `columns.tsx` inserted after the xPts columns, and two new optional fields on `MergedPlayer`. The `MOBILE_HIDDEN_COLUMNS` map in `GwToggle.tsx` and `HIDDEN_COLUMN_LABELS` in `GemTable.tsx` each get one new entry.

**Primary recommendation:** Compute regression signal inline in `merge.py` using the existing `summaries` dict parameter. Add a `_compute_regression_signal(history: list) -> tuple[str | None, float | None]` helper function. No soccerdata call, no intermediate cache, no new API route.

---

## Critical Finding: soccerdata Not Required

**D-01 was based on an incorrect assumption.** The FPL `element-summary` API endpoint already returns per-player per-match xG/xA data from StatsBomb (which FPL adopted in 2023).

**Verified from live API call (player ID 430 = Haaland):**

```
GW1:  minutes=72, goals_scored=2, assists=0, expected_goals='1.99', expected_assists='0.00'
GW33: minutes=90, goals_scored=1, assists=0, expected_goals='0.81', expected_assists='0.04'  (match 1)
GW33: minutes=90, goals_scored=1, assists=0, expected_goals='1.07', expected_assists='0.07'  (match 2 DGW)
```

`expected_goals` and `expected_assists` are strings representing floats (require `float()` cast). `round` is an int representing the GW number.

**Implication for D-02:** The intermediate `pipeline/cache/understat_per_match.json` cache file is **not needed**. Data comes from the `summaries` dict already passed to `merge_players()`. The CONTEXT.md's D-02 intent (attach signals to `merged_players.json` via merge.py) is preserved; only the data source changes.

**Data model note:** FPL `expected_goals` uses StatsBomb xG; `understat_current.json` uses Understat's proprietary model. For the regression signal the direction of delta is what matters, not the absolute scale — both models will identify the same clear over/underperformers. Using FPL's built-in per-match xG is strictly simpler and more reliable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-match xG/xA retrieval | Python pipeline | — | Already fetched via `summaries` dict in `run.py`; pure Python math |
| Signal computation (delta, window, gate) | Python pipeline (merge.py) | — | Operates on `summaries` dict already available at merge time |
| Signal fields in merged_players.json | Python pipeline | — | `merge_players()` output; same pattern as `xPts_1gw` from Phase 28 |
| TypeScript type definitions | TypeScript lib (types.ts) | — | Optional fields on MergedPlayer; planner/executor touch |
| RegressionSignalBadge component | Browser/Client (React) | — | Display-only; no server logic |
| Signal column in GemTable | Browser/Client (columns.tsx) | — | TanStack accessor + sortingFn; column visibility in GwToggle.tsx |
| API route serving signals | — | — | None needed — signals embedded in merged_players.json, served via /api/players |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python (stdlib) | 3.11 | Signal computation | No new pip dependencies needed |
| pandas | >=2.2.0 | Used by soccerdata but NOT needed for Phase 29 | Already in requirements.txt |
| React 19 / TypeScript | (project) | Badge component | Existing codebase stack |
| TanStack Table v8 | (project) | Column definition and sorting | Already used by GemTable |
| Tailwind CSS v4 | (project) | Badge styling | Same classes as VarianceBadge |

[VERIFIED: requirements.txt, pipeline/run.py, src/components/gem-table/columns.tsx]

### No New Dependencies
Phase 29 adds zero new pip packages or npm packages. The FPL element-summary data already flows through the existing pipeline path.

---

## Architecture Patterns

### System Architecture Diagram

```
run.py
  └── summaries dict (already fetched: one element-summary per player with starts>0)
        └── merge_players(bootstrap, fixtures, understat, id_map,
                           xmins_stats, summaries)          ← summaries already param
              └── _compute_regression_signal(history)       ← NEW helper function
                    inputs:  history list from summaries[fpl_id]['history']
                    output:  (signal: 'buy'|'sell'|None, delta: float|None)
              └── player dict gains:
                    regression_signal: 'buy'|'sell'|None
                    actual_vs_xg_delta: float|None
              └── merged_players.json
                    └── /api/players (no change)
                          └── usePlayers() hook (no change)
                                └── GemTable → ScoredPlayer
                                      └── Signal column
                                            └── RegressionSignalBadge
```

### Recommended Project Structure

No new files or folders are structurally required. Additions slot into existing locations:

```
pipeline/
├── merge.py                  # +_compute_regression_signal() helper + inline call
src/
├── lib/
│   └── types.ts              # +regression_signal?, +actual_vs_xg_delta?
├── components/
│   └── gem-table/
│       ├── columns.tsx        # +Signal column definition
│       ├── GwToggle.tsx       # +signal: false in MOBILE_HIDDEN_COLUMNS
│       ├── GemTable.tsx       # +signal: 'Signal' in HIDDEN_COLUMN_LABELS
│       └── RegressionSignalBadge.tsx   # NEW component (parallel to VarianceBadge)
tests/
└── lib/
    └── regression-signal.test.ts       # NEW test file
```

### Pattern 1: Signal Computation in merge.py

```python
# Source: verified from live FPL API + existing merge.py patterns

def _compute_regression_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 900,
    threshold: float = 0.5,
) -> tuple:
    """Compute regression signal from element-summary history.

    Returns (signal, delta) where:
      signal: 'buy' | 'sell' | None
      delta:  float (actual_ga_per_match - xgxa_per_match) | None

    Five-GW window = last 5 unique round values in history.
    Entries with minutes == 0 are excluded from computations
    but the round still consumes one of the 5 GW slots.
    """
    if not history:
        return None, None

    # Sort by round (GW number)
    history_sorted = sorted(history, key=lambda h: h['round'])

    # Last 5 unique rounds (BGW produces no entry, DGW produces 2 entries same round)
    unique_rounds = sorted(set(h['round'] for h in history_sorted))
    last_rounds = set(unique_rounds[-window_gws:])

    window = [h for h in history_sorted if h['round'] in last_rounds]
    played = [h for h in window if h.get('minutes', 0) > 0]

    total_mins = sum(h['minutes'] for h in played)
    if total_mins < min_minutes:
        return None, None

    n = len(played)
    if n == 0:
        return None, None

    mean_actual = sum(h['goals_scored'] + h['assists'] for h in played) / n
    mean_xgxa = sum(
        float(h.get('expected_goals', 0) or 0) + float(h.get('expected_assists', 0) or 0)
        for h in played
    ) / n

    delta = round(mean_actual - mean_xgxa, 4)

    if delta < -threshold:
        return 'buy', delta
    elif delta > threshold:
        return 'sell', delta
    else:
        return None, delta
```

**Integration point in merge_players()** — after the existing xPts ceiling classification (around line 727), before `return result`:

```python
# ---- Regression signal (Phase 29 DATA-03, REG-01, REG-02) ----
if summaries and fpl_id in summaries:
    reg_signal, reg_delta = _compute_regression_signal(
        summaries[fpl_id].get('history', [])
    )
    if reg_signal is not None or reg_delta is not None:
        player['regression_signal'] = reg_signal
        player['actual_vs_xg_delta'] = reg_delta
# Fields are simply absent when signal cannot be computed (D-03 graceful fallback).
```

### Pattern 2: RegressionSignalBadge Component

```tsx
// Source: verified from VarianceBadge.tsx and MinsRiskBadge.tsx

export function RegressionSignalBadge({
  signal,
  delta,
}: {
  signal: 'buy' | 'sell' | null | undefined
  delta: number | null | undefined
}) {
  if (!signal) return <span className="text-zinc-400">—</span>

  const deltaStr = delta != null ? delta.toFixed(2) : ''

  if (signal === 'buy') {
    return (
      <span
        className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
        title={`Underperforming xG+xA over last 5 GW (delta ${deltaStr} per match). Actual G+A below expected — may regress upward. Consider buying.`}
      >
        BUY
      </span>
    )
  }

  return (
    <span
      className="inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
      title={`Overperforming xG+xA over last 5 GW (delta +${deltaStr} per match). Actual G+A above expected — may regress downward. Consider selling.`}
    >
      SELL
    </span>
  )
}
```

### Pattern 3: Signal Column in columns.tsx

```tsx
// Source: verified from existing columns.tsx createColumnHelper pattern

// Insert AFTER the xPts_5gw column definition, BEFORE the 'trend' col.display block:
col.accessor('regression_signal', {
  header: H('Signal', 'Regression signal: BUY = underperforming xG+xA last 5 GW; SELL = overperforming. Min 900 min played.'),
  cell: (info) => (
    <RegressionSignalBadge
      signal={info.getValue()}
      delta={info.row.original.actual_vs_xg_delta}
    />
  ),
  enableSorting: true,
  sortingFn: (rowA, rowB) => {
    const order: Record<string, number> = { sell: 2, buy: 0 }
    const a = order[rowA.original.regression_signal ?? ''] ?? 1
    const b = order[rowB.original.regression_signal ?? ''] ?? 1
    return a - b
  },
}),
```

Sorting: descending puts SELL (2) first, ascending puts BUY (0) first. Null/absent (1) always in the middle.

### Pattern 4: Column Visibility Integration

**GwToggle.tsx** — add `signal` to `MOBILE_HIDDEN_COLUMNS`:

```ts
export const MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  // ... existing entries ...
  signal: false,       // ADD: hidden on portrait mobile
}
```

**GemTable.tsx** — add `signal` to `HIDDEN_COLUMN_LABELS`:

```ts
const HIDDEN_COLUMN_LABELS: Record<string, string> = {
  // ... existing entries ...
  signal: 'Signal',    // ADD: shown in tap-to-expand detail panel on mobile
}
```

No change needed in `getColumnVisibility()` — `MOBILE_HIDDEN_COLUMNS` is already spread there.

### Anti-Patterns to Avoid

- **Using soccerdata read_player_match_stats():** Would require ~320 HTTP requests (one per match), 5-10 min first-run latency, and adds a scraping dependency. FPL element-summary already provides the same data.
- **Intermediate cache file (understat_per_match.json):** Not needed; data lives in summaries dict already in memory. Adding a cache file adds I/O without benefit.
- **Mean over GW aggregates (sum per GW, then mean):** This would give each GW equal weight regardless of DGW (incorrect). Use per-match mean — each match entry is one data point.
- **Including 0-minute entries in the delta computation:** Players who DNP (minutes=0) in a window GW have `expected_goals='0.00'` and `goals_scored=0`. Including them would dilute the delta artificially. Filter to `minutes > 0` before computing mean.
- **Using seasons-aggregate Understat xG for per-match comparison:** Mixing per-match actual goals vs season-aggregate xG doesn't produce a per-match signal. Per-match must compare per-match actuals vs per-match expected.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-match xG data source | Custom Understat scraper or soccerdata integration | FPL element-summary `expected_goals`/`expected_assists` fields | Already fetched; zero new HTTP calls |
| GW→date mapping | Date-range lookup table | FPL `round` field in element-summary history | Round is the GW number directly; no date arithmetic needed |
| Badge component styling | Custom CSS | Tailwind classes from VarianceBadge/MinsRiskBadge pattern | Ensures visual consistency across all badges |
| Sort ordering for string signal values | Alphabetical string sort | Custom `sortingFn` with explicit numeric ordering | 'buy' < 'sell' alphabetically but SELL should sort higher by default |
| Column visibility for signal | New conditional logic | Adding `signal: false` to `MOBILE_HIDDEN_COLUMNS` | Reuses existing pattern used by all 15 mobile-hidden columns |

---

## Common Pitfalls

### Pitfall 1: Including 0-Minute Entries in Delta Computation
**What goes wrong:** A player benched for one GW in the window (minutes=0, goals_scored=0, expected_goals='0.00') dilutes both actual G+A and xG+xA to near zero, artificially suppressing the delta.
**Why it happens:** The history array includes entries for rounds where the player was in the squad but did not play (tactical substitution, bench starter).
**How to avoid:** Filter to `played = [h for h in window if h.get('minutes', 0) > 0]` before computing means.
**Warning signs:** Players with strong form showing `None` signal despite obvious over/under-performance.

### Pitfall 2: 5 Last Entries vs 5 Last Unique Rounds
**What goes wrong:** Taking `history[-5:]` (last 5 entries) instead of last 5 unique GW rounds. A DGW player has 6 entries in 5 GWs — `history[-5:]` would start from the middle of one season's form window.
**Why it happens:** Natural assumption that "last 5 entries" = "last 5 GWs".
**How to avoid:** Collect `unique_rounds = sorted(set(h['round'] for h in history))[-5:]` then filter.
**Warning signs:** DGW players having their window start mid-way through a GW.

### Pitfall 3: String-to-Float Cast for expected_goals
**What goes wrong:** `TypeError: unsupported operand type(s) for +: 'str' and 'str'` when summing `expected_goals + expected_assists`.
**Why it happens:** FPL API returns `expected_goals` and `expected_assists` as strings ('1.99', '0.04') not floats, unlike `goals_scored` and `assists` which are ints.
**How to avoid:** Always `float(h.get('expected_goals', 0) or 0)` — the `or 0` guard handles both `None` and empty string.
**Warning signs:** `TypeError` immediately on any player with non-zero xG.

### Pitfall 4: sortingFn Closure Scope
**What goes wrong:** Custom `sortingFn` in columns.tsx accessing `regression_signal` from wrong row when using `row.original`.
**Why it happens:** `col.accessor('regression_signal')` makes the value directly available via `rowA.getValue()` but `delta` is on a separate field.
**How to avoid:** Use `rowA.original.regression_signal ?? ''` — accessor value goes through getValue() but original fields are always available.
**Warning signs:** Sort not changing order, TypeScript compile error on getValue() type.

### Pitfall 5: Missing Field in MOBILE_HIDDEN_COLUMNS vs HIDDEN_COLUMN_LABELS
**What goes wrong:** Signal column visible on portrait mobile despite intention to hide (or vice versa: column hidden on desktop).
**Why it happens:** Forgetting one of the two maps — `MOBILE_HIDDEN_COLUMNS` controls visibility, `HIDDEN_COLUMN_LABELS` controls tap-to-expand display on mobile.
**How to avoid:** Update both maps whenever adding a column that should follow the mobile-hide pattern.
**Warning signs:** Signal column visible in portrait mode, or column absent from expanded row detail panel.

---

## Code Examples

### Verified: element-summary history structure
```python
# Source: live FPL API call (player 430 = Haaland, 2025/26 season)
# history[0] keys (verified 2026-04-28):
['element', 'fixture', 'opponent_team', 'total_points', 'was_home', 'kickoff_time',
 'team_h_score', 'team_a_score', 'round', 'modified', 'minutes', 'goals_scored',
 'assists', 'clean_sheets', 'goals_conceded', 'own_goals', 'penalties_saved',
 'penalties_missed', 'yellow_cards', 'red_cards', 'saves', 'bonus', 'bps',
 'influence', 'creativity', 'threat', 'ict_index', 'clearances_blocks_interceptions',
 'recoveries', 'tackles', 'defensive_contribution', 'starts',
 'expected_goals',           # <- str, e.g. '1.99'
 'expected_assists',         # <- str, e.g. '0.04'
 'expected_goal_involvements', 'expected_goals_conceded',
 'value', 'transfers_balance', 'selected', 'transfers_in', 'transfers_out']

# Key field types:
# round: int (GW number)
# goals_scored: int
# assists: int
# expected_goals: str  -- CAST with float()
# expected_assists: str -- CAST with float()
# minutes: int

# DGW: TWO entries with same round value (verified GW33 for Haaland):
# round=33: mins=90, goals=1, xG='0.81'
# round=33: mins=90, goals=1, xG='1.07'
```

### Verified: soccerdata Understat API (not used, but documented for reference)
```python
# Source: inspect.getsource(soccerdata.Understat.read_player_match_stats) -- verified 2026-04-28
# Constructor:
us = soccerdata.Understat(
    leagues='ENG-Premier League',  # exact string from available_leagues()
    seasons='2425',                # or 2025 (int)
)
# Returns DataFrame with index ['league', 'season', 'game', 'team', 'player']
# Columns: league_id, season_id, game_id, team_id, player_id, position, position_id,
#          minutes, goals, own_goals, shots, xg, xa, xg_chain, xg_buildup,
#          assists, key_passes, yellow_cards, red_cards
# NOTE: player_id is Understat ID, must be joined to FPL via player_id_map.json
# NOTE: ~320 HTTP requests per season (one per finished match page)
# This is NOT used in Phase 29 — documented only for future phases if needed
```

---

## Runtime State Inventory

Phase 29 is an additive feature phase — no rename or migration involved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — merged_players.json is rewritten on each pipeline run | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | merge.py computation | ✓ | 3.11 | — |
| FPL element-summary API | Per-match xG/xA data | ✓ | live | existing `summaries` dict |
| soccerdata | Not used (see Critical Finding) | ✓ | 1.8.8 | N/A — not needed |
| pandas | Not needed for Phase 29 | ✓ | >=2.2.0 | N/A |
| Vitest | Component/unit tests | ✓ | (project) | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing, jsdom environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/lib/regression-signal.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-03 | `regression_signal` and `actual_vs_xg_delta` present on players with ≥900 min in last 5 GWs | integration (cache read) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ Wave 0 |
| REG-01 | Player with consistent actual G+A below xG+xA gets `regression_signal='buy'` | unit (pure math) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ Wave 0 |
| REG-02 | Player with consistent actual G+A above xG+xA gets `regression_signal='sell'` | unit (pure math) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ Wave 0 |
| REG-01/02 | Player with <900 min in window gets no signal | unit (pure math) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ Wave 0 |
| D-09 | delta = mean(actual G+A) - mean(xG+xA) at exact threshold ±0.5 produces correct signal/no-signal | unit boundary | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ Wave 0 |
| D-07 | DGW window: 2 matches in same round both counted | unit (DGW case) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ Wave 0 |

**Note:** The regression signal computation is pure Python math. The Vitest tests validate:
1. The TypeScript `MergedPlayer` type additions are correctly typed.
2. The `RegressionSignalBadge` renders BUY/SELL/— for correct input values.
3. The column visibility pattern for `signal` in `getColumnVisibility()`.
4. Integration: `merged_players.json` cache contains correct signal fields (skipped, requires pipeline run).

### Key Test Invariants (for Wave 0 test file)

```typescript
// Unit: delta = 0.0 → no signal (exact equality case)
// Unit: delta = -0.4999 → no signal (below threshold, not BUY)
// Unit: delta = -0.5001 → BUY signal (just over threshold)
// Unit: delta = +0.5001 → SELL signal
// Unit: total_minutes < 900 → null signal regardless of delta
// Unit: empty history → null signal
// Unit: DGW (2 entries round 33) both contribute to mean
// Integration (skip): merged_players.json regression_signal field is 'buy'|'sell'|null or absent
// Integration (skip): ~15-25% of players have a non-null signal (sanity ratio check)
```

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/regression-signal.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/regression-signal.test.ts` — covers all unit invariants above (pure math + badge rendering + column visibility)

*(Existing test infrastructure covers all other phase requirements — no new fixtures/config needed)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Season-aggregate xG (understat_client.py) | Per-match xG/xA via FPL element-summary `expected_goals` | Phase 29 | Enables 5-GW window regression signal |
| soccerdata scraping for per-match data | FPL native per-match fields | Phase 29 (research finding) | Zero new HTTP calls; zero new dependencies |

**Deprecated/outdated:**
- D-01/D-02 from CONTEXT.md (soccerdata + intermediate cache file): superseded by FPL element-summary `expected_goals` discovery. The planner should implement using FPL data and note this deviation from the locked decisions.

---

## Open Questions (RESOLVED)

1. **D-01/D-02 deviation confirmation**
   - What we know: FPL element-summary has `expected_goals`/`expected_assists` per match. soccerdata would require ~320 extra HTTP calls.
   - What's unclear: Whether user wants the "Understat xG" brand on the signal tooltip, or FPL/StatsBomb xG is acceptable.
   - Recommendation: Proceed with FPL `expected_goals` (already available, zero risk). Tooltip can say "xG+xA" without specifying source. If user specifically needs Understat model consistency, soccerdata can be added in a follow-up.
   - **RESOLVED:** FPL `expected_goals`/`expected_assists` used. Tooltip says "xG+xA" without naming the source model. D-01/D-02 deviation documented in ROADMAP.md and both plan frontmatter.

2. **Window definition for BGW players**
   - What we know: If player has BGW (e.g., Man United GW31 blank), the element-summary has no entry for that round. The 5-GW window then spans 6 calendar GWs.
   - What's unclear: Is this intentional? (Yes — a BGW slot simply isn't used as a data point.)
   - Recommendation: The "last 5 unique rounds with any entry" approach is correct. The 900-min gate naturally handles sparse form.
   - **RESOLVED:** BGW slots are intentionally skipped. "Last 5 unique rounds with any entry" is the correct window definition; 900-min gate handles sparse form.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FPL `expected_goals` values are consistently populated for all players with starts > 0, including players without Understat IDs | Critical Finding | Some players may have '0.00' even when they should have positive xG — verified for players with no understat_id (returns '0.00', which is a real value not an error) |
| A2 | The `summaries` dict in `run.py` is available at merge time for all 459 players with `starts > 0` | Architecture | If pipeline changes reduce summary fetch coverage, fewer players get signals — but fallback (no signal) is graceful per D-03 |

**A1 mitigation:** Verified that FPL element-summary `expected_goals` is populated (though '0.00') even for players without Understat IDs. The signal computation handles '0.00' correctly (treats as xG=0, not missing data).

---

## Sources

### Primary (HIGH confidence)
- Live FPL API (`/api/element-summary/{id}/`) — verified `expected_goals`, `expected_assists`, `round`, `goals_scored`, `assists`, `minutes` fields with types. Tested for DGW (GW33 Haaland), BGW (GW31 absent), and non-Understat player.
- `pipeline/understat_client.py` — existing season-aggregate fetch pattern confirmed.
- `pipeline/merge.py` — merge_players signature, summaries param confirmed at line 331.
- `pipeline/run.py` — summaries dict fetch loop and merge_players call confirmed.
- `pipeline/requirements.txt` — soccerdata==1.8.8 confirmed installed.
- `src/components/gem-table/columns.tsx` — column order, accessor pattern, GwToggle integration confirmed.
- `src/components/gem-table/VarianceBadge.tsx` — badge Tailwind classes confirmed.
- `src/components/shared/MinsRiskBadge.tsx` — badge variant pattern confirmed.
- `src/components/gem-table/GwToggle.tsx` — MOBILE_HIDDEN_COLUMNS structure confirmed.
- `src/components/gem-table/GemTable.tsx` — HIDDEN_COLUMN_LABELS structure confirmed.

### Secondary (MEDIUM confidence)
- `soccerdata.Understat.read_player_match_stats` source code (inspect.getsource) — confirmed return schema, index, and HTTP request pattern per match.
- soccerdata.readthedocs.io — confirmed method list and DataFrame column names.

### Tertiary (LOW confidence)
- None — all critical claims verified from live sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from requirements.txt and live API
- Architecture: HIGH — verified from live FPL API responses and source code
- Pitfalls: HIGH — verified from live data (DGW entries, string types, 0-min entries)

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (FPL API structure stable within a season; element-summary fields unlikely to change mid-season)
