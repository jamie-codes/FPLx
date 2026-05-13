# Phase 102: MC Gate Activation & MCDistributionBar Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 102-mc-gate-activation-mcdistributionbar-display
**Areas discussed:** MCDistributionBar design, Gate flip mechanism, Captain card P10/P90 layout

---

## MCDistributionBar Design

### Q1 — Visual format

| Option | Description | Selected |
|--------|-------------|----------|
| Visual range bar | Horizontal Tailwind CSS bar showing P10–P90 range as a coloured strip with a marker for expected value; supplements/replaces text rows | ✓ |
| Text rows extracted | Keep existing Blank%/Haul%/Floor/Ceiling text rows as-is but move them into a named MCDistributionBar component | |
| Text rows + compact bar | Keep text rows AND add a compact coloured strip above them | |

**User's choice:** Visual range bar

---

### Q2 — Content of bar

| Option | Description | Selected |
|--------|-------------|----------|
| Bar only — labels on bar | P10 and P90 as end-labels; Haul% amber when ≥40%; Blank% omitted (implied by floor). Keeps hover card compact | ✓ |
| Bar + text rows above | Keep Blank%/Haul%/Floor/Ceiling text rows, add bar beneath as visual summary | |
| You decide | Let planner choose most compact layout for w-44 hover card | |

**User's choice:** Bar only — labels on bar (P10/P90 end-labels, Haul% amber when ≥40%, Blank% not shown)

---

### Q3 — Placement relative to existing text rows

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the text rows | Remove existing Blank%/Haul%/Floor/Ceiling rows (columns.tsx lines 141–163) and render MCDistributionBar in their place | ✓ |
| Below the text rows | Keep text rows AND add bar beneath | |

**User's choice:** Replace the text rows — MCDistributionBar is the sole MC display

---

## Gate Flip Mechanism

### Q1 — How to flip mc_enabled

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline code patch | Add `MC_ENABLED = True` constant in run.py; replace sticky gate read. Version-controlled, permanent | ✓ |
| Direct Blob edit | One-time manual update of production accuracy_backtest.json. Invisible out-of-band state change | |
| Conditional env var | Read MC_ENABLED from environment variable. Adds env-var complexity for a one-way permanent flip | |

**User's choice:** Pipeline code patch

---

### Q2 — Write to summary block

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — write to summary | Preserve existing pattern; accuracy_backtest.json summary includes mc_enabled: true after flip | ✓ |
| No — just the code constant | Hardcode constant in run.py only; skip summary field | |

**User's choice:** Yes — write mc_enabled: true to accuracy_backtest.json summary

---

## Captain Card P10/P90 Layout

### Q1 — Display format

| Option | Description | Selected |
|--------|-------------|----------|
| Inline range after pts | Append to pts display: "8.2 pts (C) · 4.1–18.1". Single line, no new layout | ✓ |
| New sub-line | Second line: "P10: 4.1  P90: 16.3" in zinc-400. Clearer label but taller card | |
| Reuse MCDistributionBar | Drop full MCDistributionBar into captain card row | |

**User's choice:** Inline range after pts — `"8.2 pts (C) · 4.1–18.1"` format

---

### Q2 — Raw vs doubled values

| Option | Description | Selected |
|--------|-------------|----------|
| Raw from pipeline | Show P10/P90 as base points (not doubled). Consistent with merged_players.json and xPts hover card | ✓ |
| Doubled (captain pts) | Show P10×2 and P90×2 to match "pts (C)" context | |

**User's choice:** Raw pipeline values — consistent with hover card and merged_players.json

---

## Claude's Discretion

- Bar colour scheme — use colours consistent with existing Tailwind tokens; amber for Haul% (matching existing `haulProb >= 0.40` path in columns.tsx)
- MCDistributionBar bar height and exact padding — fit within w-44 (176px) hover card
- Test strategy — cover render/no-render guards and gate-off degradation; captain card: P10/P90 display and fallback

## Deferred Ideas

- `blank_prob` display — omitted from MCDistributionBar (implied by P10 floor); revisit if confusing in production
- MCDistributionBar reuse in CaptainPicksPanel — chose inline text range instead; revisit on captain card redesign
- `fragile_transfer_pct` monitoring in data_health.json (Phase 104 ROADMAP note) — deferred to v1.19
