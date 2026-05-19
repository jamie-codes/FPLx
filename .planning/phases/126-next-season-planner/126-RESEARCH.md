# Phase 126: Next Season Planner - Research

**Researched:** 2026-05-19
**Domain:** FPL pipeline archiving (Python/asyncio), TypeScript greedy squad builder, React tab integration, FDR heatmap reuse
**Confidence:** HIGH

## Summary

Phase 126 has four distinct deliverables that touch every layer of the stack: a Python pipeline step (`archive_season.py`), a TypeScript squad-building function (`buildPreSeasonSquad()`), a Python ILP fallback (`suggest_squad.py`), and a new React tab (`NextSeasonPlannerTab`). Each deliverable has well-understood patterns already established in this codebase — the research confirms that no new infrastructure or unfamiliar libraries are required.

The most technically novel aspect is `buildPreSeasonSquad()`: it differs from `buildOptimalSquad()` (WC/FH) in that it operates from a caller-supplied score map (`points_per_minute`) rather than live `xPts_*` fields, and filters players with < 500 total minutes. This means the function cannot reuse `buildOptimalSquad` directly — it must be a fresh function following the same greedy pattern. PuLP is not in the current Python requirements and must be added.

The concurrent fetch in `archive_season.py` requires `concurrent.futures.ThreadPoolExecutor` with `requests` (synchronous). `asyncio + aiohttp` is not available and not needed — `ThreadPoolExecutor` + `requests` is the idiomatic pattern when adding concurrency to an existing synchronous pipeline.

**Primary recommendation:** Build each deliverable as a focused, isolated unit following the exact existing patterns (upload.py save(), non-fatal try/except, idempotent Blob check, TanStack Query 6h staleTime hook, SubTab registration at the bottom of the Plan SECTIONS array).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pre-season Player Scoring (NSP-02)**
- D-01: Score source is `season_archive_gw38.json`. No bootstrap `ep_next` or `form`.
- D-02: Score formula: `points_per_minute = total_points / total_minutes`. Players with < 500 total minutes are excluded (unscored / ineligible). This value is passed in the caller-supplied score map to `buildPreSeasonSquad()`.
- D-03: "Prices pending" graceful state triggers when `season_archive_gw38.json` is absent from Blob. No second check needed.

**Squad Builder UI (NSP-04)**
- D-04: Read-only formation grid. No swapping, locking, or interactive editing in this phase.
- D-05: Layout mirrors OptimiserPanel: GK row / DEF row / MID row / FWD row + 4 bench.
- D-06: Each player card shows: name, team name, `£X.Xm` cost, last-season total points. Pts-per-minute shown as tooltip only.
- D-07: Sub-tab ID: `'next-season'`, label: `"Next Season"`, mobileLabel: `"Pre-Season"`. Placed after `'rivals'` in Plan section.

**archive_season.py Pipeline Integration (NSP-01)**
- D-08: Integrated into `run.py` behind a GW38 gate (current_event is GW38 or last available GW in events[]). Idempotent: if `season_archive_gw38.json` already exists in Blob, skip silently. Runs alongside other pipeline steps, not standalone.
- D-09: Archive scope: per-player `/element-summary/{id}/` fetch for every player in bootstrap. Captures `history[]` and `summary_season`. Does NOT snapshot the full bootstrap.
- D-10: Fetch strategy: concurrent (~10 at a time). Non-fatal partial write: write if >= 50% players fetched; skip Blob write if < 50% succeed. Log failures per player.

**GW1-8 FDR Heatmap (NSP-03)**
- D-11: `HeatMapRow` is module-level in `FixtureHeatMap.tsx`. Reuse by extracting as exported component or exporting from that file. Do NOT copy.
- D-12: "Fixtures not yet published" empty state triggers when FPL fixtures API returns no events for next season. Claude decides exact detection mechanism.

