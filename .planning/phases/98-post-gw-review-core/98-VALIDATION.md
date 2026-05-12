---
phase: 98
slug: post-gw-review-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 98 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / React Testing Library |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npx jest --testPathPattern="useSettledGws|GwReviewTab|gw-review" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="useSettledGws|GwReviewTab|gw-review" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 98-01-01 | 01 | 0 | PGW-01 | — | N/A | unit | `npx jest --testPathPattern="useSettledGws" --no-coverage` | ❌ W0 | ⬜ pending |
| 98-01-02 | 01 | 0 | PGW-01 | — | N/A | unit | `npx jest --testPathPattern="gw-review/route" --no-coverage` | ❌ W0 | ⬜ pending |
| 98-02-01 | 02 | 1 | PGW-01 | — | N/A | unit | `npx jest --testPathPattern="useSettledGws" --no-coverage` | ❌ W0 | ⬜ pending |
| 98-02-02 | 02 | 1 | PGW-01 | — | N/A | unit | `npx jest --testPathPattern="gw-review/route" --no-coverage` | ✅ | ⬜ pending |
| 98-03-01 | 03 | 1 | PGW-02 | — | N/A | unit | `npx jest --testPathPattern="GwReviewTab" --no-coverage` | ✅ | ⬜ pending |
| 98-04-01 | 04 | 2 | PGW-04 | — | N/A | unit | `npx jest --testPathPattern="page" --no-coverage` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/hooks/useSettledGws.test.ts` — stubs for PGW-01 (settled GW detection)
- [ ] `src/app/api/gw-review/route.test.ts` — stubs for PGW-01 (bench computation)

*Existing infrastructure covers GwReviewTab and page tests (existing files, new cases added inline).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-surface on page load after GW deadline | PGW-04 | Requires live FPL bootstrap with real deadline_time in the past | Visit app after seeding a past deadline_time in local FPL mock; confirm Review sub-tab is pre-selected |
| Graceful degradation when squad not loaded | PGW-04 | Requires clearing session/auth state | Sign out, visit app, confirm Review card shows explanatory prompt not error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
