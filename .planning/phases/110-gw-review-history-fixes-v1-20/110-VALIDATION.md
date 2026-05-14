---
phase: 110
slug: gw-review-history-fixes-v1-20
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 110 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --reporter=verbose src/app/api/gw-review/route.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose src/app/api/gw-review/route.test.ts` or the relevant test file
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| FIX-03/04 live fetch | TBD | 1 | FIX-03, FIX-04 | — | FPL live endpoint failure degrades to 0 pts, never 502 | unit | `npm test -- src/app/api/gw-review/route.test.ts` | ✅ | ⬜ pending |
| FIX-05 sign flip | TBD | 1 | FIX-05 | — | benchmarkDiff positive when dream team > user; amber sentiment | unit | `npm test -- src/components/squad/GwReviewTab.test.tsx` | ✅ | ⬜ pending |
| FIX-06 element-summary | TBD | 1 | FIX-06 | — | element-summary failure keeps regret null, never 502 | unit | `npm test -- src/app/api/decision-history/route.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/decision-history/route.test.ts` — create test file with stubs for FIX-06 (does not exist yet per research)

*All other test files exist. Existing infrastructure covers FIX-03/04/05 requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Top scorer card shows actual player points in settled GW | FIX-03 | Requires real settled-GW data from FPL API | Open GW Review for last settled GW; verify top scorer pts match FPL website |
| Best bench card shows actual bench points | FIX-04 | Requires real settled-GW data | Open GW Review; verify bench pts are non-zero where bench scored |
| Dream team delta positive + amber when dream team wins | FIX-05 | Visual check required | Open GW Review; verify sign and colour with a GW where dream team > user score |
| Captain delta column shows values (not dashes) | FIX-06 | Requires real historical data | Open Back tab; verify regret column has values for recent GWs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
