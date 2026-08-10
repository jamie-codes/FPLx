# Chip Timeline Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit per-chip recommended GW windows from the pipeline (from confirmed fixture shape) and render them as season-timeline bars in the Cockpit chip advisor, additively.

**Architecture:** `build_chip_advice` gains a forward scan over `current_gw … max_scheduled_gw` (the max `event_id` actually present in fixtures — the honesty guard against past-horizon zero-fixture false blanks), reusing `_detect_dgw_bgw` per GW to derive DGW/BGW-driven windows for Bench Boost, Triple Captain, and Free Hit (Wildcard stays informational). Optional new fields flow through the unchanged API/hook to a new `ChipTimelineBar` rendered in each of the three chip rows.

**Tech Stack:** Python (pipeline, pytest), TypeScript, Next.js client components, Tailwind v4, Vitest + @testing-library/react (jsdom).

## Global Constraints

- **Honesty / beyond-horizon guard:** the forward scan MUST stop at `max_scheduled_gw` = the maximum `event_id` present across all players' fixtures. GWs past that must produce NO windows (a team with 0 fixtures there is not a real BGW). This is the highest-risk correctness point.
- **Data-driven only:** no historical/heuristic season priors — windows come only from confirmed fixtures.
- **Additive / keep-all-features (UIX-01):** the single-GW signal/value/reason output and every existing `ChipAdviceCard` element stay unchanged. New pipeline fields and types are optional so existing cached `chip_advice.json` still parses.
- **Window shape:** `{ start_gw, end_gw, strength: 'play' | 'consider', reason }`; contiguous qualifying GWs merge into one window; a window's strength is the strongest of its GWs (`play` > `consider`).
- **Wildcard:** `windows: []` always (informational, unchanged).
- No `Co-Authored-By` trailers. Do NOT use `git stash`. Run `npx tsc --noEmit` (not just vitest) before committing UI tasks.

---

### Task 1: Pipeline — per-chip window scan

