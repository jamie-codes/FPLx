# Phase 130: Auth Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 130-Auth Fix
**Areas discussed:** Credentials tab fate, Modal open state

---

## Credentials Tab Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it entirely | Delete the credentials form, fpl-login fetch, and mode tabs entirely. Modal opens straight to manual token. | ✓ |
| Keep, handle ENDPOINT_GONE reactively | Keep the tab but handle ENDPOINT_GONE like NO_TOKEN — show error + auto-switch to manual tab. | |
| Keep, disable with a notice | Keep the tab rendered but greyed out with a static unavailable notice. | |

**User's choice:** Remove it entirely
**Notes:** None

---

## Modal Open State

| Option | Description | Selected |
|--------|-------------|----------|
| No explanation needed | Modal shows token-paste form directly. No note about why email/password is gone. | ✓ |
| Brief note above the form | One-line muted note explaining FPL no longer supports direct login. | |

**User's choice:** No explanation needed
**Notes:** Triggered by previous decision — tab removal made mode default moot; framed as whether to add explanatory text.

---

## Claude's Discretion

- Test coverage: update or remove existing tests for credentials form / mode switching.

## Deferred Ideas

None.
