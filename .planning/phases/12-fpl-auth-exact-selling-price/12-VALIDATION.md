---
phase: 12
slug: fpl-auth-exact-selling-price
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest / vitest (Next.js project) |
| **Config file** | package.json / vitest.config.ts |
| **Quick run command** | `npm test -- --testPathPattern=auth` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=auth`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | AUTH-01 | unit | `npm test -- --testPathPattern=auth/login` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | AUTH-01 | unit | `npm test -- --testPathPattern=auth/status` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | AUTH-01 | unit | `npm test -- --testPathPattern=auth/logout` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | AUTH-02 | unit | `npm test -- --testPathPattern=fpl/my-team` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | AUTH-02 | integration | `npm test -- --testPathPattern=sell-price` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | AUTH-01 AUTH-02 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/auth/__tests__/login.test.ts` — stubs for AUTH-01 login route
- [ ] `src/app/api/auth/__tests__/status.test.ts` — stubs for AUTH-01 status route
- [ ] `src/app/api/auth/__tests__/logout.test.ts` — stubs for AUTH-01 logout route
- [ ] `src/app/api/fpl/__tests__/my-team.test.ts` — stubs for AUTH-02 my-team route

*Existing test infrastructure (jest/vitest) should already be present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login form renders, accepts credentials, shows success/error state | AUTH-01 | Browser interaction required | Open app, click Login, enter valid FPL credentials, verify squad loads with sell prices |
| Unauthenticated users see all features with no login prompt | AUTH-01 | Browser interaction required | Open app without logging in, verify all panels render correctly |
| Exact sell prices replace now_cost in SquadView when authenticated | AUTH-02 | Requires live FPL account | Log in, open SquadView, verify sell price differs from now_cost for recently purchased players |
| Bank balance shows exact value (entry_history.bank) when authenticated | AUTH-02 | Requires live FPL account | Log in, compare displayed bank to FPL app value |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