**Files:**
- Modify: `pipeline/chip_advisor.py` (add thresholds near line 32; add a `_chip_windows` helper; extend `build_chip_advice`'s return near line 74)
- Test: `pipeline/test_chip_advisor.py` (extend)

**Interfaces:**
- Consumes: `_detect_dgw_bgw(merged, gw) -> dict[int, 'dgw'|'bgw']` from `gw_intel` (already imported).
- Produces: `build_chip_advice` return dict gains `horizon_start: int`, `horizon_end: int`, and each of `chips.bench_boost / triple_captain / free_hit` gains `windows: list[{start_gw,end_gw,strength,reason}]`; `chips.wildcard['windows'] = []`.

- [ ] **Step 1: Write the failing tests**

Add to `pipeline/test_chip_advisor.py`. Note the existing `_merged_team(tid, n_fixtures, gw)` puts all a team's fixtures at ONE gw; for multi-GW calendars, build fixtures spanning several GWs. The new tests use concrete DGW/BGW team counts (not the threshold constants), so no new imports are needed. Add this helper and tests at the end of the file:

```python
def _team_with_calendar(tid, gw_fixture_counts):
    """gw_fixture_counts: {gw: n_fixtures}. Builds one team's fixtures across GWs."""
    fixtures = []
    for gw, n in gw_fixture_counts.items():
        fixtures.extend({'event_id': gw} for _ in range(n))
    return {'id': tid * 100, 'team': tid, 'fixtures': fixtures}


def test_horizon_stops_at_max_scheduled_gw():
    # Calendar runs GW30..35 only (every team one fixture per GW, none past 35).
    merged = [_team_with_calendar(t, {g: 1 for g in range(30, 36)}) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['horizon_start'] == 30
    assert advice['horizon_end'] == 35            # NOT 38 — nothing scheduled past 35
    # No chip has any window at 36-38 (past-horizon zero-fixtures are not blanks).
    for chip in ('bench_boost', 'triple_captain', 'free_hit'):
        for w in advice['chips'][chip]['windows']:
            assert w['end_gw'] <= 35


def test_bench_boost_window_on_dgw_cluster():
    # Base single fixtures GW30..35; GW34 & GW35 are DGWs for 6 teams (contiguous).
    merged = []
    for t in range(1, 21):
        cal = {g: 1 for g in range(30, 36)}
        if t <= 6:
            cal[34] = 2; cal[35] = 2
        merged.append(_team_with_calendar(t, cal))
    advice = build_chip_advice(merged, _ledger(), 30)
    bb = advice['chips']['bench_boost']['windows']
    assert len(bb) == 1
    assert bb[0]['start_gw'] == 34 and bb[0]['end_gw'] == 35   # contiguous merge
    assert bb[0]['strength'] == 'play'                         # 6 DGW teams >= strong
    # Triple Captain uses the same DGW basis → also gets the window.
    assert advice['chips']['triple_captain']['windows'][0]['start_gw'] == 34


def test_free_hit_window_on_blank_gw():
    # GW33 is a blank for 5 teams (0 fixtures that GW); calendar GW30..35.
    merged = []
    for t in range(1, 21):
        cal = {g: 1 for g in range(30, 36)}
        if t <= 5:
            cal[33] = 0
        merged.append(_team_with_calendar(t, cal))
    advice = build_chip_advice(merged, _ledger(), 30)
    fh = advice['chips']['free_hit']['windows']
    assert any(w['start_gw'] == 33 and w['strength'] == 'play' for w in fh)


def test_no_windows_on_flat_calendar():
    # Every team exactly one fixture per GW 30..35 — no doubles, no blanks.
    merged = [_team_with_calendar(t, {g: 1 for g in range(30, 36)}) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['chips']['bench_boost']['windows'] == []
    assert advice['chips']['triple_captain']['windows'] == []
    assert advice['chips']['free_hit']['windows'] == []


def test_wildcard_never_gets_windows():
    merged = []
    for t in range(1, 21):
        cal = {g: 1 for g in range(30, 36)}
        if t <= 8:
            cal[34] = 2
        merged.append(_team_with_calendar(t, cal))
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['chips']['wildcard']['windows'] == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd pipeline && python -m pytest test_chip_advisor.py -q`
Expected: the 6 new tests FAIL (ImportError on `BB_WIN_DGW`/`FH_WIN_BGW`, then KeyError on `horizon_start`/`windows`); the 8 existing tests still PASS.

- [ ] **Step 3: Add the window thresholds**

In `pipeline/chip_advisor.py`, after the existing `FH_BGW_TEAMS = 4` line (~line 32), add:

```python
# Forward-window thresholds (fixture-shape, tuned to the same DGW/BGW basis as
# the single-GW signals). A GW joins a chip's window when its DGW/BGW team count
# clears these; 'strong' upgrades the merged window to 'play'.
BB_WIN_DGW = 4          # DGW teams that make a GW Bench-Boost territory
BB_WIN_DGW_STRONG = 6
TC_WIN_DGW = 4          # DGW rounds are Triple-Captain territory
TC_WIN_DGW_STRONG = 6
FH_WIN_BGW = 4          # blanking teams that make a GW Free-Hit territory (== FH_BGW_TEAMS)
FH_WIN_DGW = 8          # a very large double is a softer Free-Hit case
```

- [ ] **Step 4: Add the `_chip_windows` helper**

In `pipeline/chip_advisor.py`, add this helper above `build_chip_advice` (after `_signal`, ~line 41):

```python
def _max_scheduled_gw(merged: list, current_gw: int) -> int:
    """Highest event_id present in any player's fixtures, clamped to >= current_gw.

    This is the honesty horizon: past this GW the calendar isn't scheduled, so a
    team with zero fixtures there is NOT a real blank and must not create a window.
    """
    max_gw = current_gw
    for p in merged:
        for f in (p.get('fixtures') or []):
            eid = f.get('event_id')
            if eid is not None and eid > max_gw:
                max_gw = eid
    return max_gw


def _merge_runs(qualifying: list) -> list:
    """qualifying: sorted list of (gw, strength). Merge contiguous GWs into windows.

    Returns list of (start_gw, end_gw, strength) where strength is the strongest
    ('play' > 'consider') across the run.
    """
    rank = {'consider': 0, 'play': 1}
    windows = []
    for gw, strength in qualifying:
        if windows and gw == windows[-1][1] + 1:
            s, e, st = windows[-1]
            best = st if rank[st] >= rank[strength] else strength
            windows[-1] = (s, gw, best)
        else:
            windows.append((gw, gw, strength))
    return windows


def _chip_windows(merged: list, current_gw: int, max_gw: int):
    """Scan current_gw..max_gw for DGW/BGW-driven chip windows.

    Returns (bb_windows, tc_windows, fh_windows) as lists of
    {start_gw, end_gw, strength, reason} dicts.
    """
    bb_q, tc_q, fh_q = [], [], []
    for gw in range(current_gw, max_gw + 1):
        kinds = _detect_dgw_bgw(merged, gw)
        n_dgw = sum(1 for k in kinds.values() if k == 'dgw')
        n_bgw = sum(1 for k in kinds.values() if k == 'bgw')
        if n_dgw >= BB_WIN_DGW:
            bb_q.append((gw, 'play' if n_dgw >= BB_WIN_DGW_STRONG else 'consider'))
        if n_dgw >= TC_WIN_DGW:
            tc_q.append((gw, 'play' if n_dgw >= TC_WIN_DGW_STRONG else 'consider'))
        if n_bgw >= FH_WIN_BGW:
            fh_q.append((gw, 'play'))
        elif n_dgw >= FH_WIN_DGW:
            fh_q.append((gw, 'consider'))

    def _fmt(runs, kind):
        out = []
        for s, e, st in runs:
            span = f"GW{s}" if s == e else f"GW{s}-{e}"
            out.append({'start_gw': s, 'end_gw': e, 'strength': st,
                        'reason': f"{kind} — {span}"})
        return out

    return (_fmt(_merge_runs(bb_q), 'DGW cluster'),
            _fmt(_merge_runs(tc_q), 'DGW round'),
            _fmt(_merge_runs(fh_q), 'blank/large-double'))
```

- [ ] **Step 5: Wire windows into `build_chip_advice`**

In `pipeline/chip_advisor.py`, inside `build_chip_advice`, after the `dgw_teams`/`bgw_teams` lines (~line 52) add:

```python
    max_gw = _max_scheduled_gw(merged, current_gw)
    bb_windows, tc_windows, fh_windows = _chip_windows(merged, current_gw, max_gw)
```

Then in the returned dict: add `'horizon_start': current_gw,` and `'horizon_end': max_gw,` at the top level (next to `'gw': current_gw,`), and add a `'windows'` key to each chip entry:
- `bench_boost`: `'windows': bb_windows,`
- `triple_captain`: `'windows': tc_windows,`
- `free_hit`: `'windows': fh_windows,`
- `wildcard`: `'windows': [],`

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd pipeline && python -m pytest test_chip_advisor.py -q`
Expected: all 12 tests PASS (7 existing + 5 new).

- [ ] **Step 7: Commit**

```bash
git add pipeline/chip_advisor.py pipeline/test_chip_advisor.py
git commit -m "feat(chip-timeline): emit per-chip recommended GW windows from fixture shape"
```

---

### Task 2: Types

**Files:**
- Modify: `src/lib/types.ts:1352-1373` (the chip-advice block)

**Interfaces:**
- Produces: `ChipWindow` interface; `ChipAdviceEntry.windows?: ChipWindow[]`; `ChipAdvice.horizon_start?/horizon_end?: number`. All optional — old JSON parses.

- [ ] **Step 1: Add the types**

In `src/lib/types.ts`, replace the current chip-advice block (lines 1352-1373):

```ts
export type ChipSignal = 'play' | 'consider' | 'hold' | 'informational'

export interface ChipAdviceEntry {
  signal: ChipSignal
  value?: number
  captain?: string | null
  reason: string
}

export interface ChipAdvice {
  gw: number
  generated_at: string
  dgw_team_count: number
  bgw_team_count: number
  chips: {
    bench_boost: ChipAdviceEntry
    triple_captain: ChipAdviceEntry
    free_hit: ChipAdviceEntry
    wildcard: ChipAdviceEntry
  }
  note: string
}
```

with:

```ts
export type ChipSignal = 'play' | 'consider' | 'hold' | 'informational'

// Chip-timeline: a recommended GW window for a chip, from confirmed fixture shape.
export interface ChipWindow {
  start_gw: number
  end_gw: number
  strength: 'play' | 'consider'
  reason: string
}

export interface ChipAdviceEntry {
  signal: ChipSignal
  value?: number
  captain?: string | null
  reason: string
  windows?: ChipWindow[]
}

export interface ChipAdvice {
  gw: number
  generated_at: string
  dgw_team_count: number
  bgw_team_count: number
  chips: {
    bench_boost: ChipAdviceEntry
    triple_captain: ChipAdviceEntry
    free_hit: ChipAdviceEntry
    wildcard: ChipAdviceEntry
  }
  note: string
  horizon_start?: number
  horizon_end?: number
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(chip-timeline): ChipWindow type + optional windows/horizon fields"
```

---

### Task 3: `ChipTimelineBar` component

**Files:**
- Create: `src/components/cockpit/ChipTimelineBar.tsx`
- Create: `src/components/cockpit/ChipTimelineBar.test.tsx`

**Interfaces:**
- Consumes: `ChipWindow` from `@/lib/types` (Task 2).
- Produces: `export function ChipTimelineBar({ windows, horizonStart, horizonEnd }: { windows: ChipWindow[]; horizonStart?: number; horizonEnd?: number }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/components/cockpit/ChipTimelineBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChipTimelineBar } from './ChipTimelineBar'
import type { ChipWindow } from '@/lib/types'

const win = (o: Partial<ChipWindow> = {}): ChipWindow => ({
  start_gw: 34, end_gw: 35, strength: 'play', reason: 'DGW cluster — GW34-35', ...o,
})

describe('ChipTimelineBar', () => {
  it('renders a segment per window with its GW-range label', () => {
    const { container } = render(
      <ChipTimelineBar windows={[win()]} horizonStart={30} horizonEnd={38} />,
    )
    const seg = container.querySelector('[data-window]')
    expect(seg).not.toBeNull()
    expect(container.textContent).toContain('GW34-35')
  })

  it('marks a single-GW window with just GW{n}', () => {
    const { container } = render(
      <ChipTimelineBar windows={[win({ start_gw: 33, end_gw: 33 })]} horizonStart={30} horizonEnd={38} />,
    )
    expect(container.textContent).toContain('GW33')
    expect(container.textContent).not.toContain('GW33-')
  })

  it('styles play and consider differently', () => {
    const { container } = render(
      <ChipTimelineBar
        windows={[win({ strength: 'play' }), win({ start_gw: 36, end_gw: 36, strength: 'consider' })]}
        horizonStart={30}
        horizonEnd={38}
      />,
    )
    const segs = container.querySelectorAll('[data-window]')
    expect(segs.length).toBe(2)
    expect(segs[0].getAttribute('data-strength')).toBe('play')
    expect(segs[1].getAttribute('data-strength')).toBe('consider')
  })

  it('shows an empty-state hint when there are no windows', () => {
    const { container } = render(<ChipTimelineBar windows={[]} horizonStart={30} horizonEnd={38} />)
    expect(container.querySelector('[data-window]')).toBeNull()
    expect(container.textContent).toContain('no confirmed windows yet')
  })

  it('shows the empty hint when horizon is missing (old JSON)', () => {
    const { container } = render(<ChipTimelineBar windows={[win()]} />)
    expect(container.querySelector('[data-window]')).toBeNull()
    expect(container.textContent).toContain('no confirmed windows yet')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/cockpit/ChipTimelineBar.test.tsx`
Expected: FAIL — `Cannot find module './ChipTimelineBar'`.

- [ ] **Step 3: Write the component**

Create `src/components/cockpit/ChipTimelineBar.tsx`:

```tsx
'use client'
// Chip-timeline: a horizontal GW axis (horizonStart..horizonEnd) with recommended
// windows drawn as positioned segments. play = accent fill, consider = muted. When
// there are no windows (early season) or the horizon is unknown (old cached JSON),
// it renders the track with an honest "no confirmed windows yet" hint.
import type { ChipWindow } from '@/lib/types'

function label(w: ChipWindow): string {
  return w.start_gw === w.end_gw ? `GW${w.start_gw}` : `GW${w.start_gw}-${w.end_gw}`
}

export function ChipTimelineBar({
  windows,
  horizonStart,
  horizonEnd,
}: {
  windows: ChipWindow[]
  horizonStart?: number
  horizonEnd?: number
}) {
  const hasHorizon = typeof horizonStart === 'number' && typeof horizonEnd === 'number' && horizonEnd > horizonStart
  const show = hasHorizon && windows.length > 0

  if (!show) {
    return (
      <div className="relative h-4 w-full rounded bg-surface-2" role="img" aria-label="No confirmed chip windows yet">
        <span className="absolute inset-0 flex items-center justify-center text-data text-ink-faint">
          no confirmed windows yet
        </span>
      </div>
    )
  }

  const span = horizonEnd! - horizonStart!
  return (
    <div className="relative h-4 w-full rounded bg-surface-2" role="img" aria-label="Recommended chip windows by gameweek">
      {windows.map((w) => {
        const left = ((w.start_gw - horizonStart!) / span) * 100
        const width = ((w.end_gw - w.start_gw + 1) / span) * 100
        return (
          <span
            key={`${w.start_gw}-${w.end_gw}`}
            data-window
            data-strength={w.strength}
            title={w.reason}
            className={`absolute inset-y-0 flex items-center justify-center rounded text-[10px] font-medium leading-none ${
              w.strength === 'play'
                ? 'bg-accent text-on-accent'
                : 'bg-surface-1 border border-line text-ink-muted'
            }`}
            style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
          >
            {label(w)}
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/cockpit/ChipTimelineBar.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/cockpit/ChipTimelineBar.tsx src/components/cockpit/ChipTimelineBar.test.tsx
git commit -m "feat(chip-timeline): ChipTimelineBar season-window component"
```

---

### Task 4: Wire the bar into `ChipAdviceCard`

**Files:**
- Modify: `src/components/cockpit/ChipAdviceCard.tsx`
- Modify: `src/components/cockpit/ChipAdviceCard.test.tsx` (extend)

**Interfaces:**
- Consumes: `ChipTimelineBar` (Task 3); `ChipAdvice.horizon_start/horizon_end` and `ChipAdviceEntry.windows` (Task 2).

**Context:** `ChipRow` currently takes `{ id, entry }`. It needs the horizon to draw the bar, and the bar shows only for BB/TC/FH (not Wildcard). The card maps over the four chip ids at lines 62-64.

- [ ] **Step 1: Write/extend the failing test**

Add to `src/components/cockpit/ChipAdviceCard.test.tsx`. First extend the `DATA` fixture to include windows + horizon (replace the `chips`/`note` tail and add the horizon fields):

```tsx
const DATA: ChipAdvice = {
  gw: 12, generated_at: '2026-07-03T00:00:00+00:00',
  dgw_team_count: 4, bgw_team_count: 0,
  chips: {
    bench_boost: { signal: 'play', value: 15.2, reason: 'Predicted bench = 15.2 xPts with 4 DGW teams',
      windows: [{ start_gw: 34, end_gw: 35, strength: 'play', reason: 'DGW cluster — GW34-35' }] },
    triple_captain: { signal: 'consider', value: 8.1, captain: 'Haaland', reason: 'Top captain projects 8.1', windows: [] },
    free_hit: { signal: 'hold', value: 61.0, reason: 'No blank-GW pressure', windows: [] },
    wildcard: { signal: 'informational', reason: 'Fixture-swing driven', windows: [] },
  },
  note: 'Generic advice',
  horizon_start: 12, horizon_end: 38,
}
```

Then add two tests inside the `describe`:

```tsx
  it('draws a window segment for a chip that has one', () => {
    mockHook.mockReturnValue(asResult({ data: DATA, isLoading: false, isError: false }))
    const { container } = render(<ChipAdviceCard />)
    const segs = container.querySelectorAll('[data-window]')
    expect(segs.length).toBe(1)                       // only bench_boost has a window
    expect(container.textContent).toContain('GW34-35')
  })

  it('does not render a timeline bar for Wildcard', () => {
    mockHook.mockReturnValue(asResult({ data: DATA, isLoading: false, isError: false }))
    const { container } = render(<ChipAdviceCard />)
    // 3 bars (BB/TC/FH) — Wildcard row has none.
    expect(container.querySelectorAll('[role="img"]').length).toBe(3)
  })
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/components/cockpit/ChipAdviceCard.test.tsx`
Expected: the 2 new tests FAIL (no `[data-window]` / no `[role="img"]` bars yet); the 3 existing tests PASS.

- [ ] **Step 3: Wire the bar into the card**

In `src/components/cockpit/ChipAdviceCard.tsx`:

Add the import after the existing `EmptyState` import:

```tsx
import { ChipTimelineBar } from './ChipTimelineBar'
```

Change `ChipRow` to accept the horizon and render the bar for non-Wildcard chips. Replace the current `ChipRow` (lines 26-41):

```tsx
function ChipRow({ id, entry }: { id: string; entry: ChipAdviceEntry }) {
  return (
    <li className="flex items-start gap-3 border-b border-line pb-2.5 last:border-0 last:pb-0">
      <div className="w-28 shrink-0">
        <div className="text-body font-semibold text-ink">{CHIP_LABEL[id] ?? id}</div>
        {entry.value != null && (
          <div className="text-data tabular text-ink-muted">{entry.value.toFixed(1)} xPts</div>
        )}
      </div>
      <Chip intent={SIGNAL_INTENT[entry.signal]} size="sm">
        {entry.signal}
      </Chip>
      <p className="min-w-0 flex-1 text-data leading-relaxed text-ink-muted">{entry.reason}</p>
    </li>
  )
}
```

with:

```tsx
function ChipRow({
  id,
  entry,
  horizonStart,
  horizonEnd,
}: {
  id: string
  entry: ChipAdviceEntry
  horizonStart?: number
  horizonEnd?: number
}) {
  return (
    <li className="border-b border-line pb-2.5 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="w-28 shrink-0">
          <div className="text-body font-semibold text-ink">{CHIP_LABEL[id] ?? id}</div>
          {entry.value != null && (
            <div className="text-data tabular text-ink-muted">{entry.value.toFixed(1)} xPts</div>
          )}
        </div>
        <Chip intent={SIGNAL_INTENT[entry.signal]} size="sm">
          {entry.signal}
        </Chip>
        <p className="min-w-0 flex-1 text-data leading-relaxed text-ink-muted">{entry.reason}</p>
      </div>
      {id !== 'wildcard' && (
        <div className="mt-2 pl-[7.75rem]">
          <ChipTimelineBar windows={entry.windows ?? []} horizonStart={horizonStart} horizonEnd={horizonEnd} />
        </div>
      )}
    </li>
  )
}
```

Then pass the horizon down where the rows are mapped (lines 62-64):

```tsx
            {(['bench_boost', 'triple_captain', 'free_hit', 'wildcard'] as const).map((id) => (
              <ChipRow key={id} id={id} entry={data.chips[id]} horizonStart={data.horizon_start} horizonEnd={data.horizon_end} />
            ))}
```

Update the footer note (line 66) to add the honesty caveat:

```tsx
          <p className="mt-3 text-data text-ink-muted">
            {data.note} Windows are drawn from confirmed fixtures and fill in as DGWs/BGWs are scheduled.
          </p>
```

- [ ] **Step 4: Run the card tests + tsc**

Run: `npx vitest run src/components/cockpit/ChipAdviceCard.test.tsx && npx tsc --noEmit`
Expected: all 5 tests PASS (3 existing + 2 new), 0 tsc errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/cockpit/ChipAdviceCard.tsx src/components/cockpit/ChipAdviceCard.test.tsx
git commit -m "feat(chip-timeline): render window bars in the chip advisor rows"
```

---

## Final Verification (after all tasks)

- [ ] `cd pipeline && python -m pytest test_chip_advisor.py -q` → 12 pass
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx vitest run src/components/cockpit/` → cockpit suite green (incl. ChipTimelineBar + ChipAdviceCard)
- [ ] `npx vitest run` → full suite green
- [ ] Manual dev-server eyeball (user): chip advisor rows show window bars (BB/TC/FH) or the "no confirmed windows yet" hint early season; Wildcard row has no bar; both light and dark.
