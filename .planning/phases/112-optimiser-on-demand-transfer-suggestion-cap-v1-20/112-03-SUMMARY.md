---
phase: 112
plan: "03"
subsystem: transfers
tags: [fpl, transfers, ui, react, tdd, tfr-02, cap, footnote]
dependency_graph:
  requires:
    - "src/lib/cap-transfer-suggestions.ts (capByPosition + CappedSuggestions — Plan 01)"
  provides:
    - "src/components/transfers/TransferPanel.tsx (ocsSuggestions capped via capByPosition(3))"
    - "src/components/transfers/OpportunityCostTable.tsx (totalsByPosition prop + per-position footnote rendering)"
  affects:
    - "TransferPanel highOwnershipAbsent memo (now operates on capped ocsSuggestions — by design)"
tech_stack:
  added: []
  patterns:
    - "Destructured useMemo return shape: { ocsSuggestions, ocsTotalsByPosition }"
    - "Optional React prop for backward-compat (totalsByPosition?: Map<number, number>)"
    - "Array.from(Map.entries()).sort().filter().map() for deterministic footnote rendering"
    - "TDD RED→GREEN: test first, implement to pass"
key_files:
  created: []
  modified:
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/TransferPanel.tsx
    - src/components/transfers/OpportunityCostTable.test.tsx
decisions:
  - "totalsByPosition prop is optional on OpportunityCostTable — preserves backward-compat for any caller omitting it (Test 4 proves this)"
  - "POSITION_LABELS declared at module scope to avoid per-render re-creation"
  - "Footnote block inserts after </table> and before onlyRoll paragraph — consistent with plan spec"
  - "highOwnershipAbsent continues to read from capped ocsSuggestions (desired: user sees what is actually surfaced)"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-05-15"
  tasks: 2
  files_created: 0
  lines: 100
---

# Phase 112 Plan 03: TransferPanel TFR-02 Cap + OpportunityCostTable Footnote Summary

**One-liner:** TransferPanel wraps `suggestTransfers` output in `capByPosition(3)` and forwards `totalsByPosition` to `OpportunityCostTable`, which renders a per-position `'Showing top 3 of N {POS} suggestions.'` footnote for each truncated bucket.

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/components/transfers/OpportunityCostTable.tsx` | +18 / 0 removed | Added `totalsByPosition` prop, `POSITION_LABELS` const, footnote rendering block |
| `src/components/transfers/TransferPanel.tsx` | +16 / -4 | Added `capByPosition` import; replaced `ocsSuggestions` useMemo with destructured `{ocsSuggestions, ocsTotalsByPosition}`; forwarded `totalsByPosition` prop |
| `src/components/transfers/OpportunityCostTable.test.tsx` | +66 added | 4 new Phase 112 TFR-02 tests in new `describe` block |

## 4 New Test Cases (RED→GREEN)

1. **renders cap-footnote-MID when totalsByPosition.get(3) > 3** — `totalsByPosition={new Map([[3, 7]])}` → `cap-footnote-MID` renders with text `'Showing top 3 of 7 MID suggestions.'`
2. **renders separate footnotes for each position whose pre-cap total > 3** — DEF=5, MID=8, FWD=3 → DEF and MID footnotes render; FWD footnote absent (3 is not > 3)
3. **renders NO footnotes when every bucket is <= 3 (D-07 silent)** — GK=1, DEF=3, MID=3, FWD=2 → zero `cap-footnote-*` elements
4. **renders NO footnotes when totalsByPosition is undefined (backward-compat)** — prop omitted entirely → zero `cap-footnote-*` elements

## TDD Gate Compliance

| Gate | Commit | Subject |
|------|--------|---------|
| RED | 77f09c9 | `test(112-03): add failing tests for OpportunityCostTable truncation footnote` |
| GREEN | 05b925b | `feat(112-03): cap transfer suggestions per position in OCS panel (TFR-02)` |

RED confirmed: Tests 1 and 2 failed before implementation (prop did not exist; assertions on non-null footnote returned null). Tests 3 and 4 passed at RED — acceptable per plan spec (those test the "absent/silent" branches which are already no-ops before implementation).

GREEN confirmed: All 17 OpportunityCostTable tests pass (15 existing + 4 new Phase 112 TFR-02 tests).

## Engine Non-Modification Confirmation (D-05 Invariant)

`src/lib/suggest-transfers.ts` was NOT modified. `src/lib/opportunity-cost.ts` was NOT modified. Both engine tests remain green (64 tests). The cap is applied post-engine in the `TransferPanel.tsx` `useMemo` — the engine output is unchanged.

`git diff --stat HEAD~2 HEAD -- src/lib/suggest-transfers.ts src/lib/opportunity-cost.ts` returns empty (zero changes).

## highOwnershipAbsent Behavior After Cap

`highOwnershipAbsent` at TransferPanel.tsx continues to compute from `ocsSuggestions` — which is now the **capped** list (by design). A high-ownership player who was in the engine's raw output but was capped out will now appear in the high-ownership-absent callout. This is the intended behavior per CONTEXT.md: "the user sees what we actually surface" — the cap-footnote-{POSITION} transparency note gives users context about what was omitted.

## Note for /gsd-verify-work

**TFR-02 user-perceptible verification on Transfers tab:** Load a squad with > 3 mid-priced MID candidates in `scoredPlayers` (typical Wednesday-morning state). Open Squad → Transfers sub-tab. Expected behavior:
- OCS table renders normally with at most 3 rows per element_type bucket (subject to existing row-kind grouping logic)
- Below the OCS table, a paragraph reads `'Showing top 3 of N MID suggestions.'` (and similarly for any other truncated position bucket)
- When the engine's raw output is naturally short (all position buckets ≤ 3 candidates), NO footnote appears at all (silent mode)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, no auth paths, no file access patterns, no schema changes. The `totalsByPosition` Map values are derived from the same FPL bootstrap data as the existing OCS rows; the defensive fallback `POSITION_LABELS[pos] ?? pos` prevents crashes on unexpected element_type keys (T-112-08 mitigation).

## Self-Check: PASSED

- `src/components/transfers/OpportunityCostTable.tsx` contains `totalsByPosition?: Map<number, number>`: CONFIRMED
- `src/components/transfers/OpportunityCostTable.tsx` contains `POSITION_LABELS`: CONFIRMED
- `src/components/transfers/OpportunityCostTable.tsx` contains `cap-footnote-`: CONFIRMED
- `src/components/transfers/OpportunityCostTable.tsx` contains `Showing top 3 of`: CONFIRMED
- `src/components/transfers/OpportunityCostTable.tsx` contains `text-xs text-zinc-500 dark:text-zinc-400 mt-1`: CONFIRMED
- `src/components/transfers/TransferPanel.tsx` contains `import { capByPosition }`: CONFIRMED
- `src/components/transfers/TransferPanel.tsx` contains `capByPosition(raw, 3)`: CONFIRMED
- `src/components/transfers/TransferPanel.tsx` contains `ocsTotalsByPosition`: CONFIRMED
- `src/components/transfers/TransferPanel.tsx` contains `totalsByPosition={ocsTotalsByPosition}`: CONFIRMED
- Engine file `src/lib/suggest-transfers.ts` UNCHANGED: CONFIRMED
- Engine file `src/lib/opportunity-cost.ts` UNCHANGED: CONFIRMED
- Commit 77f09c9 (test/RED): CONFIRMED
- Commit 05b925b (feat/GREEN): CONFIRMED
- All 17 OpportunityCostTable tests pass: CONFIRMED
- Engine tests (64 tests): CONFIRMED GREEN
