---
phase: 125
slug: summer-window-tracker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 125 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx src/components/news/SummerWindowTab.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx src/components/news/SummerWindowTab.test.tsx`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 125-01-01 | 01 | 1 | WIN-02 | — | N/A | unit | `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx` | ❌ W0 | ⬜ pending |
| 125-01-02 | 01 | 1 | WIN-02 | — | N/A | unit | `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx` | ❌ W0 | ⬜ pending |
| 125-02-01 | 02 | 1 | WIN-01 | — | N/A | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | ❌ W0 | ⬜ pending |
| 125-02-02 | 02 | 1 | WIN-01 | — | N/A | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | ❌ W0 | ⬜ pending |
| 125-03-01 | 03 | 2 | WIN-01 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |
| 125-03-02 | 03 | 2 | WIN-02 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/shared/ConfirmedSigningBadge.test.tsx` — stubs for WIN-02 badge contract (renders correct text, green classes, tooltip format)
- [ ] `src/components/news/SummerWindowTab.test.tsx` — stubs for WIN-01 feed tab behaviours (article cards render, filter pills update articles, empty state, stale banner)

*Existing infrastructure: Vitest 4.1.2 + jsdom + @testing-library/react already configured. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sub-tab "Summer Window" visible in Analyse section nav | WIN-01 | Page-level sub-tab render requires browser dev server | Open `/`, navigate to Analyse section, confirm "Summer Window" and "Window" (mobile) tabs appear after "Season" |
| Article title links open in new tab | WIN-01 | Link target behaviour requires browser | Click any article title — new tab opens to source URL |
| Confirmed Signing badge tooltip shows on hover | WIN-02 | `title` attribute tooltip requires browser hover | Expand a GemTable row or view a TransferPanel buy row with a confirmed signing — hover badge to confirm `"{title} · {source}"` tooltip |
| Badge absent for unmatched players | WIN-02 | Requires matching live data or test fixture | Expand row for a player without a confirmed_signing article — no badge rendered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
