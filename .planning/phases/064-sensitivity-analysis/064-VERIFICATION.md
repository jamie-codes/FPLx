---
phase: 064-sensitivity-analysis
verified: 2026-05-06T12:17:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app, navigate to the Transfers tab, find a transfer candidate whose buy player has start_prob < 0.70 OR a medium-difficulty fixture. Confirm the amber inline text '⚠ no longer recommended if: ...' appears below the budget badge (Row 4), NOT as a filled pill badge."
    expected: "Inline amber text with ⚠ symbol visible; no pill background; text names exact condition"
    why_human: "Visual appearance and DOM-tree position cannot be verified without a running browser"
  - test: "Find a robust transfer suggestion (start_prob >= 0.70, easy or hard fixture, xPtsGain >= 4.0). Confirm NO ⚠ symbol or fragility text appears anywhere on that card."
    expected: "Card shows only the normal 3-row structure; no Row 4 element present"
    why_human: "Negative visual assertion — no DOM node presence requires browser render"
  - test: "Open the Captain Picks panel, find a captain candidate with start_prob < 0.70 or a medium fixture. Confirm the amber fragility note appears as the last element in the candidate row, below the xPts (C) span."
    expected: "Fragility note visible at the tail of the CandidateRow flex container; no filled pill background"
    why_human: "Visual position within a flex layout requires browser render to confirm"
  - test: "Confirm visual distinction between FragilityNote and existing filled amber badges (DangerousToFadeBadge, McLabel, SeverityBadge MEDIUM) by viewing both on screen simultaneously."
    expected: "FragilityNote is plain amber text; existing badges are filled amber pills — they are clearly distinct"
    why_human: "Visual distinguishability is a human judgment call"
---

# Phase 64: Sensitivity Analysis Verification Report

**Phase Goal:** Transfer candidates and captain recommendations carry a fragility flag when the recommendation would reverse under plausible adverse conditions — making it clear which picks are robust and which are conditional. Users see a one-line inline ⚠ explanation when a recommendation could be reversed by rotation, a harder fixture, or a hit cost.
**Verified:** 2026-05-06T12:17:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #  | Truth                                                                                                                           | Status     | Evidence                                                                                                                                      |
|----|--------------------------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| SC1 | Every transfer candidate row and captain recommendation row carries a computed fragility flag (reverses on start_prob<70%, harder fixture, or 4pt hit) | ✓ VERIFIED | `computeFragility` in `src/lib/sensitivity.ts` implements all three conditions; called in TransferPanel (2x) and CaptainPicksPanel (1x); 7/7 unit tests pass |
| SC2 | Fragile recommendations display an amber indicator visually distinct from the existing severity badge system                    | ? UNCERTAIN | `FragilityNote` uses `text-xs text-amber-600 dark:text-amber-400` with no `bg-*`, no `rounded`, no `inline-block` — code enforces distinction; visual confirmation requires browser |
| SC3 | Each fragile item shows "no longer recommended if: [specific condition]" — naming the exact reversing condition                | ✓ VERIFIED | `FragilityNote` prepends `'no longer recommended if: '` exactly once, then `reasons.join(', ')`; RTL test confirms prefix appears once (Pitfall 4 guard) |
| SC4 | Non-fragile recommendations show no fragility indicator — UI not cluttered for robust picks                                    | ✓ VERIFIED | Both injection points use `return fragile ? <FragilityNote ... /> : null`; RTL test "renders nothing when empty" confirms null return on empty reasons |
| SC5 | Fragility computation is pure TypeScript over existing `MergedPlayer` fields — no new API call, no pipeline change             | ✓ VERIFIED | `sensitivity.ts` reads only `player.start_prob`, `player.fixtures[0].difficulty_tier`, and `xPtsGain` (computed from `xPts_1gw` already on `MergedPlayer`); no imports of fetch/axios/db |

**Score:** 5/5 truths verified (SC2 has code-level evidence; visual confirmation is the human item)

---

### Required Artifacts

