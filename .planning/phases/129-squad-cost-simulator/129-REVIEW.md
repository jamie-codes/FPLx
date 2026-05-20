---
phase: 129-squad-cost-simulator
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/app/api/pre-season-squad/route.test.ts
  - src/app/api/pre-season-squad/route.ts
  - src/components/next-season/NextSeasonPlannerTab.test.tsx
  - src/components/next-season/NextSeasonPlannerTab.tsx
  - src/lib/hooks/usePreSeasonSquad.ts
  - src/lib/types.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 129: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase adds a budget slider (COST-01), a `?include=inputs` query-param gate on the API (COST-02), and infeasibility/amber-track UI (COST-03). The overall architecture is sound: the API correctly gates the extra I/O, the `loadSquadInputs` helper correctly converts a `Map` to a plain `Record`, and the component reset effect on `data?.inputs` change is correct.

Two critical defects were found: a React controlled-input warning that will trigger in production (missing `onChange` on the slider alongside `value=`), and a `committedBudget` display bug where the infeasibility message can show a stale budget value. Four warnings cover a stale-closure hazard in the keyboard debounce handler, a missing `null` guard on `data?.squad`, an ambiguous `null`/`undefined` conflation in the `trackBackground` memo, and a module-level constant evaluated at import time that prevents `USE_BLOB` from being changeable via environment per test. Three informational items cover test-file patterns and dead code.

---

## Critical Issues

### CR-01: Controlled `<input>` missing `onChange` — React will throw a warning and the slider will not update correctly in React strict/production mode

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:289-307`

**Issue:** The `<input type="range">` element is rendered as a controlled component (`value={sliderValue}`) but has no `onChange` handler. React requires that every controlled input with a `value` prop also provides an `onChange` (or `readOnly`) prop. Without it React emits a console error in development and the input may become read-only or de-sync from React state in certain render paths. The existing `onInput` handler is not the same as React's synthetic `onChange` — `onInput` is a native DOM event listener that bypasses React's synthetic event system on some browsers and React does not recognise it as satisfying the `onChange` contract.

**Fix:**
```tsx
<input
  type="range"
  min={80}
  max={120}
  step={0.5}
  value={sliderValue}
  onChange={handleInput}   // ← add this
  onInput={handleInput}    // keep for immediate visual feedback if desired, or remove
  onPointerUp={handlePointerUp}
  onKeyUp={handleKeyUp}
  ...
/>
```
Alternatively, replace `onInput` with `onChange` throughout — they fire at the same moment for range inputs.

---

### CR-02: Infeasibility message uses `committedBudget` but slider displays `sliderValue` — values diverge during drag, producing a misleading error message

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:308-313`

**Issue:** The component maintains two separate state variables: `sliderValue` (visual position, updated on every `onInput`) and `committedBudget` (triggers squad recompute, updated only on `pointerUp` / keyboard debounce). The infeasibility paragraph renders:

```tsx
`No squad possible at £${committedBudget.toFixed(1)}m ...`
```

but the label and aria-valuetext both display `sliderValue`. If the user drags to an infeasible position, releases (commit), then drags again without releasing, the label shows one value while the infeasibility message still shows the old `committedBudget`. To a user this reads as contradictory: "Budget: £90.0m — No squad possible at £80.0m". The message should reference `committedBudget` (the last committed value that was actually tested), but the label should make it unambiguous which value was tested.

The most robust fix is to display the infeasibility message using the same value as the label by storing the last tested value explicitly:

**Fix:**
```tsx
// At the call site where committedBudget is set:
const [testedBudget, setTestedBudget] = useState<number>(100)

const handlePointerUp = () => {
  const v = sliderValue
  setCommittedBudget(v)
  setTestedBudget(v)   // record what was actually submitted
  setHasCommitted(true)
}
// Similarly in handleKeyUp setTimeout callback.

// Then in the infeasibility paragraph:
`No squad possible at £${testedBudget.toFixed(1)}m ...`
```

This ensures the message always describes the most recently committed (and computed) budget, not a budget that may be stale relative to the current slider position.

---

## Warnings

