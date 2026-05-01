---
phase: 31
slug: captaincy-ceiling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/lib/captain-picks.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/captain-picks.test.ts`
- **After every plan wave:** Run `npm test` (full suite — must remain green; baseline: 272 pass + 26 skip)
- **Before `/gsd-verify-work`:** Full suite green + `pipeline/cache/captain_picks.json` exists with valid JSON after `cd pipeline && python run.py`
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | CAP-03 | — | `_safe_float` cast for ownership; `status == 'a'` filter; no template interpolation in json.dumps | unit (it.skip) | `npx vitest run tests/lib/captain-picks.test.ts -t "ceiling pick"` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | CAP-03 | — | `xPts_90th_1gw` field present on every player | integration (it.skip) | `npx vitest run tests/lib/captain-picks.test.ts -t "xPts_90th_1gw"` | ❌ W0 | ⬜ pending |
| 31-01-03 | 01 | 1 | CAP-04 | — | EO pick filtered by `_safe_float(selected_by_percent) < 25.0` | integration (it.skip) | `npx vitest run tests/lib/captain-picks.test.ts -t "EO pick"` | ❌ W0 | ⬜ pending |
| 31-01-04 | 01 | 1 | CAP-03/04 | — | Both picks have `status === 'a'` | integration (it.skip) | `npx vitest run tests/lib/captain-picks.test.ts -t "status"` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 2 | CAP-03 | — | Panel renders ceiling card with player name | component (it) | `npx vitest run tests/lib/captain-picks.test.ts -t "renders ceiling"` | ❌ W0 | ⬜ pending |
| 31-02-02 | 02 | 2 | CAP-04 | — | Panel renders EO-adjusted card | component (it) | `npx vitest run tests/lib/captain-picks.test.ts -t "renders EO"` | ❌ W0 | ⬜ pending |
| 31-02-03 | 02 | 2 | CAP-03/04 | — | Panel shows same-player note when ceiling==EO | component (it) | `npx vitest run tests/lib/captain-picks.test.ts -t "same player"` | ❌ W0 | ⬜ pending |
| 31-02-04 | 02 | 2 | CAP-03/04 | — | Panel shows loading and error states | component (it) | `npx vitest run tests/lib/captain-picks.test.ts -t "loading\|error"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/captain-picks.test.ts` — new file (mirrors `tests/lib/differential-flag.test.ts` structure):
  - 1 placeholder `it()` so file passes when implementation is empty
  - 8 `it.skip` integration stubs for CAP-03/04 pipeline output verification
  - 5 component tests using `@testing-library/react` with mocked `useCaptainPicks`

No new framework install needed — Vitest + React Testing Library + jsdom already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `captain_picks.json` written to `pipeline/cache/` after pipeline run | CAP-03/04 | Requires live pipeline execution with real FPL API data | Run `cd pipeline && python run.py`; verify `pipeline/cache/captain_picks.json` exists and contains `ceiling` + `eo_adjusted` with player data |
| Panel visible on Gems tab in browser | CAP-03/04 | Visual rendering check | Load app, navigate to Gems tab, confirm `CaptainPicksPanel` renders below `GemTable` with two named picks |
| Mobile stacked layout | CAP-03 | Requires viewport resize | DevTools mobile emulation — confirm cards stack vertically on portrait; side-by-side on landscape |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
