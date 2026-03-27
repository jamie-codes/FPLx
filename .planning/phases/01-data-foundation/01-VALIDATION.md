---
phase: 1
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (none detected — Wave 0 installs) |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run tests/lib/fpl-adapter.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/fpl-adapter.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + proxy smoke test against live FPL API
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | scaffold | 1 | DAT-01 | Integration | `python pipeline/run.py --dry-run` | ❌ W0 | ⬜ pending |
| 1-02-01 | adapter | 1 | PPS-01 | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | adapter | 1 | PPS-02 | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-03 | adapter | 1 | PPS-04 | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-04 | adapter | 1 | DAT-02 | Unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | id-map | 2 | PPS-03 | Smoke | `python pipeline/verify_id_map.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest @vitest/ui` — no test framework detected
- [ ] `vitest.config.ts` — basic config for Next.js + TypeScript
- [ ] `tests/lib/fpl-adapter.test.ts` — stubs for PPS-01, PPS-02, PPS-04, DAT-02
- [ ] `tests/fixtures/bootstrap-static-sample.json` — minimal FPL bootstrap fixture for unit tests
- [ ] `pipeline/verify_id_map.py` — smoke test checking top-6 starting XI are all mapped in player_id_map.json

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FPL proxy works in deployed Vercel environment | DAT-01 | CORS check requires real browser on deployed URL, not localhost | Deploy to Vercel preview, open browser devtools, navigate to `/`, confirm no CORS errors in console |
| `player_id_map.json` currency for 2025/26 season | PPS-03 | Summer transfer signings may not be in community CSV | Spot-check 5 recent signings (e.g. new Premier League signings) are present in map |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
