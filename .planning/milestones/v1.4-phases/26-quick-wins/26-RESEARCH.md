# Phase 26: Quick Wins - Research

**Researched:** 2026-04-27
**Domain:** FPL pipeline field extraction, set-piece UI panel, mobile orientation detection
**Confidence:** HIGH

---

## Summary

Phase 26 is the first phase of v1.4 and deliberately has no upstream dependencies. It delivers four self-contained deliverables: (1) extract three `_text` set-piece fields into merged_players.json (DATA-04), (2) a new "Set Pieces" tab with a team grid panel showing primary takers per team (SP-01), (3) an inline amber alert when taker orders change between pipeline runs (SP-02), and (4) a passive landscape-tip banner on Gems and DefCon tabs for mobile portrait users (MOB-LS-01).

A critical discovery: the three `penalties_text`, `direct_freekicks_text`, and `corners_and_indirect_freekicks_text` fields are already present in FPL bootstrap-static but are **all empty strings** in the current season's data. The numeric `_order` fields (`penalties_order`, `direct_freekicks_order`, `corners_and_indirect_freekicks_order`) are fully populated and are the real data source for SP-01. DATA-04 must extract the `_text` fields into merged_players.json regardless of their current emptiness — this satisfies the literal requirement and positions the pipeline for when FPL populates them. The `_order` fields are already in merged_players.json and in the `MergedPlayer` TypeScript type.

SP-02 (change detection) requires the pipeline to persist a previous-run snapshot for diffing. No such snapshot mechanism exists today. The plan must add a `set_pieces_snapshot.json` written by the pipeline at the end of each successful run. On the next run, the pipeline reads the previous snapshot, diffs it against the new data, and writes a `set_piece_changes.json` (or includes a `changed` boolean per field in the merged output). A dedicated API route serves this to the UI.

**Primary recommendation:** Drive the SP-01 panel from the existing `_order` numeric fields already in merged_players.json. Add the three `_text` fields for DATA-04 compliance. Implement SP-02 via a pipeline snapshot diff, not a Vercel Blob version list.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-04 | Extract `penalties_text`, `direct_freekicks_text`, `corners_and_indirect_freekicks_text` from FPL bootstrap-static into merged_players.json | Fields exist in bootstrap-static (all empty strings currently). pipeline/merge.py must pass them through. MergedPlayer TypeScript type must gain three new string fields. |
| SP-01 | User can see the penalty taker, direct FK taker, and corner taker for each team in a dedicated panel | Data available via existing `_order` fields in merged_players.json. New "Set Pieces" tab + SetPieceTakerPanel component. API route derives primary taker per team by grouping players by `team` and filtering for `_order === 1`. |
| SP-02 | User is alerted when a set-piece order change is detected between the current and previous pipeline run | No snapshot mechanism exists today. Pipeline must write `set_pieces_snapshot.json` at end of each run. Next run diffs against it. A dedicated `set_piece_changes.json` (or inline `sp_changed` flags) serves the alert. |
| MOB-LS-01 | User sees a subtle landscape tip on Gems and DefCon tabs on mobile portrait orientation | Pattern fully established: `isMobile` state (`window.innerWidth < 640`) via resize listener. Add `isPortrait` state via `window.innerHeight > window.innerWidth` + `orientationchange` listener. LandscapeTip component rendered in GemTable and DefConTables. |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component rendering | Project standard |
| Next.js | 16.2.1 | App router, API routes | Project standard — read `node_modules/next/dist/docs/` before writing code |
| TypeScript | ^5 | Type safety | Project standard |
| Tailwind v4 | ^4 | Utility CSS via `@import "tailwindcss"` with `@theme inline` | Project standard — no shadcn, no component registry |
| @tanstack/react-query | ^5.95.2 | Data fetching hooks | Project standard (`useQuery`) |
| @vercel/blob | ^2.3.1 | Production data storage | Project standard |

