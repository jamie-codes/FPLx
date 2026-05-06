---
phase: 074-transfer-engine-overhaul
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/lib/opportunity-cost.ts
  - src/lib/opportunity-cost.test.ts
  - src/lib/suggest-transfers.ts
  - src/lib/suggest-transfers.test.ts
  - src/lib/types.ts
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/components/squad/DecisionSummaryTab.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 074: Code Review Report (Re-Review After Plan 05 Gap Closure)

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is a re-review of Phase 74 (Transfer Engine Overhaul) after the plan-05 gap-closure pass. All seven previously filed findings were verified against the submitted code.

Gap-closure verification (prior findings):

- **CR-01** (-8 Hit row missing when ftCount=1): CLOSED. `comboForHit8 = best2FTCombo ?? best2FTHit` at `opportunity-cost.ts:163`. Three CR-01 unit tests cover the fallback path.
- **CR-02** (freeTransfers not wired into unauthenticated derivedFtCount in TransferPanel): CLOSED in `TransferPanel.tsx:87-96`. `freeTransfers >= 2 ? 2 : 1` branch present; `freeTransfers` in the dependency array.
- **WR-01** (badgeFor omits combo-hit from marginal branch): CLOSED. `OpportunityCostTable.tsx:70` now checks `row.kind === 'combo-free' || row.kind === 'combo-hit'`.
- **WR-03** (combo-hit isMarginal compared raw xPtsGain not xPtsGainNet): CLOSED. `opportunity-cost.ts:131` uses `(best2FTHit.xPtsGain - 4) < MARGINAL_THRESHOLD`.
- **WR-04** (redundant inner sell2.id===sell1.id guard inside buy2 loop): CLOSED. Exactly one occurrence remains at the outer j-loop guard (line 189); the inner occurrence is gone.
- **IN-01** (duplicate __tests__/opportunity-cost.test.ts): CLOSED. Only `src/lib/opportunity-cost.test.ts` exists.
- **IN-03** (Submit button in TransferPanel had two transition tokens): CLOSED in `TransferPanel.tsx:269` — now uses single `transition` token.

Two new critical issues and three new warnings/info items are surfaced below. All are new findings not addressed by the gap-closure pass.

---

## Critical Issues

### CR-01: DecisionSummaryTab.derivedFtCount Ignores freeTransfers — Hard-codes 1 for All Unauthenticated Users

**File:** `src/components/squad/DecisionSummaryTab.tsx:213-218`

**Issue:** `DecisionSummaryTab` maintains its own copy of the `derivedFtCount` logic, documented as "verbatim from TransferPanel.tsx lines 87-92", but the CR-02 fix was applied only to `TransferPanel`. The unauthenticated branch in `DecisionSummaryTab` unconditionally returns `1`:

```typescript
// DecisionSummaryTab.tsx lines 213-218 — NOT updated with CR-02 fix
const derivedFtCount: 1 | 2 = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return 1   // always 1, no user input
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return 1
  return myTeamData.entry_history.event_transfers === 0 ? 2 : 1
}, [isAuthenticated, myTeamData, squadData])
```

Unlike `TransferPanel`, `DecisionSummaryTab` has no `freeTransfers` state and no corresponding input field. Every unauthenticated user of the Decision Summary tab sees engine output computed with `ftCount=1` — the 2FT row always shows a cost:4 hit combo, the -8 Hit row is always derived from the cost:4 fallback, and no affordability calculation reflects a 2-FT week.

The Transfer Options card in this tab explicitly notes "Using 1 free transfer (default)" for the unauthenticated case (`line 573`), which is technically truthful but not adjustable by the user — the TransferPanel allows adjustment via the Free Transfers input, while DecisionSummaryTab provides no equivalent control.

**Fix:** Add a `freeTransfers` state (mirroring `TransferPanel`) and apply the same unauthenticated branch logic. If the tab intentionally always uses 1 FT (design decision), the comment "verbatim from TransferPanel" must be corrected to document the intentional divergence and the "Using 1 free transfer (default)" label must be made non-editable by design:

