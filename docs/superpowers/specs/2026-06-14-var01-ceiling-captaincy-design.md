# VAR-01: Ceiling-Led Captaincy Ranking

**Feature ID:** VAR-01 (promotion of the exp07 finding)
**Date:** 2026-06-14
**Status:** Approved
**Evidence:** `pipeline/experiments/exp07_captaincy_ranking.py` — ranking captaincy by analytical ceiling (xPts + 1.28σ) beat mean-xPts on mean-captain-points across all three splits (full 6.06→6.31, train 5.68→5.86, validation 6.90→7.30), with equal-or-higher captain-haul rate. Modest (~+0.25 pts/GW) but consistent. Captaincy ≠ picks: doubling one player rewards upside.

---

## Goal

Make the captaincy candidate ranking lead with **ceiling** instead of mean-xPts, resolving an existing inconsistency (the pipeline already surfaces a ceiling captain in `captain_picks.json`, and `eo-candidates.chase_rank` already sorts by `xPts_90th_1gw`, but `computeCaptaincyCandidates` — the Decision/Home/Transfers captaincy list — sorts by `xPts_1gw × 2`). Low-risk, no pipeline change.

## The ceiling signal

`xPts_90th_1gw` on the player (= `xPts_1gw + 1.28·σ` analytically; the MC `p90_pts` *overwrites* it when MC is enabled — so it is the best available ceiling, equal to or better than exp07's proxy). Fallback to `xPts_1gw` when `xPts_90th_1gw` is null/absent (pre-rollout / BGW).

## Changes

### `src/lib/captaincy-engine.ts` (keystone)
- `CaptaincyCandidate` gains `ceiling_pts: number` (the ranking basis = `xPts_90th_1gw ?? xPts_1gw`).
- Keep `projected_captain_pts = xPts_1gw * 2` (the honest *expected* return, still displayed).
- **Sort by `ceiling_pts` descending** (was `projected_captain_pts`). Tie-break by `projected_captain_pts` desc for stability.
- Docstring + a provenance comment: `// VAR-01 (exp07): captaincy ranks by ceiling — doubling one player rewards upside (validated GW7-38).`
- All existing filters unchanged (XI only, no GK, xPts_1gw>0, not injured). `captain_type` 'safe'/'upside' logic unchanged.

### Pool fallbacks (no-squad path) — align to ceiling
- `src/components/home/HomeTab.tsx` (~111-119) and `src/components/squad/DecisionSummaryTab.tsx` (~200-219): where they build a pool fallback candidate sorted by `xPts_1gw`, sort by `xPts_90th_1gw ?? xPts_1gw` instead, and populate `ceiling_pts`. Keep `projected_captain_pts = xPts_1gw*2`.

### Display coherence (so ceiling ordering is self-explanatory)
- `src/components/captaincy/CaptaincyPanel.tsx` (~87) and `DecisionSummaryTab.tsx` captain card (~579): alongside the existing "{projected_captain_pts} pts (C)", show the ceiling as the ordering basis — e.g. a muted "ceiling {ceiling_pts.toFixed(1)}" so a user sees why a slightly-lower-mean pick ranks first. Tokens only; `.tabular` on the numbers. Minimal — no layout overhaul.
- `ActionCards.tsx` (Home captain card) keeps showing `projectedPts` (mean×2) — no change needed; the ranking that *chose* the captain is now ceiling-based upstream.

### `src/lib/decision-severity.ts` — verify only
Uses `candidates[0]/[1].projected_captain_pts` ratio for HIGH/MED/LOW. Still valid (the top-2 are now ceiling-ranked but the ratio of their expected returns is still a sensible "is there a clear pick" signal). No change; confirm its test still passes.

## Testing

- **New `src/lib/captaincy-engine.test.ts`** (no existing test): candidates sorted by `ceiling_pts` not `projected_captain_pts` (construct two players where mean and ceiling disagree — higher-ceiling/lower-mean ranks first); `ceiling_pts` falls back to `xPts_1gw` when `xPts_90th_1gw` absent; GK/injured/XI filters still hold; `projected_captain_pts` still = xPts_1gw*2; tie-break stable.
- Existing consumer tests (CaptaincyPanel, DecisionSummaryTab, HomeTab, decision-severity, TransferPanel) stay green; update only assertions that pinned the old mean-sort ORDER (behaviour assertions on filters/values unchanged).
- Gates: grep gate on touched components (zero raw palette); full vitest; tsc 0; contrast 30; e2e 65.

## Out of scope

- MC `haul_prob`-based ranking (not reachable consistently client-side; ceiling is the validated, always-present signal)
- Pipeline `captain_picks.json` (already has a ceiling pick — unchanged)
- EO-adjusted / differential captaincy modes (separate concern; `eo-candidates` already ceiling-aware in chase_rank)
