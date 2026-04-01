---
phase: 14
slug: gemtable-mobile
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | MOB-TBL-01 | unit | `npx vitest run src/components/gem-table/GwToggle.test.ts` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | MOB-TBL-05 | visual | manual — DevTools 375px sticky column | N/A | ⬜ pending |
| 14-01-03 | 01 | 1 | MOB-TBL-06 | visual | manual — tap row, verify expand panel | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. vitest + GwToggle.test.ts already in place.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky Player column at 375px | MOB-TBL-05 | CSS `position: sticky` requires live browser rendering | DevTools iPhone SE — scroll GemTable horizontally, verify Player column stays fixed |
| Expandable detail row on tap | MOB-TBL-06 | Touch interaction requires live browser | Tap a row, verify inline panel appears with hidden column data |
| Desktop layout unchanged | MOB-TBL-01 | Responsive breakpoint requires live browser | Switch to 1024px — all columns visible, no expand chevron |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