### Supporting (Pipeline)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Python | 3.11.9 | Pipeline scripting | All pipeline changes |
| requests | 2.32.3 | FPL API fetch | Already in use |

### No New Dependencies

This phase introduces zero new npm or pip packages. All deliverables use the existing stack.

---

## Architecture Patterns

### Recommended Project Structure

```
pipeline/
├── merge.py              # Add three _text fields (DATA-04)
├── run.py                # Add snapshot write + diff logic (SP-02)
└── cache/
    ├── merged_players.json          # gains 3 new string fields
    ├── set_pieces_snapshot.json     # NEW: persisted per-run snapshot for SP-02
    └── set_piece_changes.json       # NEW: diff output consumed by API + UI

src/
├── app/
│   ├── page.tsx                     # Add 'set-pieces' to Tab union + tab bar + MobileNav
│   └── api/
│       └── set-pieces/
│           └── route.ts             # NEW: serves set_piece_changes.json (Blob/local)
├── components/
│   ├── set-pieces/                  # NEW directory
│   │   ├── SetPieceTakerPanel.tsx   # SP-01: grid of 20 TeamSetPieceCard
│   │   ├── SetPieceChangeAlert.tsx  # SP-02: amber alert banner
│   │   └── LandscapeTip.tsx        # MOB-LS-01: portrait orientation tip
│   ├── gem-table/
│   │   └── GemTable.tsx             # Add <LandscapeTip> below filters
│   └── defcon/
│       └── DefConTables.tsx         # Add <LandscapeTip> below filters
├── lib/
│   ├── types.ts                     # MergedPlayer gains 3 new string fields; new SetPieceChanges type
│   └── hooks/
│       └── useSetPieces.ts          # NEW: useQuery for /api/set-pieces
└── nav/
    └── MobileNav.tsx                # Add 'set-pieces'/'SP' tab entry
```

### Pattern 1: Tab Addition

**What:** Add a new tab to the existing union type + desktop tab bar + MobileNav.

**When to use:** Any new top-level section in the app.

```typescript
// page.tsx — extend the union
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems' | 'planner' | 'set-pieces'

// Desktop tab bar — copy exact className pattern from existing tabs, insert after 'club-form':
<button
  className={`pb-2 px-1 text-sm font-medium ${
    activeTab === 'set-pieces'
      ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
  }`}
  onClick={() => setActiveTab('set-pieces')}
>
  Set Pieces
</button>

// Tab content render:
{activeTab === 'set-pieces' && <SetPieceTakerPanel />}
```

```typescript
// MobileNav.tsx — extend TABS const satisfies array:
const TABS = [
  { id: 'gems',        label: 'Gems' },
  { id: 'defcon',      label: 'DefCon' },
  { id: 'squad',       label: 'Squad' },
  { id: 'club-form',   label: 'Form' },
  { id: 'set-pieces',  label: 'SP' },       // <-- new, after 'Form'
  { id: 'value-gems',  label: 'Values' },
  { id: 'planner',     label: 'Plan' },
] as const satisfies ReadonlyArray<{ id: Tab; label: string }>
```

Note: 7 tabs in mobile nav. Existing layout uses `flex-1` per button — adding one tab compresses all widths. This is acceptable given the existing pattern does not impose a hard limit.

### Pattern 2: API Route (Blob/Local)

**What:** Every new data file served to the UI follows the same pattern: `list()` in production, `readFile()` in dev.

**When to use:** Any new pipeline output file.

```typescript
// src/app/api/set-pieces/route.ts
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'set_piece_changes.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Set-piece data not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'set_piece_changes.json')
      data = await readFile(cachePath, 'utf-8')
    }
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
  }
}
```

### Pattern 3: isMobile + isPortrait Orientation Detection

**What:** LandscapeTip renders only when `isMobile && isPortrait`. Both states use event listeners, not CSS media queries alone (though `sm:hidden` is used as defence-in-depth).

**When to use:** Any feature that differs by device size or orientation.

