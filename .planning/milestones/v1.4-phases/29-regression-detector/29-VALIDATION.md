---
phase: 29
slug: regression-detector
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing, jsdom environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/regression-signal.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/regression-signal.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | DATA-03 | — | N/A | unit + integration | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | REG-01 | — | N/A | unit (pure math) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | REG-02 | — | N/A | unit (pure math) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 2 | REG-01 | — | N/A | component (RTL) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ W0 | ⬜ pending |
| 29-02-02 | 02 | 2 | REG-02 | — | N/A | component (RTL) | `npx vitest run tests/lib/regression-signal.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/regression-signal.test.ts` — stubs for unit invariants below (pure math + badge rendering + column visibility)

*Existing test infrastructure (vitest.config.ts, jsdom env) covers all other phase requirements — no new fixtures/config needed.*

### Key Test Invariants (Wave 0 stubs)

```typescript
// Unit: delta = 0.0 → no signal (exact equality case)
// Unit: delta = -0.4999 → no signal (below threshold, not BUY)
// Unit: delta = -0.5001 → BUY signal (just over threshold)
// Unit: delta = +0.5001 → SELL signal
// Unit: total_minutes < 900 → null signal regardless of delta
// Unit: empty history → null signal
// Unit: DGW (2 entries round 33) both contribute to mean
// Component: RegressionSignalBadge renders green "BUY" pill for signal='buy'
// Component: RegressionSignalBadge renders amber "SELL" pill for signal='sell'
// Component: RegressionSignalBadge renders '—' for signal=null or absent
// Column: signal column hidden in MOBILE_HIDDEN_COLUMNS (portrait mobile)
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signal column visible in landscape, hidden in portrait | D-06 | Requires real device/browser resize | Rotate phone to landscape on Gems tab; verify Signal column appears |
| BUY/SELL pill colours correct in dark mode | D-04 | Visual check required | Toggle dark mode; verify green BUY / amber SELL contrast |
| Sort by Signal surfaces all BUY at top | D-05 | Visual/interactive | Click Signal column header; verify sort order: BUY → no signal → SELL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
