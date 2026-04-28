# Phase 33: Insights Tab — Discussion Log

**Date:** 2026-04-28
**Status:** Complete

## Areas Discussed

### 1. Insight Generation

| Question | Options | Selected |
|----------|---------|----------|
| Where does computation live? | Pipeline / Client-side / Hybrid | **Pipeline — persisted to insights.json** |
| How many insights shown? | Fixed ~10–15 / Dynamic (all passing gate) / Fixed categories | **Dynamic — all that pass the triviality gate** |

### 2. Confidence Weight Format

| Question | Options | Selected |
|----------|---------|----------|
| How expressed? | Percentage sentence / LOW/MED/HIGH tier / Both | **Both — tier badge + percentage in tooltip** |
| Minimum sample size? | 5 / 10 / 20 data points | **10 data points** |

### 3. Insight Categories & Triviality Gate

| Question | Options | Selected |
|----------|---------|----------|
| Which categories? | Defensive / Attacking / Player-specific / Captaincy | **All four** |
| INS-04 triviality gate? | Hardcoded exclusion list / Confidence-only / Threshold floor | **Hardcoded exclusion list** |

### 4. Tab Layout & Display

| Question | Options | Selected |
|----------|---------|----------|
| Display format? | Card list grouped / Flat list / Accordion | **Card list grouped by category** |
| Tab position? | After Set Pieces / After Planner / After Club Form | **After Set Pieces** |

## Deferred Ideas

None captured during this discussion.

## Claude's Discretion Items

- Exact wording of individual insight statements
- `insights.json` flat array vs wrapper object
- Order of insights within category (recommend descending confidence)
- Exact number of pattern computations in pipeline
