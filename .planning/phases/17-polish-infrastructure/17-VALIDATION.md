---
phase: 17
slug: polish-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 17 — Validation Strategy

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
| 17-01-01 | 01 | 1 | MOB-POL-01 | grep | `grep -n "sticky" src/components/gems/GemTable.tsx` | ✅ | ⬜ pending |
| 17-01-02 | 01 | 1 | MOB-POL-02 | grep | `grep -n "back-to-top\|scrollY\|scroll" src/components/gems/GemTable.tsx` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 1 | DAT-01 | grep | `grep -n "blob\|getBlob\|head" src/app/api/last-updated/route.ts` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 1 | DAT-01 | manual | GitHub Actions run history | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky filter bar stays visible while scrolling | MOB-POL-01 | Visual browser test required | Open app at 375px, scroll GemTable, confirm filter row stays at top |
| Back-to-top button appears after scrolling | MOB-POL-02 | Visual browser test required | Scroll past first screenful of rows, confirm button appears; tap to confirm scroll |
| GitHub Actions cron ran and updated Blob | DAT-01 | Runtime state — needs live cron trigger or run history check | Check GitHub Actions run history; confirm `merged_players.json` freshness in Vercel Blob |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
