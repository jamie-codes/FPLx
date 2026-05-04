# Phase 59: Manual Transfer Planner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 59-Manual Transfer Planner
**Areas discussed:** GW steps & horizon, Transfer entry UX, No-squad behavior, Squad snapshot layout

---

## GW Steps & Horizon

### Q1: How does the manual planner start — fixed GW steps or user-driven?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed horizon (1/3/5 toggle) | Same HorizonSelector as the AI planner — opens with N blank GW steps | ✓ |
| Dynamic steps (add one at a time) | Starts with 1 GW step; user taps '+ Add GW' to extend | |
| Fixed 5 steps, no toggle | Always shows 5 GW steps | |

**User's choice:** Fixed horizon (1/3/5 toggle)

---

### Q2: When the user changes the horizon toggle, what happens to transfers already entered?

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate (drop steps beyond new horizon) | Shrinking discards steps beyond new cap | ✓ |
| Preserve all (show/hide extra steps) | Steps hidden but not deleted | |
| Prompt before truncating | Confirmation dialog if transfers would be lost | |

**User's choice:** Truncate

---

### Q3: What does the break-even calculation use for the xPts delta?

| Option | Description | Selected |
|--------|-------------|----------|
| 1-GW xPts (fixed) | Always uses xPts_1gw: 4 ÷ (xPts_1gw_in − xPts_1gw_out) | |
| Tied to horizon toggle | Uses xPts_Ngw matching current horizon | |
| Per-step horizon (each step uses 1GW) | Same as option 1 in practice | |

**User's choice:** You decide (Claude's discretion)

---

## Transfer Entry UX

### Q1: How does the user add a transfer to a GW step?

| Option | Description | Selected |
|--------|-------------|----------|
| Button → PlayerPickerModal (reuse existing) | '+ Add Transfer' opens existing PlayerPickerModal | ✓ |
| Inline row editor | Two dropdowns inline in the GW step row | |
| Drag-and-drop | Drag players from a pool onto the squad | |

**User's choice:** Button → PlayerPickerModal

---

### Q2: How many transfers can the user add per GW step?

| Option | Description | Selected |
|--------|-------------|----------|
| Unlimited (including hit transfers) | No cap; hit cost computed automatically | ✓ |
| Cap at 2 per step | 2-transfer max | |
| Cap at free transfers only | Only allow up to FT bank | |

**User's choice:** Unlimited

---

### Q3: Does the manual planner include a chip toggle per GW step?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — same ChipToggle as AI planner | Each step has chip selector | ✓ |
| No chips — transfers only | Skip chip toggles | |

**User's choice:** Yes — same ChipToggle

---

## No-squad Behavior

### Q1: If no squad is loaded, can the user still use the manual planner?

| Option | Description | Selected |
|--------|-------------|----------|
| Require squad — show prompt if none loaded | Accessible but shows 'Load your squad first' prompt | ✓ |
| Allow draft mode (no squad) | Open with £0 bank and empty starting squad | |
| Disable tab until squad is loaded | Sub-tab greyed out / unclickable | |

**User's choice:** Require squad — show prompt

---

## Squad Snapshot Layout

### Q1: How is the 15-player squad snapshot displayed per GW step?

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible accordion (collapsed by default) | Expand/collapse toggle per step — reuses SquadSnapshotRow | ✓ |
| Always visible inline | Always shown below each step's transfer row | |
| Separate snapshot panel | Clicking a step opens a full-width panel | |

**User's choice:** Collapsible accordion, collapsed by default

---

### Q2: What does the plan summary row show?

| Option | Description | Selected |
|--------|-------------|----------|
| Summary header: total hits + hit cost + break-even | Above GW steps: "Hits: N \| Hit cost: −N pts \| Avg break-even: N.N GWs" | ✓ |
| Summary footer only | Below all GW steps | |
| Inline per step only | Each step shows its own hit cost; no aggregate row | |

**User's choice:** Summary header above GW steps

---

## Claude's Discretion

- Break-even formula uses 1-GW xPts fixed: `4 ÷ (xPts_1gw_in − xPts_1gw_out)` — simplest, consistent with OCS (Phase 50)
- Exact column layout within summary header row
- Loading/error/empty states within GW step rows
- Mobile column hiding strategy for squad snapshot rows
- Exact localStorage serialization schema for plan steps

## Deferred Ideas

- Phase 60 TRT-05 bridge ("Load into Manual Planner") — Phase 60 adds this; no Phase 59 changes needed
- Wildcard squad builder mode (build full 15 from scratch) — out of scope for v1.9
- Export/share plan — out of scope for v1.9
