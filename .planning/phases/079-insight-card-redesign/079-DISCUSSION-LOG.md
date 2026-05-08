# Phase 79: Insight Card Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 079-insight-card-redesign
**Areas discussed:** Data model restructure, Signal badge assignment, Decision Summary chips, Section state

---

## Data Model Restructure

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the pipeline | Pipeline emits new fields: title, metric_value, metric_label, takeaway, action_hint, benchmark_value, gw_coverage, player_ids, team_ids. Clean and reliable. | ✓ |
| Client-side derivation | Parse existing `statement` string client-side. Fragile, depends on consistent phrasing. | |
| Static enrichment layer | TS mapping file hand-annotating each insight `id`. No pipeline changes, but requires manual authoring for every pattern. | |

**User's choice:** Extend the pipeline
**Notes:** Current `Insight` type has only `statement` as a flat sentence with embedded numbers. New structured fields must come from the pipeline, which already has access to all the relevant data at generation time.

---

## Signal Badge Assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Category × confidence rules | Thresholds vary by category: player + high conf = Hidden gem; defensive + low conf = Regression risk; attacking + low conf = Trap risk. Logic in pipeline. | ✓ |
| New pipeline `signal_type` field | Hand-authored `signal_type` per insight `id`. Explicit but requires maintaining a mapping for every pattern. | |
| Confidence thresholds only | Simple >70% / 55–70% / <55% bands. Trap risk / Regression risk / Hidden gem never appear. | |

**User's choice:** Category × confidence rules
**Notes:** Allows the 6 semantic labels to all appear naturally without manual annotation, while keeping logic centralized in the pipeline.

---

## Decision Summary Player/Team Chips

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline adds entity fields | Each insight gets `player_ids: list[int]` and `team_ids: list[int]`. Decision Summary uses top 3 highest-signal insights with non-empty entity lists. | ✓ |
| Parse from statement text | Client-side regex extracts names from `statement`. Fragile, requires name → ID lookup. | |
| Separate pipeline output | Pipeline writes `decision_summary.json` independently of insight cards. | |

**User's choice:** Pipeline adds entity fields
**Notes:** Simplest for the client; pipeline already has full player/team data at generation time.

---

## Section Collapsibility State

| Option | Description | Selected |
|--------|-------------|----------|
| Component state — reset on navigate | React useState. Sections open by default. Zero complexity. | ✓ |
| localStorage — persist across sessions | Survive tab switches and page reloads. ~20 lines of persistence logic. | |

**User's choice:** Component state — reset on navigate
**Notes:** Simplest approach; the sections are informational, not workflow state. Resetting on navigate is fine.

---

## Claude's Discretion

- Exact confidence threshold boundaries within the category × confidence signal label matrix (approximate values given; Claude tunes ±3pp based on data distribution)
- Whether `<details>/<summary>` or a JS toggle is used for hover/expand methodology
- Deduplication strategy for Priority Insights vs. category sections (show in both vs. exclude from category)
- Chevron icon choice for collapse toggle
- Mini progress bar dimensions and benchmark line styling
- Whether player/team chip names are embedded in pipeline output vs. cross-referenced from merged player data client-side

## Deferred Ideas

None — discussion stayed within phase scope.
