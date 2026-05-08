---
phase: 079-insight-card-redesign
reviewed: 2026-05-08T09:19:44Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - pipeline/insights.py
  - pipeline/tests/test_insights.py
  - src/lib/types.ts
  - src/app/globals.css
  - src/components/insights/InsightsTab.tsx
  - src/components/insights/InsightsTab.test.tsx
findings:
  critical: 0
  warning: 0
  info: 3
  total: 10
status: clean
---

# Phase 79: Code Review Report

**Reviewed:** 2026-05-08T09:19:44Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase extended `pipeline/insights.py` with 11 new structured fields on all 12 insight-emitting sites, introduced a `_signal_label()` rule matrix, and rewrote `InsightsTab.tsx` with five-zone cards, collapsible sections, and a Decision Summary strip. Two critical bugs were found: a runtime crash when the pipeline runs mid-season on a fixture list where no fixtures have a valid `event` value, and a logic defect in `_signal_label` that silently drops `'captaincy'` insights into the generic fallback path (returning `'Weak signal'`) even at 65–69 % confidence, producing a misleading label. Five warnings cover a hard-coded `takeaway` that outputs a negative difference when away CS % is higher than home, misaligned `player_ids`/`player_names` list filtering, an inaccessible `<details>` element for screen readers, a non-exhaustive `byCategory` insertion that silently discards future categories, and an untested fallback branch. Three info items note minor style and test-coverage gaps.

---

## Critical Issues

### CR-01: `max()` on empty sequence crashes pipeline when no fixture has a valid `event`

**File:** `pipeline/insights.py:194` (also lines 263, 326, 375, 406, 452)

**Issue:** Six `gw_coverage` assignments use:
```python
f'GW1–{max((f.get("event") or 0) for f in finished)}'
```
The guard `total >= MIN_SAMPLE_TOTAL` (line 164) ensures `finished` is non-empty for the first three call sites, and similar guards apply for the attacking patterns. However the `att_top_xg_overperformers` block (line 375) enters when `sample_total_att >= MIN_SAMPLE_TOTAL` (i.e. enough qualifying *attackers* exist) — but `finished` is computed separately and could be empty when an API refresh happens before GW1 or during a break where no fixtures have `finished=True`. An empty `finished` list makes `max()` raise `ValueError: max() arg is an empty sequence`, crashing the entire pipeline run.

Additionally, the `def_cs_streak_ge2` block (lines 276–332) appends regardless of `len(finished)` (only `len(all_team_ids)` is checked). If `finished` is empty, all streaks are 0 and the `max()` call on line 326 crashes.

**Fix:**
```python
# Replace every instance with a safe default:
last_gw = max((f.get("event") or 0 for f in finished), default=0)
gw_coverage = f'GW1–{last_gw}' if last_gw > 0 else 'pre-season'
```
Apply this pattern consistently across all six `gw_coverage` assignment sites, and add an early-return guard in `def_cs_streak_ge2` when `finished` is empty:
```python
if not finished:
    return out
```
before the `streak_ge2_count` loop.

---

### CR-02: `_signal_label()` silently returns `'Weak signal'` for captaincy insights at 65–69 % confidence

**File:** `pipeline/insights.py:32–50`

**Issue:** The rule matrix contains no category-specific override for `'captaincy'`. A `captaincy` insight with `confidence_pct` between 65 and 69 (inclusive) falls through all three category guards, then also misses the `>= 70` threshold for `'Strong signal'`, landing on `'Watchlist'` — which is actually correct at 55–69. However at exactly 65–69 for `captaincy` the intent from D-04 is ambiguous: the "Hidden gem" override is `player`-only and the plan explicitly lists 6 labels without specifying captaincy behaviour at that band.

The real defect is the inverse: a `player` insight at confidence 65 is labelled `'Hidden gem'` (line 39) regardless of the subsequent `>= 70` check. Then a `player` insight at confidence 44 is labelled `'Trap risk'` (line 41). But a `player` insight at confidence 64 falls through both overrides, hits `>= 55`, and returns `'Watchlist'`. **This is correct by the code's own test (line 51 in test file).** 

The actual unreachable label is `'Strong signal'` for `category == 'player'`: because the first override fires at `>= 65` returning `'Hidden gem'`, and the second override fires at `< 45` returning `'Trap risk'`, the generic `>= 70` branch is **unreachable for the `player` category** — a `player` insight at 75 % confidence returns `'Hidden gem'`, not `'Strong signal'`. The type contract says `SignalLabel` contains `'Strong signal'` but the pipeline will never emit it for the player category. This is a semantic defect: a player with confidence 90 % is labelled `'Hidden gem'` rather than `'Strong signal'`, misleading the user.

