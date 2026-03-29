---
phase: 06
slug: club-form-value-gems-and-polish
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 06 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/lib/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | VAL-03 | unit | `npx vitest run tests/lib/gem-score.test.ts tests/lib/merge.test.ts` | tests/lib/merge.test.ts created in task | pending |
| 06-01-02 | 01 | 1 | FFA-03 | unit | `npx vitest run tests/lib/club-form.test.ts` | created in task | pending |
| 06-01-03 | 01 | 1 | VAL-01, VAL-02 | unit | `npx vitest run tests/lib/value-gems.test.ts` | created in task | pending |
| 06-02-01 | 02 | 2 | FFA-03, DAT-02 | unit+build | `npx vitest run tests/lib/last-updated.test.ts && npx next build` | tests/lib/last-updated.test.ts created in task | pending |
| 06-02-02 | 02 | 2 | UIX-03, UIX-04 | unit+build | `npx vitest run tests/lib/ && npx next build` | reuses existing | pending |
| 06-03-01 | 03 | 3 | VAL-01, VAL-02, VAL-03 | unit+build | `npx vitest run tests/lib/ && npx next build` | reuses value-gems.test.ts from Plan 01 | pending |
| 06-03-02 | 03 | 3 | VAL-03 | unit+build | `npx vitest run tests/lib/ && npx next build` | reuses existing | pending |

---

## Wave 0 Requirements

- [x] `tests/lib/merge.test.ts` -- unit tests for price trend field output from merge.py (VAL-03) -- created in Plan 01 Task 1
- [x] `tests/lib/value-gems.test.ts` -- boundary tests for cheap/low-owned filter predicates (VAL-01/02) -- created in Plan 01 Task 3
- [x] `tests/lib/last-updated.test.ts` -- unit test for stale amber styling (DAT-02) -- created in Plan 02 Task 1
- [x] Update `tests/lib/gem-score.test.ts` `makeMergedPlayer` factory to include `cost_change_event: 0, cost_change_start: 0` -- Plan 01 Task 1

*All Wave 0 gaps are addressed by plan tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fixture badges render correct colour per difficulty_tier | UIX-03 | Visual colour check | Load Gem Ratings tab, verify easy fixtures = green chip, hard = red chip |
| Club form table sorts correctly by column | FFA-03 | TanStack click interaction | Click each column header, verify ascending/descending sort |
| Value Gems filter tabs switch between Cheap/Low-owned | VAL-01, VAL-02 | Tab click interaction | Click each filter pill, verify player list updates |
| Last-updated timestamp visible on all tabs | DAT-02 | Multi-tab visual check | Navigate to each tab, confirm timestamp line visible |
| Price trend arrows appear in all three views with season sub-text | VAL-03 | Multi-view visual check | Gem table, Value Gems, Squad & Transfers -- confirm GW primary + season secondary present |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s (vitest run ~5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
