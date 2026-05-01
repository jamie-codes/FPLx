---
phase: 41
slug: accuracy-ui-model-rationalisation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/components/accuracy/ src/lib/hooks/useAccuracy.ts src/app/api/accuracy/ src/components/gem-table/GwToggle.test.ts src/components/gem-table/columns.test.tsx src/app/page.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/accuracy/ src/components/gem-table/GwToggle.test.ts src/components/gem-table/columns.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | ACC-02, ACC-03, ACC-04 | — | N/A | unit (RTL stub) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ❌ W0 | ⬜ pending |
| 41-01-02 | 01 | 0 | ACC-05 | — | N/A | unit | `npx vitest run src/components/gem-table/GwToggle.test.ts` | ✅ needs cases | ⬜ pending |
| 41-01-03 | 01 | 0 | ACC-05 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/columns.test.tsx` | ✅ needs cases | ⬜ pending |
| 41-02-01 | 02 | 1 | ACC-02 | — | N/A | unit (RTL) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ❌ W0 | ⬜ pending |
| 41-02-02 | 02 | 1 | ACC-02 | — | N/A | unit (RTL) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ❌ W0 | ⬜ pending |
| 41-02-03 | 02 | 1 | ACC-03 | — | N/A | unit (RTL) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ❌ W0 | ⬜ pending |
| 41-02-04 | 02 | 1 | ACC-04 | — | N/A | unit (RTL) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ❌ W0 | ⬜ pending |
| 41-02-05 | 02 | 1 | ACC-04 | — | N/A | unit (RTL) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ❌ W0 | ⬜ pending |
| 41-02-06 | 02 | 1 | ACC-05 | — | N/A | unit | `npx vitest run src/components/gem-table/GwToggle.test.ts` | ✅ | ⬜ pending |
| 41-02-07 | 02 | 1 | ACC-05 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/columns.test.tsx` | ✅ | ⬜ pending |
| 41-03-01 | 03 | 2 | ACC-06 | — | N/A | unit (RTL) | `npx vitest run src/app/page.test.tsx` | ✅ | ⬜ pending |
| 41-03-02 | 03 | 2 | ACC-06 | — | N/A | compile-time | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/accuracy/AccuracyTab.test.tsx` — RED stubs for ACC-02 (GW summary table, 5 rows + Overall), ACC-03 (haulter list ✓/✗ flags), ACC-04 (default sort xPts Δ ascending, column header sort toggle)
- [ ] `src/lib/hooks/useAccuracy.ts` — stub hook needed by AccuracyTab (Wave 0 can be a minimal stub returning null/undefined)
- [ ] `src/app/api/accuracy/route.ts` — stub route needed by useAccuracy (returns 200 with empty data shape)

*Existing infrastructure — `vitest.config.ts`, `@testing-library/react`, jsdom — covers all phase requirements. No new test framework setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Accuracy sub-tab renders correctly in browser | ACC-02, ACC-03, ACC-04 | Visual layout and scrolling cannot be fully asserted in RTL | Start dev server, navigate to Analyse > Accuracy, verify all three sections render |
| last_gw_actual_pts column visible in Default/Analysis, hidden in Compact | ACC-05 | Preset toggle is interactive | Open GemTable, switch between Default/Analysis/Compact presets |
| Human checkpoint displays correct hit rates and prompts for model selection | ACC-06 | Terminal-only checkpoint | Run executor checkpoint plan and confirm prompt appears with correct data |
| Model removal leaves no dead code for the loser | ACC-06 | AST analysis; removal scope differs by which model loses | After executor completes Plan 03, grep for loser model fields across all files |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