```typescript
// Option A: add state + branch (mirrors TransferPanel)
const [freeTransfers, setFreeTransfers] = useState<number>(1)

const derivedFtCount: 1 | 2 = useMemo(() => {
  if (!isAuthenticated || !myTeamData) {
    return (freeTransfers >= 2 ? 2 : 1) as 1 | 2
  }
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return 1
  return myTeamData.entry_history.event_transfers === 0 ? 2 : 1
}, [isAuthenticated, myTeamData, squadData, freeTransfers])
```

---

### CR-02: manualBank Input Accepts Sub-Tenth Values That Are Silently Rounded by the Engine

**File:** `src/components/transfers/TransferPanel.tsx:248-257`

**Issue:** The bank balance input has `step={0.1}` but no rounding on its `onChange` handler:

```typescript
onChange={e => setManualBank(Math.max(0, Number(e.target.value)))}
```

A user who types `5.35` stores `5.35` in state. The engine call at line 113 converts with `Math.round(5.35 * 10)`. Due to IEEE 754 representation, `5.35 * 10 = 53.50000000000001`, which rounds correctly to `54`. However, a value like `0.05` stores `0.05`; `Math.round(0.05 * 10) = Math.round(0.5) = 1` (browser-dependent: some round 0.5 up, some to even). More critically, the user typed "£0.05m" but the UI displays `0.05` while the engine receives `1` (£0.1m) — a silent 2x inflation of the available budget that can cause transfers to be marked affordable when they should not be.

The `min={0}` and `max={20}` HTML attributes are advisory only and do not prevent typed values outside that range. The `step={0.1}` attribute guides the browser's increment/decrement arrows but does not prevent keyboard entry of arbitrary precision.

**Fix:** Clamp and round on change to the nearest 0.1:

```typescript
onChange={e => {
  const raw = Number(e.target.value)
  setManualBank(Math.round(Math.max(0, raw) * 10) / 10)
}}
```

This ensures the stored float always has at most one decimal place, making the `Math.round(manualBank * 10)` conversion in the engine call exact.

---

## Warnings

### WR-01: combo-hit-8 Row Has No isMarginal Field — Marginal Badge Never Shown for -8 Hit Option

**File:** `src/lib/opportunity-cost.ts:169-184` and `src/components/transfers/OpportunityCostTable.tsx:69-72`

**Issue:** The `combo-hit-8` row pushed at line 169 does not include an `isMarginal` field. The `badgeFor` function (fixed by WR-01 in the prior review) now checks `combo-free` and `combo-hit`, but `combo-hit-8` is still excluded:

```typescript
// opportunity-cost.ts lines 169-184: no isMarginal on combo-hit-8
rows.push({
  kind: 'combo-hit-8',
  xPtsGainNet: comboForHit8.xPtsGain - 8,
  // isMarginal: not set
  ...
})

// OpportunityCostTable.tsx line 70: combo-hit-8 not in the check
if ((row.kind === 'combo-free' || row.kind === 'combo-hit') && row.isMarginal === true)
```

A -8 Hit option with `xPtsGain=8.3` (net 0.3 xPts after deducting 8 points) would display a plain red "Hit" badge with no "Marginal — verify" warning. The -8 Hit case has the highest risk of any row and is the most important one to flag as marginal.

**Fix:**

```typescript
// opportunity-cost.ts — inside the combo-hit-8 push
isMarginal: (comboForHit8.xPtsGain - 8) < MARGINAL_THRESHOLD,

// OpportunityCostTable.tsx
function badgeFor(row: OCSRow): BadgeConfig {
  if (
    (row.kind === 'combo-free' || row.kind === 'combo-hit' || row.kind === 'combo-hit-8') &&
    row.isMarginal === true
  ) return MARGINAL_BADGE
  return BADGE_BY_KIND[row.kind]
}
```

---

### WR-02: DecisionSummaryTab Always Uses Public squadData.entry_history.bank — Ignores Authenticated Bank

**File:** `src/components/squad/DecisionSummaryTab.tsx:232, 238`

**Issue:** Both the `suggestTransfers` call (line 232) and `computeOpportunityCostRows` call (line 238) use `squadData.entry_history.bank` exclusively:

```typescript
bank: squadData.entry_history.bank,   // line 232

computeOpportunityCostRows(ocsSuggestions, derivedFtCount, squadData?.entry_history.bank ?? 0),   // line 238
```

