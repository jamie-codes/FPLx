---
phase: 11
name: Explainability + Replacement Shortlist
status: context_complete
created: 2026-03-30
---

# Phase 11 Context: Explainability + Replacement Shortlist

## Phase Goal

Managers understand why each recommendation was made, can see structured risk flags per player,
and get a concrete replacement shortlist with projected points gain for Sell candidates.

## Requirements in Scope

- **EXP-01**: Natural-language "why this player" reasons per recommendation
- **EXP-02**: Risk flags per player (rotation concern, fixture swing, regression risk, poor form)
- **REC-02**: Replacement shortlist (3–5 alternatives with projected pts delta) for Sell candidates

## Canonical Refs

- `.planning/REQUIREMENTS.md` — EXP-01, EXP-02, REC-02 acceptance criteria
- `.planning/ROADMAP.md` — Phase 11 success criteria
- `src/lib/recommend.ts` — computeVerdicts, Verdict type, BUY/SELL thresholds
- `src/lib/transfer-engine.ts` — computeTransferSuggestions, SingleTransfer interface
- `src/lib/types.ts` — ScoredPlayer, MergedPlayer, FixtureEntry, MinsRisk types
- `src/components/squad/SquadView.tsx` — existing per-player row rendering
- `src/components/transfers/TransferPanel.tsx` — existing wiring pattern

---

## Decisions

### D-01: Explainability display — inline expand per row

Each player row in SquadView gets a click-to-expand panel. Clicking reveals reasons and (for
Sell players) the replacement shortlist. The expand is toggled per player independently.

**Not chosen:** tooltip on badge (reasons hidden), always-visible sub-line (too dense for
full signal set).

### D-02: Replacement shortlist inside the expanded row

For Sell-verdicted players, the expanded panel shows reasons first, then the replacement
shortlist below. Keeps all "why sell + what to do about it" context in one place.

**Not chosen:** separate Sell Candidates panel (duplicates player info), augmenting
transfer suggestion cards (different sort order, different scope).

### D-03: Reasons signal set

Show all applicable signals as natural-language sentences. No cap on count — show everything
that applies.

**Signals to use:**

| Signal | Positive phrasing | Negative phrasing |
|--------|-------------------|-------------------|
| `fdr_score` + `fixtures[]` | "Strong fixture run — N easy games next 5 GWs" | "Difficult fixtures — N hard games next 5 GWs" |
| `form_pts_per90` | "In form — X pts/90 last 5 GWs" | "Poor form — X pts/90 last 5 GWs" |
| `proj_pts_1gw` | "Projected X pts next GW" | (low projection is implicit in Sell verdict) |
| `start_prob` | "High start probability (X%)" | "Low start probability (X%)" |
| `xg_per90` | "High xG — X/90" | "Low xG — X/90" (when relevant) |
| `xa_per90` | "Creative — X xA/90" | — |
| `penalties_order === 1` | "Primary penalty taker" | — |
| `direct_freekicks_order === 1` | "Direct free-kick taker" | — |
| `corners_and_indirect_freekicks_order === 1` | "Corner/set piece taker" | — |
| `selected_by_percent` (low) | "Differential — X% owned" | — |

**Explicitly excluded:**
- `mins_risk` — already shown via MinsRiskBadge in the row
- `cost_change_start` — not surfaced as a reason

### D-04: Risk flags = negative reasons, no separate flag concept

EXP-02 risk flags (rotation concern, fixture swing, regression risk, poor form) are
implemented as negatively-phrased reasons in the same expand panel. No separate chip/badge
concept for flags. Example: "Poor form — 2.1 pts/90" IS the "poor form" risk flag.

**Not chosen:** separate labelled ⚠ flag chips at top of panel (would duplicate negative
reasons, adds UI complexity for no information gain).

### D-05: Replacement shortlist ranking

Shortlist alternatives ranked by **projected points delta** (`buy.proj_pts_1gw - sell.proj_pts_1gw`)
descending — not gem delta. This is the stated requirement (REC-02: "projected points delta").
Show 3–5 alternatives. Each entry shows: player name, team, projected pts gain (e.g. "+3.2 pts"),
affordability indicator.

### D-06: Architecture pattern — pure function + component

Following established phase patterns:
- New `computeExplanations(player: ScoredPlayer): string[]` pure function in `src/lib/`
- New `computeReplacementShortlist(sellPlayer, allPlayers, budget): ShortlistEntry[]` pure function
- New `ExplainPanel` component consumes both outputs
- SquadView receives expanded state (or manages it internally via local useState)
- TDD: tests written first for pure functions

---

## Deferred Ideas

None raised during discussion.

---

## Prior Decisions Carried Forward

- Computation separated from rendering: pure functions in `src/lib/`, components in `src/components/`
- Minimal UI: zinc palette, small badges, compact rows
- TDD approach: Vitest tests first, then UI wiring
- `ScoredPlayer` is the single data source — no new pipeline fields needed for this phase
