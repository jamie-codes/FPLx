---
phase: 27
slug: fdr-plus-plus-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- club-form.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- club-form.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + manual Form tab visual check
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | DATA-01 | — | N/A | unit | `npm test -- club-form.test.ts -t "FDR\+\+"` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | DATA-01 | — | N/A | manual smoke | `python pipeline/run.py && python -c "import json; d=json.load(open('pipeline/cache/merged_players.json'))[0]; assert 'attacking_difficulty' in d['fixtures'][0]"` | N/A | ⬜ pending |
| 27-01-03 | 01 | 1 | DATA-01 | — | N/A | unit (regression) | `npm test -- gem-score captaincy-engine planning-engine recommend` | Existing | ⬜ pending |
| 27-02-01 | 02 | 2 | FIX-01 | — | N/A | unit | `npm test -- club-form.test.ts -t "ease arrays"` | ❌ W0 | ⬜ pending |
| 27-02-02 | 02 | 2 | FIX-01 | — | N/A | unit | `npm test -- club-form.test.ts -t "BGW"` | ❌ W0 | ⬜ pending |
| 27-02-03 | 02 | 2 | FIX-01 | — | N/A | component | `npm test -- FixtureEaseRankingPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 27-02-04 | 02 | 2 | FIX-02 | — | N/A | component | `npm test -- FixtureEaseRankingPanel.test.tsx -t "ATT/DEF"` | ❌ W0 | ⬜ pending |
| 27-02-05 | 02 | 2 | FIX-02 | — | N/A | manual visual | `npm run dev` → Club Form tab → toggle ATT/DEF; verify FixtureBadges below unchanged | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/club-form.test.ts` — extend with 5 new cases:
  - "FDR++ — emits attacking_difficulty and defensive_difficulty per fixture entry"
  - "FDR++ — defensive_difficulty uses 3-game goals-scored window (not 6)"
  - "FDR++ — ease arrays present for 1GW/3GW/5GW windows on each ClubForm row"
  - "FDR++ — BGW: team with no upcoming fixture in window returns null ease"
  - "FDR++ — high-scoring opponent yields low defensive_ease (hard to keep CS)"
- [ ] `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` — new file: smoke render, GW toggle switches sort, ATT/DEF toggle switches metric, ATT is default
- [ ] Verify `@testing-library/react` is installed (`npm ls @testing-library/react`); if missing, add as devDependency + add `jsdom` or `happy-dom` to vitest environment config

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline emits new fields in merged_players.json | DATA-01 | No Python test infra exists | `python pipeline/run.py` then grep/inspect `pipeline/cache/merged_players.json` fixture entries |
| FixtureBadges colours in ClubFormTable unchanged when ATT/DEF toggle flipped | FIX-02 (regression) | Cross-component visual state isolation | `npm run dev` → Club Form tab → toggle ATT/DEF → confirm FixtureBadges below table look identical |
| Panel ranks teams correctly (easiest first) with correct colours | FIX-01 | End-to-end visual verification | `npm run dev` → Club Form tab → compare panel rank vs known fixture schedule for GW window |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
