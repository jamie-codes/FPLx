# Phase 102: MC Gate Activation & MCDistributionBar Display - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/mc/MCDistributionBar.tsx` | component | transform (display-only) | `src/components/shared/FragilityBadge.tsx` | role-match |
| `src/components/gem-table/columns.tsx` | component | request-response (hover card) | self (XPtsCell lines 141–163 removed, same file) | exact |
| `src/components/captaincy/CaptainPicksPanel.tsx` | component | request-response | `src/components/captaincy/CaptainPicksPanel.tsx` CandidateRow (self) | exact |
| `pipeline/run.py` | utility/config | batch | `pipeline/run.py` lines 188–211 (existing gate constants) | exact |
| `.github/workflows/pipeline.yml` | config | batch | self (existing pip install step line 46) | exact |

---

## Pattern Assignments

### `src/components/mc/MCDistributionBar.tsx` (NEW component, transform/display)

**Primary analog:** `src/components/shared/FragilityBadge.tsx`
**Secondary analog:** `src/components/shared/MinsRiskBadge.tsx`

**Imports pattern** — copy from `FragilityBadge.tsx` lines 1–12, adapted:
```tsx
// No React import needed (Next.js 16+ JSX transform)
// No 'use client' — this is a pure display component with no state/effects

interface MCDistributionBarProps {
  blankProb: number   // 0–1
  haulProb: number    // 0–1
  p10Pts: number      // base points, 1 decimal place
  p90Pts: number      // base points, 1 decimal place
}
```

**No-guard pattern inside component** — caller (XPtsCell) already guards via `showMC`. The component itself does NOT guard. Pattern from `FragilityBadge.tsx` line 25 (null for robust tier is the caller's decision, not the component's — MCDistributionBar takes this further: the component always renders, caller always guards):
```tsx
// FragilityBadge.tsx line 24–25 — analog for "caller decides whether to mount"
export function FragilityBadge({ tier, reasons }: FragilityBadgeProps) {
  if (tier === 'robust') return null   // <-- guard IS in component for FragilityBadge
  // MCDistributionBar moves guard entirely to the caller (XPtsCell showMC block)
```

**Amber colour token** — copy from `columns.tsx` lines 149–153 (exact same threshold and class):
```tsx
// columns.tsx lines 149–153 — REUSE amber token and 0.40 threshold exactly
haulProb! >= 0.40
  ? 'font-mono text-amber-600 dark:text-amber-400'
  : 'font-mono'
```

**Core component pattern** — Tailwind flex layout, track + fill, conditional amber row:
```tsx
export function MCDistributionBar({ blankProb, haulProb, p10Pts, p90Pts }: MCDistributionBarProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Bar row */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums w-6 text-right">
          {p10Pts.toFixed(1)}
        </span>
        <div
          className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-600 relative"
          role="img"
          aria-label={`MC range: ${p10Pts.toFixed(1)} to ${p90Pts.toFixed(1)} pts`}
        >
          <div className="absolute inset-y-0 left-0 w-full rounded-full bg-teal-500 dark:bg-teal-400" />
        </div>
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums w-6 text-left">
          {p90Pts.toFixed(1)}
        </span>
      </div>
      {/* Haul% row — conditional amber, same threshold as columns.tsx line 150 */}
      {haulProb >= 0.40 && (
        <div className="text-xs font-mono text-amber-600 dark:text-amber-400">
          Haul {(haulProb * 100).toFixed(0)}%
        </div>
      )}
    </div>
  )
}
```

**What NOT to copy from MinsRiskBadge.tsx:** The `px-2 py-1 rounded inline-block` pill envelope (lines 59–63). MCDistributionBar is a block layout element inside the hover card, not a badge pill. Use `flex flex-col` not `inline-block`.

---

### `src/components/gem-table/columns.tsx` — XPtsCell modification (component, request-response)

**Analog:** Self — the existing `showMC` block at lines 141–163 is the target.

**showMC guard pattern** (lines 93–98) — unchanged, keep exactly as-is:
```tsx
// columns.tsx lines 93–98 — DO NOT CHANGE this guard
const showMC = window === 1
  && blankProb !== undefined
  && haulProb !== undefined
  && p10Pts !== undefined
  && p90Pts !== undefined
```

**Import to add** — after existing import block (line 11), insert:
```tsx
import { MCDistributionBar } from '@/components/mc/MCDistributionBar'
```

