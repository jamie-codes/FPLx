---
phase: 9
slug: projected-points-columns
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-W0-01 | W0 | 0 | PROJ-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 9-toggle-01 | toggle | 1 | PROJ-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 9-columns-01 | columns | 1 | PROJ-04 | type check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 9-transfer-01 | transfer | 2 | PROJ-04 | type check | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/gem-table/GwToggle.test.ts` — unit tests for `getColumnVisibility(horizon: 1 | 3 | 5)` pure helper (PROJ-04)

*Note: Vitest 4.1.2 installed, `vitest.config.ts` exists, `@` alias configured — no framework setup needed. Environment is `node` (no jsdom). Tests must target the pure exported function, not the React component render.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GW toggle switches visible column in GemTable | PROJ-04 | DOM interaction requires jsdom/browser | Open app, click "1 GW"/"3 GW"/"5 GW" buttons, verify only the selected column appears |
| Projected points values in 2–15 range for regular starters | PROJ-04 | Requires live pipeline data | Inspect values for Salah / Haaland — expect 8–14 range for next GW |
| Projected points visible in TransferPanel alongside gem delta | PROJ-04 | Requires live squad load | Load squad, check suggestions show "Proj pts (1 GW):" label with numeric value |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
