---
phase: 20
slug: auth-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 0 | AUTH-03, AUTH-04 | unit | `npx vitest run tests/lib/auth-expiry.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | AUTH-03, AUTH-04 | manual | — | ✅ | ⬜ pending |
| 20-01-03 | 01 | 1 | AUTH-03 | manual | — | ✅ | ⬜ pending |
| 20-01-04 | 01 | 2 | AUTH-04 | manual | — | ✅ | ⬜ pending |
| 20-01-05 | 01 | 2 | AUTH-03, AUTH-04 | manual | — | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/auth-expiry.test.ts` — unit tests for `computeAuthExpiryState()` pure function (thresholds: >1hr = normal, <1hr = warning, <15min = expired)

*Existing vitest infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Modal opens on "Connect FPL account →" click | AUTH-03 | Requires browser interaction | Click link in Squad tab; confirm modal appears with numbered steps and token input |
| Backdrop click dismisses modal | AUTH-03 | Requires browser interaction | Click outside modal area; confirm modal closes |
| Escape key dismisses modal | AUTH-03 | Requires browser interaction | Press Escape while modal is open; confirm modal closes |
| Paste button fills token field | AUTH-03 | Requires Clipboard API in browser | Copy a string; click paste button; confirm field populated |
| Token submit authenticates and closes modal | AUTH-03 | Requires live FPL session token | Paste valid token; submit; confirm squad data loads |
| Expiry warning appears when token < 1hr | AUTH-04 | Requires time manipulation or mock token | Use token with ~45min remaining; confirm amber warning shown |
| Expired state shows reconnect link | AUTH-04 | Requires expired token or time mock | Use expired token; confirm "Token expired — reconnect →" link shown |
| Reconnect link reopens guide modal | AUTH-04 | Requires browser interaction | Click reconnect link; confirm modal reopens |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