**Replacement target** — lines 141–163 in `columns.tsx`. The entire block:
```tsx
// REMOVE lines 141–163 entirely:
{showMC && (
  <>
    <div className="flex justify-between">
      <span className="text-zinc-500 dark:text-zinc-400">Blank%</span>
      <span className="font-mono">{(blankProb! * 100).toFixed(0)}%</span>
    </div>
    <div className="flex justify-between">
      <span className="text-zinc-500 dark:text-zinc-400">Haul%</span>
      <span className={
        haulProb! >= 0.40
          ? 'font-mono text-amber-600 dark:text-amber-400'
          : 'font-mono'
      }>{(haulProb! * 100).toFixed(0)}%</span>
    </div>
    <div className="flex justify-between">
      <span className="text-zinc-500 dark:text-zinc-400">Floor</span>
      <span className="font-mono">{p10Pts!.toFixed(1)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-zinc-500 dark:text-zinc-400">Ceiling</span>
      <span className="font-mono">{p90Pts!.toFixed(1)}</span>
    </div>
    <hr className="my-1 border-zinc-200 dark:border-zinc-600" />
  </>
)}
```

**Replace with:**
```tsx
{showMC && (
  <>
    <MCDistributionBar
      blankProb={blankProb!}
      haulProb={haulProb!}
      p10Pts={p10Pts!}
      p90Pts={p90Pts!}
    />
    <hr className="my-1 border-zinc-200 dark:border-zinc-600" />
  </>
)}
```

Note: The `<hr>` that was inside the old block (line 163) moves outside `MCDistributionBar` and stays in the caller. The `<hr>` before the Total row (which remains at line 140 in the original) is unaffected.

**Hover card structural context** (lines 126–133) — unchanged, reference only:
```tsx
<div className={[
  'absolute bottom-full left-0 mb-1 w-44 z-50',
  'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
  'rounded shadow-lg p-2 text-xs',
  ...
].join(' ')}>
```
MCDistributionBar must fit within `w-44` (176px) minus the `p-2` card padding.

---

### `src/components/captaincy/CaptainPicksPanel.tsx` — CandidateRow modification (component, request-response)

**Analog:** Self — `CandidateRow` function at lines 85–158.

**Existing pts display** (lines 149–151) — the insertion point:
```tsx
// columns.tsx lines 149–151 — the span BEFORE the insertion point
<span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
  {((candidate.xPts_1gw ?? 0) * 2).toFixed(1)} pts (C)
</span>
```

**Insert immediately after** that closing `</span>` (after line 151, before line 152):
```tsx
{candidate.p10_pts !== undefined && candidate.p90_pts !== undefined && (
  <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
    {' · '}{candidate.p10_pts.toFixed(1)}{'–'}{candidate.p90_pts.toFixed(1)}
  </span>
)}
```

**Separator pattern** — middle dot `·` (U+00B7) with single space each side. En-dash `–` (U+2013) between values. No template literal interpolation of the separator character — use string literals `{' · '}` and `{'–'}` to keep linting clean.

**Gate-off pattern** — undefined check `!== undefined` (not falsy check) because `p10_pts` could be `0` in theory. Matches existing `minsRisk` undefined check pattern in `MinsRiskBadge.tsx` line 38: `if (!minsRisk || minsRisk === 'injured') return null`.

**Existing undefined guard precedent** from `CandidateRow` (line 153–156):
```tsx
// Pattern: inline IIFE guard before rendering optional subcomponent
{(() => {
  const { tier, reasons } = computeFragility(candidate, false)
  return tier !== 'robust' ? <FragilityBadge tier={tier} reasons={reasons} /> : null
})()}
```
P10/P90 guard is simpler — use inline `&&` conditional, not IIFE (no computation needed).

**MergedPlayer type reference** — `src/lib/types.ts` lines 186–193 already has `p10_pts?: number` and `p90_pts?: number` optional fields on `MergedPlayer`. No type changes needed.

---

### `pipeline/run.py` — gate constant flip (utility/config, batch)

**Analog:** Lines 188–211 — the existing gate constant block.

**Existing pattern for other gates** (lines 188–192) — `MC_ENABLED` follows the same naming convention as these constants-that-override-sticky-reads:
```python
# pipeline/run.py lines 188–192 — pattern to match
form_signal_enabled = False
blend_alpha_used = 0.4
xmins_v2_enabled = False  # Phase 52 D-02
bonus_predictor_enabled = False  # Phase 53 BPS-01
save_predictor_enabled = False  # Phase 83 GK-03
mc_enabled = False  # Phase 90 MC-01 — default OFF
```

**Target line to replace** (line 203):
```python
# REMOVE this line:
mc_enabled = prev_backtest.get('summary', {}).get('mc_enabled', False)
```