```typescript
// Reuse existing isMobile pattern + add isPortrait
const [isMobile, setIsMobile] = useState(false)
const [isPortrait, setIsPortrait] = useState(false)

useEffect(() => {
  const checkOrientation = () => {
    setIsMobile(window.innerWidth < 640)
    setIsPortrait(window.innerHeight > window.innerWidth)
  }
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
  return () => {
    window.removeEventListener('resize', checkOrientation)
    window.removeEventListener('orientationchange', checkOrientation)
  }
}, [])
```

Note: `window.screen.orientation.type` is more precise but has inconsistent behaviour across iOS Safari and Android Chrome. `window.innerHeight > window.innerWidth` is reliable and matches the existing `isMobile` pattern's dimension-comparison approach.

### Pattern 4: SP-02 Pipeline Snapshot Diff

**What:** At the end of each successful pipeline run, write a compact snapshot of current set-piece orders. On the next run, load the previous snapshot, diff, and write a changes file.

**Design decision:** Store the snapshot as a flat dict `{ team_id: { penalty: player_id, fk: player_id, corner: player_id } }` keyed by team. "Change" = the primary taker player_id differs between runs.

```python
# In run.py, after merged is built:

import json, os

def _extract_sp_snapshot(merged: list) -> dict:
    """Extract primary set-piece taker IDs per team from merged players."""
    snapshot = {}
    for player in merged:
        team = str(player['team'])
        if team not in snapshot:
            snapshot[team] = {'penalty': None, 'fk': None, 'corner': None}
        if player.get('penalties_order') == 1:
            snapshot[team]['penalty'] = player['id']
        if player.get('direct_freekicks_order') == 1:
            snapshot[team]['fk'] = player['id']
        if player.get('corners_and_indirect_freekicks_order') == 1:
            snapshot[team]['corner'] = player['id']
    return snapshot

def _diff_sp_snapshots(prev: dict, curr: dict) -> dict:
    """Return dict of changes: { team_id: { role: { prev_id, curr_id } } }"""
    changes = {}
    for team_id, curr_roles in curr.items():
        prev_roles = prev.get(team_id, {})
        for role, curr_id in curr_roles.items():
            prev_id = prev_roles.get(role)
            if prev_id != curr_id and not (prev_id is None and curr_id is None):
                if team_id not in changes:
                    changes[team_id] = {}
                changes[team_id][role] = {'prev_id': prev_id, 'curr_id': curr_id}
    return changes
```

The pipeline then saves `set_pieces_snapshot.json` (for the next run) and `set_piece_changes.json` (for the API). In local dev, the snapshot file is read from `pipeline/cache/`. In production (Blob), `set_pieces_snapshot.json` is uploaded alongside other files and listed on the next run.

**SP-02 first-run behaviour:** If no previous snapshot exists, write `set_piece_changes.json` as `{ "changes": {}, "change_count": 0, "has_changes": false }` — no alert shown.

### Pattern 5: DATA-04 Merge Extension

**What:** Three fields are added to the `player` dict in `merge.py` (section 7) and to the `MergedPlayer` interface in `types.ts`.

```python
# merge.py — inside the player dict construction block:
'penalties_text': element.get('penalties_text', ''),
'direct_freekicks_text': element.get('direct_freekicks_text', ''),
'corners_and_indirect_freekicks_text': element.get('corners_and_indirect_freekicks_text', ''),
```

```typescript
// types.ts — inside MergedPlayer interface:
penalties_text: string                          // FPL text field (empty string when FPL has no data)
direct_freekicks_text: string
corners_and_indirect_freekicks_text: string
```

### Anti-Patterns to Avoid

