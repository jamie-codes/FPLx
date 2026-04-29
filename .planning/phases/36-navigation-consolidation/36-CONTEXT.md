# Phase 36: Navigation Consolidation - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the flat 8-tab navigation with a 3-section hierarchy on both desktop and mobile. The three sections are Analyse (Gem Ratings, Insights, DefCon Analysis, Set Pieces), Plan (Planner, Club Form, Value Gems), and Squad (Squad & Transfers — no sub-tabs). No new content is added; this phase is purely navigation restructuring.

</domain>

<decisions>
## Implementation Decisions

### Desktop Nav Structure
- **D-01:** Two-tier bar — a section row on top (Analyse / Plan / Squad) with the same border-b underline style as the current tab bar; clicking a section renders a second row immediately below showing that section's sub-tabs (also border-b underline style).
- **D-02:** When Squad is the active section, the sub-tab row is hidden entirely — content renders directly below the section bar with no empty second row.

### Mobile Nav Structure
- **D-03:** Bottom bar shows 3 section buttons (replacing the current 8). A second fixed row of pills sits immediately above the bottom bar, showing the active section's sub-tabs. Squad section shows no pill row above the bar. Both rows are fixed at the bottom of the viewport.
- **D-04:** Sub-tab pill labels use abbreviated names matching the existing MobileNav convention: Analyse → Gems | Insights | DefCon | SP; Plan → Planner | Form | Values.

### Sub-tab State
- **D-05:** Each section remembers the last visited sub-tab within the session. Returning to Analyse after visiting Squad restores the previously active Analyse sub-tab (e.g. Insights), not the first sub-tab.
- **D-06:** Default landing state is Analyse → Gem Ratings — unchanged from current behaviour.

### Claude's Discretion
- How to model the section + sub-tab state internally (flat `activeTab` with lookup vs nested `{ section, subTab }` object) — Claude picks whichever fits cleanest with the existing page.tsx pattern.
- Sub-tab pill styling on mobile (active vs inactive colours, border, background) — match existing dark-mode-aware Tailwind tokens already in MobileNav.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Navigation (NAV-01 through NAV-05) — locked requirements; these define the exact groupings and mobile expectation

### Existing Navigation Code
- `src/app/page.tsx` — current desktop tab buttons and `activeTab` state; all changes land here
- `src/components/nav/MobileNav.tsx` — current mobile bottom bar; needs section restructuring

### Cross-cutting Constraint (from Phase 33 history)
- The `Tab` type union is duplicated in `src/app/page.tsx` and `src/components/nav/MobileNav.tsx` — both files must be updated atomically whenever the Tab type changes (Phase 33 Pitfall 3 precedent)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MobileNav` component: already handles fixed bottom positioning, dark-mode tokens, 44px tap targets, `aria-current` — the section row can reuse this structure
- All 8 content components are already imported in `page.tsx` and rendered by tab condition — no content changes needed, just re-wiring tab keys to sub-tab state

### Established Patterns
- `hidden sm:flex` / `sm:hidden` CSS-only breakpoint split is the existing desktop/mobile show-hide pattern — preserve this; no JS media-query detection needed
- `aria-current="page"` on active tab button is the existing accessibility pattern — apply to both section and sub-tab buttons
- `active:scale-95 transition-transform` is the existing mobile tap-feedback class — reuse on section buttons

### Integration Points
- `page.tsx` owns `activeTab` state and passes it to `MobileNav`; after restructuring it will own `activeSection` + per-section last sub-tab memory (or equivalent)
- `MobileNav` receives active tab and change handler — props signature will change; this is the only call site

</code_context>

<specifics>
## Specific Ideas

No specific references cited during discussion — open to standard Tailwind/React approaches consistent with the existing codebase style.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 36-Navigation Consolidation*
*Context gathered: 2026-04-29*