### Claude's Discretion
- Exact concurrent request count for archive_season.py (D-10 specifies ~10 as starting point)
- HeatMapRow export strategy — extract to shared module or export from FixtureHeatMap.tsx
- FDR heatmap empty-state detection mechanism (D-12)
- Loading/skeleton state design for the squad builder tab
- Exact formation (4-3-3, 4-4-2, etc.) layout defaults in the formation grid

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NSP-01 | `pipeline/archive_season.py` archives per-player element-summary history to Vercel Blob as `season_archive_gw38.json` before GW38 closes | GW38 gate pattern from run.py; upload.py save(); concurrent ThreadPoolExecutor pattern; idempotent Blob check via `vercel_blob.list()` |
| NSP-02 | `buildPreSeasonSquad()` TypeScript function builds optimal 15-player squad; greedy first; ILP fallback via `suggest_squad.py` + PuLP if greedy returns null | chip-modes.ts greedy pattern; new score map parameter; PuLP for ILP; suggest_squad.py writes Blob artifact; UI reads from `/api/pre-season-squad` route |
| NSP-03 | GW1-8 FDR heatmap reuses `HeatMapRow`; shows "Fixtures not yet published" empty state | HeatMapRow export; ClubForm data shape confirmed; fixture detection by filtering events with `event` field matching next-season GW IDs |
| NSP-04 | Next Season Planner in Plan section; "Prices pending" graceful state when archive absent | SubTab registration pattern (page.tsx SECTIONS + SubTab union); TanStack Query hook pattern; ChipSquadView read-only display pattern |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Season archive fetch + write | Pipeline (Python) | — | Batch operation, Blob write, time-sensitive — pipeline is the only correct tier |
| ILP squad computation | Pipeline (Python) | — | CPU-intensive combinatorial solver; must be pre-computed, not runtime |
| Greedy squad builder | TypeScript lib | — | Pure function, runs on server in API route or client-side — no DOM dependency |
| Pre-season squad API route | API (Next.js Route Handler) | — | Reads Blob artifact and serves JSON; same pattern as `/api/transfer-news` |
| Pre-season squad data hook | Frontend (React) | — | TanStack Query hook with 6h staleTime; reads from `/api/pre-season-squad` |
| GW1-8 FDR heatmap | Frontend (React) | API | Reuses `HeatMapRow`; data fetched from next-season fixtures; empty state handled client-side |
| Next Season Planner tab | Frontend (React) | — | New Plan sub-tab; read-only; uses hook data + formation grid display |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python `requests` | >=2.32.0 | Sync HTTP for FPL element-summary fetches | Already in requirements.txt [VERIFIED: pipeline/requirements.txt] |
| `concurrent.futures.ThreadPoolExecutor` | stdlib | Concurrent sync HTTP calls (~10 at a time) | No aiohttp in requirements.txt; ThreadPoolExecutor wraps requests cleanly [VERIFIED: requirements.txt — aiohttp absent] |
| `vercel_blob` | >=0.4.0 | Blob check (existence) + write via upload.py | Already in requirements.txt [VERIFIED: pipeline/requirements.txt] |
| `upload.py` `save()` | project | Sole Blob write path | Canonical pattern — never call vercel_blob directly [VERIFIED: upload.py] |
| PuLP | latest | Python ILP solver for suggest_squad.py | Standard Python LP library; not yet in requirements.txt — must be added [ASSUMED — PuLP is the standard open-source Python ILP library; version not yet verified against registry] |
| `@tanstack/react-query` | ^5.95.2 | TanStack Query hook for usePreSeasonSquad | Already in package.json [VERIFIED: package.json] |
| `@vercel/blob` | ^2.3.1 | Blob read in API route (`list()` + fetch) | Already in package.json [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-limit` | ^6.2.0 | JS concurrency limiter | Not needed here — concurrency is Python-side |
| `vitest` | (via package.json) | Test framework | All TypeScript unit tests |
| `pytest` | (pipeline test pattern) | Python pipeline tests | `pipeline/test_*.py` files |

**Version verification:**
```bash
# Verify PuLP current version before adding to requirements.txt
npm view pulp version  # N/A — Python package; use: pip index versions pulp
```

**Installation (new dependency only):**
```bash
# Python: add to pipeline/requirements.txt
pulp>=2.7.0
```

---

## Architecture Patterns

### System Architecture Diagram

```
GW38 daily pipeline run
    │
    ├─► bootstrap fetch ──► GW38 gate check
    │                         │
    │                         ├─► IS GW38? AND archive NOT in Blob?
    │                         │       │
    │                         │       └─► archive_season.py
    │                         │               │
    │                         │               ├─► ThreadPoolExecutor(max_workers=10)
    │                         │               │   └─► get_element_summary(id) × 700+
    │                         │               │
    │                         │               ├─► >= 50% success? ──► upload.py save()
    │                         │               │                           └─► season_archive_gw38.json → Blob
    │                         │               └─► < 50% success? ──► log + skip write
    │                         │
    │                         └─► suggest_squad.py (if greedy null rate detected)
    │                                 └─► PuLP ILP ──► pre_season_squad.json → Blob
    │
Off-season / pre-season
    │
    ├─► /api/pre-season-squad
    │       ├─► Blob list(season_archive_gw38.json) ──► absent? 404
    │       └─► present? compute score map → buildPreSeasonSquad() → 200
    │
    └─► NextSeasonPlannerTab
            ├─► usePreSeasonSquad(hook) ──► 404? "Prices pending" state
            ├─► 200? formation grid (GK/DEF/MID/FWD/Bench)
            └─► GW1-8 FDR heatmap ──── no next-season fixtures? "Fixtures not yet published"
```

### Recommended Project Structure
```
pipeline/
├── archive_season.py      # NEW: NSP-01 season archive step
├── suggest_squad.py       # NEW: NSP-02 ILP fallback (PuLP)
├── requirements.txt       # ADD: pulp>=2.7.0

src/
├── lib/
│   ├── pre-season-squad.ts         # NEW: buildPreSeasonSquad() pure function (NSP-02)
│   ├── pre-season-squad.test.ts    # NEW: unit tests
│   └── hooks/
│       └── usePreSeasonSquad.ts    # NEW: TanStack Query hook
├── components/
│   ├── club-form/
│   │   └── FixtureHeatMap.tsx      # MODIFY: export HeatMapRow (D-11)
│   └── next-season/
│       └── NextSeasonPlannerTab.tsx  # NEW: Plan sub-tab component
│           └── NextSeasonPlannerTab.test.tsx
└── app/
    ├── page.tsx                    # MODIFY: add 'next-season' SubTab + render condition
    └── api/
        └── pre-season-squad/
            └── route.ts            # NEW: reads season_archive_gw38.json from Blob
```

### Pattern 1: GW38 Gate in run.py
**What:** Detect GW38 (or last GW in events[]) and run archive_season.py idempotently.
**When to use:** Any one-time-per-season pipeline step.

```python
# Source: run.py existing IS_OFF_SEASON pattern (verified)
# Detect GW38 (or last available GW id)
current_event_entry = next((e for e in events if e.get('is_current')), None)
last_event_id = max((e['id'] for e in events), default=0)
CURRENT_GW = current_event_entry['id'] if current_event_entry else 0
IS_GW38 = (CURRENT_GW == last_event_id) and CURRENT_GW > 0

if IS_GW38:
    try:
        from archive_season import archive_season
        archive_season(bootstrap)
        print("Season archive written.")
    except Exception as arc_exc:
        print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)