- **Deriving SP-01 from `_text` fields:** All three `_text` fields are empty strings in the current FPL season. The UI must use `_order` fields (group by team, find player where `penalties_order === 1`) to determine the primary taker. The `_text` fields are stored in merged_players.json purely for DATA-04 completeness.
- **Using `window.screen.orientation` as the sole portrait check:** iOS Safari has historically had quirks with this API. Always fall back to `window.innerHeight > window.innerWidth`.
- **Dismissible landscape tip:** The UI spec says no dismiss button — the tip is passive and re-evaluates on orientation change.
- **Including changes diff in merged_players.json:** The diff is a pipeline-run artefact, not player data. It belongs in a separate `set_piece_changes.json` served via its own API route.
- **7-tab mobile nav line-length:** With 7 tabs using `flex-1`, each button gets ~14% width on a 390px phone = ~55px. At `text-xs` (12px) this is tight but workable. "SP" (2 chars) is the correct truncation chosen in the UI spec.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching with loading/error states | Custom fetch + useState | `useQuery` from @tanstack/react-query | Already used in all hooks; handles caching, dedup, stale-while-revalidate |
| Blob/local routing in API routes | Custom storage abstraction | The established `USE_BLOB` pattern from existing routes | Consistent, tested, already understood by the codebase |
| Orientation detection via CSS only | Media query `@media (orientation: portrait)` | JS listener + `sm:hidden` as defence-in-depth | JS state needed to conditionally render JSX, not just style |

---

## Common Pitfalls

### Pitfall 1: _text Fields Are Always Empty Strings

**What goes wrong:** Developer reads DATA-04 requirement, checks bootstrap-static, sees `penalties_text` field, adds it to merged output, and then tries to display it in SP-01 — finds it's always `""` and the panel shows nothing.

**Why it happens:** FPL populates `_text` as a human-readable description (e.g. "Penalty taker for Arsenal") but does NOT populate it in the current 2025/26 season. The numeric `_order` fields are the live data.

**How to avoid:** SP-01 renders by grouping `merged_players` by `team`, then finding the player with `penalties_order === 1` for each team. Display `player.web_name`. The `_text` fields are only extracted for future use (DATA-04).

**Warning signs:** Panel shows "—" for every team when `_text` field is used; panel shows real player names when `_order === 1` filter is used.

### Pitfall 2: SP-02 — First Pipeline Run After Deployment Has No Previous Snapshot

**What goes wrong:** Pipeline runs, tries to load `set_pieces_snapshot.json`, file doesn't exist, unhandled exception crashes the pipeline.

**Why it happens:** The snapshot file is new; no previous run has written it yet.

**How to avoid:** Wrap the snapshot read in a try/except. If file not found, set `prev_snapshot = {}`. The diff then produces `change_count = 0` and no alert is shown.

### Pitfall 3: MobileNav 7-Tab Layout Regression

**What goes wrong:** Adding the "SP" tab makes the mobile nav text overflow or the touch targets become too small.

**Why it happens:** `min-h-[44px]` is set (good) but text truncation is not guaranteed at extreme widths.

**How to avoid:** "SP" is 2 characters at `text-xs` — this is the shortest reasonable label. The UI spec confirms this choice. No overflow should occur on standard mobile widths (360px+).

### Pitfall 4: LandscapeTip Shows on Desktop

**What goes wrong:** Portrait detection fires on a desktop browser with a narrow/tall window, showing the landscape tip on non-mobile.

**Why it happens:** The `isPortrait` check (`window.innerHeight > window.innerWidth`) is purely dimensional — a narrow desktop window can match.

**How to avoid:** The guard is `isMobile && isPortrait`. `isMobile` requires `window.innerWidth < 640` — a normal desktop window is wider than 640px. The `sm:hidden` class adds a CSS-level backup.

### Pitfall 5: Snapshot Storage in Production (Blob)

**What goes wrong:** Pipeline uploads `set_pieces_snapshot.json` to Blob. On next run, `list({ prefix: 'set_pieces_snapshot.json', limit: 1 })` works. But Blob `put` with `allowOverwrite: true` replaces the file — the previous snapshot is lost before it can be read.

**Why it happens:** The pipeline reads the snapshot AFTER uploading new data if the order is wrong.

