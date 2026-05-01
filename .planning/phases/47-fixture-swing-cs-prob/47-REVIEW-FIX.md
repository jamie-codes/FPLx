---
phase: 47-fixture-swing-cs-prob
fixed_at: 2026-05-01T00:00:00Z
review_path: .planning/phases/47-fixture-swing-cs-prob/47-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 47: Code Review Fix Report

**Fixed at:** 2026-05-01T00:00:00Z
**Source review:** .planning/phases/47-fixture-swing-cs-prob/47-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical, 5 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: tier() called with inverted argument in club-form.ts

**Files modified:** `src/lib/club-form.ts`
**Commit:** 9acd83f
**Applied fix:** Replaced `tier(1 - attDiff)` with `tier(attDiff)` at both lines 132 and 146 (home and away fixture loop arms). `attDiff` is already in difficulty-score space [0,1]; passing its ease inverse had inverted every fixture's tier label.

---

### WR-01: Guard inconsistency — xmins == 0 vs xmins <= 0

**Files modified:** `pipeline/merge.py`
**Commit:** 5c851e5
**Applied fix:** Changed `start_prob == 0 or xmins == 0` to `start_prob <= 0 or xmins <= 0` in both `_xpts_ngw` (line 259) and `_compute_xpts_sigma` (line 313), matching the correct guard already used in `_cs_prob_1gw_for_fixtures`.

---

### WR-02: Tooltip double-negative for worsening swing direction

**Files modified:** `src/components/club-form/FixtureSwingDetector.tsx`
**Commit:** e2e331b
**Applied fix:** Wrapped `row.swing * 100` in `Math.abs()` in both branches of the tooltip `title` string (improving and worsening). The worsening tooltip no longer shows a negative number followed by "below".

---

### WR-03: meanEase null guard fragility

**Files modified:** `src/lib/club-form.ts`
**Commit:** f83d585
**Applied fix:** Added a three-line comment above the `past_ease_3gw` assignment explaining when `meanEase` can return null versus when it cannot, and noting that swing fields null-guard downstream. No logic change required — `fplToAttDiff` always produces a number so the null path is unreachable in practice.

---

### WR-04: Inverted attacking_difficulty used as defensive_difficulty fallback

**Files modified:** `pipeline/merge.py`
**Commit:** 0a016b2
**Applied fix:** Replaced all three occurrences of `fix.get('defensive_difficulty', 1.0 - fix.get('attacking_difficulty', 0.5))` with `fix.get('defensive_difficulty', 0.5)` — in `_cs_prob_1gw_for_fixtures` (line 170), `_xpts_ngw` (line 277), and `_compute_xpts_sigma` (line 326). The neutral 0.5 fallback avoids the logically incorrect axis inversion.

---

### WR-05: Stale RED phase comments in test_merge_cs_prob.py

**Files modified:** `pipeline/tests/test_merge_cs_prob.py`
**Commit:** af57fcc
**Applied fix:** Removed the "RED phase" paragraph from the module docstring, removed the stale inline comment on the `getattr` import block, replaced the dynamic `getattr(__import__(...))` pattern with a direct `from merge import _cs_prob, _cs_prob_1gw_for_fixtures`, and updated the `test_symbol_exists` assertion message to remove the RED-phase wording.

---

_Fixed: 2026-05-01T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
