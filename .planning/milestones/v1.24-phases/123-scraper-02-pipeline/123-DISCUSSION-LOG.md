# Phase 123: SCRAPER-02 Pipeline — Discussion Log

**Date:** 2026-05-18
**Workflow:** discuss-phase (default mode)

## Areas Discussed

All four gray areas were selected by user.

### 1. Player Matching

**Options presented:**
- Fuzzy surname match (rapidfuzz token_sort_ratio ≥ 85)
- Exact surname + first-initial fallback
- LLM-assisted matching

**Selected:** Fuzzy surname match
**Notes:** Unmatched → element_id = null. Reuse Phase 117 normalization pattern.

### 2. Article Classification

**Options presented:**
- Rule-based keyword matching
- LLM batch classification (like batch_insights.py)

**Selected:** Rule-based keywords
**Notes:** Deterministic, zero cost per run. Keyword sets defined per classification class.

### 3. IS_OFF_SEASON Gate Scope

**Options presented:**
- Transfer news runs; GW steps skip
- Everything skips in off-season
- User-defined per-step flag

**Selected:** Transfer news runs; GW steps skip
**Notes:** transfer_news.py is explicitly not GW-dependent and most valuable in off-season.

### 4. Hook staleTime

**Options presented:**
- 6h (match pipeline cadence)
- 1–2h (shorter)
- 24h (daily)

**Selected:** 6h — match pipeline cadence
**Notes:** Consistent with useLineupNews. No benefit to polling more frequently than pipeline runs.

## Decisions Summary

| ID | Decision |
|----|----------|
| D-01 | rapidfuzz token_sort_ratio ≥ 85; unmatched → element_id = null |
| D-02 | Reuse Phase 117 name normalization |
| D-03 | Rule-based keyword classification at parse time |
| D-04 | Deterministic classification, zero cost |
| D-05 | transfer_news.py runs year-round; IS_OFF_SEASON only skips GW-dependent steps |
| D-06 | IS_OFF_SEASON = not any(e.get('is_current') for e in events) |
| D-07 | useTransferNews staleTime = 6h |
| D-08 | Route Handler follows gw-intel artifact pattern |