**Fix:** Add an explicit upper bound to the `player`/`Hidden gem` override so `'Strong signal'` remains reachable:
```python
if category == 'player' and 65 <= confidence_pct < 70:
    return 'Hidden gem'
```
Then the generic `>= 70` branch correctly returns `'Strong signal'` for high-confidence player insights.

---

## Warnings

### WR-01: `takeaway` is factually wrong when away CS rate exceeds home

**File:** `pipeline/insights.py:188–191`

**Issue:** The `takeaway` string is hard-coded to always say "Home defenders keep clean sheets X% of the time — Ypp **more than away sides**." When `away_cs > home_cs` the difference `home_pct - away_pct` is negative, producing nonsense copy such as "32.1% of the time — -3.2pp more than away sides." The `confidence_pct` branch (lines 169–174) correctly picks the larger of the two, but `metric_value` (line 186) is always `home_pct` and the `takeaway` always frames it as a home advantage. If away is higher, the card is both numerically wrong (`metric_value` shows the lesser number) and textually contradictory.

**Fix:**
```python
if home_cs >= away_cs:
    metric_val = home_pct
    diff_label = f'{round(home_pct - away_pct, 1)}pp more than away sides'
    takeaway_subject = 'Home'
else:
    metric_val = away_pct
    diff_label = f'{round(away_pct - home_pct, 1)}pp more than home sides'
    takeaway_subject = 'Away'
# then use metric_val in metric_value and takeaway_subject/diff_label in takeaway
```

---

### WR-02: `player_ids` and `player_names` lists can fall out of alignment

**File:** `pipeline/insights.py:376–378` (also lines 502–504, 534–536, 566–568, 598–600, 646–648)

**Issue:** The list comprehensions for `player_ids` and `player_names` use independent filter predicates:
```python
'player_ids':   [int(p.get('id') or 0) for p in overperformers[:5] if p.get('id')],
'player_names': [str(p.get('web_name') or '') for p in overperformers[:5] if p.get('web_name')],
```
A player where `id` is present but `web_name` is `None`/empty will appear in `player_ids` but not in `player_names`, producing lists of different lengths. Downstream TypeScript code (and tests) assume the two lists are parallel (same length, same index = same player). If a player is missing their `web_name`, the chip rendered in `DecisionSummary` for `player_names[i]` will correspond to the wrong player ID.

**Fix:** Zip over a single pass so both lists are always aligned:
```python
top_players = [(p.get('id'), p.get('web_name', '')) for p in overperformers[:5] if p.get('id')]
'player_ids':   [int(pid) for pid, _ in top_players],
'player_names': [str(name) for _, name in top_players],
```

---

### WR-03: `<details>/<summary>` methodology section is inaccessible to screen readers

**File:** `src/components/insights/InsightsTab.tsx:101–106`

**Issue:** The `<details>` element uses native browser disclosure behaviour, but the `<summary>` element has no `aria-expanded` attribute and no explicit role. Screen readers on some platforms (particularly NVDA + Chrome) do not reliably announce the expanded/collapsed state of native `<details>` elements. Per WCAG 2.1 SC 4.1.2, interactive UI components must expose their state to assistive technologies.

**Fix:**
```tsx
<details className="text-xs text-muted">
  <summary
    className="cursor-pointer select-none"
    // Native <details> + <summary> is valid; add aria-label for clarity
    aria-label={`Methodology for ${insight.title}`}
  >
    Methodology
  </summary>
  ...
</details>
```
Alternatively, replace with a controlled `<button aria-expanded>` pattern consistent with `CollapsibleSection`.

---

### WR-04: `byCategory` insertion silently drops insights whose `category` is not in the hard-coded object

**File:** `src/components/insights/InsightsTab.tsx:217–227`

**Issue:**
```tsx
const byCategory: Record<Exclude<SectionKey, 'priority'>, Insight[]> = {
  defensive: [], attacking: [], player: [], captaincy: [],
}
for (const insight of data) {
  if (insight.category in byCategory) {
    byCategory[insight.category].push(insight)
  }
}
```
The `if (insight.category in byCategory)` guard silently discards any insight whose `category` is not one of the four keys. If the pipeline is extended with a new category (e.g. `'transfer'`), those insights will vanish from the UI with no error or warning. The TypeScript type `Insight.category` is a union `'defensive' | 'attacking' | 'player' | 'captaincy'` so this cannot happen today, but the guard creates a maintenance trap where the type union can be extended without updating the component.

