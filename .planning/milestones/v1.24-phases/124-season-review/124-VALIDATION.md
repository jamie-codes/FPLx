---
phase: 124
slug: season-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 124 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (vitest.config.ts) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/season-review src/lib/hooks/useSeasonReview` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/season-review src/lib/hooks/useSeasonReview`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 124-01-01 | 01 | 1 | REV-01 | SSRF via teamId | `/^\d+$/.test()` guard before URL construction | unit | `npx vitest run src/app/api/season-review` | ❌ W0 | ⬜ pending |
| 124-01-02 | 01 | 1 | REV-02 | — | N/A | unit | `npx vitest run src/lib/season-review` | ❌ W0 | ⬜ pending |
| 124-01-03 | 01 | 1 | REV-02 | — | D-06 chip=0 renormalization | unit | `npx vitest run src/lib/season-review` | ❌ W0 | ⬜ pending |
| 124-01-04 | 01 | 1 | REV-02 | — | Zero hits → 1.0 break-even (no NaN) | unit | `npx vitest run src/lib/season-review` | ❌ W0 | ⬜ pending |
| 124-02-01 | 02 | 2 | REV-03 | — | Hook disabled when teamId null/non-numeric | unit | `npx vitest run src/lib/hooks/useSeasonReview` | ❌ W0 | ⬜ pending |
| 124-02-02 | 02 | 2 | REV-03 | — | Hook fetches correct URL | unit | `npx vitest run src/lib/hooks/useSeasonReview` | ❌ W0 | ⬜ pending |
| 124-03-01 | 03 | 3 | REV-04 | — | Empty state renders when teamId null | unit | `npx vitest run src/components/season-review` | ❌ W0 | ⬜ pending |
| 124-03-02 | 03 | 3 | REV-04 | — | Skeleton renders while loading | unit | `npx vitest run src/components/season-review` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/season-review.ts` — stub with `computeDecisionGrade()` signature (needed before route can import)
- [ ] `src/lib/season-review.test.ts` — unit tests for `computeDecisionGrade()` boundary conditions + D-06 chip-0 renormalization + zero-hits guard
- [ ] `src/lib/hooks/useSeasonReview.ts` — hook stub (enabled guard, correct queryKey)
- [ ] `src/lib/hooks/useSeasonReview.test.ts` — hook contract tests (disabled when null, correct URL)
- [ ] `src/components/season-review/SeasonReviewTab.tsx` — skeleton-first stub (empty state renders)
- [ ] `src/components/season-review/SeasonReviewTab.test.tsx` — empty state + skeleton tests
- [ ] `src/app/api/season-review/route.ts` — minimal route handler stub (teamId validation returns 400 on invalid)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart chip markers render as amber dots at correct GWs | REV-03 | Visual rendering; recharts custom dot requires browser | Load Season tab with a team ID that has chip GWs; confirm amber dots appear on those GWs only |
| Grade methodology note displays on card | REV-02 | Copy verification; not worth unit-testing exact copy | Load Season tab; confirm note text mentions captain EV rate 40% + hit break-even 35% + chip ROI 25% |
| "Season" sub-tab appears after "Accuracy" in Analyse nav | REV-04 | Navigation order is visual | Open Analyse section; confirm Season tab is 7th (after Accuracy, before Price Changes) |
| Unauthenticated empty state card displays correct copy | REV-04 | Copy verification | Load page without entering team ID; open Analyse > Season; confirm "Enter your FPL Team ID to see your Season Review" card |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
