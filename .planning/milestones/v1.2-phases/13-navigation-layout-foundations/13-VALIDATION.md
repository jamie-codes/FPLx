---
phase: 13
slug: navigation-layout-foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — `npm test`) |
| **Config file** | `vitest.config.ts` (if exists) or `package.json` scripts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds (14 existing lib unit tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (regression guard — no Phase 13 logic to unit test)
- **After every plan wave:** Run `npm test` + manual browser check at 375px
- **Before `/gsd:verify-work`:** Full suite green + all 5 manual verifications complete
- **Max feedback latency:** ~5 seconds automated; visual checks are manual

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| viewport-export | 01 | 1 | MOB-NAV-03 | grep | `grep -r "viewportFit" src/app/layout.tsx` | ⬜ pending |
| mobile-nav-component | 01 | 1 | MOB-NAV-01/02/03 | grep | `grep -r "MobileNav\|sm:hidden\|hidden sm:flex" src/` | ⬜ pending |
| main-layout-padding | 01 | 1 | MOB-LAY-01/02 | grep | `grep -r "overflow-x-hidden\|pb-20\|max-sm:pb" src/app/` | ⬜ pending |
| touch-targets | 01 | 2 | MOB-TOUCH-01/03 | grep | `grep -r "min-h-11\|active:scale-95" src/components/` | ⬜ pending |
| input-font-size | 01 | 2 | MOB-TOUCH-02 | grep | `grep -r "text-base\|max-sm:text-base" src/components/` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- No new test files needed — Phase 13 is pure CSS/layout work; existing 14 unit tests serve as regression guard
- No new framework to install

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom tab bar visible on phone | MOB-NAV-01 | CSS layout — not testable in jsdom | Open app at 375px width (DevTools mobile); confirm 5 tabs visible at bottom |
| Top strip hidden on mobile | MOB-NAV-02 | CSS visibility | At 375px, confirm horizontal tab row is not visible |
| iOS home indicator clearance | MOB-NAV-03 | Requires real device or Safari simulation | On iOS device or Safari responsive mode: confirm tab bar sits above home indicator notch |
| No horizontal overflow at 375px | MOB-LAY-01 | CSS overflow — not testable in jsdom | Open each of 5 tabs at 375px; confirm no horizontal scrollbar |
| Content not hidden by nav bar | MOB-LAY-02 | Layout pixel check | Scroll to bottom of any tab at 375px; confirm last row is fully visible above nav bar |
| 44px tap targets | MOB-TOUCH-01 | Requires computed CSS check | DevTools → Inspect filter pills, sort headers, tab items; confirm height ≥ 44px |
| No iOS Safari zoom on input focus | MOB-TOUCH-02 | Requires real device or Safari simulation | On iOS Safari: tap Team ID input; viewport must not zoom |
| active:scale-95 feedback | MOB-TOUCH-03 | Visual — requires interaction | Tap filter pills and tab items; confirm slight scale animation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
