---
phase: 3
slug: gem-rating-table
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/lib/gem-score.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/gem-score.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | GEM-01 | unit | `npx vitest run tests/lib/gem-score.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | GEM-01, GEM-02 | unit + build | `npx vitest run && npx next build` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | UIX-01, UIX-02 | build | `npx next build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/gem-score.test.ts` — stubs for GEM-01 scoring algorithm (7 dimensions, null handling, cross-position normalisation)
- [ ] `@tanstack/react-table` package installed (`npm install @tanstack/react-table`)

*Wave 0 installs missing dependency and creates test stub before any implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Table sorts by clicking column header | GEM-02, UIX-02 | DOM interaction required | Load `/`, click "xG per 90" column header, verify sort direction toggles and rows reorder |
| Position filter shows correct row count | GEM-02, UIX-02 | DOM interaction required | Click "MID" filter, verify only element_type=3 players shown |
| Null xG/xA shows dash (not zero or NaN) | PPS-03 | Visual rendering check | Find a player with null xg_per90, verify "—" displayed in cell |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