**How to avoid:** In `run.py`, the snapshot diff must happen BEFORE `save('set_pieces_snapshot.json', ...)`. The sequence is: (1) fetch bootstrap, (2) compute merged, (3) read previous snapshot from Blob/local, (4) compute diff, (5) save changes file, (6) save new snapshot (overwrites previous). This order preserves the previous snapshot long enough to diff it.

---

## Code Examples

### SetPieceChangeAlert (matches amber pattern from TransferPanel.tsx)

```typescript
// src/components/set-pieces/SetPieceChangeAlert.tsx
// Source: TransferPanel.tsx line 237 — `rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200`
export function SetPieceChangeAlert({ changeCount }: { changeCount: number }) {
  if (changeCount === 0) return null
  return (
    <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200 mb-4">
      <span className="font-semibold">Set-piece changes detected</span>
      {' — '}{changeCount} taker order change(s) since the last pipeline run. Updated rows are marked below.
    </div>
  )
}
```

### LandscapeTip (exact structure from UI spec)

```typescript
// src/components/set-pieces/LandscapeTip.tsx
export function LandscapeTip({ isMobile, isPortrait }: { isMobile: boolean; isPortrait: boolean }) {
  if (!isMobile || !isPortrait) return null
  return (
    <div className="sm:hidden rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300 mb-2">
      Rotate to landscape for the full table.
    </div>
  )
}
```

### Set-piece data shape (set_piece_changes.json)

```json
{
  "has_changes": true,
  "change_count": 2,
  "teams": [
    {
      "team_id": 1,
      "team_short_name": "ARS",
      "penalty_taker": { "id": 232, "name": "Saka", "changed": false },
      "fk_taker": { "id": 302, "name": "Rice", "changed": true },
      "corner_taker": { "id": 302, "name": "Rice", "changed": false }
    }
  ]
}
```

This single file serves both SP-01 (team taker listing) and SP-02 (change flag per role). The UI derives `change_count` and `has_changes` from this to control alert visibility.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate orientation API (`screen.orientation.type`) | `innerHeight > innerWidth` comparison | Consistent practice post-iOS 16 | More reliable across Safari/Chrome mobile |
| Polling for data freshness | `staleTime` in useQuery | TanStack Query v4+ | No polling loop needed; data served from 6h cache |

---

## Open Questions

1. **Snapshot in Vercel Blob for production**
   - What we know: `save()` in upload.py uses `allowOverwrite: True` — reading must happen before writing.
   - What's unclear: Whether the snapshot read in production uses `list()` (finds latest blob) or a direct URL fetch — the `list()` pattern is already established.
   - Recommendation: Use `list({ prefix: 'set_pieces_snapshot.json', limit: 1 })` in production, `readFile` in dev. If not found (first run), treat as empty dict.

2. **7-tab mobile nav visual regression**
   - What we know: Current 6 tabs work. 7th tab reduces each button width by ~3-4px.
   - What's unclear: Whether "SP" fits acceptably at the smallest supported widths (360px).
   - Recommendation: Implement, check at 360px. Worst case: relabel "Plan" as "Pl" or reorder — but this is very likely to be fine at `text-xs`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | Pipeline changes (merge.py, run.py) | Yes | 3.11.9 | — |
| requests | Pipeline FPL fetch | Yes | 2.32.3 | — |
| Node.js | Next.js dev server | Yes | 25.8.1 | — |
| vitest | Test suite | Yes | ^4.1.2 | — |
| pipeline/cache/merged_players.json | Local dev data source | Yes | current (Apr 2026) | Run pipeline |
| pipeline/cache/set_pieces_snapshot.json | SP-02 first-run diff | No (does not exist yet) | — | Empty dict (handled in code) |

**Missing dependencies with no fallback:** None — all are either available or handled gracefully in code.

**Missing dependencies with fallback:**
- `set_pieces_snapshot.json`: Does not exist on first run. Pipeline must handle `FileNotFoundError` and treat as empty dict.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

