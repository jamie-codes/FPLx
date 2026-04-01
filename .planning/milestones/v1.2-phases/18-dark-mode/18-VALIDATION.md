---
phase: 18
slug: dark-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx next build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | DARK-01/02 | grep | `grep -n "@custom-variant dark" src/app/globals.css` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | DARK-01/02 | grep | `grep -n "suppressHydrationWarning\|dangerouslySetInnerHTML" src/app/layout.tsx` | ✅ | ⬜ pending |
| 18-01-03 | 01 | 1 | DARK-01 | grep | `grep -n "ThemeToggle" src/components/` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | DARK-03 | grep | `grep -rn "dark:" src/components/gem-table/ \| wc -l` | ✅ | ⬜ pending |
| 18-02-02 | 02 | 2 | DARK-03 | grep | `grep -rn "dark:" src/components/squad/ src/components/transfers/ \| wc -l` | ✅ | ⬜ pending |
| 18-02-03 | 02 | 2 | DARK-03 | grep | `grep -rn "dark:" src/components/defcon/ src/components/club-form/ src/components/value-gems/ \| wc -l` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/theme/ThemeToggle.tsx` — new component file (created in 18-01 Task 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No white flash on dark-OS page load | DARK-01 | Visual — can't grep for flash | Open app in browser with OS set to dark; hard-reload; confirm no white flash before dark mode applies |
| Toggle persists across reload | DARK-01 | Runtime localStorage state | Toggle to light on dark-OS device; reload; confirm stays light |
| prefers-color-scheme auto-detection | DARK-02 | OS-level preference | Clear localStorage; open app on dark-OS; confirm dark mode loads without toggle |
| All 5 tabs readable in dark mode | DARK-03 | Visual contrast audit | Switch to dark mode; visit Gems, Squad, DefCon, Club Form, Values; check for white-on-white or illegible text |
| Sticky/fixed elements themed correctly | DARK-03 | Visual — sticky elements notoriously missed | In dark mode, scroll GemTable; confirm filter bar, thead, sticky player column, and MobileNav are all dark-themed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
