# Phase 116: Prose Staleness & Model Versioning - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 7
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/squad/ProseSummaryBlock.tsx` | component | request-response | `src/components/LastUpdated.tsx` | exact (staleness + amber + relative time) |
| `src/lib/types.ts` (VersionRecord, AccuracySubTab) | type definitions | — | `src/lib/types.ts` (CalibrationBucket.predicted_mean) | self-analog (optional field extension) |
| `pipeline/prose_summary.py` | service | request-response | `pipeline/prose_summary.py` (self) | self-modification |
| `pipeline/run.py` | orchestrator | batch | `pipeline/run.py` lines 362–395 (self) | self-modification |
| `pipeline/gw_intel.py` | utility | transform | `pipeline/gw_intel.py` lines 108–130 (self) | self-modification (import site) |
| `pipeline/accuracy.py` | service | batch | `pipeline/accuracy.py` lines 395–410, 481–493 (self) | self-modification |
| `src/components/accuracy/AccuracyTab.tsx` | component | request-response | `src/components/accuracy/AccuracyTab.tsx` (self) | self-modification |

---

## Pattern Assignments

### `src/components/squad/ProseSummaryBlock.tsx` (PROSE-01)

**Analog:** `src/components/LastUpdated.tsx` — the project's only other component that computes a staleness flag from an ISO timestamp and switches to amber.

**Relative time + staleness pattern** (`src/components/LastUpdated.tsx` lines 1–45):
```typescript
import { formatRelativeTime } from '@/lib/formatRelativeTime'

