---
phase: 11
slug: explainability-replacement-shortlist
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/lib/explain.test.ts tests/lib/replacement-shortlist.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/explain.test.ts tests/lib/replacement-shortlist.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | EXP-01, EXP-02 | unit stub | `npx vitest run tests/lib/explain.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | EXP-01 | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | EXP-02 | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 0 | REC-02 | unit stub | `npx vitest run tests/lib/replacement-shortlist.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | REC-02 | unit | `npx vitest run tests/lib/replacement-shortlist.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 1 | EXP-01, EXP-02, REC-02 | integration | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/explain.test.ts` — stubs for EXP-01, EXP-02 (computeExplanations)
- [ ] `tests/lib/replacement-shortlist.test.ts` — stubs for REC-02 (computeReplacementShortlist)

*Framework already installed — no install step needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Expand row opens/closes on click in SquadView | EXP-01 | DOM interaction requires browser | Click a squad player row — expand panel appears; click again — collapses |
| Replacement shortlist renders inside expand for Sell players | REC-02 | Visual render requires browser | Load squad, find Sell-verdicted player, expand row — shortlist appears below reasons |
| No expand panel for non-Sell bench players | EXP-01 | Runtime state requires browser | Bench rows (opacity-50) show no expand trigger |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
