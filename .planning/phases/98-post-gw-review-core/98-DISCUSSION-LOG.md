# Phase 98: Post-GW Review Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 98-post-gw-review-core
**Areas discussed:** Auto-surface behavior, Auto-surface recurrence, Bench breakdown format

---

## Auto-surface behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-navigate | Switch to Squad > Review sub-tab on page load via setActiveSection/setActiveSubTab in useEffect | ✓ |
| Banner on current tab | Show amber banner linking to Review; user stays on current tab | |
| Both: navigate + banner | Auto-navigate AND show dismissable 'GW settled' tag on review card | |

**User's choice:** Auto-navigate

**Follow-up — no squad loaded:**

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate anyway | Go to Squad > Review regardless; existing empty-state handles no-squad case | ✓ |
| Skip if no squad | Only auto-navigate if submittedId already in localStorage | |
| You decide | Defer to executor | |

**User's choice:** Navigate anyway — lean on the existing GwReviewTab empty-state.

**Follow-up — where logic lives:**

| Option | Description | Selected |
|--------|-------------|----------|
| useEffect in page.tsx | Direct useEffect reads settled GW data, fires nav mutations where they already live | ✓ |
| Custom hook useAutoSurface | Encapsulated hook returns {shouldSurface, latestSettledGw}; page.tsx consumes | |
| You decide | Defer to executor | |

**User's choice:** useEffect in page.tsx

---

## Auto-surface recurrence

| Option | Description | Selected |
|--------|-------------|----------|
| Once per settled GW | Write localStorage flag per GW on auto-navigate; skip if same GW already seen | ✓ |
| Every visit until dismissed | Auto-navigate every visit; dismissable banner stores flag on explicit dismiss | |

**User's choice:** Once per settled GW

**Follow-up — when to write the flag:**

| Option | Description | Selected |
|--------|-------------|----------|
| On auto-navigate | Write flag immediately when useEffect fires the navigation | ✓ |
| On Review tab render | Write flag inside GwReviewTab on mount with valid selectedGw | |

**User's choice:** On auto-navigate

---

## Bench breakdown format

| Option | Description | Selected |
|--------|-------------|----------|
| Best scorer + total | 'Bench pts left' StatCard (existing) + new 'Best bench: Watkins — 11pts' info row | ✓ |
| Full bench breakdown | List all 4 bench players with individual points | |

**User's choice:** Best scorer + total

**Follow-up — placement:**

| Option | Description | Selected |
|--------|-------------|----------|
| Below stat grid as row | Third info row after 'Top scorer' and 'Captain' rows; existing row style | ✓ |
| Replace Bench pts StatCard | Combined stat card showing both total and top scorer | |

**User's choice:** Below stat grid as row

---

## Claude's Discretion

- `useSettledGws` stale time — suggest 1 hour
- Whether to use internal `/api/fpl/[...proxy]` or direct bootstrap fetch in `useSettledGws` — prefer proxy for consistency
- TDD test coverage scope for the PGW-04 auto-surface useEffect
- Settled GW criteria: `event.finished === true && event.data_checked === true` (both flags required)

## Deferred Ideas

None — discussion stayed within phase scope.
