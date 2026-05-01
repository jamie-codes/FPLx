---
phase: 26
slug: quick-wins
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts (or package.json scripts) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | DATA-04 | — | N/A | integration | `npm run test` | ✅ | ⬜ pending |
| 26-02-01 | 02 | 1 | SP-01 | — | N/A | manual | visual check | — | ⬜ pending |
| 26-03-01 | 03 | 2 | SP-02 | — | N/A | integration | `npm run test` | ⬜ W0 | ⬜ pending |
| 26-04-01 | 04 | 1 | MOB-LS-01 | — | N/A | manual | resize browser | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Set-piece taker panel renders correctly | SP-01 | Visual layout | Navigate to set-pieces tab; verify penalty, free kick, corner takers shown per team |
| Landscape tip appears on portrait mobile | MOB-LS-01 | Requires device/resize | Open Gems/DefCon tab on mobile in portrait; verify tip appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
