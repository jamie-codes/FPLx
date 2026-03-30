---
phase: 8
slug: minutes-risk-ui-transfer-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/transfer-engine.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/transfer-engine.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** `npx tsc --noEmit && npx vitest run` must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-W0-01 | W0 | 0 | MINS-02 | unit | `npx vitest run tests/lib/mins-risk-badge.test.ts` | ❌ W0 | ⬜ pending |
| 8-badge-01 | badge | 1 | MINS-02 | unit | `npx vitest run tests/lib/mins-risk-badge.test.ts` | ❌ W0 | ⬜ pending |
| 8-badge-02 | badge | 1 | MINS-02 | unit | `npx vitest run tests/lib/mins-risk-badge.test.ts` | ❌ W0 | ⬜ pending |
| 8-transfer-01 | transfer | 2 | MINS-03 | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ✅ | ⬜ pending |
| 8-transfer-02 | transfer | 2 | MINS-03 | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ✅ | ⬜ pending |
| 8-transfer-03 | transfer | 2 | MINS-03 | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/mins-risk-badge.test.ts` — pure function tests for `getMinsRiskConfig()` helper (MINS-02)

*Note: Vitest uses `environment: 'node'` — no jsdom. Badge logic must be extracted as an exportable pure function `getMinsRiskConfig(minsRisk)` from `MinsRiskBadge.tsx` to enable unit testing without React Testing Library.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge renders correctly in SquadView rows | MINS-02 | DOM rendering requires visual check (no jsdom) | Open app, navigate to SquadView, verify badge appears with correct color/label for each risk tier |
| Badge renders correctly in GemTable rows | MINS-02 | DOM rendering requires visual check (no jsdom) | Open app, navigate to GemTable, verify badge appears in correct column position |
| Injured/unavailable players show availability badge not rotation badge | MINS-02 | Requires live data with injured players | Check a player with `status != 'a'` or injury `news` — badge must reflect availability context |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
