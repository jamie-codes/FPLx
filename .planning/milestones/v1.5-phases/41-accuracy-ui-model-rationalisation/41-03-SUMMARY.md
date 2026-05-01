# Plan 41-03 Summary — Model Rationalisation (ACC-06)

**Status:** COMPLETE  
**Commits:** `8baf8dc` (partial removal) + `4a54334` (sweep complete)

## What Was Done

Plan 03 delivered two tasks:

### Task 1 — Hit-Rate Review & Model Selection
- Ran `python pipeline/run.py` to generate `pipeline/cache/accuracy_backtest.json`
- Presented live per-GW hit rates for both models (GWs 30-34)
- User confirmed: remove **proj_pts** (9.0% hit rate), keep **xPts** (16.7%)
- Decision written to `41-03-DECISION.md`

### Task 2 — proj_pts Removal Sweep

Removed `proj_pts_1gw/3gw/5gw` from the entire codebase:

| Location | Change |
|----------|--------|
| `pipeline/merge.py` | Deleted `_proj_pts_ngw()` and all player dict assignments |
| `src/lib/types.ts` | Removed fields from `MergedPlayer`; updated comments |
| `src/lib/planning-engine.ts` | 4 callsites → `xPts_1gw ?? 0` |
| `src/lib/captaincy-engine.ts` | Filter + score calc → `xPts_1gw` |
| `src/lib/chip-strategy-engine.ts` | Removed from TC fallback chain |
| `src/lib/explain.ts` | → `xPts_1gw ?? 0` |
| `src/lib/replacement-shortlist.ts` | Filter + delta → `xPts_1gw ?? 0` |
| `src/components/planner/PlannerTab.tsx` | BB/TC bonus calc → `xPts_1gw ?? 0` |
| `src/components/planner/PlayerPickerModal.tsx` | Sort + display → `xPts_1gw ?? 0` |
| `src/components/transfers/TransferPanel.tsx` | Label "xPts (1 GW)", values → `xPts_1gw ?? 0` |
| 9 test fixture files | `proj_pts_*` → `xPts_*` throughout |

## Verification

- `npx tsc --noEmit` → 0 errors (5 pre-existing captain-picks errors excluded)
- `npx vitest run` → 418 passing, 1 pre-existing failure (club-form, unrelated)
- `grep -rn "proj_pts" src/ pipeline/merge.py` → 0 functional references (only guard assertions in GwToggle.test.ts)
