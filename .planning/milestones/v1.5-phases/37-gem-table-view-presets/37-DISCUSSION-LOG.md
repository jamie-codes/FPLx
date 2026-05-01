# Phase 37: GemTable View Presets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 37-GemTable View Presets
**Areas discussed:** Default column set, Control placement, State persistence, Mobile behaviour

---

## Default Column Set

### Q1: Should Default hide the granular sub-scores to reduce noise?

| Option | Description | Selected |
|--------|-------------|----------|
| Default = curated | Hide 7 sub-score columns (FDR, Form, xG Sc, xA Sc, Own, Min, SP) — keeps curated action view | ✓ |
| Default = current full view | Show everything, same as today — Default acts as a reset button | |
| You decide | Claude picks the column set | |

**User's choice:** Default = curated

### Q2: What does Analysis reveal on top of Default?

| Option | Description | Selected |
|--------|-------------|----------|
| xg_per90 + xa_per90 only | Two raw Understat stats — aligns literally with ROADMAP requirement | ✓ |
| All xG/xA (4 columns) | xg_per90, xa_per90, xg_score, xa_score | |
| Full analysis mode | Reveals all sub-scores — essentially current full desktop view | |

**User's choice:** xg_per90 + xa_per90 only

**Notes:** None — user accepted the recommended option for both questions.

---

## Control Placement

### Q1: Where does the preset toggle live?

| Option | Description | Selected |
|--------|-------------|----------|
| Same sticky bar, left of GwToggle | `[PositionFilter] ··· [Default\|Compact\|Analysis] [1GW\|3GW\|5GW]` — no extra row | ✓ |
| Separate row above table | Own row below sticky bar — more breathing room but adds vertical space | |

**User's choice:** Same sticky bar, left of GwToggle

### Q2: Visual style for the preset toggle?

| Option | Description | Selected |
|--------|-------------|----------|
| Match GwToggle style | Same segmented button group (border + rounded + filled active state) | ✓ |
| Lighter variant | Text tabs with underline active indicator | |

**User's choice:** Match GwToggle style

---

## State Persistence

### Q1: Where should preset state live to survive tab switches?

| Option | Description | Selected |
|--------|-------------|----------|
| Lift to page.tsx | Add `gemPreset` to page.tsx state, pass as prop — mirrors Phase 36 sectionMemory | ✓ |
| sessionStorage in GemTable | Read/write sessionStorage on change — no prop threading but browser API coupling | |
| React context | GemPresetContext wrapping the app — overkill for one value | |

**User's choice:** Lift to page.tsx

---

## Mobile Behaviour

### Q1: Should preset toggle appear on mobile?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide on mobile | Mobile uses MOBILE_HIDDEN_COLUMNS — no room, no benefit | ✓ |
| Show on mobile, affects expanded row | Compact hides expanded row details, Analysis adds xg/xa to expanded row | |

**User's choice:** Hide on mobile

---

## Claude's Discretion

- Exact prop name for preset (`preset` / `viewPreset` / `gemPreset`)
- Whether to introduce a `type ViewPreset` alias in a shared file or inline it
- Whether to extract a `PresetToggle` sub-component or keep it inline

## Deferred Ideas

None — discussion stayed within phase scope.