| Artifact                                          | Expected                                              | Status     | Details                                                                 |
|--------------------------------------------------|-------------------------------------------------------|------------|-------------------------------------------------------------------------|
| `src/lib/sensitivity.ts`                         | `computeFragility` pure function + `FragilityResult`  | ✓ VERIFIED | 42 lines; exports both; implements all 3 conditions; no stubs            |
| `src/lib/__tests__/sensitivity.test.ts`          | 7 unit tests, `@vitest-environment node`              | ✓ VERIFIED | 124 lines; 7 `it()` cases; header comment includes `@vitest-environment node`; all 7 pass |
| `src/components/shared/FragilityNote.tsx`        | `FragilityNote({ reasons })` — inline amber indicator | ✓ VERIFIED | 22 lines; exports `FragilityNote`; no forbidden classes; returns null for empty |
| `src/components/shared/FragilityNote.test.tsx`   | 4 RTL tests, `@vitest-environment jsdom`              | ✓ VERIFIED | 47 lines; 4 `it()` cases; all 4 pass                                    |
| `src/components/transfers/TransferPanel.tsx`     | Row 4 fragility injection (single + combo)            | ✓ VERIFIED | Imports both; 2 IIFE injection blocks (lines ~392-397 and ~458-463); `isTransfer=true` in both |
| `src/components/captaincy/CaptainPicksPanel.tsx` | Tail fragility injection in CandidateRow              | ✓ VERIFIED | Imports both; 1 IIFE injection block (lines ~152-156); `isTransfer=false` (D-09 enforced) |

---

### Key Link Verification

| From                              | To                                    | Via                          | Status     | Details                                                        |
|-----------------------------------|---------------------------------------|------------------------------|------------|----------------------------------------------------------------|
| `src/lib/sensitivity.ts`          | `@/lib/types`                         | `import type { MergedPlayer }` | ✓ WIRED   | Line 9: `import type { MergedPlayer } from '@/lib/types'`     |
| `src/lib/__tests__/sensitivity.test.ts` | `src/lib/sensitivity.ts`        | `from '../sensitivity'`      | ✓ WIRED    | Line 4: `import { computeFragility } from '../sensitivity'`   |
| `src/components/shared/FragilityNote.test.tsx` | `FragilityNote.tsx`    | `from './FragilityNote'`     | ✓ WIRED    | Line 5: `import { FragilityNote } from './FragilityNote'`     |
| `TransferPanel.tsx`               | `@/lib/sensitivity`                   | `import { computeFragility }` | ✓ WIRED   | Line 16: exact import present                                  |
| `TransferPanel.tsx`               | `@/components/shared/FragilityNote`   | `import { FragilityNote }`   | ✓ WIRED    | Line 17: exact import present                                  |
| `CaptainPicksPanel.tsx`           | `@/lib/sensitivity`                   | `import { computeFragility }` | ✓ WIRED   | Line 15: exact import present                                  |
| `CaptainPicksPanel.tsx`           | `@/components/shared/FragilityNote`   | `import { FragilityNote }`   | ✓ WIRED    | Line 16: exact import present                                  |

---

### Data-Flow Trace (Level 4)

| Artifact               | Data Variable    | Source                                         | Produces Real Data | Status    |
|------------------------|------------------|------------------------------------------------|--------------------|-----------|
| `FragilityNote.tsx`    | `reasons` prop   | `computeFragility(player, isTransfer, xPtsGain)` | Yes — computed from live `MergedPlayer` fields (`start_prob`, `fixtures`, `xPts_1gw`) | ✓ FLOWING |
| `TransferPanel.tsx` (single) | `fragile, reasons` | `computeFragility(s.buy, true, xPtsGain)` where `xPtsGain = (s.buy.xPts_1gw ?? 0) - (s.sell.xPts_1gw ?? 0)` | Yes — derived from real suggestion data | ✓ FLOWING |
| `TransferPanel.tsx` (combo)  | `fragile, reasons` | Same IIFE as single — `computeFragility(s.buy, true, xPtsGain)` | Yes | ✓ FLOWING |
| `CaptainPicksPanel.tsx` | `fragile, reasons` | `computeFragility(candidate, false)` — `candidate: MergedPlayer` from engine | Yes — no cast, no stub | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                            | Command                                                            | Result               | Status  |
|-----------------------------------------------------|--------------------------------------------------------------------|----------------------|---------|
| `computeFragility` — all 7 unit tests pass          | `npx vitest run src/lib/__tests__/sensitivity.test.ts`             | 7 passed (7)         | ✓ PASS  |
| `FragilityNote` — all 4 RTL tests pass              | `npx vitest run src/components/shared/FragilityNote.test.tsx`      | 4 passed (4)         | ✓ PASS  |
| Visual rendering of fragility note                  | Requires running browser                                           | N/A                  | ? SKIP (human item) |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                 | Status       | Evidence                                                                   |
|-------------|-------------|-------------------------------------------------------------------------------------------------------------|--------------|----------------------------------------------------------------------------|
| SENS-01     | Plan 01, 03 | Every transfer candidate and captain recommendation row carries a computed fragility flag (3 conditions)    | ✓ SATISFIED  | `computeFragility` implements all 3 conditions; wired at 3 call sites       |
| SENS-02     | Plan 02, 03 | Fragile recommendations display amber indicator visually distinct from severity badges; one-line explanation | ✓ SATISFIED* | `FragilityNote` uses text-only amber classes; no forbidden pill classes; one-line format confirmed by tests. *Visual distinction requires human check |