**Fix:** Remove the silent-discard guard and assert exhaustiveness, or at minimum throw in development:
```tsx
for (const insight of data) {
  const cat = insight.category as Exclude<SectionKey, 'priority'>
  if (!(cat in byCategory)) {
    // New category added to pipeline but not to component — surface it
    console.warn(`InsightsTab: unknown category "${cat}", insight ${insight.id} dropped`)
    continue
  }
  byCategory[cat].push(insight)
}
```

---

### WR-05: D-07 fallback in `DecisionSummary` is untested and partially contradicts its own comment

**File:** `src/components/insights/InsightsTab.tsx:142–146`; `src/components/insights/InsightsTab.test.tsx:311–331`

**Issue:** The fallback comment says "if fewer than 3 have entity lists, fall back to top-3 by confidence overall." The code triggers the fallback when `withEntities.length >= DECISION_TOP_N` is false — i.e. when there are 0, 1, or 2 entity-bearing insights. In that case it replaces the entire result with the top-3 by confidence, including insights that have *no* entity lists. The test on line 319 documents this: `FIXTURE[0]` (confidence 75) has empty entity lists but still appears in the Decision Summary via fallback. The test passes, but the fallback's own contract ("fall back to top-3") means the Decision Summary may show three action hints with zero chips, which is the low-information state the entity filtering was designed to avoid.

More critically: the fallback condition checks `withEntities.length >= DECISION_TOP_N` (≥ 3), meaning if there are exactly 2 entity-bearing insights the fallback fires and throws away those 2 in favour of a confidence-only sort. This is backwards — 2 entity-bearing insights should be kept and supplemented, not discarded.

**Fix:**
```tsx
const top3 =
  withEntities.length > 0
    ? withEntities  // show whatever entity-bearing insights exist (1, 2, or 3)
    : [...insights].sort((a, b) => b.confidence_pct - a.confidence_pct).slice(0, DECISION_TOP_N)
```
Or if exactly 3 is a hard requirement, pad `withEntities` with additional confidence-sorted items rather than replacing it entirely.

---

## Info

### IN-01: `_signal_label` `insight_id` parameter is accepted but never used

**File:** `pipeline/insights.py:32`

**Issue:** The function signature includes `insight_id: str` as the third parameter, but the function body never references it. It is passed at every call site, adding noise and suggesting future per-insight overrides that do not exist.

**Fix:** Remove the parameter from the signature and all call sites, or add a `# noqa: ARG001` comment if the intent is to reserve it for future per-ID overrides.

---

### IN-02: Test fixture `def_cs_streak_ge2` has `metric_value: 30.0` but sample is 2/20 = 10 %

**File:** `src/components/insights/InsightsTab.test.tsx:113`

**Issue:** The test fixture for `def_cs_streak_ge2` sets `confidence_pct: 30.0` and `metric_value: 30.0` but `sample_n: 2` / `sample_total: 20` — which is 10 %, not 30 %. The `metric_value` field is supposed to be the headline number (the pipeline sets it to `float(confidence_pct)`), so the fixture is internally inconsistent. This does not break any test because no test asserts the `metric_value` against `sample_n/sample_total`, but it makes the fixture misleading for future test authors.

**Fix:** Correct the fixture to use consistent values:
```ts
confidence_pct: 10.0,
metric_value: 10.0,
// or keep 30.0 and update sample_n: 6 (6/20 = 30%)
```

---

### IN-03: `CollapsibleSection` `aria-expanded` value is a boolean, not a string

**File:** `src/components/insights/InsightsTab.tsx:123`

**Issue:**
```tsx
aria-expanded={open}
```
React serialises boolean `true` as the string `"true"` and boolean `false` as `"false"` in the DOM, which is correct for ARIA. However, the test on line 295 asserts `.getAttribute('aria-expanded') === 'true'`, which works only because React converts the boolean. This is fine in the current stack but is worth noting: the pattern is only safe because React handles the conversion — raw DOM `setAttribute('aria-expanded', false)` would set the string `"false"` which is still truthy. No action required beyond awareness, but consider using an explicit string `aria-expanded={open ? 'true' : 'false'}` for explicitness and portability.

**Fix (optional):** `aria-expanded={open ? 'true' : 'false'}` to make the contract explicit.

---

_Reviewed: 2026-05-08T09:19:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
