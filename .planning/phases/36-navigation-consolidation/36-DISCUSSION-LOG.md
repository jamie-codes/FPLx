# Phase 36: Navigation Consolidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 36-Navigation Consolidation
**Areas discussed:** Desktop sub-tab reveal, Mobile sub-tab pattern, Sub-tab memory, Default landing state

---

## Desktop Sub-tab Reveal

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tier bar | Section row on top, sub-tabs as a second border-b row below. Clean, familiar, always-visible. | ✓ |
| Inline pill row | Sub-tabs as a compact pill/chip group above the content area. | |
| You decide | Claude picks based on existing conventions. | |

**User's choice:** Two-tier bar

**Follow-up — Squad section treatment:**

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the row entirely | Sub-tab row disappears when Squad is active. No empty row. | ✓ |
| Show row with single item | Sub-tab row always present, one item for Squad. | |

**User's choice:** Hide the row entirely

---

## Mobile Sub-tab Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-tab row above bottom bar | Bottom bar = 3 sections; second fixed row of pills above it for current section's sub-tabs. | ✓ |
| Sub-tab row at top of content | Sub-tabs appear as a pill row at the top of scrollable content area (not fixed). | |

**User's choice:** Sub-tab row above the bottom bar

**Follow-up — Sub-tab pill labels:**

| Option | Description | Selected |
|--------|-------------|----------|
| Abbreviated (Recommended) | Gems / Insights / DefCon / SP; Planner / Form / Values — match existing MobileNav convention. | ✓ |
| Full names, scrollable | Full labels with horizontal scroll if overflow. | |

**User's choice:** Abbreviated

---

## Sub-tab Memory

| Option | Description | Selected |
|--------|-------------|----------|
| Restore last visited sub-tab | Returning to Analyse restores the previously active sub-tab. | ✓ |
| Reset to first sub-tab always | Always opens Gem Ratings / Planner when switching back to a section. | |

**User's choice:** Restore last visited sub-tab per section (session memory)

---

## Default Landing State

| Option | Description | Selected |
|--------|-------------|----------|
| Analyse → Gem Ratings | Same as today — primary use case is player analysis. | ✓ |
| Squad → Squad & Transfers | Opens on squad/transfer view. | |
| You decide | Claude picks. | |

**User's choice:** Analyse → Gem Ratings (unchanged from current)

---

## Claude's Discretion

- Internal state model: flat `activeTab` with section lookup vs nested `{ section, subTab }` — Claude picks whichever fits the existing page.tsx pattern cleanest.
- Sub-tab pill styling on mobile (active/inactive colours, border, background) — match existing dark-mode-aware Tailwind tokens in MobileNav.

## Deferred Ideas

None — discussion stayed within phase scope.