---

### Anti-Patterns Found

| File                         | Pattern                    | Severity | Impact |
|------------------------------|----------------------------|----------|--------|
| No stubs detected            | —                          | —        | —      |

Scanned files: `sensitivity.ts`, `FragilityNote.tsx`, `TransferPanel.tsx` (injection blocks), `CaptainPicksPanel.tsx` (injection block). No `TODO`, `FIXME`, placeholder strings, `return null` stubs, or hardcoded empty arrays in production paths found. The only `return null` is the intentional guard in `FragilityNote` when `reasons.length === 0` — correct behavior, not a stub.

Forbidden class guard confirmed: `FragilityNote.tsx` contains none of `bg-amber-100`, `bg-amber-900`, `inline-block`, or `rounded`.

---

### Human Verification Required

#### 1. Fragility note visible on fragile transfer card

**Test:** Open the app with data loaded, navigate to the Transfers tab. Identify a buy candidate with `start_prob < 0.70` OR `fixtures[0].difficulty_tier === 'medium'` OR `xPtsGain < 4.0`. Inspect that card visually.
**Expected:** An amber inline text line appears as the 4th row: "⚠ no longer recommended if: [condition]". No pill background. Text is `text-xs` amber.
**Why human:** Visual appearance and Row 4 vertical position within a flex column cannot be verified without a browser render.

#### 2. Non-fragile card shows no indicator

**Test:** Find a robust transfer suggestion (buy player has `start_prob >= 0.70`, `fixtures[0].difficulty_tier !== 'medium'`, and `xPtsGain >= 4.0`). Inspect that card.
**Expected:** The card shows only its normal 3-row structure. No ⚠ symbol, no amber fragility text.
**Why human:** Negative visual assertion — confirming absence of a DOM element requires browser render.

#### 3. Fragility note on captain candidate

**Test:** Open the Captain Picks panel. Find a candidate with `start_prob < 0.70` or a medium fixture. Inspect the candidate row.
**Expected:** Amber fragility text appears at the bottom of the row (after the xPts (C) span). No hit-cost reason appears (captains have no hit condition).
**Why human:** Visual position within the flex candidate row layout requires browser render.

#### 4. Visual distinction from existing amber pills

**Test:** View a screen that shows both a `FragilityNote` and a DangerousToFadeBadge or McLabel (both existing filled amber pills).
**Expected:** The fragility note is clearly plain inline text; the existing badges are visually distinct filled pill shapes with rounded corners and background fill.
**Why human:** Visual distinguishability is a human perceptual judgment.

---

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria have code-level evidence of implementation. All artifacts are substantive (not stubs), all key links are wired, and data flows from real `MergedPlayer` fields through `computeFragility` to `FragilityNote` at both render surfaces.

The 4 human verification items cover the visual/perceptual aspects of SENS-02 (amber indicator visually distinct, correct position in layout) that cannot be validated programmatically. These are standard human checks for any UI phase — they do not indicate missing implementation.

---

### Commit Record

| Hash    | Message                                                              |
|---------|----------------------------------------------------------------------|
| 7e2d9e3 | test(064-01): add failing tests for computeFragility                 |
| d8713f0 | feat(064-01): implement computeFragility — SENS-01                   |
| 80f98e2 | test(064-02): add failing tests for FragilityNote                    |
| 3e5e6df | feat(064-02): implement FragilityNote — SENS-02                      |
| 21ee3f9 | feat(064-03): inject FragilityNote into TransferPanel single + combo |
| 4a4f02c | feat(064-03): inject FragilityNote into CaptainPicksPanel CandidateRow |

All 6 commits confirmed present in git log.

---

_Verified: 2026-05-06T12:17:00Z_
_Verifier: Claude (gsd-verifier)_
