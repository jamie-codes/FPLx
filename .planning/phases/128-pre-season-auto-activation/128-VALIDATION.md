---
phase: 128
slug: pre-season-auto-activation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 128 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend framework** | Vitest 4.1.2 + jsdom + @testing-library/react |
| **Frontend config** | `vitest.config.ts` (project root) |
| **Pipeline framework** | pytest 8.3.5 |
| **Pipeline config** | `conftest.py` (sys.path injection) |
| **Frontend quick run** | `npm test` |
| **Pipeline quick run** | `python -m pytest pipeline/tests/ -x` |
| **Full suite command** | `npm test && python -m pytest pipeline/tests/` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest pipeline/tests/ -x` (pipeline tasks) or `npm test` (frontend tasks)
- **After every plan wave:** Run `npm test && python -m pytest pipeline/tests/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Req | Wave | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|-----|------|------------|-----------------|-----------|-------------------|-------------|--------|
| AUTO-01 predicate true | AUTO-01 | 1 | — | N/A | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ extend | ⬜ pending |
| AUTO-01 predicate false (finished events) | AUTO-01 | 1 | — | N/A | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ extend | ⬜ pending |
| AUTO-01 predicate false (< 38 events) | AUTO-01 | 1 | — | N/A | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ extend | ⬜ pending |
| AUTO-01 predicate false (no deadline_time) | AUTO-01 | 1 | — | N/A | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ extend | ⬜ pending |
| AUTO-02 force=True bypasses idempotency | AUTO-02 | 1 | — | N/A | unit (Python) | `python -m pytest pipeline/tests/test_suggest_squad.py -x` | ❌ Wave 0 | ⬜ pending |
| AUTO-02 force=False skips when artifact exists | AUTO-02 | 1 | — | N/A | unit (Python) | `python -m pytest pipeline/tests/test_suggest_squad.py -x` | ❌ Wave 0 | ⬜ pending |
| AUTO-03 usePreSeasonActive returns null on 404 | AUTO-03 | 2 | — | N/A | unit (TS) | `npm test -- usePreSeasonActive` | ❌ Wave 0 | ⬜ pending |
| AUTO-03 usePreSeasonActive returns data on 200 | AUTO-03 | 2 | — | N/A | unit (TS) | `npm test -- usePreSeasonActive` | ❌ Wave 0 | ⬜ pending |
| AUTO-03 banner dismissed state persists via localStorage | AUTO-03 | 2 | — | N/A | unit (TS) | `npm test -- usePreSeasonActive` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/test_suggest_squad.py` — stubs for AUTO-02 `force` parameter contract (bypasses/honors idempotency check)
- [ ] `src/lib/hooks/usePreSeasonActive.test.ts` — stubs for AUTO-03 hook contract (404→null, data shape, localStorage key)

*`pipeline/tests/test_run_offseason.py` already exists — extend it for AUTO-01 predicate edge cases, do not create a new file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Status pill flips Awaiting → Live within one TanStack Query refetch | AUTO-03 | Requires live Blob write + browser | Open NextSeasonPlannerTab before and after `/api/pre-season-active` becomes 200; confirm pill color change |
| First-activation banner appears on fresh session, dismissed forever after × click | AUTO-03 | localStorage + render state interaction | Clear localStorage, load tab, confirm banner; dismiss; reload, confirm banner absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
