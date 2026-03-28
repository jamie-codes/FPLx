---
phase: 5
slug: squad-view-transfer-suggestions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/lib/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TIS-01 | unit | `npx vitest run tests/lib/squad-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | TIS-03 | unit | `npx vitest run tests/lib/squad-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | TRF-01, TRF-02, TRF-03 | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | TRF-04, TRF-05, TRF-06 | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | TIS-01, TIS-02, TIS-03 | build | `npx next build 2>&1 \| tail -5` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | TRF-01–TRF-07 | checkpoint | human visual verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/squad-adapter.test.ts` — stubs for TIS-01, TIS-03 (squad shape, position split)
- [ ] `tests/lib/transfer-engine.test.ts` — stubs for TRF-01 through TRF-06 (position lock, budget, chip detection, "save transfer" recommendation)

*Existing vitest infrastructure covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Squad renders correctly in browser | TIS-01 | Requires browser rendering | Enter Team ID → verify squad split by position |
| Transfer suggestions appear ranked | TRF-01, TRF-02 | Requires live FPL data | Enter Team ID → verify suggestions ranked by Gem delta |
| Free Hit chip warning shown | TRF-05 | Requires account with active chip | Activate Free Hit → verify chip warning panel |
| "Save transfer" recommendation | TRF-06 | Requires squad with no beneficial swaps | Use squad where all alternatives score lower |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
