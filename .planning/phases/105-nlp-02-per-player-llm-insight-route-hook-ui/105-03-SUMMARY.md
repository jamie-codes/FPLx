---
phase: 105
plan: "03"
subsystem: nlp
tags: [nlp, llm, anthropic, vitest, wave-2, integration, player-insight]
dependency_graph:
  requires:
    - "105-01: RED-phase test scaffolding"
    - "105-02: route handler, hook, PlayerInsightSection component"
  provides:
    - "GemTable mobile + desktop expand rows render PlayerInsightSection after ComparisonSearch"
    - "TransferPanel threads gw={nextGw} to OpportunityCostTable"
    - "OpportunityCostTable threads gw to PlayerMoveCell; PlayerInsightSection rendered below FragilityBadge for buy candidates"
    - "DecisionSummaryTab passes gw={nextGw ?? 0} to OpportunityCostTable (auto-fixed)"
    - "NLP-02 feature fully wired end-to-end"
  affects:
    - "src/components/transfers/TransferPanel.tsx"
    - "src/components/transfers/OpportunityCostTable.tsx"
    - "src/components/gem-table/GemTable.tsx"
    - "src/components/squad/DecisionSummaryTab.tsx (Rule 3 auto-fix)"
    - "src/components/transfers/OpportunityCostTable.test.tsx"
tech_stack:
  added: []
  patterns:
    - "gw prop threading through component hierarchy (TransferPanel → OCT → PlayerMoveCell)"
    - "insightGw = (lastGwActualGwN ?? 0) + 1 GW derivation in GemTable component scope"
    - "vi.mock of PlayerInsightSection in OCT test; vi.mocked().mock.calls inspection for prop threading assertion"
key_files:
  created: []
  modified:
    - src/components/transfers/TransferPanel.tsx
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/OpportunityCostTable.test.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/squad/DecisionSummaryTab.tsx
decisions:
  - "OCT test 'gw prop threaded' assertion uses vi.mocked().mock.calls[0][0].gw check rather than toHaveBeenCalledWith because expect.anything() does not match undefined second arg in Vitest"
  - "DecisionSummaryTab fix passes gw={nextGw ?? 0} — uses existing nextGw const at line 249, ?? 0 fallback for pre-squad-load state"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-13"
  tasks: 3
  files: 5
---

# Phase 105 Plan 03: Wave 2 UI Integration Summary

Wave 2 wires `PlayerInsightSection` into the two production surfaces: GemTable row expand and TransferPanel OpportunityCostTable buy-candidate cells. The `gw` number is threaded from `TransferPanel.nextGw` through `OpportunityCostTable` and `PlayerMoveCell`. GemTable derives `insightGw` from `lastGwActualGwN ?? 0 + 1`. All Wave 0 test stubs flip GREEN. TypeScript compiles cleanly. Phase 105 NLP-02 is fully wired end-to-end. A human UAT checkpoint is pending for Vercel env key and Anthropic spending cap before merge.

## Files Modified and Line Counts

| File | Lines Changed | Description |
|------|--------------|-------------|
| `src/components/transfers/OpportunityCostTable.tsx` | +22 / -5 | Import PlayerInsightSection; gw prop in interface + PlayerMoveCell; render in PlayerMoveCell |
| `src/components/transfers/TransferPanel.tsx` | +1 / -0 | Add gw={nextGw} to OpportunityCostTable invocation |
| `src/components/transfers/OpportunityCostTable.test.tsx` | +55 / -12 | Replace 3 it.todo stubs with live tests; add PlayerInsightSection mock; add gw to all test invocations |
| `src/components/gem-table/GemTable.tsx` | +21 / -0 | Import PlayerInsightSection; insightGw const; two insertions in expand rows |
| `src/components/squad/DecisionSummaryTab.tsx` | +1 / -0 | Rule 3: add missing gw prop to OCT invocation |

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Thread gw through TransferPanel → OCT → PlayerMoveCell; insert PlayerInsightSection | e20e9c9 | TransferPanel.tsx, OpportunityCostTable.tsx, OpportunityCostTable.test.tsx |
| 2 | Insert PlayerInsightSection into GemTable mobile + desktop expand rows | 2512992 | GemTable.tsx |
| 3 (gate) | Full test-suite phase gate + TypeScript clean + Rule 3 fix | f31bc28 | DecisionSummaryTab.tsx |
| 4 | checkpoint:human-verify — Vercel env + Anthropic spending cap | PENDING | (external systems) |

## RED→GREEN Test Transitions

| Test | File | Wave |
|------|------|------|
| gw prop is threaded to PlayerMoveCell — PlayerInsightSection rendered with gw=35 | OCT.test.tsx | Wave 2 |
| PlayerInsightSection absent on roll rows | OCT.test.tsx | Wave 2 |
| PlayerInsightSection present on buy-candidate rows | OCT.test.tsx | Wave 2 |
| PlayerInsightSection rendered in mobile expand row | GemTable.test.tsx | Wave 2 |
| PlayerInsightSection rendered in desktop expand row | GemTable.test.tsx | Wave 2 |
| does not fire mutate on expand (no useEffect trigger) | GemTable.test.tsx | Wave 2 |

