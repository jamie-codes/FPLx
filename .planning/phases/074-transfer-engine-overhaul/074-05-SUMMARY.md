---
phase: "074"
plan: "05"
subsystem: transfer-engine
tags: [gap-closure, opportunity-cost, transfer-panel, tests]
dependency_graph:
  requires:
    - "074-04 — TransferPanel manualBank, FtToggle removal, OCS table disabled rows"
    - "074-03 — computeOpportunityCostRows 3-arg signature, OCSRow bankAfter/isAffordable"
    - "074-02 — always-emit combos, ftCount-driven cost"
  provides:
    - "CR-01 closed: -8 Hit row now present for ftCount=1 via comboForHit8 fallback"
    - "CR-02 closed: freeTransfers state wired into derivedFtCount unauthenticated branch"
    - "WR-01 closed: combo-hit isMarginal badge handled in badgeFor"
    - "WR-03 closed: combo-hit isMarginal compares xPtsGainNet not raw xPtsGain"
    - "WR-04 closed: redundant inner sell-side guard removed from buy2 loop"
    - "IN-01 closed: duplicate __tests__/opportunity-cost.test.ts deleted, unique tests merged"
    - "IN-03 closed: Submit button uses single Tailwind transition token"
  affects:
    - "src/lib/opportunity-cost.ts — -8 Hit fallback + isMarginal fix"
    - "src/lib/opportunity-cost.test.ts — 22 new tests added"
    - "src/components/transfers/OpportunityCostTable.tsx — badgeFor expanded"
    - "src/components/transfers/TransferPanel.tsx — derivedFtCount CR-02, IN-03 className"
    - "src/lib/suggest-transfers.ts — inner guard removed"
    - "src/lib/__tests__/opportunity-cost.test.ts — deleted"
tech_stack:
  added: []
  patterns:
    - "comboForHit8 = best2FTCombo ?? best2FTHit — nullish coalescing for ftCount=1 fallback"
    - "isMarginal: (best2FTHit.xPtsGain - 4) < MARGINAL_THRESHOLD — net-of-hit comparison"
    - "badgeFor includes combo-hit in marginal-badge predicate"
    - "derivedFtCount unauthenticated branch: (freeTransfers >= 2 ? 2 : 1) as 1 | 2"
key_files:
  modified:
    - path: src/lib/opportunity-cost.ts
      change: "comboForHit8 fallback (CR-01); isMarginal against xPtsGainNet (WR-03); D-07 comment updated"
    - path: src/lib/opportunity-cost.test.ts
      change: "Added 5 CR-01+WR-03 tests, 3 CR-02 tests, 14 IN-01 merged tests; MARGINAL_THRESHOLD imported"
    - path: src/components/transfers/OpportunityCostTable.tsx
      change: "badgeFor includes combo-hit in marginal-badge branch (WR-01)"
    - path: src/components/transfers/TransferPanel.tsx
      change: "derivedFtCount reads freeTransfers for unauth path (CR-02); freeTransfers in deps array; Submit button uses single transition token (IN-03)"
    - path: src/lib/suggest-transfers.ts
      change: "Removed redundant inner sell2.id===sell1.id guard from buy2 loop (WR-04)"
  deleted:
    - path: src/lib/__tests__/opportunity-cost.test.ts
      reason: "IN-01: duplicate test file deleted; 14 unique behavioral tests merged into canonical"
decisions:
  - "CR-01 fix: mapper-side fallback preferred over engine-side change — avoids touching suggest-transfers.ts type surface"
  - "IN-01 merge: 14 unique tests from __tests__/ file merged; Tests 2 and 6 (__tests__) skipped as covered in canonical"
  - "WR-02 (DecisionSummaryTab hasAvailableChip memoization) intentionally deferred per plan spec"
metrics:
  duration: "5 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 3
  files_changed: 6
---

# Phase 074 Plan 05: Gap Closure — CR-01, CR-02, WR-01, WR-03, WR-04, IN-01, IN-03 Summary

Gap-closure plan closing all 7 findings from VERIFICATION.md/REVIEW.md: CR-01 (-8 Hit absent for ftCount=1) fixed via mapper nullish-coalescing fallback; CR-02 (freeTransfers ignored in derivedFtCount) wired; WR-01/WR-03/WR-04 warning fixes applied; IN-01 duplicate test file deleted with 14 unique tests merged; IN-03 Tailwind duplicate transition classes removed.

## Tasks Completed

### Task 1: Fix mapper (CR-01), warning fixes (WR-01, WR-03, WR-04), add CR-01+WR-03 tests

**Commit:** aba31f0

**Findings closed:**

**CR-01 (-8 Hit row absent for ftCount=1)**
- File: `src/lib/opportunity-cost.ts` — lines 158-182
- Fix: `const comboForHit8 = best2FTCombo ?? best2FTHit` declared before the -8 Hit block; guard changed to `if (comboForHit8)`; all `best2FTCombo` references inside the block replaced with `comboForHit8`
- Evidence: `grep -F "comboForHit8 = best2FTCombo ?? best2FTHit" src/lib/opportunity-cost.ts` returns exit 0

