# Phase 43: Lineup Engine & Navigator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 43-lineup-engine-navigator
**Areas discussed:** Panel layout, Squad default sub-tab, Formation display, Squad data access

---

## Panel Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Pitch layout | Visual football field with players positioned by formation. GK bottom, attack top. CSS grid/positioning. | ✓ |
| Position-group rows | GK/DEF/MID/FWD rows with xPts per player, mirrors SquadView.tsx pattern. Faster to build. | |

**User's choice:** Pitch layout
**Notes:** FPL convention orientation — GK at bottom. No SVG, CSS only.

---

## Squad Default Sub-tab

| Option | Description | Selected |
|--------|-------------|----------|
| Transfers | Preserves existing muscle memory — Squad has always landed on the transfer view. | ✓ |
| Optimiser | Leads with the new feature. Better for showcasing the new capability. | |

**User's choice:** Transfers
**Notes:** User explicitly navigates to Optimiser. Existing TransferPanel UX is preserved as the landing.

---

## Formation Display

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show formation label | Formation badge near top of panel (e.g. "Formation: 4-3-3"). Makes the auto-selection clear. | ✓ |
| No — implicit from grouping | Position grouping makes formation clear without a label. Simpler. | |

**User's choice:** Show formation label
**Notes:** Formation label displayed above the pitch, inline with the horizon selector.

---

## Squad Data Access

| Option | Description | Selected |
|--------|-------------|----------|
| Lift Team ID to page.tsx | Team ID state moves to page.tsx. Both sub-tabs share squad picks via props. User enters once. | ✓ |
| Optimiser has its own Team ID input | OptimiserPanel independently prompts. No refactor but user enters Team ID twice. | |
| Shared React context | New SquadContext. TransferPanel writes, OptimiserPanel reads. More idiomatic but adds provider. | |

**User's choice:** Lift Team ID to page.tsx
**Notes:** TransferPanel refactored to accept teamId as prop (controlled component). Mild page.tsx refactor required.

---

## Claude's Discretion

- Exact CSS pitch layout (CSS Grid with player circles, no SVG)
- Formation enum: standard FPL formation set (3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1)
- OptimiserHorizon type (1|3|5) and 3-button pill toggle (mirrors GwToggle, not HorizonSelector)
- BGW exclusion via `xPts_1gw === 0` proxy
- (C)/(VC) text labels for captain/VC display
- BGW amber warning banner placement (above pitch)
- Player circle visual style and typography

## Deferred Ideas

- Formation preference picker (user-locked formation) — already in REQUIREMENTS.md Future Requirements
- Player locking (must-start pins) — already in REQUIREMENTS.md Future Requirements
- Captain swap what-if simulation — already deferred
- Pitch orientation toggle (portrait vs landscape) — not needed for v1.6
