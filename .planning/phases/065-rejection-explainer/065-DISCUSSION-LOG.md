# Phase 65: Rejection Explainer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 65-rejection-explainer
**Areas discussed:** GemTable expand trigger, Rejection logic scope, SquadView WHY-03 panel, WHY-02 callout placement

---

## GemTable Expand Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Enable expand everywhere | Change getRowCanExpand to () => true; click any row to toggle inline | ✓ |
| Add a "Why?" button column | New column at right with per-row button; keeps row click free of side effects | |
| Hover tooltip on desktop only | Popover on hover for desktop, keep mobile action-sheet; not great for multi-line explanations | |

**User's choice:** Enable expand everywhere (recommended)
**Notes:** Desktop expand shows why-not explanation only (hidden columns already visible). Mobile adds why-not panel below existing action-sheet + hidden column data.

| Option | Description | Selected |
|--------|-------------|----------|
| Why-not explanation only | Desktop expand shows only rejection reasons | ✓ |
| Why-not + positive reasons | Both rejection and positive signals in desktop expand | |
| You decide | Claude decides layout | |

**User's choice:** Why-not explanation only (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Add why-not to mobile expand too | WHY-01 requires "any GemTable row"; panel added below existing mobile action-sheet | ✓ |
| Desktop only | Keep mobile expand exactly as-is | |

**User's choice:** Add why-not to mobile expand too (recommended)

---

## Rejection Logic Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All rows, adaptive framing | Panel always shows; rejection reasons for weak players, "No rejection signals — ranked #X" for strong | ✓ |
| All rows, rejection-only | Lists rejection factors for every player including high-ranked ones | |
| Below-threshold only | Panel only for players ranked below position average | |

**User's choice:** All rows, adaptive framing (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| 1-GW xPts | Rank within position by xPts_1gw; matches GemTable default sort | ✓ |
| gem_score | Rank by composite gem_score; harder to explain to users | |
| Active GW horizon | Match current GwToggle horizon (1/3/5 GW); adds complexity | |

**User's choice:** 1-GW xPts (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Computed inside rejection function | Pass allPlayers to computeRejection(); derives rank internally | ✓ |
| Pre-computed rank passed as prop | GemTable computes positionRanks useMemo and passes down | |

**User's choice:** Computed inside rejection function (recommended)

---

## SquadView WHY-03 Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Add rejection section to ExplainPanel | New rejectionReasons prop; renders below positive reasons | ✓ |
| Show rejection only | Replace positive reasons with rejection signals | |
| You decide | Claude decides balance of positive and rejection content | |

**User's choice:** Add rejection section to ExplainPanel (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add captain rejection to row expand | Names top candidate; "Ranked #X at MID — [Name] is the captain pick" | ✓ |
| No — only hold/sell rejection | Captain picking already covered by CaptaincyPanel | |
| You decide | Claude decides | |

**User's choice:** Yes — add captain rejection (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Thread from TransferPanel | verdicts + captaincyCandidates already exist as useMemo; no duplicate computation | ✓ |
| Compute inside ExplainPanel | Pass allPlayers + picks to ExplainPanel; duplicates computation | |

**User's choice:** Thread from TransferPanel (recommended)

---

## WHY-02 Callout Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Above transfer suggestions | Between Load Squad form and OpportunityCostTable | ✓ |
| Below transfer suggestions | Appended after transfer table as "also worth noting" | |
| Inline with the table | Special row in opportunity cost table | |

**User's choice:** Above transfer suggestions (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| One reason: xPts gain insufficient | For non-squad absent players: "xPts gain vs your [position] options is negative" | ✓ |
| Full rejection signals | Run computeRejection(); 1-2 signals | |
| Squad-owned only | Only callout for players user already owns | |

**User's choice:** One reason: xPts gain insufficient (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Top 3 by ownership% | Cap at 3 highest-owned absent players | ✓ |
| All qualifying players | Show all ≥20% ownership absent from candidates | |
| Configurable / show more | Top 3 + "N more" expand link | |

**User's choice:** Top 3 by ownership% (recommended)

---

## Claude's Discretion

- Component name for WHY-02 callout section
- Whether `computeRejection` lives in `src/lib/explain.ts` or new `src/lib/rejection.ts`
- Exact threshold for "weak" vs "strong" framing in adaptive mode
- Precise string formatting for rank labels

## Deferred Ideas

None — discussion stayed within phase scope.
