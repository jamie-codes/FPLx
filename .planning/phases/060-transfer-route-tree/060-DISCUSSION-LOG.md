# Phase 60: Transfer Route Tree - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 60-Transfer Route Tree
**Areas discussed:** Greedy continuation rule, Route Tree placement, Bridge confirm behavior, Mobile path layout

---

## Greedy Continuation Rule

### Q1: How many transfers per GW step?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 transfer per GW | Simple and predictable; each GW buys the best available player for a free position | |
| Spend all available FTs | If bank = 2, make 2 transfers; more aggressive | |
| 0 or 1 — skip if no gain | Only transfer when there's a positive xPts delta; some steps may be blank | ✓ |

**User's choice:** 0 or 1 — skip if no gain

---

### Q2: FT banking when a GW is skipped

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — bank up to 2 FTs | Use computeNextFTState from free-transfer-engine.ts as-is | ✓ |
| No — always cap at 1 FT per step | Simpler tree; ignores banking | |

**User's choice:** Yes — bank up to 2 FTs (use computeNextFTState as-is)

---

### Q3: How to pick sell roots

| Option | Description | Selected |
|--------|-------------|----------|
| Lowest xPts_1gw per position | Bottom 1 per position = 4 candidates; pick 3 with lowest absolute xPts | ✓ |
| Lowest xPts across full horizon | Use xPts_3gw or xPts_5gw for worst players over full window | |
| Worst xPts gain from any single transfer | Top 3 by highest potential improvement = sell roots | |

**User's choice:** Lowest xPts_1gw across squad (bottom 3 regardless of position)

---

### Q4: Two-FT spending rule

| Option | Description | Selected |
|--------|-------------|----------|
| Both only if each has positive xPts gain | 2 transfers only when both individually improve xPts | ✓ |
| Always spend both banked FTs | If bank = 2, always make 2 transfers | |

**User's choice:** Both only if each has positive xPts gain

---

## Route Tree Placement

### Q1: Where should Route Tree live?

| Option | Description | Selected |
|--------|-------------|----------|
| New Plan sub-tab — 'Route Tree' | 6th sub-tab alongside Planner, Manual Plan, etc. | ✓ |
| Embedded in Manual Plan tab | 'Generate Routes' panel or button at top of Manual Plan | |
| Embedded in Planner tab | Below AI planner output as alternative paths | |

**User's choice:** New Plan sub-tab — 'Route Tree'

---

### Q2: Label and position in sub-tab bar

| Option | Description | Selected |
|--------|-------------|----------|
| Route Tree \| after Manual Plan | Order: Planner \| Manual Plan \| Route Tree \| Club Form \| Value Gems \| Rivals | ✓ |
| Transfer Tree \| at the end | Treated as supplementary tool at the end | |
| Routes \| after Manual Plan | Shorter label for mobile | |

**User's choice:** Route Tree after Manual Plan

---

### Q3: Horizon state sharing

| Option | Description | Selected |
|--------|-------------|----------|
| Share section-level horizon | One HorizonSelector controls all Plan sub-tabs | ✓ |
| Own horizon per sub-tab | Route Tree has its own independent HorizonSelector | |

**User's choice:** Share section-level horizon

---

## Bridge Confirm Behavior

### Q1: Existing plan overwrite behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm dialog, then overwrite + navigate | Brief inline warning if plan has steps | ✓ |
| Silent overwrite + auto-navigate | No confirmation; immediate write + switch | |
| Open Manual Plan tab first, let user decide | Navigate, then show banner | |

**User's choice:** Confirm dialog (inline on button) if existing plan has steps, then overwrite + navigate

---

### Q2: What does the bridge write?

| Option | Description | Selected |
|--------|-------------|----------|
| Transfers + horizon; chip defaults to null | User sets chips manually in Manual Plan after loading | ✓ |
| Transfers + horizon + chip from active chip mode | Carries tree's chip assumption into Manual Plan | |

**User's choice:** Transfers + horizon; chip = null per step

---

## Mobile Path Layout

### Q1: Summary table mobile adaptation

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal scroll | overflow-x-auto container; same as TransferPlanTable | ✓ |
| Stacked path cards | Each path = vertical card on mobile; side-by-side on md+ | |
| Tab strip to switch paths | One path visible at a time on mobile | |

**User's choice:** Horizontal scroll (overflow-x-auto)

---

### Q2: Expanded GW breakdown rows on mobile

| Option | Description | Selected |
|--------|-------------|----------|
| Stay inside the table — scroll with it | Expanded rows are table rows; scroll horizontally with parent | ✓ |
| Break out to full width | Expanded row takes full container width, stacks per path | |

**User's choice:** Stay inside the table

---

## Claude's Discretion

- Exact column headers for summary table
- Visual highlight style for recommended path (ring, background tint — follow existing app patterns)
- Whether "Load into Manual Planner" button is in summary row or below expanded breakdown
- Empty/no-squad state messaging
- Skeleton/loading state while tree computes

## Deferred Ideas

- LLM-generated branches (NLP-01) — v1.12
- Wildcard squad builder via Route Tree — out of v1.9 scope
- Save/favourite a route — v2.x scope