**WR-03 (combo-hit isMarginal uses raw xPtsGain not net)**
- File: `src/lib/opportunity-cost.ts` — line 129
- Fix: Changed `best2FTHit.xPtsGain < MARGINAL_THRESHOLD` to `(best2FTHit.xPtsGain - 4) < MARGINAL_THRESHOLD`
- Evidence: `grep -F "(best2FTHit.xPtsGain - 4) < MARGINAL_THRESHOLD" src/lib/opportunity-cost.ts` returns exit 0

**WR-01 (combo-hit marginal badge silently ignored)**
- File: `src/components/transfers/OpportunityCostTable.tsx` — `badgeFor()` function
- Fix: Extended predicate from `row.kind === 'combo-free'` to `(row.kind === 'combo-free' || row.kind === 'combo-hit')` with `&&  row.isMarginal === true`
- Evidence: `grep -F "(row.kind === 'combo-free' || row.kind === 'combo-hit') && row.isMarginal === true" ...` returns exit 0

**WR-04 (redundant inner sell-side guard in buy2 loop)**
- File: `src/lib/suggest-transfers.ts` — line 199 (removed)
- Fix: Removed `if (sell2.id === sell1.id) continue  // TFX-02: sell-side dedup (redundant inner guard)` from inside the `for (const buy2 of pool2)` loop
- Evidence: `grep -c "sell2.id === sell1.id" src/lib/suggest-transfers.ts` returns `1`

**New tests added (src/lib/opportunity-cost.test.ts):**

| Test | Assertion |
|------|-----------|
| CR-01: -8 Hit row present when ftCount=1 and only cost:4 combo | `combo-hit-8` in rows; xPtsGain=8.0, xPtsGainNet=0.0, cost=8 |
| CR-01: -8 Hit prefers cost:0 combo when both cost:0 and cost:4 exist | transfers[0].sell.id === 1 (from cost:0 combo) |
| CR-01: -8 Hit transfers reference cost:4 combo when only source | transfers[0].sell.id === 5, transfers[1].sell.id === 7 |
| WR-03: combo-hit isMarginal=true when xPtsGainNet < MARGINAL_THRESHOLD | xPtsGain=4.5 → net=0.5 → isMarginal=true |
| WR-03: combo-hit isMarginal=false when xPtsGainNet >= MARGINAL_THRESHOLD | xPtsGain=5.5 → net=1.5 → isMarginal=false |

**Result:** `npx vitest run src/lib/opportunity-cost.test.ts src/lib/suggest-transfers.test.ts` — 41 tests, all passing.

---

### Task 2: Wire freeTransfers into derivedFtCount (CR-02), Tailwind cleanup (IN-03), CR-02 tests

**Commit:** 53aac4a

**CR-02 (freeTransfers state disconnected from engine)**
- File: `src/components/transfers/TransferPanel.tsx` — `derivedFtCount` useMemo (lines 87-95)
- Fix: Unauthenticated branch changed from `return 1` to `return (freeTransfers >= 2 ? 2 : 1) as 1 | 2`; `freeTransfers` added as last dependency in the useMemo deps array
- Evidence: `grep -F "freeTransfers >= 2 ? 2 : 1"` and `grep -F "[isAuthenticated, myTeamData, squadData, freeTransfers]"` both return exit 0

**IN-03 (duplicate transition-colors + transition-transform on Submit button)**
- File: `src/components/transfers/TransferPanel.tsx` — line 265
- Fix: Replaced `transition-colors cursor-pointer active:scale-95 transition-transform` with single `transition cursor-pointer active:scale-95`
- Evidence: `grep -F " transition cursor-pointer active:scale-95 "` returns exit 0; old pattern grep returns exit 1

**New CR-02 logic tests:**

| Test | Assertion |
|------|-----------|
| CR-02: freeTransfers=2 returns ftCount=2 for unauthenticated path | `unauthFallback(2) === 2` |
| CR-02: freeTransfers=1 returns ftCount=1 for unauthenticated path | `unauthFallback(1) === 1` |
| CR-02: freeTransfers>=2 (e.g. 5) clamps to 2 | `unauthFallback(5) === 2` |

**Result:** `npx vitest run src/lib/opportunity-cost.test.ts` — 24 tests, all passing.

---

### Task 3: Consolidate duplicate test file (IN-01), run final verification

**Commit:** a2bcbee

**IN-01 (duplicate test file divergence risk)**
- Deleted: `src/lib/__tests__/opportunity-cost.test.ts` (jsdom-environment, 16 tests)
- Unique tests identified: 14 (Tests 1, 3–5, 7–16 from the duplicate; Tests 2 and 6 were behaviorally covered in canonical)
- Merged into: `src/lib/opportunity-cost.test.ts` under `describe('IN-01: merged from __tests__/ duplicate')`
- MARGINAL_THRESHOLD imported from `./opportunity-cost` to support the constant-lock test (Test 1)

