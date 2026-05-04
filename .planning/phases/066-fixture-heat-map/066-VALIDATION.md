---
phase: 66
slug: fixture-heat-map
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 66 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom environment) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 66-01-01 | 01 | 1 | D-01 | — | N/A (read-only) | manual | `python pipeline/merge.py && grep -c "event_id" pipeline/cache/club_form.json` | ✅ | ⬜ pending |
| 66-01-02 | 01 | 1 | D-01 | — | N/A | unit | `npx vitest run src/lib/types.test.ts` (type comment check is manual) | ✅ | ⬜ pending |
| 66-02-01 | 02 | 2 | HEAT-01, HEAT-02, HEAT-03 | — | N/A | unit (RTL) | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 66-02-02 | 02 | 2 | D-06, D-07 | — | N/A | unit (RTL) | `npx vitest run src/app/page.test.tsx` | ✅ (needs mock + test) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/club-form/FixtureHeatMap.test.tsx` — stubs for HEAT-01, HEAT-02, HEAT-03
- [ ] `src/app/page.test.tsx` — new `vi.mock('@/components/club-form/FixtureHeatMap', ...)` entry + Heat Map tab navigation test

*Existing Vitest infrastructure covers the project; no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full 20×8 grid visible on 1440px desktop without horizontal scroll | HEAT-03 | Visual/layout — requires browser rendering | Open app at ≥1440px viewport, navigate to Analyse → Heat Map, confirm all 20 rows and 8 GW columns visible without scrolling |
| DGW split-diagonal renders correctly in dark mode | HEAT-02 | CSS gradient dark mode requires visual inspection | Toggle dark mode, verify DGW cells show two coloured triangles (not uniform light-mode colour) |
| BGW tooltip reads "No fixture (BGW)" | HEAT-02 | Tooltip display requires browser hover | Hover over a known blank-gameweek cell and confirm tooltip text |
| GW column headers show absolute event numbers (e.g. "GW34") | HEAT-01 | Label content — visual check | Confirm headers match `GW{event_id}` format from pipeline data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
