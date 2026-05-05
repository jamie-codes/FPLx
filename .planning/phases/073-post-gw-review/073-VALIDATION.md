---
phase: 73
slug: post-gw-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 73 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/squad/GwReviewTab.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/squad/GwReviewTab.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 73-01-01 | 01 | 1 | PGW-02 | — | N/A | manual | `python pipeline/run.py && ls pipeline/cache/gw_review_gw*.json` | N/A | ⬜ pending |
| 73-02-01 | 02 | 2 | PGW-02 | T-34-01 | Numeric teamId + gw guard prevents path traversal | unit | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | ❌ W0 | ⬜ pending |
| 73-02-02 | 02 | 2 | PGW-02 | — | N/A | unit | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | ❌ W0 | ⬜ pending |
| 73-03-01 | 03 | 3 | PGW-01 | — | N/A | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | ❌ W0 | ⬜ pending |
| 73-03-02 | 03 | 3 | PGW-01 | — | N/A | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | ❌ W0 | ⬜ pending |
| 73-03-03 | 03 | 3 | PGW-01 | — | N/A | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | ❌ W0 | ⬜ pending |
| 73-03-04 | 03 | 3 | PGW-01 | — | N/A | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | ❌ W0 | ⬜ pending |
| 73-03-05 | 03 | 3 | PGW-02 | — | N/A | unit (RTL) | `npx vitest run src/components/nav/MobileNav.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/squad/GwReviewTab.test.tsx` — RTL stubs for PGW-01 (4 test cases: data render, no-squad empty state, unsettled GW state, GW pill toggle)
- [ ] Update `src/components/nav/MobileNav.test.tsx` — change "4 pills" → "5 pills", add "Review" to filter array

*Existing infrastructure (Vitest, RTL) covers all phase requirements — no new test framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline writes 3 gw_review_gw{N}.json files to pipeline/cache/ | PGW-02 | Python pipeline has no automated unit tests | `python pipeline/run.py` → `ls pipeline/cache/gw_review_gw*.json` → verify 3 files each with `{ gw, average_score }` |
| API route serves merged GwReview JSON in dev | PGW-02 | Integration of Blob + FPL proxy requires live services | `curl "http://localhost:3000/api/gw-review?teamId=<id>&gw=<n>"` → verify response has all GwReview fields |
| GW Review tab renders and GW pill toggle works | PGW-01 | Full integration with real team data requires browser | Load squad → Squad → Review tab → verify 4 stat cards and GW pills; switch GWs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
