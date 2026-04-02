---
phase: 21
slug: planner-tab-shell-and-state-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/lib/free-transfer-engine.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/free-transfer-engine.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 0 | PLAN-01 | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | PLAN-01 | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | PLAN-01 | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | PLAN-08 | smoke | visual check in browser | manual-only | ⬜ pending |
| 21-02-02 | 02 | 1 | PLAN-08 | smoke | visual check in browser | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/free-transfer-engine.test.ts` — stubs for PLAN-01 FT banking, cap, hits, Wildcard, Free Hit, squad snapshot isolation
- [ ] `src/lib/free-transfer-engine.ts` — module under test (must exist as empty export before Wave 0 tests can compile)

*Existing vitest.config.ts, node environment, and `@` alias all confirmed present — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Planner tab renders in desktop tab strip | PLAN-08 | Vitest node env cannot render Next.js routes | `npm run dev` → visit `/` → click "Planner" tab → confirm renders without error |
| Planner tab renders in mobile bottom nav | PLAN-08 | Vitest node env cannot render Next.js routes | `npm run dev` → resize to 375px → confirm "Plan" tab visible in bottom bar → tap → confirm renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
