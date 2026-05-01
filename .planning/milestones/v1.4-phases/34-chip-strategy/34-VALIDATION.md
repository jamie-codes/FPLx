---
phase: 34
slug: chip-strategy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx src/lib/chip-strategy-engine.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx src/lib/chip-strategy-engine.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | CHIP-01/02/03 | — | N/A | unit (pure) | `npx vitest run src/lib/chip-strategy-engine.test.ts` | ❌ W0 | ⬜ pending |
| 34-01-02 | 01 | 1 | CHIP-01/02/03 | T-34-01 | teamId validated as numeric before URL construction | unit | `npx vitest run src/lib/chip-strategy-engine.test.ts` | ❌ W0 | ⬜ pending |
| 34-02-01 | 02 | 2 | CHIP-01 | — | N/A | unit (component) | `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 34-02-02 | 02 | 2 | CHIP-02 | — | N/A | unit (component) | `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 34-02-03 | 02 | 2 | CHIP-03 | — | N/A | unit (component) | `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/chip-strategy-engine.test.ts` — unit stubs for `computeBBScore`, `computeTCScore`, `computeFHResult` pure function correctness (CHIP-01, CHIP-02, CHIP-03)
- [ ] `src/components/planner/ChipStrategyPanel.test.tsx` — component rendering stubs covering loading, error, data, used-chip greyed state, FH expand interaction

*Existing Vitest infrastructure covers framework installation — no new setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ease bar visual correctness (inverted polarity: green = low attacking_difficulty) | CHIP-01/02/03 | CSS colour rendering not testable in jsdom | Open Planner tab, verify easiest GW cell is darkest green, hardest GW cell is lightest |
| FH squad expand shows 15 players in correct formation | CHIP-03 | Formation slot count requires real FPL data | Expand FH row, count rows: 1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD |
| Used-chip row correctly greyed and labelled "Used GW{N}" | CHIP-01/02/03 | Requires account with chips played | Use a test FPL account that has played BB; verify label and opacity |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
