# Phase 47: Fixture Swing Detector & Clean Sheet Probability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 47-Fixture-Swing-Detector-CS-Probability
**Areas discussed:** Swing Threshold & Squad Highlight, Swing Calculation Location, Swing Panel Placement, CS% Display Surface

---

## Swing Threshold & Squad Highlight

### Swing Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 0.20 delta (recommended) | Meaningful shift in typical 0.0–1.0 ease range | ✓ |
| 0.15 — more sensitive | Catches smaller swings; more false positives | |
| 0.25 — more conservative | Only dramatic schedule changes; fewer signals | |

**User's choice:** 0.20 — keep as spec'd

---

### Team Cap

| Option | Description | Selected |
|--------|-------------|----------|
| 4+4 (recommended) | Concise — 8 rows max; signal stays meaningful | ✓ |
| Top-3 each direction | Even tighter; only extreme swings | |
| No cap | 0–10 teams depending on gameweek; variable | |

**User's choice:** 4+4 — keep as spec'd

---

### SWG-04 Squad Highlight Style

| Option | Description | Selected |
|--------|-------------|----------|
| Badge count + expand (recommended) | "You own N" badge + expandable inline player list; reuses TARGET expand pattern | ✓ |
| Top-of-panel alert strip | Separate "Your squad alerts" section above main table | |
| Highlight row only | Visual highlight (border/background); no player list | |

**User's choice:** Badge count + expand — reuse existing TARGET expand pattern from FixtureEaseRankingPanel
**Notes:** Confirmed this reuses the exact existing interaction from FixtureEaseRankingPanel.tsx

---

## Swing Calculation Location

### Computation Layer

| Option | Description | Selected |
|--------|-------------|----------|
| Pure TypeScript (recommended) | Extend computeClubForm() with past_ease from finished=true fixtures | ✓ |
| Python pipeline | Add past_ease_Ngw + swing_Ngw to pipeline output; pre-computed | |

**User's choice:** Pure TypeScript
**Notes:** No pipeline changes needed beyond cs_prob_1gw. Consistent with chip-strategy-engine.ts, xgi.ts patterns.

---

### Past Window Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed at 3 GWs always (recommended) | Swing = upcoming_N_ease - past_3_ease; GwToggle changes only upcoming | ✓ |
| Symmetric — past matches upcoming toggle | past_1/3/5 computed to match selected horizon; more complexity | |

**User's choice:** Fixed past window (3 GWs always)

---

## Swing Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New section on Club Form tab (recommended) | Below existing FixtureEaseRankingPanel; no nav changes | ✓ |
| Extend FixtureEaseRankingPanel | Add "Swing" mode to existing ATT/DEF toggle | |
| New Analyse sub-tab | First-class nav entry; adds nav complexity | |

**User's choice:** New section on Club Form tab
**Notes:** Fixture-related content stays co-located. No nav changes required.

---

## CS% Display Surface

### Surface Location

| Option | Description | Selected |
|--------|-------------|----------|
| cs_prob_1gw column in GemTable (recommended) | GK/DEF rows show %; MID/FWD show em-dash; DGW combined CS% | ✓ |
| CS panel on Club Form tab | Team-level CS% panel; separate from player table | |
| Both (column + panel) | Most complete; two surfaces to build | |

**User's choice:** GemTable column

---

### Column Visibility Default

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden by default, in Analysis preset (recommended) | Avoids cluttering default table; discoverable via preset | ✓ |
| Visible by default for all positions | Always shown; MID/FWD get em-dash; immediately discoverable | |
| Separate GK/DEF filter view | Only visible when position filter is GK or DEF | |

**User's choice:** Hidden by default, in Analysis preset

---

## Claude's Discretion

None — all gray areas were explicitly decided by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