**D-05 implementation** — add named constant near line 193, replace line 203:
```python
# Add near line 193, after the other gate defaults:
MC_ENABLED = True  # Phase 102 — permanent ON; MC fields in merged_players.json

# Replace line 203 (the sticky read) with:
mc_enabled = MC_ENABLED
```

**Print statement** (line 211) — keep unchanged. It already logs the correct value:
```python
print(f"MC simulation (5-GW uncertainty bands): {'ENABLED' if mc_enabled else 'DISABLED'}")
```

**accuracy.py write path** — NO change needed. `accuracy.py` lines 368, 400 already read `mc_enabled` from `prior_cache` and write it back to `summary`. Once `mc_enabled = MC_ENABLED = True` is written into `accuracy_backtest.json` on the first pipeline run after the flip, subsequent reads in `accuracy.py` will preserve `True` automatically via the existing sticky-read pattern.

**Existing test that must be updated** — `pipeline/tests/test_simulate.py` line 259 asserts the sticky-read string exists in `run.py`. That assertion will need updating to assert `MC_ENABLED = True` instead.

---

### `.github/workflows/pipeline.yml` — pip install and env block (config, batch)

**Analog:** Self — lines 44–46 (Install dependencies step) and lines 30–34 (env block).

**Existing pip install line** (line 46) — the target:
```yaml
# pipeline.yml line 46 — current state
pip install requests==2.32.3 pandas==2.2.3 vercel-blob==0.4.2 python-dotenv==1.0.1 anthropic==0.40.0
```

**D-07 replacement** — update `anthropic` pin, add `numpy`:
```yaml
pip install requests==2.32.3 pandas==2.2.3 vercel-blob==0.4.2 python-dotenv==1.0.1 anthropic==0.98.1 numpy==2.2.3
```

**Existing env block** (lines 30–34) — the insertion target:
```yaml
env:
  USE_BLOB: 'true'
  BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**D-07 MC env vars** — add two new entries to the `env` block:
```yaml
env:
  USE_BLOB: 'true'
  BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  MC_ITERATIONS: 10000
  MC_SEED: 42
```

**Convention note:** Numeric env values in this workflow are unquoted integers — follow the same style as `MC_ITERATIONS: 10000` (no quotes). String booleans use single quotes: `'true'`.

---

## Shared Patterns

### Amber colour token (Haul%)
**Source:** `src/components/gem-table/columns.tsx` lines 149–153
**Apply to:** `MCDistributionBar.tsx` Haul% conditional row
```tsx
// Exact threshold (0.40) and exact Tailwind classes — do not alter:
haulProb >= 0.40   // threshold
'text-amber-600 dark:text-amber-400'  // classes when condition true
```

### Optional undefined guard
**Source:** `src/components/shared/MinsRiskBadge.tsx` line 38; `CaptainPicksPanel.tsx` lines 149–151
**Apply to:** CandidateRow P10/P90 range conditional
```tsx
// Pattern: explicit !== undefined (not falsy check) for numeric props that could be 0
candidate.p10_pts !== undefined && candidate.p90_pts !== undefined
```

### font-mono for numeric data
**Source:** `src/components/gem-table/columns.tsx` lines 136–137
**Apply to:** MCDistributionBar P10/P90 labels; CandidateRow range span
```tsx
// All numeric data in hover card uses font-mono:
<span className="font-mono">{val}</span>
// MCDistributionBar bar labels:
<span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ...">
```

### tabular-nums for alignment
**Source:** UI-SPEC.md typography table; existing `columns.tsx` pattern
**Apply to:** MCDistributionBar P10/P90 labels; CandidateRow range span
```tsx
className="... tabular-nums"  // prevents layout shift when numbers change width
```

### Gate constant naming (pipeline)
**Source:** `pipeline/run.py` lines 188–193
**Apply to:** `MC_ENABLED = True` constant placement
```python
# Convention: SCREAMING_SNAKE_CASE for the override constant,
# lowercase_snake_case for the variable used downstream
MC_ENABLED = True          # named constant (new)
mc_enabled = MC_ENABLED    # replaces the sticky read (line 203)
# Downstream usage unchanged:
if mc_enabled:
    merged = compute_simulations(merged, xmins_v2_enabled)
```

---

## No Analog Found

None — all five files have direct analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/`, `pipeline/`, `.github/workflows/`
**Files read:** `columns.tsx`, `CaptainPicksPanel.tsx`, `FragilityBadge.tsx`, `MinsRiskBadge.tsx`, `VarianceBadge.tsx`, `pipeline/run.py`, `pipeline/accuracy.py`, `pipeline/tests/test_simulate.py`, `.github/workflows/pipeline.yml`
**Pattern extraction date:** 2026-05-13
