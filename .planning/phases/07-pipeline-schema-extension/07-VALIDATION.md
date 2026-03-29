---
phase: 7
slug: pipeline-schema-extension
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/lib/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | PROJ-01, PROJ-02, PROJ-03, MINS-01 | unit | `npx vitest run tests/lib/merge.test.ts` | ✅ (add cases) | ⬜ pending |
| 7-02-01 | 02 | 1 | PROJ-01 | unit | `npx vitest run tests/lib/merge.test.ts` | ✅ | ⬜ pending |
| 7-03-01 | 03 | 1 | PROJ-02, PROJ-03 | unit | `npx vitest run tests/lib/merge.test.ts` | ✅ | ⬜ pending |
| 7-04-01 | 04 | 1 | MINS-01 | unit | `npx vitest run tests/lib/merge.test.ts` | ✅ | ⬜ pending |
| 7-05-01 | 05 | 2 | PROJ-01, PROJ-02, PROJ-03, MINS-01 | unit | `npx vitest run tests/lib/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/merge.test.ts` — add stubs for PROJ-01/02/03/MINS-01 (file exists, add cases)
  - [ ] Test `proj_pts_1gw` present and non-negative on every player
  - [ ] Test `proj_pts_3gw >= proj_pts_1gw` for all players
  - [ ] Test DGW doubling: 2 fixtures with same `event_id` produce higher `proj_pts_3gw` than single-GW player
  - [ ] Test `xmins` in range [0, 90]
  - [ ] Test `start_prob` in range [0.0, 1.0]
  - [ ] Test `mins_risk` is one of: `'nailed' | 'likely_start' | 'rotation_risk' | 'cameo' | 'injured'`
  - [ ] Test `chance_of_playing_next_round = null` does not throw TypeError (treated as 100%)

*Existing infrastructure (Vitest, vitest.config.ts, tests/lib/merge.test.ts) already in place — Wave 0 only adds test cases.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline run produces all 6 new fields in `merged_players.json` | PROJ-01, PROJ-02, PROJ-03, MINS-01 | Requires live FPL API + pipeline execution | Run `python pipeline/run.py`, then `python -c "import json; d=json.load(open('pipeline/cache/merged_players.json')); p=d[0]; print(p.get('proj_pts_1gw'), p.get('proj_pts_3gw'), p.get('proj_pts_5gw'), p.get('xmins'), p.get('start_prob'), p.get('mins_risk'))"` |
| DGW player shows higher proj_pts than equivalent single-GW player in live data | PROJ-02, PROJ-03 | Requires live GW with DGW teams | After pipeline run: compare `proj_pts_3gw` for a DGW team player vs same-form single-GW team player |
| Pipeline runtime does not increase proportionally with xmins addition | MINS-01 | Requires timed pipeline run | Time `python pipeline/run.py` before and after; delta should be ~3s (GK fetches only), not >30s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