### WR-01: Stale closure in keyboard debounce — `sliderValue` captured at `setTimeout` registration, not at callback execution

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:184-190`

**Issue:** `handleKeyUp` closes over `sliderValue` from the render in which it was created. Because the function is re-created on each render but the `setTimeout` callback retains the `sliderValue` from the render that registered the timer, rapid key presses can fire the debounce with a stale value if React batches renders. Concretely: the user presses ArrowRight five times quickly; on press 5, `handleKeyUp` is called with the press-5 closure (sliderValue=105); the `clearTimeout` correctly cancels the press-4 timer; `setTimeout` fires 300ms later — but the closure captures the value from whichever render was in flight. In practice React re-renders synchronously on each `setSliderValue`, so this is a low-probability race, but it is a real correctness hazard under concurrent rendering (React 18 Strict Mode, useDeferredValue interaction).

**Fix:** Read `sliderValue` from a ref that is kept in sync, so the debounce callback always reads the latest value:
```tsx
const sliderValueRef = useRef(sliderValue)
useEffect(() => { sliderValueRef.current = sliderValue }, [sliderValue])

const handleKeyUp = () => {
  if (keyboardTimerRef.current) clearTimeout(keyboardTimerRef.current)
  keyboardTimerRef.current = setTimeout(() => {
    setCommittedBudget(sliderValueRef.current)  // always fresh
    setHasCommitted(true)
  }, 300)
}
```

---

### WR-02: `data?.squad !== null` guard in slider render condition is insufficient — `data?.squad` can be `undefined` when `data` is defined but `squad` field is absent

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:284`

**Issue:** The slider render condition is:
```tsx
{data?.inputs && data?.squad !== null && (
```
`PreSeasonSquadResponse.squad` is typed as `PreSeasonSquad | null`, so TypeScript accepts this. However if `data` is a non-null object but `data.squad` is `undefined` (e.g. a future API response shape, or a partial mock), the check `data?.squad !== null` evaluates to `true` (because `undefined !== null`), so the slider renders even though there is no squad to display. The existing `else if` branch at line 205 correctly uses `squad === null` (which catches `null` after the `?? null` coalescion), but the slider gate does not share that defensive pattern.

**Fix:**
```tsx
{data?.inputs && data.squad != null && (
```
Using `!= null` (loose) catches both `null` and `undefined`, matching the intent.

---

### WR-03: `trackBackground` memo treats `health?.min_feasible_budget_greedy === undefined` and `=== null` identically — but the comment in types.ts documents only `null` as the "all fail" sentinel

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:169-174`

**Issue:**
```tsx
const minFeasible = health?.min_feasible_budget_greedy
if (minFeasible === null || minFeasible === undefined) return '#71717a'
```
`SquadHealth.min_feasible_budget_greedy` is typed as `number | null`. The field is never `undefined` when `health` is a valid `SquadHealth` object. The `=== undefined` check is reachable only via optional chaining when `health` itself is `null` (making `health?.min_feasible_budget_greedy` evaluate to `undefined`). This is fine functionally, but the logic conflates two distinct states:

1. `health === null` → no health data from pipeline (zinc track, correct)
2. `health` present but `min_feasible_budget_greedy === null` → all 81 sweeps failed (zinc track, correct per D-11)
3. `health` present, `min_feasible_budget_greedy` is a number → amber gradient (correct)

The current code accidentally merges case 1 and 2 via `=== undefined`, which happens to be correct today, but would silently mis-classify a future extension where `health` is defined but `min_feasible_budget_greedy` is `undefined`. More importantly, the test at line 451-463 explicitly tests case 1 (`health: null`) and expects zinc only — the test would still pass after a regression in this logic because `undefined` path returns zinc. A regression to case 2 being treated as amber would be caught, but case 1 and 2 are insufficiently distinguished.

**Fix:** Make the intent explicit:
```tsx
const trackBackground = useMemo<string>(() => {
  if (!health) return '#71717a'  // no health data → zinc
  const minFeasible = health.min_feasible_budget_greedy
  if (minFeasible === null) return '#71717a'  // all sweeps infeasible → zinc
  const threshold = ((minFeasible - 80) / 40) * 100
  return `linear-gradient(to right, #f59e0b 0%, #f59e0b ${threshold}%, #71717a ${threshold}%, #71717a 100%)`
}, [health])
```

---

### WR-04: `USE_BLOB` evaluated at module import time — environment variable changes after module load are silently ignored, and the test suite's `process.env.USE_BLOB = 'false'` in `beforeEach` has no effect if the module is cached

**File:** `src/app/api/pre-season-squad/route.ts:15`

**Issue:**
```ts
const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
```
This constant is evaluated once when the module is first `import`ed. The test file sets `process.env.USE_BLOB = 'false'` in `beforeEach`, but if the module is already cached in the module registry (which happens on the second and subsequent tests because `vi.resetModules()` is only called in the `beforeEach` for some tests, not all), this assignment has no effect on `USE_BLOB`. The test for the 404 path (lines 241-262) calls `vi.resetModules()` mid-test, but most other tests do not reset before their import at lines 171, 184, 206, etc. — they re-use the same module import from the top of the describe block.

In production this is also a concern: if the environment variable is set after process start (e.g., via a secrets manager that sets env after module evaluation), the value will be wrong.

**Fix:** Read the environment variable inside the function rather than at module top-level:
```ts
// Remove the top-level constant
// const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

