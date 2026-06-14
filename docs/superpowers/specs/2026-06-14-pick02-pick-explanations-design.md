# PICK-02: Deterministic Pick Explanations ("why / what could go wrong")

**Feature ID:** PICK-02
**Date:** 2026-06-14
**Status:** Approved

---

## Goal

For each Weekly Picks player, surface a plain-language **"Why the model rates him"** + **"What could make this wrong"** summary, derived deterministically from existing fields. Builds trust and makes the picks actionable. **Annotation only — it does NOT change any ranking** (the picks list stays ranked by mean xPts, exp04-validated; this just explains it). Because it's descriptive, not predictive, it needs no lab validation.

## Why deterministic (not LLM)

Instant, free, every player, unit-testable, no API/latency/PII. The repo's LLM prose (NLP-01) is a separate richer surface; PICK-02 is a fast per-player rule-based annotation.

## `src/lib/explain-pick.ts` (pure)

```ts
import type { MergedPlayer } from '@/lib/types'
export interface PickExplanation { reasons: string[]; risks: string[] }
export function explainPick(p: MergedPlayer): PickExplanation
```

Rule-based; each rule emits a short string *with its supporting number* when it fires. Order by salience; cap **reasons ≤ 4, risks ≤ 3**. All thresholds are HEURISTIC presentation cutoffs (documented constants), not model parameters — they describe, they don't rank. Verify exact field names against `src/lib/types.ts` before use; guard every optional with `?? 0` / presence checks.

**Reasons** (fire when present & above cutoff, salience order):
- `xg_per90 >= 0.45` → `"Strong goal threat (xG {xg_per90}/90)"`
- `xa_per90 >= 0.30` → `"Creator (xA {xa_per90}/90)"`
- mean of next ≤3 `fixtures[].difficulty_score` `<= 0.4` → `"Favourable fixtures"`
- `mins_risk === 'nailed'` (or `start_prob >= 0.9`) → `"Nailed starter"`
- `penalties_order === 1` → `"On penalties"`; else `direct_freekicks_order === 1 || corners_and_indirect_freekicks_order === 1` → `"Set-piece taker"`
- `bonus_ev >= 0.8` → `"Bonus magnet ({bonus_ev} EV)"`
- `xPts_components_1gw.defcon >= 0.5` → `"DefCon points likely"`
- `differential_flag === 'diff'` → `"Genuine differential ({selected_by_percent}% owned)"`
- `haul_prob >= 0.30` → `"High ceiling (haul {haul_prob*100|0}%)"`

**Risks** (salience order):
- `status !== 'a'` → `"{Doubtful|Injured|Suspended|Unavailable}{: news if present}"` (maps `d/i/s/u/n`)
- `mins_risk in ('rotation_risk','cameo')` or `rotation_risk === true` → `"Rotation risk"`
- mean next-fixture `difficulty_score >= 0.66` → `"Tough fixtures"`
- `mins_60_prob` present and `< 0.6` → `"May not complete 60 mins"`
- `blank_prob >= 0.45` → `"High blank risk ({blank_prob*100|0}%)"`
- `differential_flag === 'trap'` → `"Template trap ({selected_by_percent}% owned, low projection)"`
- season `minutes` present and `< 270` → `"Limited minutes sample"`

If nothing fires (rare), `reasons` falls back to `["Ranked on overall xPts"]`; `risks` may be empty (UI shows "No major flags").

## `src/components/weekly-picks/PickExplain.tsx`

Presentational, UIX tokens only. Two compact stacked lists: reasons each prefixed with a positive ✓ (`text-positive`), risks with a ⚠ (`text-warning`); `text-data`, numbers `.tabular`. Empty risks → muted "No major flags". Props: `{ explanation: PickExplanation }` (or `{ player }` and call `explainPick` inside — implementer's choice; keep the lib pure and the component thin).

## Integration

Render `<PickExplain>` inside `WeeklyPicksTab`'s `ExpandedPanel` (the expandable row), below the existing component bars + `MCDistributionBar`. Both 1GW and 3GW expand rows. No change to ranking, columns, or any other surface. (Optionally reusable in the gem-table expand later — out of scope now.)

## Testing

- `explain-pick.test.ts`: a strong-xG nailed easy-fixture player → reasons include xG / nailed / fixtures; a doubtful rotation-risk tough-fixture player → risks include those; penalties_order=1 → "On penalties"; caps respected (≤4 / ≤3); empty-ish player → fallback reason + empty risks; numbers formatted.
- `PickExplain.test.tsx`: renders reason/risk lists with the right tone classes; empty risks → "No major flags".
- WeeklyPicksTab test: expanded row contains the explain block (extend the existing expand test).
- Grep gate (zero raw palette in new files); full vitest; tsc 0; contrast 30; e2e 65.

## Out of scope

- LLM-generated narrative (NLP-01 exists separately)
- Any ranking/selection change (annotation only)
- Surfacing on gem-table / other tabs (future, trivial reuse)