```

### Pattern 2: Idempotent Blob Existence Check
**What:** Skip write if artifact already in Blob (no overwrite on re-run).
**When to use:** One-time-per-season artifacts where re-running could overwrite partial with worse data.

```python
# Source: upload.py + vercel_blob SDK (verified)
import vercel_blob

def _blob_exists(pathname: str) -> bool:
    """Return True if pathname exists in Vercel Blob."""
    result = vercel_blob.list({'prefix': pathname, 'limit': 1})
    return len(result.get('blobs', [])) > 0
```

### Pattern 3: Concurrent Fetch with ThreadPoolExecutor
**What:** Fetch 700+ element summaries concurrently with a bounded worker pool.
**When to use:** Batch HTTP calls that are embarrassingly parallel (no ordering dependency).

```python
# Source: Python stdlib concurrent.futures (ASSUMED pattern — aiohttp not in requirements.txt)
import concurrent.futures
import time

MAX_WORKERS = 10
RETRY_DELAY = 0.5

def _fetch_one(player_id: int) -> tuple[int, dict | None]:
    """Fetch element-summary for one player. Returns (id, data_or_None)."""
    try:
        from fpl_client import get_element_summary
        return (player_id, get_element_summary(player_id))
    except Exception as exc:
        print(f"[archive_season] player {player_id} failed: {exc}", file=sys.stderr)
        return (player_id, None)

def fetch_all_summaries(elements: list[dict]) -> dict[int, dict]:
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(_fetch_one, el['id']): el['id'] for el in elements}
        for future in concurrent.futures.as_completed(futures):
            pid, data = future.result()
            if data is not None:
                results[pid] = data
    return results
```

### Pattern 4: buildPreSeasonSquad() — Greedy with Score Map
**What:** New pure TypeScript function distinct from `buildOptimalSquad()`. Uses caller-supplied `scoreMap` (ppm values) not live `xPts_*` fields.
**When to use:** Pre-season squad build from archived data.

```typescript
// Source: src/lib/chip-modes.ts pattern (verified — adapted for new score map)
// Key differences from buildOptimalSquad():
//  1. Score comes from scoreMap[id] not p[field]
//  2. Players with no score map entry are excluded (< 500 min rule)
//  3. Budget is always 1000 (100m in tenths)
//  4. Eligibility: scoreMap.has(id) — not status check (off-season status unreliable)