async function readBlobOrLocal(filename: string): Promise<string | null> {
  const useBlob = process.env.USE_BLOB?.toLowerCase() === 'true'
  try {
    if (useBlob) {
      ...
```
This ensures each call reads the current env value and makes the test `beforeEach` assignment actually effective.

---

## Info

### IN-01: Dead import — `HeatMapRow` is imported but the populated code path is never reached; the eslint-disable comment acknowledges this

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:21`

**Issue:**
```tsx
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { HeatMapRow } from '@/components/club-form/FixtureHeatMap'
```
The import is explicitly suppressed with an eslint-disable. The in-file TODO comment at line 224 explains this is a deferred feature. This is a known deferred item per the code comment, not a defect, but it adds bundle weight for a code path that cannot currently execute.

**Fix:** Remove the import and the eslint-disable comment until the fixture data path is implemented. Re-add when GW1-8-FIXTURES work is prioritised.

---

### IN-02: Magic number `0.5` step and `80`/`120` min/max are hardcoded in both the component and tests but not defined as named constants

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:290-292`

**Issue:** The slider range constants (`min=80`, `max=120`, `step=0.5`) match `SquadHealth.budget_sweep_min` / `budget_sweep_max` / `budget_sweep_step` semantically, but the component hard-codes them rather than reading from `health`. This means if the pipeline changes the sweep range, the UI will silently misrepresent the feasible range. The `trackBackground` memo correctly reads `health.min_feasible_budget_greedy`, but the slider bounds do not read `health.budget_sweep_min` / `health.budget_sweep_max`.

**Fix:** Either derive `min`/`max`/`step` from `health` when present, or define named constants that match the `SquadHealth` defaults:
```tsx
const SLIDER_MIN = health?.budget_sweep_min ?? 80
const SLIDER_MAX = health?.budget_sweep_max ?? 120
const SLIDER_STEP = health?.budget_sweep_step ?? 0.5
```

---

### IN-03: `makeArchiveFixture` in route tests hard-codes 6-entry history × 90 min = 540 min, which barely passes the 500-minute filter — a change to the threshold would silently break tests without an obvious failure message

**File:** `src/app/api/pre-season-squad/route.test.ts:51-63`

**Issue:** Each player in the archive fixture has exactly 6 gameweek entries × 90 minutes = 540 total minutes. The eligibility threshold in `loadSquadInputs` is `totalMinutes < 500`. 540 is only 40 minutes above the threshold. If the threshold were changed to 550 (e.g., to require a full 6-match window), all 20 players would be excluded and tests would fail with cryptic errors (empty player pool → `loadSquadInputs` returns `null` → 503 instead of 200). The fixture should be named or documented to make its relationship to the threshold explicit.

**Fix:** Add a comment:
```ts
// 6 × 90 = 540 total minutes — intentionally > 500-minute eligibility threshold (route.ts:85)
// If the threshold changes, update this fixture accordingly.
```

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
