---
phase: 126
slug: next-season-planner
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 126 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom environment) + pytest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/pre-season-squad.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/pre-season-squad.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 126-01-01 | 01 | 0 | NSP-02 | — | N/A | unit | `npx vitest run src/lib/pre-season-squad.test.ts` | ❌ W0 | ⬜ pending |
| 126-01-02 | 01 | 0 | NSP-03/04 | — | N/A | unit | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | ❌ W0 | ⬜ pending |
| 126-01-03 | 01 | 0 | NSP-01 | — | N/A | unit | `python -m pytest pipeline/ -k "archive"` | ❌ W0 | ⬜ pending |
| 126-02-01 | 02 | 1 | NSP-02 | — | N/A | unit | `npx vitest run src/lib/pre-season-squad.test.ts` | ❌ W0 | ⬜ pending |
| 126-03-01 | 03 | 1 | NSP-03 | — | N/A | unit | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | ❌ W0 | ⬜ pending |
| 126-04-01 | 04 | 2 | NSP-04 | — | N/A | unit | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/pre-season-squad.test.ts` — stubs for NSP-02
- [ ] `src/components/next-season/NextSeasonPlannerTab.test.tsx` — stubs for NSP-03, NSP-04
- [ ] `pipeline/test_archive_season.py` — stubs for NSP-01 idempotency and partial-write guard
- [ ] `pulp>=2.7.0` in `pipeline/requirements.txt` — required before Wave 1 Python work

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Prices pending" state when archive absent from Blob | NSP-03/04 | Requires Vercel Blob env; cannot mock in unit tests without integration setup | Remove `season_archive_gw38.json` from Blob, load Next Season tab, verify graceful state renders |
| "Fixtures not yet published" when FPL has no next-season fixtures | NSP-03 | Requires live FPL API response with empty fixtures array | During off-season, load heatmap section, verify empty state renders |
| `archive_season.py` runs during GW38 CI pipeline | NSP-01 | Time-gated; GW38 condition not reproducible in unit tests | Verify `run.py` GW38 gate executes `archive_season.py` with a mocked `current_gw == last_event_id` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