**IN-01 merged test summary (14 tests):**
1. MARGINAL_THRESHOLD equals 1.0 (constant lock)
2. ftCount=1 with 1 FREE single returns length=2
3. ftCount=1 with FREE+HIT singles returns length=3
4. ftCount=2 with FREE single+FREE combo returns >= 3 rows with combo-free
5. Roll row zero values, no transfers field
6. 1-FT FREE row: xPtsGainNet===xPtsGain, breakEvenGws=null, cost=0
7. 1-FT HIT row: xPtsGainNet===xPtsGain-4, breakEvenGws >= 1, cost=4
8. 2-FT combo row: xPtsGainNet===xPtsGain, transfers.length=2, web_names defined
9. 1-FT row carries best suggestion sell/buy IDs
10. 2-FT combo row carries both transfer leg IDs
11. combo-free xPtsGain=0.9 → isMarginal=true
12. combo-free xPtsGain=1.0 → isMarginal=false (boundary)
13. combo-free xPtsGain=2.5 → isMarginal=false
14. single rows: isMarginal undefined or false

**Final test count:** `src/lib/opportunity-cost.test.ts`: 38 tests (16 original + 5 CR-01/WR-03 + 3 CR-02 + 14 IN-01 merged).

## Findings Closed

| Finding | Severity | File | Evidence |
|---------|----------|------|---------|
| CR-01: -8 Hit absent for ftCount=1 | Critical | opportunity-cost.ts:158+ | `comboForHit8 = best2FTCombo ?? best2FTHit` present |
| CR-02: freeTransfers ignored in derivedFtCount | Critical | TransferPanel.tsx:87-95 | `freeTransfers >= 2 ? 2 : 1` and deps array include `freeTransfers` |
| WR-01: combo-hit isMarginal badge silently ignored | Warning | OpportunityCostTable.tsx:69 | badgeFor predicate includes `combo-hit` |
| WR-03: isMarginal uses raw xPtsGain not net | Warning | opportunity-cost.ts:129 | `(best2FTHit.xPtsGain - 4) < MARGINAL_THRESHOLD` |
| WR-04: redundant inner sell-side guard | Warning | suggest-transfers.ts:199 | grep-c returns 1 (only outer guard remains) |
| IN-01: duplicate test file | Info | __tests__/opportunity-cost.test.ts | File deleted; 14 unique tests merged |
| IN-03: duplicate Tailwind transition classes | Info | TransferPanel.tsx:265 | Single `transition` token; old double-class removed |

## Deferred

**WR-02 (DecisionSummaryTab `hasAvailableChip` outside useMemo):** Intentionally deferred per plan spec. Lower priority, separate component file, no correctness impact. Carry to future phase if concern remains.

## Final Verification Results

```
npx tsc --noEmit → exit 0, no output
npx vitest run src/lib/opportunity-cost.test.ts → 38 tests, all passing
npx vitest run src/lib/suggest-transfers.test.ts → 20 tests, all passing
npx vitest run src/lib/opportunity-cost.test.ts src/lib/suggest-transfers.test.ts → 58 tests, all passing

Pre-existing failures (unrelated to this plan, documented in STATE.md):
  - tests/lib/captain-picks.test.ts — 5 failures (TEST-57, from Phase 57 rewrite)
  - tests/lib/club-form.test.ts — 1 failure (pre-existing boundary assertion)
```

## Deviations from Plan

None — plan executed exactly as written. All 7 findings closed per specification.

## Threat Flags

None — changes are purely internal logic fixes and test consolidation. No new network endpoints, auth paths, file access patterns, or schema changes.

## Known Stubs

None — all functionality fully wired. The CR-01 fix ensures -8 Hit row is always present when any 2-transfer combo exists. CR-02 fix ensures the Free transfers input field is honoured for unauthenticated users.

## Self-Check: PASSED

- FOUND: src/lib/opportunity-cost.ts (contains comboForHit8 = best2FTCombo ?? best2FTHit)
- FOUND: src/lib/opportunity-cost.test.ts (38 tests)
- FOUND: src/components/transfers/OpportunityCostTable.tsx (combo-hit in badgeFor)
- FOUND: src/components/transfers/TransferPanel.tsx (freeTransfers >= 2 ? 2 : 1)
- FOUND: src/lib/suggest-transfers.ts (1 occurrence of sell2.id === sell1.id)
- DELETED: src/lib/__tests__/opportunity-cost.test.ts (confirmed absent)
- FOUND: commit aba31f0 (Task 1)
- FOUND: commit 53aac4a (Task 2)
- FOUND: commit a2bcbee (Task 3)