**6 Wave 0 stubs flipped GREEN in Wave 2** (3 OCT + 3 GemTable).

## Full Test Suite Results

```
Test Files  5 passed (5)   [Phase 105 NLP-02 files only]
Tests       43 passed (43)
```

Full repo run: `101 passed | 4 failed` — all 4 failing files are **pre-existing failures** (listed in STATE.md deferred items):
- `tests/lib/captain-picks.test.ts` — TEST-57 (pre-existing, deferred)
- `tests/lib/club-form.test.ts` — pre-existing
- `src/components/nav/MobileNav.test.tsx` — WR-03/04 (pre-existing, deferred)
- `src/lib/hooks/useRivals.test.ts` — pre-existing

No new failures introduced by this wave.

## TypeScript `tsc --noEmit` Output

```
(empty — zero errors)
```

## Manual UAT Checkpoint (Task 4) — PENDING

Task 4 is a `checkpoint:human-verify` requiring manual verification of:
- **Step A:** `ANTHROPIC_API_KEY` present in Vercel Production env, no `NEXT_PUBLIC_ANTHROPIC_API_KEY` leak
- **Step B:** Anthropic Console monthly spending cap configured (recommended USD 50/month)
- **Step C (optional):** Smoke-test "Get AI insight" button in dev environment

Merge must be blocked until both Step A and Step B are confirmed.

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| `grep -c "import { PlayerInsightSection }" src/components/transfers/OpportunityCostTable.tsx` → 1 | PASS |
| `grep -c "gw: number" src/components/transfers/OpportunityCostTable.tsx` → ≥2 | PASS (2) |
| `grep -c "<PlayerInsightSection" src/components/transfers/OpportunityCostTable.tsx` → 1 | PASS |
| `grep -c "gw={nextGw}" src/components/transfers/TransferPanel.tsx` → ≥1 | PASS (1) |
| `grep -c "import { PlayerInsightSection }" src/components/gem-table/GemTable.tsx` → 1 | PASS |
| `grep -c "const insightGw" src/components/gem-table/GemTable.tsx` → 1 | PASS |
| `grep -c "<PlayerInsightSection" src/components/gem-table/GemTable.tsx` → 2 | PASS |
| `grep -c "gw={insightGw}" src/components/gem-table/GemTable.tsx` → 2 | PASS |
| `grep -rn "runtime = 'edge'" src/app/api/player-insight/` → 0 | PASS |
| `grep -rn "NEXT_PUBLIC_ANTHROPIC" src/` → 0 | PASS |
| `grep -c "allowOverwrite: true" src/app/api/player-insight/route.ts` → 1 | PASS |
| All Phase 105 NLP-02 tests GREEN (43/43) | PASS |
| TypeScript clean | PASS |
| Manual UAT (Step A + B) | PENDING |

## NLP-02 Success Criteria Coverage

| SC | Description | Status |
|----|-------------|--------|
| SC1 | `<PlayerInsightSection>` rendered in GemTable expand rows (mobile + desktop) | PASS |
| SC2 | `<PlayerInsightSection>` rendered in TransferPanel buy-candidate rows only (not roll rows) | PASS |
| SC3 | gw prop threaded correctly to each insertion site | PASS |
| SC4 | No Edge runtime, no NEXT_PUBLIC_ANTHROPIC leak, allowOverwrite: true | PASS |
| SC5 | ANTHROPIC_API_KEY in Vercel Production env; Anthropic Console monthly spending cap | PENDING (human UAT) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DecisionSummaryTab missing required gw prop**
- **Found during:** Task 3 (tsc --noEmit)
- **Issue:** `DecisionSummaryTab.tsx` invokes `<OpportunityCostTable>` without the new required `gw` prop. TypeScript reported: `Property 'gw' is missing in type ... but required in type 'OpportunityCostTableProps'`
- **Fix:** Added `gw={nextGw ?? 0}` using the existing `nextGw` const at line 249
- **Files modified:** `src/components/squad/DecisionSummaryTab.tsx`
- **Commit:** f31bc28

**2. [Rule 1 - Bug] OCT test: toHaveBeenCalledWith with expect.anything() fails for undefined second arg**
- **Found during:** Task 1 test run
- **Issue:** Vitest's `expect.anything()` does not match `undefined`. The mocked React component receives `(props, undefined)` where the second arg (forwardRef context) is `undefined`. `expect.anything()` fails the match.
- **Fix:** Replaced with explicit `vi.mocked().mock.calls.find(call => call[0].gw === 35)` pattern
- **Files modified:** `src/components/transfers/OpportunityCostTable.test.tsx`
- **Commit:** e20e9c9

## Deferred Items

| ID | Description | Target |
|----|-------------|--------|
| PROMPT-CACHE | `cache_control: ephemeral` on NLP-02 system prompt | v1.19+ (defer until prompt > 1024 tokens) |
| NLP-BATCH | Pipeline pre-generation of top-20 player insights | v1.19+ (defer until on-demand latency proves unacceptable) |

## Threat Flags

None — Wave 2 modifies only presentation wiring. No new network endpoints, no new auth paths, no new schema changes.

## Self-Check: PASSED