Current baseline: 21 test files, 240 passed, 8 skipped. All tests pass in 609ms.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-04 | `merged_players.json` contains `penalties_text`, `direct_freekicks_text`, `corners_and_indirect_freekicks_text` as strings | unit (skipped, requires pipeline run) | `npx vitest run tests/lib/merge.test.ts` | Extend existing merge.test.ts |
| SP-01 | SetPieceTakerPanel renders 20 team cards with taker names derived from `_order === 1` | unit | `npx vitest run tests/components/set-pieces` | ❌ Wave 0 |
| SP-02 | SetPieceChangeAlert shown when `has_changes: true`, hidden when `false` | unit | `npx vitest run tests/components/set-pieces` | ❌ Wave 0 |
| MOB-LS-01 | LandscapeTip renders when `isMobile && isPortrait`, hidden otherwise | unit | `npx vitest run tests/components/set-pieces` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/components/set-pieces/SetPieceTakerPanel.test.tsx` — covers SP-01
- [ ] `tests/components/set-pieces/SetPieceChangeAlert.test.tsx` — covers SP-02
- [ ] `tests/components/set-pieces/LandscapeTip.test.tsx` — covers MOB-LS-01
- [ ] Extend `tests/lib/merge.test.ts` — add skipped tests for DATA-04 fields

Note: Vitest config uses `environment: 'node'`. Component tests that call `window.innerWidth` need either a jsdom environment override or to test the logic in isolation (passing props directly). The LandscapeTip and alert components accept props rather than reading window themselves — this makes unit testing straightforward.

---

## Project Constraints (from CLAUDE.md)

- Do not add `Co-Authored-By` trailers to git commits.
- This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices. (Next.js 16.2.1 with React 19.2.4 — breaking changes from training data.)
- No shadcn: `components.json` is not present. All components are hand-rolled Tailwind v4 utilities.
- Tailwind is v4 via `@import "tailwindcss"` with `@theme inline` — not v3 config file style.
- No new npm or pip dependencies for this phase.

---

## Sources

### Primary (HIGH confidence)

- Codebase scan: `pipeline/merge.py` — existing field extraction pattern, MergedPlayer shape
- Codebase scan: `pipeline/fpl_client.py` — bootstrap-static fetch
- Codebase scan: `pipeline/cache/fpl_bootstrap.json` — live FPL data confirming `_text` fields are empty, `_order` fields populated
- Codebase scan: `pipeline/cache/merged_players.json` — confirmed `_text` fields not yet in output, `_order` fields already present
- Codebase scan: `src/app/page.tsx` — Tab union, desktop tab bar pattern
- Codebase scan: `src/components/nav/MobileNav.tsx` — TABS array, flex-1 layout
- Codebase scan: `src/components/gem-table/GemTable.tsx` — isMobile pattern (resize listener, `window.innerWidth < 640`)
- Codebase scan: `src/components/defcon/DefConTables.tsx` — isMobile pattern (same)
- Codebase scan: `src/components/transfers/TransferPanel.tsx` — amber alert className pattern
- Codebase scan: `src/app/api/defcon/route.ts` — Blob/local API route template
- Codebase scan: `src/lib/types.ts` — MergedPlayer interface, complete field list
- Codebase scan: `vitest.config.ts` + test run — 240 tests passing, node environment, 609ms duration
- UI Spec: `.planning/phases/26-quick-wins/26-UI-SPEC.md` — definitive component design

### Secondary (MEDIUM confidence)

- `window.innerHeight > window.innerWidth` orientation check — widely documented cross-browser approach; preferred over `screen.orientation.type` for iOS Safari compatibility

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing codebase
- Architecture patterns: HIGH — derived from existing code patterns in the same codebase
- DATA-04 field status: HIGH — verified by direct inspection of fpl_bootstrap.json and merged_players.json
- SP-02 snapshot approach: HIGH — derived from upload.py and existing Blob patterns
- Pitfalls: HIGH — grounded in actual data state (empty `_text` fields confirmed)

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable architecture; FPL season ends May 2026 so `_text` fields may populate before then)