// Compute staleness at render time using Date.now() directly.
// The 'stale' flag drives conditional amber vs. muted colour class.
export function LastUpdatedDisplay({ relativeTime, stale }: { relativeTime: string; stale: boolean }) {
  if (!stale) {
    return (
      <span className="...text-muted">
        Updated {relativeTime}
      </span>
    )
  }
  return (
    <span className="...text-amber-600 dark:text-amber-400">
      Updated {relativeTime}
    </span>
  )
}
```

**For PROSE-01** — apply inline in the existing `<p>` footer; do NOT extract a separate display component. The `formatRelativeTime` utility already exists at `src/lib/formatRelativeTime.ts`. Pattern:
```typescript
// Inline in ProseSummaryBlock render, replacing the static line 63-65:
const minutesAgo = Math.floor((Date.now() - new Date(displayed.generated_at).getTime()) / 60_000)
const isStale = minutesAgo >= 20 * 60
const relTime = formatRelativeTime(displayed.generated_at)  // uses Date.now() internally
<p className={`text-xs mt-2 ${isStale ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
  Updated {relTime} · GW{displayed.gw}
</p>
```

**Amber colour class** (`src/components/LastUpdated.tsx` line 19, `src/components/transfers/TransferPanel.tsx` line 324):
```typescript
className="text-amber-600 dark:text-amber-400"
```
This is the project-canonical amber for inline text warnings.

**formatRelativeTime signature** (`src/lib/formatRelativeTime.ts` lines 14–25):
```typescript
export function formatRelativeTime(isoTimestamp: string, nowMs: number = Date.now()): string {
  const ts = new Date(isoTimestamp).getTime()
  if (isNaN(ts)) return 'unknown'
  const diffMs = nowMs - ts
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 48) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}
```

**Existing test file to extend:** `src/components/squad/ProseSummaryBlock.test.tsx`

**Test pattern for staleness** (`src/components/LastUpdated.test.tsx` lines 70–78 and `src/components/captaincy/CaptainPicksPanel.test.tsx` line 402–403):
```typescript
// Pattern A — vi.setSystemTime (preferred when testing connected component)
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

// Pattern B — vi.spyOn(Date, 'now') for isolated renders
vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-05T20:01:00Z').getTime())
```
D-04 says use `Date.now()` directly in component (not an injectable param), so tests use `vi.spyOn(Date, 'now')` to freeze time, same as `CaptainPicksPanel.test.tsx` line 403.

---

### `src/lib/types.ts` — VersionRecord and AccuracySubTab (VER-01/VER-02)

**Analog:** `src/lib/types.ts` itself — the optional-field extension pattern is already established by `CalibrationBucket.predicted_mean?` and `AccuracyBacktest.versions?`.

**Optional field pattern** (`src/lib/types.ts` lines 455–460, 462–469):
```typescript
// Current VersionRecord — add sample_gws? here:
export interface VersionRecord {
  formula_version: string
  recorded_at: string    // ISO timestamp
  hit_rate: number       // 0..1 (rounded to 4 decimals by accuracy.py)
  gate_flags: VersionGateFlags
  // ADD: sample_gws?: number  — optional for backward compat; UI defaults ?? 0
}

// Reference: same optional pattern used by CalibrationBucket
export interface CalibrationBucket {
  ...
  predicted_mean?: number  // optional for legacy-cache compat
  actual_mean?: number
}
```

**AccuracySubTab union type extension** (`src/components/accuracy/AccuracyTab.tsx` lines 42–47):
```typescript
// Current union — add 'versions' here:
type AccuracySubTab = 'summary' | 'calibration' | 'back'
const ACCURACY_SUB_TABS: ReadonlyArray<{ value: AccuracySubTab; label: string }> = [
  { value: 'summary', label: 'Summary' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'back', label: 'Back' },
  // ADD: { value: 'versions', label: 'Versions' }
]
```

---

### `pipeline/prose_summary.py` — `generate_weekly_summary()` + `_build_user_prompt()` (PROSE-02)

**Self-modification.** The file is read-only context; changes are scoped to the function signature and the prompt builder.

**Current signature to extend** (`pipeline/prose_summary.py` lines 101–106):
```python
def generate_weekly_summary(
    captains: list,
    gems: list,
    player_corpus: list,
    gameweek: Optional[int],
    # ADD: dgw_teams: list[str] | None = None
) -> Optional[dict]:
```
The `None` default (D-05) preserves backward compat with all existing tests.

**Current `_build_user_prompt` to extend** (`pipeline/prose_summary.py` lines 65–83):
```python
def _build_user_prompt(captains: list, gems: list) -> str:
    cap_lines = '\n'.join(
        f'  <player name="{c["name"]}" team="{c["team"]}" />'
        for c in captains
    )
    gem_lines = '\n'.join(
        f'  <player name="{g["name"]}" team="{g["team"]}" />'
        for g in gems
    )
    return (
        '<input>\n'
        f'<captains>\n{cap_lines}\n</captains>\n'
        f'<gems>\n{gem_lines}\n</gems>\n'
        '</input>\n\n'
        "Write a concise 4-5 sentence summary..."
    )
```

**Extended signature for PROSE-02** — add `dgw_teams` param and availability attributes:
- `_build_user_prompt(captains, gems, dgw_teams=None)` — prepend DGW note when non-empty
- Player XML gains `chance_of_playing` attribute when `chance_of_playing_next_round < 100` or `news` is non-empty
- DGW note prepended before `<input>`: `f"Note: Gameweek {gameweek} is a double gameweek for: {', '.join(dgw_teams)}.\n\n"`
- `generate_weekly_summary` passes `dgw_teams` down to `_build_user_prompt` (and `user` is recomputed once before the retry loop; dgw_teams is static across retries)

**Guardrail is NOT modified** — DGW team names are not player web_names; `_passes_guardrail` does not reject them (D-08).

---

### `pipeline/run.py` — prose call site enrichment (PROSE-02)

**Self-modification.** Exact lines to change: 362–395.

**Current call site** (`pipeline/run.py` lines 362–395):
```python
from prose_summary import generate_weekly_summary
# Top-3 captains
captains_top3 = sorted(...)[:3]
cap_payload = [
    {'name': p.get('web_name'), 'team': p.get('team_short_name', ''), 'xPts_1gw': p.get('xPts_1gw')}
    for p in captains_top3
]
# Top-3 gems
gems_top3 = sorted(...)[:3]
gem_payload = [
    {'name': p.get('web_name'), 'team': p.get('team_short_name', ''), 'xPts_1gw': p.get('xPts_1gw')}
    for p in gems_top3
]
corpus = [p.get('web_name') for p in merged if p.get('web_name')]
summary = generate_weekly_summary(
    captains=cap_payload,
    gems=gem_payload,
    player_corpus=corpus,
    gameweek=current_gw,
)
```

**Changes for PROSE-02:**
1. Add `chance_of_playing_next_round` and `news` fields to each dict in `cap_payload` and `gem_payload` (D-06).
2. After building payloads, call `_detect_dgw_bgw(merged, current_gw)` from `gw_intel` (already importable — see analog below). Collect team names for `'dgw'` entries using `team_short_by_id` or `team_short_name` lookup from `merged`.
3. Pass `dgw_teams=dgw_team_names` kwarg to `generate_weekly_summary` (D-07).

**`_detect_dgw_bgw` call pattern** (`pipeline/gw_intel.py` lines 277–286):
```python
# Already called inside gw_intel.py itself — replicate the import + call pattern:
dgw_bgw_map = _detect_dgw_bgw(merged, next_gw)
for tid, kind in sorted(dgw_bgw_map.items()):
    if kind == 'dgw':
        # collect team_short_name from merged for this tid
```
In `run.py`, import from `gw_intel`: `from gw_intel import _detect_dgw_bgw` (D-07 says it is already imported — check if import exists; if not, add it alongside existing `gw_intel` import).

---

### `pipeline/gw_intel.py` — `_detect_dgw_bgw` import reference (PROSE-02)

**Read-only.** No modifications to this file. The function signature and return type are:

**`_detect_dgw_bgw` signature** (`pipeline/gw_intel.py` lines 108–130):
```python
def _detect_dgw_bgw(merged: list, next_gw: int) -> dict[int, str]:
    """Returns {team_id: 'dgw' | 'bgw'} for the next GW only.

    DGW: >=2 fixtures with event_id == next_gw. BGW: 0 fixtures with event_id == next_gw.
    """
```
The return value keys are integer `team_id` values. Map them to team short names via `merged` player records (each player has `'team'` = team_id and `'team_short_name'`).

---

### `pipeline/accuracy.py` — `new_version_record` and `_empty_backtest` (VER-01)

**Self-modification.** Exact locations:

**`new_version_record` dict** (`pipeline/accuracy.py` lines 395–406):
```python
new_version_record = {
    'formula_version': FORMULA_VERSION,
    'recorded_at': datetime.now(timezone.utc).isoformat(),
    'hit_rate': round(overall_xpts_blended_hit, 4),
    'gate_flags': {
        'form_signal_enabled': form_signal_enabled,
        'xmins_v2_enabled': xmins_v2_enabled,
        'bonus_predictor_enabled': bonus_predictor_enabled,
        'save_predictor_enabled': save_predictor_enabled,
        'mc_enabled': mc_enabled,
    },
    # ADD: 'sample_gws': len(target_gws_desc)   ← D-09
}
```
`target_gws_desc` is already in scope at this point (line 154: `target_gws_desc = sorted(target_gws, reverse=True)`).

**`_empty_backtest` version record** (`pipeline/accuracy.py` lines 481–493):
```python
if FORMULA_VERSION not in existing_set:
    existing_versions = existing_versions + [{
        'formula_version': FORMULA_VERSION,
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'hit_rate': 0.0,
        'gate_flags': {
            'form_signal_enabled': False,
            'xmins_v2_enabled': xmins_v2_enabled,
            'bonus_predictor_enabled': bonus_predictor_enabled,
            'save_predictor_enabled': save_predictor_enabled,
            'mc_enabled': mc_enabled,
        },
        # ADD: 'sample_gws': 0   ← D-10 (cold start by definition)
    }]
```

---

### `src/components/accuracy/AccuracyTab.tsx` — VER-02 (sub-tab + table column)

**Self-modification.** Four precise change sites:

**Site 1 — Sub-tab type + array** (lines 42–47):
```typescript
// Extend union to include 'versions':
type AccuracySubTab = 'summary' | 'calibration' | 'back' | 'versions'
const ACCURACY_SUB_TABS: ReadonlyArray<{ value: AccuracySubTab; label: string }> = [
  { value: 'summary', label: 'Summary' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'back', label: 'Back' },
  { value: 'versions', label: 'Versions' },   // ADD (D-12)
]
```

**Site 2 — VersionHistoryTable `<th>` row** (lines 194–200 — add "Sample GWs" column):
```typescript
<th scope="col" className={TH_CLS}>Version</th>
<th scope="col" className={TH_CLS}>Recorded</th>
<th scope="col" className={TH_CLS}>Hit Rate</th>
<th scope="col" className={TH_CLS} title="Change vs previous version">Δ</th>
<th scope="col" className={TH_CLS}>Active Gates</th>
// ADD after Active Gates:
<th scope="col" className={TH_CLS}>Sample GWs</th>
```

**Site 3 — VersionHistoryTable row cells** (lines 207–228 — add cold-start render):
```typescript
// Replace <HitRateBadge> with conditional cold-start label:
<td className={TD_CLS}>
  {(v.sample_gws ?? 0) < 3
    ? <span className="text-amber-600 dark:text-amber-400 text-xs">cold start</span>
    : <HitRateBadge rate={v.hit_rate} />}
</td>

// ADD new cell after Active Gates:
<td className={TD_CLS}>
  {(v.sample_gws ?? 0) < 3
    ? <span className="text-amber-600 dark:text-amber-400 text-xs">{'< 3 GWs'}</span>
    : v.sample_gws}
</td>
```

**Site 4 — Main render block** (lines 1093–1113):
```typescript
// Remove VersionHistoryTable from calibration block (line 1106):
{subTab === 'calibration' && (
  <>
    {/* REMOVE: {data.versions && data.versions.length >= 1 && <VersionHistoryTable data={data} />} */}
    {data.calibration && <CalibrationSection data={data} />}
  </>
)}

// ADD new versions block after 'back' block (after line 1110):
{subTab === 'versions' && (
  <>
    {data.versions && data.versions.length >= 1
      ? <VersionHistoryTable data={data} />
      : <p className="text-sm text-zinc-500 dark:text-zinc-400">No version history yet.</p>}
  </>
)}
```

---

## Shared Patterns

### Amber colour — inline text
**Source:** `src/components/LastUpdated.tsx` line 19; `src/components/transfers/TransferPanel.tsx` line 324
**Apply to:** PROSE-01 footer (stale state); VER-02 cold-start cells
```typescript
className="text-amber-600 dark:text-amber-400"
```

### Conditional class switching (stale vs. fresh)
**Source:** `src/components/LastUpdated.tsx` lines 10–23
**Apply to:** PROSE-01 footer `<p>` className
```typescript
className={`text-xs mt-2 ${isStale
  ? 'text-amber-600 dark:text-amber-400'
  : 'text-zinc-400 dark:text-zinc-500'
}`}
```

### Optional type field with `?? 0` default
**Source:** `src/lib/types.ts` lines 467–469 (`predicted_mean?`); `src/components/accuracy/AccuracyTab.tsx` usage
**Apply to:** `VersionRecord.sample_gws?: number` + `(v.sample_gws ?? 0) < 3` in VER-02
```typescript
// Type definition:
sample_gws?: number  // optional for backward compat; UI defaults ?? 0

// Usage:
(v.sample_gws ?? 0) < 3
```

### `formatRelativeTime` utility
**Source:** `src/lib/formatRelativeTime.ts` (already exists; do not recreate)
**Apply to:** PROSE-01 footer — import and call directly
```typescript
import { formatRelativeTime } from '@/lib/formatRelativeTime'
// Returns e.g. "3 hours ago" from ISO timestamp using Date.now() internally
```

### Test timer control — `vi.spyOn(Date, 'now')`
**Source:** `src/components/captaincy/CaptainPicksPanel.test.tsx` line 402–403
**Apply to:** `ProseSummaryBlock.test.tsx` staleness tests
```typescript
vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-05T20:01:00Z').getTime())
// Use this (not vi.useFakeTimers) because the component calls Date.now() directly
// in component body (not via setInterval), so a spy is sufficient.
```

### Sub-tab conditional render block pattern
**Source:** `src/components/accuracy/AccuracyTab.tsx` lines 1097–1110
**Apply to:** VER-02 new `{subTab === 'versions' && ...}` block
```typescript
{subTab === 'summary' && ( <> <GwSummaryTable ... /> ... </> )}
{subTab === 'calibration' && ( <> ... </> )}
{subTab === 'back' && <BackTab teamId={teamId} />}
// New block follows same pattern:
{subTab === 'versions' && ( <> <VersionHistoryTable data={data} /> </> )}
```

---

## No Analog Found

None. All files are self-modifications of existing components/modules, with close analogs available for every cross-cutting pattern.

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/`, `pipeline/`
**Files read:** 12 (ProseSummaryBlock.tsx, ProseSummaryBlock.test.tsx, prose_summary.py, accuracy.py, run.py, gw_intel.py, AccuracyTab.tsx, types.ts, formatRelativeTime.ts, formatRelativeTime.test.ts, LastUpdated.tsx, LastUpdated.test.tsx)
**Pattern extraction date:** 2026-05-17
