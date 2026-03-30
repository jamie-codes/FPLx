# Phase 12: FPL Auth + Exact Selling Price — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 12-fpl-auth-exact-selling-price
**Areas discussed:** Login placement, Auth flow architecture, Session persistence, Unauthenticated fallback display

---

## Login Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline nudge near bank balance | Small "Log in for exact prices →" link next to bank balance; becomes "Logged in • Log out" when authed | ✓ |
| Section above Team ID input | Dedicated optional login block at top of Squad tab | |
| Integrated with Team ID flow | Secondary prompt expands after entering Team ID | |

**User's choice:** Inline nudge near bank balance
**Notes:** Surfaces at the exact point of imprecision; doesn't disrupt unauthenticated flow.

---

## Auth Flow Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| HttpOnly cookie on our domain | Client → /api/auth/login → FPL login → HttpOnly cookie on our domain → /api/fpl/my-team reads it | ✓ |
| In-memory React state only | FPL session token kept in useState; lost on page refresh | |

**User's choice:** HttpOnly cookie on our domain

**Follow-up — Logout route:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — logout button when authenticated | /api/auth/logout clears cookie; nudge becomes "Logged in • Log out" | ✓ |
| No — cookie expires naturally | Session ends when TTL expires; no manual sign-out | |

**User's choice:** Yes — expose logout route and button

---

## Session Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Match FPL's own session TTL | Mirror Max-Age from FPL's pl_profile cookie | ✓ |
| Fixed short TTL (2 hours) | Hardcode 2-hour expiry regardless of FPL's TTL | |

**User's choice:** Match FPL's own session TTL

---

## Unauthenticated Fallback Display

**Sell price display:**

| Option | Description | Selected |
|--------|-------------|----------|
| Tilde prefix + tooltip | ~£4.5m in rows; tooltip "Approximate sell price — log in for exact value" | ✓ |
| Show as-is, no label change | Keep current now_cost display unchanged | |

**User's choice:** Tilde prefix + tooltip

**Authenticated state:**

| Option | Description | Selected |
|--------|-------------|----------|
| Replace in-place | Bank and sell prices upgrade in the same location; no extra UI | ✓ |
| Show both approximate and exact | Show diff to highlight gain | |

**User's choice:** Replace in-place, same location

---

## Claude's Discretion

None — all areas had clear user preferences.

## Deferred Ideas

None — discussion stayed within phase scope.