When authenticated, `myTeamData` is available and `myTeamData.entry_history.bank` reflects the authenticated API's bank balance (which is also the source `TransferPanel` uses via `useEffect → manualBank`). The public squad endpoint may lag or differ from the authenticated value. For authenticated users, the Decision Summary tab could show different affordability results than the Transfer tab because it is using a different bank source.

**Fix:**

```typescript
const effectiveBank = (isAuthenticated && myTeamData)
  ? myTeamData.entry_history.bank
  : squadData?.entry_history.bank ?? 0

// then use effectiveBank in both useMemos
```

---

### WR-03: TFX-03 Test Uses Engine-Impossible Suggestion Set (cost:4 single with ftCount=2)

**File:** `src/lib/opportunity-cost.test.ts:84-95`

**Issue:** The test "returns Roll + 1FT + 2FT + −4 Hit + −8 Hit when both single and combo suggestions present" calls `computeOpportunityCostRows` with `ftCount=2` but injects a `makeSingle({ cost: 4 })` suggestion. The engine (`suggest-transfers.ts:157-168`) only emits cost:4 singles when `ftCount===1`. The test therefore exercises the mapper against a combination the engine will never produce:

```typescript
const suggestions: TransferSuggestion[] = [
  makeSingle({ ..., cost: 0, ... }),
  makeSingle({ ..., cost: 4, ... }),    // engine never emits this when ftCount=2
  makeCombo({ ..., cost: 0, ... }),
]
const rows = computeOpportunityCostRows(suggestions, 2, 100)   // ftCount=2 but cost:4 single present
```

A future refactor that strips hit rows when `ftCount=2` (architecturally correct behaviour) would cause this test to fail with no actual regression. The test asserts a 5-row output whose existence depends on incoherent input, not real engine behaviour.

**Fix:** Change to `ftCount=1` to match the scenario where both free and hit singles coexist, or split into two tests: one for the realistic `ftCount=1` 5-row case and one for the realistic `ftCount=2` 3-row case (Roll, single-free, combo-free, combo-hit-8):

```typescript
// Realistic ftCount=1 test (engine emits both cost:0 and cost:4 singles)
it('ftCount=1: returns Roll, single-free, single-hit, combo-hit, combo-hit-8 (5 rows)', () => {
  const suggestions = [
    makeSingle({ sellId: 1, buyId: 2, cost: 0, xPtsGain: 3.0, xPtsGainPerGw: 3.0 }),
    makeSingle({ sellId: 3, buyId: 4, cost: 4, xPtsGain: 5.0, xPtsGainPerGw: 5.0 }),
    makeCombo({ ids: [5, 6, 7, 8], cost: 4, xPtsGain: 6.0, xPtsGainPerGw: 6.0 }),
  ]
  const rows = computeOpportunityCostRows(suggestions, 1, 100)
  expect(rows.map(r => r.kind)).toEqual(
    expect.arrayContaining(['roll', 'single-free', 'single-hit', 'combo-hit', 'combo-hit-8']),
  )
})
```

---

## Info

### IN-01: DecisionSummaryTab Submit Button Has Duplicate Transition Tokens (Not Fixed by IN-03 Pass)

**File:** `src/components/squad/DecisionSummaryTab.tsx:475`

**Issue:** The Load Squad submit button in `DecisionSummaryTab` still uses the same double-transition pattern that was fixed in `TransferPanel.tsx` (prior IN-03):

```
className="... transition-colors cursor-pointer active:scale-95 transition-transform w-full sm:w-auto"
```

The `TransferPanel` fix applied `transition` (single shorthand) on its submit button, but the identical button in `DecisionSummaryTab` was left unchanged.

**Fix:** Match the fixed `TransferPanel` pattern:

```
className="... transition cursor-pointer active:scale-95 w-full sm:w-auto"
```

---

### IN-02: Scaffold Test Remains in Production Test File

**File:** `src/lib/opportunity-cost.test.ts:71-73`

**Issue:** The test `it('scaffold loads', () => { expect(true).toBe(true) })` was never removed after initial scaffolding. It passes trivially and inflates the test count without providing coverage. It will never detect a regression.

**Fix:** Delete the three-line scaffold test block.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
