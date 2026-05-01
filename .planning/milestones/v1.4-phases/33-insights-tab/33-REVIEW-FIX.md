---
phase: 33-insights-tab
fixed_at: 2026-04-28T00:00:00Z
review_path: .planning/phases/33-insights-tab/33-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 33: Code Review Fix Report

**Fixed at:** 2026-04-28T00:00:00Z
**Source review:** .planning/phases/33-insights-tab/33-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Blob fetch response not checked — corrupt data silently forwarded as 200

**Files modified:** `src/app/api/insights/route.ts`
**Commit:** b30bbf7
**Applied fix:** Added `if (!res.ok)` check after `await fetch(blobs[0].url)`. Returns `Response.json({ error: \`Blob fetch failed: ${res.status}\` }, { status: 502 })` when the CDN returns a non-OK status, preventing corrupt HTML error pages from being forwarded as 200 JSON.

### WR-01: Blob response content-type not validated — JSON parse failure not caught at route boundary

**Files modified:** `src/app/api/insights/route.ts`
**Commit:** 7e4c6b4
**Applied fix:** Replaced `new Response(data, { headers: { 'Content-Type': 'application/json', ... } })` with `const parsed = JSON.parse(data)` followed by `return Response.json(parsed, ...)`. Invalid JSON now throws a `SyntaxError` that is caught by the existing `catch {}` block and mapped to a 500, rather than returning a 200 with an invalid `Content-Type: application/json` body.

### CR-02: Top-6 clean-sheet count double-counts when both teams are top-6 (logic error)

**Files modified:** `pipeline/insights.py`
**Commit:** bbaff03
**Applied fix:** Changed `elif a in top6_ids and h_score == 0: top6_cs += 1` to `if a in top6_ids and h_score == 0: top6_cs += 1` (independent check). Replaced `top6_total = len(top6_fixtures)` with `top6_appearances` computed by summing the number of top-6 team slots in each fixture `(1 if h in top6_ids else 0) + (1 if a in top6_ids else 0)`. The denominator now correctly accounts for top-6 vs top-6 fixtures contributing two appearances. Updated statement and `sample_total` to use `top6_appearances`. Note: logic fix — requires human verification of the confidence value semantics.

### CR-03: `cap_top3_xpts_share` — sample gate uses rounded xPts sum, not a count

**Files modified:** `pipeline/insights.py`
**Commit:** fd02200
**Applied fix:** Changed `sample_total = round(sum_all_xpts)` to `sample_total = len(available)` (player count). Changed `sample_n = round(sum_top3_xpts)` to `sample_n = len(top3)` (always 3 when len(available) >= 3). Updated the statement from `({sample_n}/{sample_total})` fractions to `from {sample_total} eligible players` prose. The `MIN_SAMPLE_TOTAL` gate now correctly checks a minimum of 10 available players rather than an xPts sum that could pass with fewer than 10 players.

### WR-02: Tooltip precision inconsistency — `confidence_pct` rendered without decimal when whole number

**Files modified:** `src/components/insights/InsightsTab.tsx`, `src/components/insights/InsightsTab.test.tsx`
**Commit:** d9317cf
**Applied fix:** Changed `` `True in ${insight.confidence_pct}%... `` to `` `True in ${insight.confidence_pct.toFixed(1)}%... `` in `InsightCard`. Updated the test expectation at line 138 from `'True in 75% of fixtures — 100/308 matches'` to `'True in 75.0% of fixtures — 100/308 matches'` to enforce the 1 d.p. precision contract.

### WR-03: `_taker_entry` accepts unused `role_key` parameter

**Files modified:** `pipeline/run.py`
**Commit:** c8b0f97
**Applied fix:** Removed the `role_key` first parameter from `def _taker_entry(role_key, curr_id, prev_id)` to `def _taker_entry(curr_id, prev_id)`. Updated all three call sites to remove the string literal first argument: `_taker_entry('penalty', ...)` → `_taker_entry(...)`, and aligned the three call sites for readability.

### WR-04: `InsightsTab` section element lacks `aria-labelledby` — screen-reader landmark is not labelled

**Files modified:** `src/components/insights/InsightsTab.tsx`
**Commit:** bc35f6b
**Applied fix:** Added `aria-label="Season pattern insights"` to the main `<section className="mt-6 space-y-6">`. Added `aria-label="Insights not available"` to the empty-state `<section className="mt-6 space-y-2">`.

---

_Fixed: 2026-04-28T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