const MIN_SLOTS: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }
const MAX_SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }

export interface PreSeasonPlayer {
  id: number
  web_name: string
  element_type: PositionCode
  team: number
  team_short_name: string
  now_cost: number       // tenths of £1m — from archive (prices may be stale)
  total_points: number   // last-season total (display only)
  ppm: number            // points_per_minute (tooltip signal)
}

export interface PreSeasonSquad {
  starters: PreSeasonPlayer[]  // 11 in bestXI
  bench: PreSeasonPlayer[]     // 4
  formation: string
  budgetUsed: number           // tenths of £1m
}

export function buildPreSeasonSquad(
  players: PreSeasonPlayer[],          // 700+ from archive
  scoreMap: Map<number, number>,       // id -> ppm (only entries with >= 500 min)
  budget = 1000,                       // tenths of £1m
  teamCap = 3,
): PreSeasonSquad | null {
  // eligible = in scoreMap only
  const eligible = players.filter(p => scoreMap.has(p.id))
  const sorted = [...eligible].sort((a, b) => {
    const diff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
    return diff !== 0 ? diff : a.now_cost - b.now_cost
  })
  // ... same greedy slot-fill as buildOptimalSquad
}
```

### Pattern 5: HeatMapRow Export Strategy
**What:** Export `HeatMapRow` from `FixtureHeatMap.tsx` for reuse in NextSeasonPlannerTab.
**When to use:** Component already exists module-level; don't copy.

```typescript
// Source: src/components/club-form/FixtureHeatMap.tsx (verified — currently not exported)
// Change: add `export` keyword to the function declaration
// BEFORE:
// function HeatMapRow({ t, grid, mode, tierMap, ownedTeamIds }: HeatMapRowProps) {
// AFTER:
export function HeatMapRow({ t, grid, mode, tierMap, ownedTeamIds }: HeatMapRowProps) {
// Also export HeatMapRowProps interface for typed consumption
```

The simpler strategy (export in-place) is preferred over moving to a shared module — it keeps the file structure stable and `FixtureHeatMap.tsx` remains the single source of truth. `NextSeasonPlannerTab` imports via `@/components/club-form/FixtureHeatMap`.

### Pattern 6: "Fixtures not yet published" Detection
**What:** Detect whether next-season fixture data is available via the FPL fixtures endpoint.
**When to use:** Pre-season window when FPL has reset but not yet published next-season fixtures.

The FPL `/fixtures/` endpoint returns a flat array. During off-season it returns an empty array `[]` or fixtures only for the concluded season (all `finished: true`). Detection: after pipeline run, `fpl_fixtures.json` is available; if all fixtures are `finished: true` (or array is empty), next-season fixtures are not yet published.

For the UI, the hook reads from Blob/local — the "Fixtures not yet published" check is: `fixtures.length === 0 || fixtures.every(f => f.finished)` on the fixtures data that would be fetched for next-season GW IDs 1-8. [ASSUMED — exact FPL behaviour at season rollover not verified in this session; the detection logic should be validated against actual off-season API state]

### Pattern 7: SubTab Registration
**What:** Add `'next-season'` to SubTab union and SECTIONS Plan array.
**When to use:** Adding any new Plan section tab.

```typescript
// Source: src/app/page.tsx lines 57-98 (verified — Phase 125 'window' is exact recent example)
// Step 1: extend SubTab union
export type SubTab = 'gems' | ... | 'rivals' | 'next-season'  // append at end

// Step 2: add to Plan SECTIONS subTabs array after 'rivals'
{ id: 'next-season' as SubTab, label: 'Next Season', mobileLabel: 'Pre-Season' },

// Step 3: add render condition in JSX
{activeSection === 'plan' && activeSubTab === 'next-season' && (
  <NextSeasonPlannerTab />
)}
```

### Pattern 8: API Route for Blob Artifact
**What:** Read `season_archive_gw38.json` from Blob, compute score map, call `buildPreSeasonSquad()`, return squad.
**When to use:** Any pipeline artifact that needs serving via API.

```typescript
// Source: src/app/api/transfer-news/route.ts (verified — exact Blob read pattern)
import { list } from '@vercel/blob'
// list({ prefix: 'season_archive_gw38.json', limit: 1 }) → 404 if absent → "Prices pending"
// fetch(blobs[0].url) → parse → compute scoreMap → buildPreSeasonSquad()
```

### Pattern 9: TanStack Query Hook (usePreSeasonSquad)
**What:** Fetch pre-season squad from `/api/pre-season-squad`; 404 maps to "Prices pending" state.
**When to use:** Any Blob-backed data with potential absence.

```typescript
// Source: src/lib/hooks/useTransferNews.ts (verified — exact staleTime pattern)
export function usePreSeasonSquad() {
  return useQuery<PreSeasonSquad | null>({
    queryKey: ['pre-season-squad'],
    queryFn: async () => {
      const res = await fetch('/api/pre-season-squad')
      if (res.status === 404) return null   // "Prices pending" — archive not yet written
      if (!res.ok) throw new Error('Failed to fetch pre-season squad')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,  // 6h — archive only written once per season
  })
}
```

### Anti-Patterns to Avoid

- **Calling `vercel_blob.put()` directly in archive_season.py:** Always use `upload.py save()`. [VERIFIED: upload.py is the sole write path]
- **Reusing `buildOptimalSquad()` for `buildPreSeasonSquad()`:** `buildOptimalSquad` checks `status === 'a'` and `xPts_1gw !== 0` — both unreliable off-season. New function needed with `scoreMap` eligibility. [VERIFIED: STATE.md C-01]
- **Computing ILP at runtime in the API route:** 700 players × ILP is too slow for request-time compute. PuLP runs in the pipeline and writes `pre_season_squad.json` to Blob. The API route reads the pre-computed result.
- **Copying HeatMapRow:** D-11 is explicit — extract or export, never copy. Copying creates two sources of truth for the same rendering logic.
- **Overwriting `season_archive_gw38.json` on re-run:** The idempotency check (`_blob_exists()`) must run BEFORE the fetch loop, not after. A partial re-run could overwrite a complete archive with fewer players.
- **Running archive_season.py in the IS_OFF_SEASON block:** The archive must run while is_current=GW38 is still true. After rollover, IS_OFF_SEASON=True and the opportunity is gone. Position the GW38 block BEFORE the IS_OFF_SEASON block in run.py.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ILP squad optimization | Custom constraint solver | PuLP | Hand-rolled constraint solvers have subtle bugs; PuLP has COIN-BC bundled, handles integer constraints correctly |
| Concurrent HTTP rate limiting | Custom semaphore/sleep loop | `ThreadPoolExecutor(max_workers=10)` | stdlib, handles exceptions per-future, no sleep needed |
| Blob existence check | Custom HEAD request | `vercel_blob.list(prefix=..., limit=1)` | Already used pattern in codebase; vercel_blob SDK handles auth [ASSUMED — verify list() is correct API; could be `head()` in newer versions] |
| Formation grid display | New custom grid component | Port ChipSquadView pattern | Position-grouped display already proven in ChipSquadView.tsx |

**Key insight:** Every hard problem in this phase (ILP, concurrency, Blob access, formation grid) has an existing pattern in the codebase. The planner should compose existing pieces, not invent new ones.

---

## Common Pitfalls

### Pitfall 1: GW38 Gate Position in run.py
**What goes wrong:** Archive step placed inside or after the `IS_OFF_SEASON` block — it never runs during GW38 because `IS_OFF_SEASON=False` during GW38 (is_current IS set), but if placed after the block it may not be reached.
**Why it happens:** The IS_OFF_SEASON block guards all GW-dependent steps; it's easy to assume archive should go there too.
**How to avoid:** Place the GW38 gate BEFORE the IS_OFF_SEASON block. GW38 detection uses `is_current` (which is True during GW38) — not the off-season flag.
**Warning signs:** Archive writes during testing but not during actual GW38 daily run.

### Pitfall 2: Overwriting Complete Archive with Partial Re-run
**What goes wrong:** `_blob_exists()` check omitted or positioned after fetch loop — re-run overwrites a complete 700-player archive with a 400-player partial fetch.
**Why it happens:** Forgetting that `save()` via upload.py always overwrites (it uses `allowOverwrite: True`).
**How to avoid:** `_blob_exists()` must be the FIRST thing in `archive_season()` — return early if archive already exists.
**Warning signs:** `season_archive_gw38.json` blob has fewer players than expected on second run.

### Pitfall 3: Score Map Eligibility vs. Status Check
**What goes wrong:** `buildPreSeasonSquad()` filters by `status === 'a'` — off-season FPL marks many players as unavailable before confirming transfers. All good players filtered out.
**Why it happens:** Copy-paste from `buildOptimalSquad()` which uses status check.
**How to avoid:** Eligibility for `buildPreSeasonSquad()` is `scoreMap.has(p.id)` only (>= 500 min proxy). Do not gate on `status`.
**Warning signs:** Greedy returns null on full 100m budget even with 700+ players available.

### Pitfall 4: PuLP Missing from requirements.txt
**What goes wrong:** `suggest_squad.py` imports PuLP but it's not installed; pipeline crashes non-fatally but ILP fallback is silently unavailable.
**Why it happens:** PuLP not in current requirements.txt — it must be added.
**How to avoid:** Add `pulp>=2.7.0` to `pipeline/requirements.txt` before implementing `suggest_squad.py`. Test locally with `pip install pulp`.
**Warning signs:** `ModuleNotFoundError: No module named 'pulp'` in pipeline logs.

### Pitfall 5: HeatMapRow Props Not Exported
**What goes wrong:** `HeatMapRow` exported but `HeatMapRowProps` interface not exported — TypeScript error in `NextSeasonPlannerTab.tsx` when constructing the `grid` prop.
**Why it happens:** Only the function is exported, but the caller needs the interface for typed `grid` construction.
**How to avoid:** Export both `HeatMapRow` and `HeatMapRowProps` from `FixtureHeatMap.tsx`.
**Warning signs:** TypeScript error `cannot find name 'HeatMapRowProps'`.

### Pitfall 6: SubTab 'next-season' Must Not Collide with 'window' or Other Tabs
**What goes wrong:** Tab renders correctly in Plan section but MobileNav doesn't show it, or section memory breaks.
**Why it happens:** MobileNav reads from the same SECTIONS array — no additional registration needed — but the SubTab union type must be extended or TypeScript will error.
**How to avoid:** Add `'next-season'` to the `SubTab` union type literal on page.tsx line 58. Follow the Phase 125 `'window'` addition exactly.
**Warning signs:** TypeScript error `Type '"next-season"' is not assignable to type 'SubTab'`.

### Pitfall 7: now_cost in Archive May Reflect Last-Season Prices
**What goes wrong:** Archive captures `now_cost` at GW38 time. When FPL resets for next season, prices will change. UI shows stale prices until next season's bootstrap is available.
**Why it happens:** This is expected — D-03 says "Prices pending" state handles this. No fix needed in Phase 126; the state resolves when FPL publishes next-season prices.
**How to avoid:** UI must show "Prices pending" when `season_archive_gw38.json` is absent AND gracefully note that displayed prices are from last season when archive IS present but new-season prices aren't yet out. However, D-03 says the graceful state only triggers on absence — when the archive IS present, displaying last-season prices is acceptable for Phase 126.
**Warning signs:** User confusion about prices — this is a known limitation acknowledged in D-03.

### Pitfall 8: ILP Fallback Blob Key Name
**What goes wrong:** `suggest_squad.py` writes to a different key than the API route reads from (e.g., `pre_season_squad.json` vs `preseason_squad.json`).
**Why it happens:** Different naming conventions between Python (snake_case) and TypeScript (camelCase in URLs).
**How to avoid:** Establish one canonical key: `pre_season_squad.json`. Use this in both `suggest_squad.py` (write) and `/api/pre-season-squad/route.ts` (read).

---

## Code Examples

Verified patterns from official sources:

### GW38 Detection (run.py — verified codebase)
```python
# Source: run.py IS_OFF_SEASON pattern (verified) + events loop pattern
events = bootstrap.get('events', [])
current_event_entry = next((e for e in events if e.get('is_current')), None)
all_gw_ids = [e['id'] for e in events]
last_event_id = max(all_gw_ids, default=0)
CURRENT_GW = current_event_entry['id'] if current_event_entry else 0
IS_GW38 = (CURRENT_GW > 0) and (CURRENT_GW == last_event_id)
```

### Blob Existence Check (Python — verified upload.py + vercel_blob)
```python
# Source: vercel_blob SDK (list is verified method in vercel-blob>=0.4.0) [ASSUMED exact API shape]
import vercel_blob

def _blob_exists(pathname: str) -> bool:
    result = vercel_blob.list({'prefix': pathname, 'limit': 1})
    return len(result.get('blobs', [])) > 0
```

### Non-fatal Pipeline Step Pattern (verified from run.py)
```python
# Source: run.py transfer_news block (verified)
try:
    from archive_season import archive_season
    archive_season(bootstrap)
    print("Season archive written.")
except Exception as arc_exc:
    print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)
```

### Blob Read in API Route (verified from transfer-news/route.ts)
```typescript
// Source: src/app/api/transfer-news/route.ts (verified)
const { blobs } = await list({ prefix: 'season_archive_gw38.json', limit: 1 })
if (!blobs.length) {
  return Response.json({ error: 'Archive not available' }, { status: 404 })
}
const res = await fetch(blobs[0].url)
const data = await res.text()
const archive = JSON.parse(data)
```

### Formation Grid Display (verified from ChipSquadView.tsx)
```typescript
// Source: src/components/optimiser/ChipSquadView.tsx (verified)
// Position-grouped display with GK/DEF/MID/FWD sections + Bench
const POSITION_ORDER = [1, 2, 3, 4]
const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
// XI players grouped by element_type; bench sorted GK-first then xPts desc
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential element summary fetches (0.1s sleep per player) | Concurrent fetch with ThreadPoolExecutor | Phase 126 (new) | 700 players × 0.1s = 70s → ~10s with 10 workers |
| xPts_1gw for squad building | caller-supplied scoreMap (ppm from archive) | Phase 126 (new) | Off-season signal; xPts unavailable post-season |
| HeatMapRow module-level (unexported) | Exported HeatMapRow for reuse | Phase 126 (new) | Enables Next Season heatmap without duplication |

**Deprecated/outdated:**
- `buildOptimalSquad()` for pre-season use: off-season `status` and `xPts_1gw` are unreliable; `buildPreSeasonSquad()` replaces it for this context only.

---

## Runtime State Inventory

> This is a new feature phase (greenfield pipeline step + new UI tab). Not a rename/refactor phase.

None — verified: no existing runtime state needs migration. The `season_archive_gw38.json` artifact does not yet exist; this phase creates it.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PuLP is the correct ILP library; `pulp>=2.7.0` is the current version | Standard Stack | Wrong version adds friction; COIN-BC solver bundling may differ across versions |
| A2 | `vercel_blob.list({'prefix': ..., 'limit': 1})` is the correct idempotency check API | Code Examples | If the list API shape differs (e.g., keyword args vs positional), the existence check will fail |
| A3 | FPL fixtures endpoint returns empty array or all-finished array pre-season | Architecture Patterns (Pattern 6) | If FPL returns placeholder/stub fixtures for next season, the "not yet published" detection logic needs adjustment |
| A4 | `concurrent.futures.ThreadPoolExecutor` with `requests` is safe in GitHub Actions pipeline runner | Standard Stack | If there are thread safety issues in `requests` under high concurrency, need rate limiting; `MAX_WORKERS=10` is conservative |
| A5 | `suggest_squad.py` ILP reads directly from archive + bootstrap (not merged_players.json) | Architecture Patterns | If ILP needs current-season data (xPts) not archive data, the input source needs rethinking — but D-01/D-02 confirm archive is the intended source |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

Assumptions A1 and A2 are the highest-risk items. The planner should include a Wave 0 step to verify PuLP installation and `vercel_blob.list()` API shape.

---

## Open Questions

1. **vercel_blob Python SDK: list() API shape**
   - What we know: `vercel-blob>=0.4.0` is in requirements.txt; `upload.py` calls `vercel_blob.put()`
   - What's unclear: Whether `vercel_blob.list()` accepts `{'prefix': ..., 'limit': 1}` as a dict or keyword args
   - Recommendation: Check SDK source or test locally before implementing `_blob_exists()`; fallback: catch exception and assume does not exist

2. **Greedy null rate on 100m budget with 700+ players**
   - What we know: STATE.md GREEDY-NULL deferred item acknowledges this is unmeasured
   - What's unclear: Whether the greedy algorithm reliably fills all 15 slots at 100m with the `scoreMap` eligibility filter (only players with >= 500 min)
   - Recommendation: Build `buildPreSeasonSquad()` first, test with representative data; if null rate > 0 in testing, the ILP fallback must also be triggered more aggressively

3. **PuLP COIN-BC solver availability on GitHub Actions**
   - What we know: PuLP bundles COIN-BC by default; GitHub Actions uses Ubuntu runners
   - What's unclear: Whether GitHub Actions runner has all COIN-BC native library dependencies
   - Recommendation: Test `pip install pulp` on CI runner in Wave 0; fallback: PuLP also supports glpk (apt-get installable)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `requests` | archive_season.py | ✓ | >=2.32.0 (requirements.txt) | — |
| `concurrent.futures` | archive_season.py | ✓ | stdlib (Python 3.8+) | — |
| `vercel_blob` | archive_season.py (existence check) | ✓ | >=0.4.0 (requirements.txt) | — |
| `pulp` | suggest_squad.py | ✗ | — (not in requirements.txt) | Must add: `pulp>=2.7.0` |
| `@vercel/blob` | pre-season-squad API route | ✓ | ^2.3.1 (package.json) | — |
| `@tanstack/react-query` | usePreSeasonSquad hook | ✓ | ^5.95.2 (package.json) | — |
| `vitest` | TypeScript tests | ✓ | (package.json devDependencies) | — |

**Missing dependencies with no fallback:**
- `pulp` — must be added to `pipeline/requirements.txt` before `suggest_squad.py` can be implemented

**Missing dependencies with fallback:**
- None (all others available)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/pre-season-squad.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NSP-02 | `buildPreSeasonSquad()` returns valid 15-player squad at 100m | unit | `npx vitest run src/lib/pre-season-squad.test.ts` | ❌ Wave 0 |
| NSP-02 | `buildPreSeasonSquad()` returns null when budget insufficient | unit | `npx vitest run src/lib/pre-season-squad.test.ts` | ❌ Wave 0 |
| NSP-02 | `buildPreSeasonSquad()` excludes players not in scoreMap | unit | `npx vitest run src/lib/pre-season-squad.test.ts` | ❌ Wave 0 |
| NSP-03 | `NextSeasonPlannerTab` renders "Fixtures not yet published" empty state | unit | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | ❌ Wave 0 |
| NSP-04 | `NextSeasonPlannerTab` renders "Prices pending" when data is null | unit | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | ❌ Wave 0 |
| NSP-04 | `NextSeasonPlannerTab` renders formation grid when data is present | unit | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | ❌ Wave 0 |
| NSP-01 | `archive_season.py` skips write when archive exists (idempotency) | unit | `python -m pytest pipeline/ -k "archive"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/pre-season-squad.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/pre-season-squad.test.ts` — covers NSP-02
- [ ] `src/components/next-season/NextSeasonPlannerTab.test.tsx` — covers NSP-03, NSP-04
- [ ] `pipeline/test_archive_season.py` — covers NSP-01 idempotency and partial-write guard
- [ ] `pulp>=2.7.0` in `pipeline/requirements.txt` — required before Wave 1 Python work
- [ ] Verify `vercel_blob.list()` API shape (Wave 0 investigation task)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Pre-season squad API route: no user-supplied teamId; archive is pipeline-only; no injection surface |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Blob URL exposure (season_archive_gw38.json is public CDN URL) | Information Disclosure | Archive contains only public FPL data; no PII; acceptable |
| ILP Blob artifact tampering | Tampering | Blob only writeable by pipeline (server env); UI is read-only consumer |

No significant security concerns for this phase — all data sources are public FPL API data. No user-supplied IDs are involved in archive or squad routes.

---

## Sources

### Primary (HIGH confidence)
- `pipeline/run.py` — IS_OFF_SEASON gate pattern, GW detection pattern, non-fatal step pattern
- `pipeline/upload.py` — canonical save() function; only Blob write path
- `src/lib/chip-modes.ts` — `buildOptimalSquad()` greedy pattern; `buildPreSeasonSquad()` will follow the same structure
- `src/components/optimiser/ChipSquadView.tsx` — formation grid display pattern; visual template for squad builder
- `src/app/page.tsx` lines 57-98 — SubTab union, SECTIONS array, render switch pattern
- `src/components/club-form/FixtureHeatMap.tsx` — `HeatMapRow` definition; verified module-level, not exported
- `src/app/api/transfer-news/route.ts` — Blob read + 404 empty-state pattern
- `src/lib/hooks/useTransferNews.ts` — 6h staleTime hook pattern
- `pipeline/requirements.txt` — confirmed: PuLP not present, must be added
- `package.json` — confirmed: @vercel/blob, @tanstack/react-query available

### Secondary (MEDIUM confidence)
- `pipeline/lineup_news.py` — non-fatal scraper isolation pattern (per-source try/except)
- `src/components/optimiser/OptimiserPanel.tsx` — formation grid layout context (ComparisonTable section headers)
- `.planning/STATE.md` — C-01 confirmed: buildPreSeasonSquad must be a new function

### Tertiary (LOW confidence — flag for validation)
- PuLP library version and COIN-BC bundling behaviour on GitHub Actions CI
- `vercel_blob.list()` Python SDK exact API shape for existence check

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against requirements.txt and package.json
- Architecture: HIGH — all patterns verified against existing codebase files
- Pitfalls: HIGH — most derived from verified code inspection, not training assumptions
- PuLP ILP integration: MEDIUM — library is standard but exact API not verified this session

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable codebase; PuLP/vercel_blob SDK may update)
