# Phase 20: Auth UX — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 20-auth-ux
**Areas discussed:** AUTH-03 reinterpretation, Guide format + depth, Where the guide lives, Connected state display

---

## AUTH-03 Reinterpretation

| Option | Description | Selected |
|--------|-------------|----------|
| Best-in-class guided flow | Accept DevTools token approach, make it smooth for non-technical users | ✓ |
| OAuth redirect flow | Redirect to account.premierleague.com, capture token from redirect | |
| Drop AUTH-03, deliver AUTH-04 only | Acknowledge constraint, remove AUTH-03 from scope | |

**User's choice:** Best-in-class guided flow
**Notes:** FPL uses OAuth 2.0 PKCE — no email/password API. Reinterpreting AUTH-03 as polished guided onboarding. Both AUTH-03 and AUTH-04 converge into one deliverable.

---

## Guide Format + Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Tabbed by browser | Chrome / Firefox / Safari tabs, numbered steps each | |
| Single guide with browser callouts | One list with inline browser-specific notes | |
| Plain numbered steps only | Chrome-focused, minimal, no branching | ✓ |

**Clipboard paste button:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — on the input itself | Paste icon auto-fills token field | ✓ |
| No — standard paste is fine | Ctrl+V / Cmd+V sufficient | |

**User's choice:** Plain numbered steps (Chrome-focused) + paste-from-clipboard button

---

## Where the Guide Lives

| Option | Description | Selected |
|--------|-------------|----------|
| Modal/dialog | Opens on button click, guide + token input inside | ✓ |
| Inline expansion (current pattern) | Expands in-place in Squad tab | |
| Dedicated help page | Separate /help/auth route | |

**User's choice:** Modal/dialog

---

## Connected State Display

**Expiry warning:**

| Option | Description | Selected |
|--------|-------------|----------|
| Expiry warning when < 1hr left | Amber warning badge when token expires within 1 hour | ✓ |
| Keep current display unchanged | No change to current "valid until HH:MM" | |
| Show team name | Fetch team name from FPL API | |

**Reconnect action:**

| Option | Description | Selected |
|--------|-------------|----------|
| Show expired state + reconnect link | "Token expired — reconnect →" reopens modal | ✓ |
| No explicit expired state | User clicks Connect again when unauthenticated | |

**User's choice:** Amber expiry warning (< 1hr) + explicit expired/reconnect state (< 15min)

---

## Claude's Discretion

- Exact visual styling of expiry warning (amber color, badge vs inline text)
- Whether to use native `<dialog>` element or div-based modal overlay
- Exact wording of numbered DevTools steps

## Deferred Ideas

None.
