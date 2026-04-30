---
phase: 45
slug: transfer-aware-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom global environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/suggest-transfers.test.ts src/components/optimiser/OptimiserPanel.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (engine tests + panel tests)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 0 | TFR-01, TFR-02, TFR-03 | — | N/A | unit | `npx vitest run src/lib/suggest-transfers.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-02 | 01 | 1 | TFR-01, TFR-02, TFR-03 | — | N/A | unit | `npx vitest run src/lib/suggest-transfers.test.ts` | ❌ W0 | ⬜ pending |
| 45-02-01 | 02 | 2 | TFR-01 | — | N/A | RTL/jsdom | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ✅ | ⬜ pending |
| 45-02-02 | 02 | 2 | TFR-02 | — | N/A | RTL/jsdom | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ✅ | ⬜ pending |
| 45-02-03 | 02 | 2 | TFR-03 | — | N/A | RTL/jsdom | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/suggest-transfers.test.ts` — test stubs covering TFR-01 engine (ftCount toggle re-run), TFR-02 engine (budget filter, top-30 pool, own-squad exclusion, empty state), TFR-03 formula (Math.ceil(4/xPtsGainPerGw), singular/plural GW copy contract)
- [ ] `src/lib/suggest-transfers.ts` — new pure engine file (skeleton with correct function signature so test file can import it)

Wave 0 must be committed and green before Wave 1 begins.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark mode visual appearance of FT toggle and suggestion rows | TFR-01, TFR-02 | Visual token verification requires browser | Toggle OS dark mode, confirm active FT button shows bg-zinc-900/dark:bg-white; confirm -4pts pill shows amber-50/amber-950 backgrounds |
| Budget enforcement with real FPL authentication | TFR-02 | Requires live FPL session cookies | Log in to FPL, open Optimiser, verify expensive transfers are filtered when bank insufficient |
| Mobile layout wrapping on 360px viewport | TFR-02 | Responsive layout requires browser devtools | Set Chrome devtools to 360px; confirm flex-wrap produces readable layout; confirm break-even ml-0 on mobile |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
