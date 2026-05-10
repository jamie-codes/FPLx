---
phase: 90
slug: monte-carlo-simulation-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 90 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.5 |
| **Config file** | none — rootdir discovery |
| **Quick run command** | `python -m pytest pipeline/tests/test_simulate.py -v` |
| **Full suite command** | `python -m pytest pipeline/tests/ -v` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest pipeline/tests/test_simulate.py -v`
- **After every plan wave:** Run `python -m pytest pipeline/tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 90-01-01 | 01 | 0 | MC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_simulate.py -v` | ❌ W0 | ⬜ pending |
| 90-01-02 | 01 | 0 | MC-01 | — | N/A | type-check | `npx tsc --noEmit` | ✅ exists | ⬜ pending |
| 90-02-01 | 02 | 1 | MC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_simulate.py -v` | ✅ W0 | ⬜ pending |
| 90-02-02 | 02 | 1 | MC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_simulate.py -v` | ✅ W0 | ⬜ pending |
| 90-03-01 | 03 | 1 | MC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_simulate.py -v` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/test_simulate.py` — 6 new test cases added: percentile invariants, BGW zero-fill, DGW combine, iteration-count gate, seed determinism, mc_enabled OFF skip
- [ ] `src/lib/types.ts` — 4 new optional fields on `MergedPlayer`: `xPts_5gw_p10?`, `xPts_5gw_p50?`, `xPts_5gw_p90?`, `rank_trajectory?`

*Existing `pipeline/tests/` infrastructure covers all phase requirements — no new conftest or install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end pipeline run with `mc_enabled=true` | MC-01 | Requires full pipeline data and live fixture list | Run `python -m pipeline.run` in a dev environment with `accuracy_backtest.json` having `mc_enabled: true`; confirm `merged_players.json` contains `xPts_5gw_p10/p50/p90` and `rank_trajectory` arrays of length 5 for non-BGW players |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
