# Phase 31: Captaincy Ceiling — Research

**Researched:** 2026-04-28
**Domain:** Pipeline math (Python) + Next.js 16 App Router UI (TypeScript/React)
**Confidence:** HIGH (all decisions verified against codebase, no external research required)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-03 | User can see a ceiling captain recommendation showing the highest 90th-percentile xPts player | Verified `_sigma_1gw` is computed in `merge_players()` line 787, currently stripped at line 844 — must compute picks BEFORE strip |
| CAP-04 | User can see an EO-adjusted captain recommendation that accounts for ownership concentration | Verified `selected_by_percent` is on every player dict (line 682) and `_safe_float` helper exists (lines 7–11) |

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01..D-03** — Dedicated panel on Gems tab with two cards (ceiling + EO); per-pick fields are name, price, xPts_1gw, ownership %.
- **D-04..D-05** — Ceiling pick = max `xPts_90th_1gw` where `xPts_90th_1gw = xPts_1gw + 1.28 * _sigma_1gw`; status='a' gate.
- **D-06..D-08** — EO pick = max `xPts_90th_1gw` with `selected_by_percent < 25.0`; fallback chain 25% → 35% → ceiling pick.
- **D-09** — Output to `pipeline/cache/captain_picks.json` (NOT top-level fields in `merged_players.json`); structure given verbatim.
- **D-10** — New `_compute_captain_picks(result: list) -> dict` in merge.py, post-loop pass after differential-flag block.
- **D-11** — `xPts_90th_1gw` ALSO stored per-player in `merged_players.json` for future GemTable sort.
- **D-12** — New `useCaptainPicks()` hook reading captain_picks.json.
- **D-13** — New `CaptainPicksPanel.tsx`. Note: CONTEXT says `src/components/captain/` but existing dir is `src/components/captaincy/` — see Risks §1.
- **D-14** — Panel placement on Gems tab below `GwToggle` + `GemTable` block.

### Claude's Discretion

- Visual design of pick cards, icon/colour choices, label wording
- Whether `xPts_90th_1gw` becomes a sortable GemTable column (out of scope for Phase 31; can be Phase 32)
- Whether panel shows tooltips (recommended: yes, native `title` attribute per project convention)
- Edge case ceiling==EO — show both cards with same player; EO card notes "also low-owned"

### Deferred Ideas (OUT OF SCOPE)

- Top-3 ranked lists (only one of each pick type)
- Squad-aware captaincy (already covered by `src/lib/captaincy-engine.ts` + `src/components/captaincy/CaptaincyPanel.tsx` on Squad tab)
- xPts_90th GemTable sort column

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js version is 16.2.1** — `package.json:"next": "16.2.1"`. AGENTS.md warns: "This is NOT the Next.js you know. APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." `[VERIFIED: package.json + node_modules/next/dist/docs/index.md]`
- **No `Co-Authored-By` trailers in commits** — CLAUDE.md.
- **`react`: 19.2.4, `@tanstack/react-query`: ^5.95.2, `vitest`: ^4.1.2** — match the project's existing test/UI patterns. `[VERIFIED: package.json]`

---

## Research Summary

This phase is purely **additive integration** — every primitive needed already exists in the codebase. No new dependencies, no new external data, no new architectural patterns. The work is to:

1. Add a small post-loop pass in `pipeline/merge.py` that scans `result` (with `_sigma_1gw` still attached), writes `xPts_90th_1gw` onto each player, and returns a `(merged, captain_picks)` tuple.
2. Add a parallel `save('captain_picks.json', captain_picks)` line in `pipeline/run.py`.
3. Add a Next.js App Router GET route at `src/app/api/captain-picks/route.ts` mirroring `src/app/api/set-pieces/route.ts` (Blob/local toggle).
4. Add `useCaptainPicks()` in `src/lib/hooks/useCaptainPicks.ts` mirroring `useSetPieces()`.
5. Add `CaptainPicksPanel.tsx` (new component) — render two pick cards. Place inside the `{activeTab === 'gems' && ...}` branch of `src/app/page.tsx`, below `<GemTable />`.
6. Add `xPts_90th_1gw?: number` to `MergedPlayer`; add new `CaptainPick` and `CaptainPicks` types to `src/lib/types.ts`.

**Primary recommendation:** Treat this as a near-clone of Phase 30's pattern (helper before `merge_players`, post-loop block, type addition) plus a Phase 26-style cache JSON + API route + hook + panel. No novel design required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute `xPts_90th_1gw` per player | Pipeline (Python) | — | All inputs (`xPts_1gw`, `_sigma_1gw`) are in-process; UI never recomputes |
| Pick the ceiling player | Pipeline (Python) | — | GW-level aggregate; one max-scan over result list, no client recomputation |
| Pick the EO-adjusted player | Pipeline (Python) | — | Same scan, with ownership gate + fallback ladder |
| Write `captain_picks.json` | Pipeline (Python — `run.py`) | — | Single side-effect at pipeline boundary |
| Serve `captain_picks.json` | API / Backend (Next.js route handler) | — | Same Blob-vs-local toggle as `/api/set-pieces`, `/api/players` |
| Fetch + cache picks | Frontend (React Query hook) | — | 6-hour `staleTime`, matches `usePlayers()` and `useSetPieces()` |
| Render two cards | Frontend (CaptainPicksPanel) | — | Pure presentation; no business logic |
| Tab placement | Frontend (`src/app/page.tsx`) | — | Existing tab switch already handles `activeTab === 'gems'` |

---

## Standard Stack

### Core (already in project — no installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.95.2 | Hook caching layer (`useCaptainPicks`) | Used by all existing data hooks (`usePlayers`, `useSetPieces`, `useDefCon`, etc.) `[VERIFIED: package.json]` |
| `next` | 16.2.1 | App Router GET route handler at `src/app/api/captain-picks/route.ts` | Already in use for `/api/set-pieces`, `/api/players` `[VERIFIED: package.json]` |
| `@vercel/blob` | ^2.3.1 | Production data source (`USE_BLOB=true`) | Existing toggle in `pipeline/upload.py` and every `route.ts` `[VERIFIED: package.json + src/app/api/set-pieces/route.ts]` |
| `vitest` | ^4.1.2 | Test framework — Wave 0 stubs + component tests | Existing pattern in `tests/lib/*.test.ts` `[VERIFIED: package.json]` |
| `@testing-library/react` | ^16.3.2 | Component render assertions | Used by `tests/lib/differential-flag.test.ts` `[VERIFIED: package.json + that file]` |

### Pipeline-side (Python stdlib)
- `_safe_float()` (already exists, lines 7–11) — handles missing/malformed `selected_by_percent`
- No new Python deps. `_sigma_1gw` is already computed by Phase 28 `_compute_xpts_sigma()`.

### No alternatives to consider
This is integration work — every other choice (REST style, hook lib, component lib, test runner) is already locked by Phases 1–30.

---

## Architecture Patterns

### System Architecture Diagram

```
                       ┌──────────────────────────────────┐
                       │   pipeline/run.py (entry point)  │
                       └────────────────┬─────────────────┘
                                        │
                                        ▼
          ┌───────────────────────────────────────────────┐
          │ merge_players(bootstrap, fixtures, ...)       │
          │   ── per-player loop (lines 620-800) ──       │
          │   • build player dict                         │
          │   • compute xPts_1gw, _sigma_1gw               │
          │   ── post-loop blocks (lines 802-846) ──      │
          │   • differential_flag pass                    │
          │   • xPts ceiling tercile pass                 │
          │   • [NEW] captain picks pass    ◄── INSERT    │
          │   • strip _sigma scratch fields               │
          │ returns (result, captain_picks)               │
          └────────────────┬───────────────┬──────────────┘
                           │               │
                           ▼               ▼
                save(merged_players)   save(captain_picks)
                           │               │
                           ▼               ▼
              pipeline/cache/         pipeline/cache/
              merged_players.json    captain_picks.json
                           │               │
                           ▼               ▼
                   /api/players      /api/captain-picks
                           │               │
                           ▼               ▼
                    usePlayers()     useCaptainPicks()
                           │               │
                           ▼               ▼
                       <GemTable>     <CaptainPicksPanel>
                           └─── Gems tab ──┘
```

### Recommended Project Structure (additions only)

```
pipeline/
├── merge.py                      # MODIFY: helper + post-loop block + return tuple
├── run.py                        # MODIFY: receive tuple, save captain_picks.json
└── cache/
    └── captain_picks.json        # NEW: written each pipeline run

src/
├── app/
│   ├── api/
│   │   └── captain-picks/
│   │       └── route.ts          # NEW: GET handler, Blob/local toggle
│   └── page.tsx                  # MODIFY: render <CaptainPicksPanel /> below <GemTable />
├── lib/
│   ├── hooks/
│   │   └── useCaptainPicks.ts    # NEW: React Query hook
│   └── types.ts                  # MODIFY: add xPts_90th_1gw + CaptainPick + CaptainPicks
└── components/
    └── captain/                  # NEW DIR (or use existing 'captaincy/' — see Risks §1)
        └── CaptainPicksPanel.tsx # NEW

tests/
└── lib/
    └── captain-picks.test.ts     # NEW: Wave 0 stubs + component tests
```

### Pattern 1: Helper-before-`merge_players` placement (Python)

Mirrors `_compute_differential_flag` (lines 386–414) and `_compute_regression_signal` (lines 331–383).

```python
# pipeline/merge.py — insert just before `merge_players()` (~line 415)

def _compute_captain_picks(result: list, gameweek: int | None = None) -> dict:
    """Pick ceiling and EO-adjusted captain candidates from the merged player list.

    Both picks require status == 'a'. Ceiling is the player with the highest
    xPts_90th_1gw (xPts_1gw + 1.28 * _sigma_1gw, the ~90th percentile of a
    normally-distributed xPts variable per Phase 28 analytical sigma).

    EO-adjusted is the highest-xPts_90th player with ownership < 25%, falling
    back to < 35% then to the ceiling pick (D-08).

    Inputs:
        result    — list of merged player dicts (must still have _sigma_1gw)
        gameweek  — optional GW number to embed in output

    Returns:
        dict matching the captain_picks.json schema (D-09).
    """
    from datetime import datetime, timezone

    eligible = [p for p in result if p.get('status') == 'a']

    def pick_dict(p: dict, *, eo_threshold: float | None = None) -> dict:
        d = {
            'id': p['id'],
            'name': p['web_name'],
            'team': p.get('team_short_name', ''),
            'position': {1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD'}.get(p['element_type'], ''),
            'now_cost': p['now_cost'],
            'xPts_1gw': p.get('xPts_1gw', 0.0),
            'xPts_90th_1gw': p.get('xPts_90th_1gw', 0.0),
            'selected_by_percent': p.get('selected_by_percent', '0'),
        }
        if eo_threshold is not None:
            d['eo_threshold_used'] = eo_threshold
        return d

    if not eligible:
        return {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'gameweek': gameweek,
            'ceiling': None,
            'eo_adjusted': None,
        }

    ceiling = max(eligible, key=lambda p: p.get('xPts_90th_1gw', 0.0))

    eo = None
    threshold_used = None
    for threshold in (25.0, 35.0):
        candidates = [
            p for p in eligible
            if _safe_float(p.get('selected_by_percent'), 0.0) < threshold
        ]
        if candidates:
            eo = max(candidates, key=lambda p: p.get('xPts_90th_1gw', 0.0))
            threshold_used = threshold
            break
    if eo is None:
        eo = ceiling
        threshold_used = None  # fallback to ceiling pick

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'gameweek': gameweek,
        'ceiling': pick_dict(ceiling),
        'eo_adjusted': pick_dict(eo, eo_threshold=threshold_used) if threshold_used else pick_dict(eo),
    }
```

### Pattern 2: Post-loop pass with `_sigma_1gw` still attached

The existing strip block is at lines 842–846. Phase 31 work must fit between the differential-flag block (ends line 823) and the strip block. The xPts ceiling tercile classification block (lines 824–840) reads `_sigma_*gw` — it's safe to put captain picks before OR after that block. Recommended placement: **after the ceiling tercile block** (line 840) and **before** the sigma strip (line 842), so the ceiling tercile boolean is computed first (consistent with the order the `result` is built).

```python
# pipeline/merge.py inside merge_players() — after line 840, before line 842

# ---- Captain picks per GW (Phase 31 CAP-03, CAP-04) ----
# Compute xPts_90th_1gw per player (D-11) and the two GW-level picks (D-04, D-06).
# Z=1.28 is the 90th-percentile z-score for a normal distribution.
for p in result:
    p['xPts_90th_1gw'] = round(
        (p.get('xPts_1gw') or 0.0) + 1.28 * (p.get('_sigma_1gw') or 0.0), 3
    )

# Determine current GW for the captain_picks.json embed
captain_gameweek = current_gw
captain_picks_payload = _compute_captain_picks(result, gameweek=captain_gameweek)

# (existing strip block stays at lines 842-846 — _sigma_* deleted before return)
```

But — `merge_players()` currently returns just `result`. CONTEXT D-09 implies a separate file write; the cleanest contract is to have `merge_players` return a tuple `(result, captain_picks_payload)`. Discretion: alternatively, attach `captain_picks_payload` to a module-level returned dict, or have `run.py` compute it post-merge. **Recommendation: change return signature to a tuple** — narrow, explicit, type-friendly. Update the single call site in `run.py` (line 146) accordingly.

### Pattern 3: Parallel `save()` in `run.py`

After line 147 (`save('merged_players.json', merged)`), add:

```python
merged, captain_picks = merge_players(...)  # changed line 146
save('merged_players.json', merged)
save('captain_picks.json', captain_picks)   # NEW — same save() helper, Blob/local routing handled
```

### Pattern 4: API route handler (Next.js 16 App Router)

Identical to `src/app/api/set-pieces/route.ts` (verified that file).

```typescript
// src/app/api/captain-picks/route.ts
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'captain_picks.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Captain picks not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json')
      data = await readFile(cachePath, 'utf-8')
    }
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'Failed to load captain picks' }, { status: 500 })
  }
}
```

### Pattern 5: React Query hook

```typescript
// src/lib/hooks/useCaptainPicks.ts
import { useQuery } from '@tanstack/react-query'
import type { CaptainPicks } from '@/lib/types'

export function useCaptainPicks() {
  return useQuery<CaptainPicks>({
    queryKey: ['captain-picks'],
    queryFn: async () => {
      const res = await fetch('/api/captain-picks')
      if (!res.ok) throw new Error('Failed to fetch captain picks')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours, matches usePlayers/useSetPieces
  })
}
```

**IMPORTANT:** CONTEXT.md D-12 says "Fetches `/pipeline/cache/captain_picks.json`". The actual project convention is to **never** fetch from `/pipeline/cache/...` directly — that path is a server-side filesystem path, not a public URL. All other hooks (`usePlayers`, `useSetPieces`, `useDefCon`, `useClubForm`) go through `/api/<thing>` route handlers. The hook MUST use `/api/captain-picks`. `[VERIFIED: src/lib/hooks/usePlayers.ts and src/lib/hooks/useSetPieces.ts both fetch /api/* routes]`

### Pattern 6: Panel component structure

Mirror `src/components/set-pieces/SetPieceTakerPanel.tsx`:

```typescript
// src/components/captain/CaptainPicksPanel.tsx (or src/components/captaincy/ — see Risks §1)
'use client'

import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import type { CaptainPick } from '@/lib/types'

function PickCard({ kind, pick }: { kind: 'ceiling' | 'eo'; pick: CaptainPick | null }) {
  if (!pick) {
    return (
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
        <p className="text-sm text-zinc-500">No {kind} pick available</p>
      </div>
    )
  }
  const price = (pick.now_cost / 10).toFixed(1)
  const own = pick.selected_by_percent
  const label = kind === 'ceiling' ? 'Ceiling' : 'EO-Adjusted'
  const tooltip = kind === 'ceiling'
    ? 'Highest 90th-percentile xPts. Captain when chasing rank — accepts higher variance for upside.'
    : 'Highest 90th-percentile xPts among low-owned players. Reduces rank variance vs the template.'
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" title={tooltip}>{label}</h3>
        <span className="text-xs text-zinc-500">{pick.position}</span>
      </div>
      <p className="text-base font-semibold">{pick.name}</p>
      <p className="text-xs text-zinc-500">
        {pick.team} · £{price}m · {own}% owned
      </p>
      <p className="text-sm">
        xPts: <span className="font-medium">{pick.xPts_1gw.toFixed(1)}</span>
        <span className="ml-2 text-xs text-zinc-500">(90th pct: {pick.xPts_90th_1gw.toFixed(1)})</span>
      </p>
    </div>
  )
}

export function CaptainPicksPanel() {
  const { data, isLoading, error } = useCaptainPicks()

  if (isLoading) return <p className="text-sm text-zinc-500 py-4">Loading captain picks…</p>
  if (error) return <p className="text-sm text-red-500 py-4">Failed to load captain picks.</p>
  if (!data) return null

  const sameAsCeiling =
    data.ceiling != null && data.eo_adjusted != null && data.ceiling.id === data.eo_adjusted.id

  return (
    <section className="mt-6 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Captain Picks — GW {data.gameweek ?? '—'}</h2>
        <p className="text-sm text-zinc-500">
          Ceiling = chase rank. EO-Adjusted = protect rank.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PickCard kind="ceiling" pick={data.ceiling} />
        <PickCard kind="eo" pick={data.eo_adjusted} />
      </div>
      {sameAsCeiling && (
        <p className="text-xs text-zinc-500">
          Ceiling pick is also low-owned — same player satisfies both criteria this GW.
        </p>
      )}
    </section>
  )
}
```

Place inside `src/app/page.tsx` Gems branch:

```typescript
{activeTab === 'gems' && (
  <>
    <GemTable />
    <CaptainPicksPanel />
  </>
)}
```

### Anti-Patterns to Avoid

- **Fetching `/pipeline/cache/*` directly from a hook.** The cache directory is server-side only. Always go through an `/api/*` route handler.
- **Recomputing `xPts_90th` on the client.** D-09 puts the picks in a separate cache file; D-11 stores per-player `xPts_90th_1gw` for future GemTable use. The panel reads pre-computed data.
- **Mutating the existing `xPts_ceiling_*gw` fields.** Phase 28 ships these as a tercile boolean; do not change their semantics — Phase 31 introduces a different field (`xPts_90th_1gw`) at the player level and a separate cache file at the GW level.
- **Returning just `result` from `merge_players()` and computing picks in `run.py`.** That would split the algorithm across files. Keep it inside `merge_players()` where `_sigma_1gw` is in scope.
- **Duplicating directory naming.** Existing dir is `src/components/captaincy/` (used by Squad-tab CaptaincyPanel). CONTEXT says new dir `src/components/captain/`. Pick one — see Risks §1.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Numeric cast for `selected_by_percent` (string from FPL) | `parseFloat(x) \|\| 0` inline | `_safe_float(x, 0.0)` | Already in `merge.py` lines 7–11; matches Phase 30 T-30-01 mitigation `[VERIFIED: pipeline/merge.py:7]` |
| Sigma computation | New variance code | `_compute_xpts_sigma()` already attaches `_sigma_1gw` | Lines 281–328 — analytical Poisson + Bernoulli variance, ships verified in Phase 28 |
| Cache JSON write | `with open() as f: json.dump(...)` | `save('captain_picks.json', payload)` | `pipeline/upload.py` already toggles Blob vs local based on `USE_BLOB` env `[VERIFIED: pipeline/upload.py:25-30]` |
| API route Blob/local toggle | New conditional | Copy `src/app/api/set-pieces/route.ts` | 33 lines, exact pattern, just swap `set_piece_changes.json` → `captain_picks.json` |
| React Query setup | New `useState`/`useEffect` fetch | `useQuery` w/ 6h `staleTime` | Pattern locked across `usePlayers`, `useSetPieces`, `useDefCon`, etc. |
| Panel layout (mobile/desktop grid) | Custom media queries | `grid grid-cols-1 sm:grid-cols-2 gap-3` Tailwind | Pattern from `SetPieceTakerPanel.tsx` line 58 |
| Tooltip primitives | New `Tooltip` component | Native `title` HTML attribute | Project pattern documented in `VarianceBadge.tsx` line 3 and `DifferentialBadge.tsx` |

**Key insight:** The entire phase reuses primitives. The only novel logic is the EO fallback ladder (25% → 35% → ceiling), which is 8 lines of Python.

---

## Common Pitfalls

### Pitfall 1: `_sigma_1gw` deleted before captain picks computed
**What goes wrong:** If `_compute_captain_picks()` is called after lines 842–846 (the strip block), `p['_sigma_1gw']` raises `KeyError`. If called from `run.py` after `merge_players()` returns, the field is gone.
**Why it happens:** Phase 28 deliberately strips scratch fields to reduce JSON size.
**How to avoid:** Place the captain picks block **between line 840 (end of ceiling tercile block) and line 842 (start of strip block)**, or — recommended — compute `xPts_90th_1gw` per-player BEFORE the strip block, then call `_compute_captain_picks(result)` (which only needs `xPts_90th_1gw`, not raw sigma).
**Warning sign:** Any plan that calls `_compute_captain_picks` from `run.py` is wrong.

### Pitfall 2: `_sigma_1gw` is 0 or extremely small for fringe players
**What goes wrong:** Players with `xPts_1gw == 0` (BGW, no xG/xA, xmins=0) also have `_sigma_1gw == 0`, giving `xPts_90th_1gw == 0`. They won't win the max scan — but they'll all tie. `max(eligible, key=...)` still returns one (the first). Not a bug but verify behaviour.
**Why it happens:** `_compute_xpts_sigma` early-returns 0.0 when `start_prob == 0 or xmins == 0` (line 304).
**How to avoid:** Status='a' gate filters out most BGW/injured players. As a defence-in-depth, the max-scan is fine because real captain candidates have `xPts_1gw > 0` and outrank zero-xPts players naturally.
**Warning sign:** Test asserts `ceiling.xPts_1gw > 0`.

### Pitfall 3: `selected_by_percent` is a string, not a number
**What goes wrong:** `p.get('selected_by_percent') < 25.0` raises `TypeError` because the FPL API returns `"12.5"` (string).
**Why it happens:** FPL bootstrap-static schema — same field type that triggered Phase 30's T-30-01 mitigation.
**How to avoid:** Always use `_safe_float(p.get('selected_by_percent'), 0.0) < 25.0`. The same pattern is already in `_compute_differential_flag` line 405.
**Warning sign:** Plan or test that does `p.selected_by_percent < 25` is broken.

### Pitfall 4: `current_gw` may be None when no event has `is_current=True`
**What goes wrong:** Pre-season or between-GW edge cases where no event is current and no event is finished — `current_gw` falls through to `1` (line 462).
**Why it happens:** The current logic at lines 451–462 handles this, but the value `1` may be misleading for the captain_picks.json `gameweek` field if used between GW deadlines.
**How to avoid:** Pass `current_gw` from `merge_players` to `_compute_captain_picks`. The caller already has access. Acceptable to include `1` as a fallback — same convention as the rest of the pipeline.
**Warning sign:** Tests asserting exact GW values without context.

### Pitfall 5: Renaming `merge_players()` return type breaks downstream consumers
**What goes wrong:** Changing return from `list` to `(list, dict)` will break any other call site expecting a list.
**Why it happens:** Phase 30 didn't change the return type — that pattern wrote a flag onto each player dict. CAP-03/04 are GW-level aggregates so they need separate output.
**How to avoid:** Grep for callers of `merge_players(`:

```
$ grep -rn "merge_players(" pipeline/ src/ tests/
```
Verified in this research: only `pipeline/run.py:146` calls it. Single call site. Safe to change return signature.
`[VERIFIED: grep over pipeline/, src/, tests/ — single caller in run.py]`

### Pitfall 6: Existing `src/components/captaincy/CaptaincyPanel.tsx` collision
**What goes wrong:** CONTEXT.md D-13 says new dir is `src/components/captain/`, but a similarly-named feature already exists in `src/components/captaincy/CaptaincyPanel.tsx`. Two co-existing dirs (`captain/` and `captaincy/`) is confusing.
**Why it happens:** Phase 13 (or earlier) shipped a squad-aware captaincy feature for the Squad tab.
**How to avoid:** **Recommendation — use the existing `src/components/captaincy/` directory** and name the new component `CaptainPicksPanel.tsx` (filename already disambiguates from `CaptaincyPanel.tsx`). This is a divergence from CONTEXT D-13 and SHOULD be flagged in the plan as a deliberate filesystem-organisation deviation. See Risks §1.
**Warning sign:** Plan creates `src/components/captain/` while `src/components/captaincy/` exists.

### Pitfall 7: Next.js 16 changes from training-data Next.js
**What goes wrong:** AGENTS.md warns this isn't the Next.js you know. Outdated patterns (e.g. `getStaticProps`, `pages/api/*.ts`) are wrong.
**Why it happens:** App Router is the standard; route handlers live in `src/app/api/<name>/route.ts` and export `GET`/`POST` async functions returning a `Response`.
**How to avoid:** Copy `src/app/api/set-pieces/route.ts` exactly. It's the canonical 33-line template.
**Warning sign:** Any plan that creates a `pages/api/...` file or exports `default` from a route handler.

### Pitfall 8: React Query 5 cache key collisions
**What goes wrong:** Reusing `['players']` or another existing queryKey would cause cache thrashing.
**Why it happens:** All hooks share one `QueryClient`.
**How to avoid:** Use `queryKey: ['captain-picks']` — verified unique against all 8 existing hook files.
`[VERIFIED: grep "queryKey:" src/lib/hooks/]`

---

## Code Examples

### Computing xPts_90th_1gw inline (verified)
```python
# Source: pipeline/merge.py:786-790 (existing _sigma_1gw computation)
player['_sigma_1gw'] = _compute_xpts_sigma(
    xg_per90, xa_per90, player_start_prob, player_xmins,
    element['element_type'], player_fixtures, 1,
)
# NEW Phase 31 line — runs in post-loop pass
player['xPts_90th_1gw'] = round(
    (player.get('xPts_1gw') or 0.0) + 1.28 * (player.get('_sigma_1gw') or 0.0), 3
)
```

### EO fallback ladder (canonical pattern)
```python
# 25% → 35% → fallback to ceiling (D-08)
eo = None
threshold_used = None
for threshold in (25.0, 35.0):
    candidates = [
        p for p in eligible
        if _safe_float(p.get('selected_by_percent'), 0.0) < threshold
    ]
    if candidates:
        eo = max(candidates, key=lambda p: p.get('xPts_90th_1gw', 0.0))
        threshold_used = threshold
        break
if eo is None:
    eo = ceiling
```

### Component card render (verified pattern)
```tsx
// Source: src/components/set-pieces/SetPieceTakerPanel.tsx:58-69 (envelope)
//         src/components/gem-table/DifferentialBadge.tsx (title attribute)
<div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
  <h3 title="Highest 90th-percentile xPts...">Ceiling</h3>
  <p>{pick.name}</p>
  <p className="text-xs text-zinc-500">{pick.team} · £{(pick.now_cost/10).toFixed(1)}m · {pick.selected_by_percent}% owned</p>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Squad-aware captaincy via `computeCaptaincyCandidates(squadPicks, allPlayers)` | GW-level pre-classified picks for ALL players in `captain_picks.json` | Phase 31 | The Squad-tab CaptaincyPanel still uses the engine; Gems-tab CaptainPicksPanel uses the cache file. Coexist — different inputs, different audiences. |
| Per-player flag fields (Phase 30 `differential_flag`, Phase 28 `xPts_ceiling_*gw`) | Separate `captain_picks.json` for GW-level aggregates | Phase 31 (D-09) | Avoids polluting `merged_players.json` with two top-level fields when only two players matter |

**Deprecated/outdated:** Nothing deprecated. Existing `captaincy-engine.ts` and `CaptaincyPanel` (Squad tab) remain.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Z-score 1.28 corresponds to the 90th percentile of a normal distribution | Pattern 1 | Standard statistical fact — Φ⁻¹(0.90) ≈ 1.2816. `[VERIFIED]` from CONTEXT D-04/D-05 which locks this constant. No risk. |
| A2 | `current_gw` is the right value to embed in `captain_picks.json` `gameweek` | Pattern 1 | If pre-season, value is `1`. Acceptable per project convention (pipeline always emits something). |
| A3 | Single caller of `merge_players()` so changing return signature is safe | Pitfall 5 | `[VERIFIED: grep -rn "merge_players(" pipeline/ src/ tests/]` returns only `pipeline/run.py:146` plus internal docstring/import lines. |

All other claims are verified against the codebase. No external sources required (all primitives are in-tree).

---

## Open Questions

1. **Directory name: `captain/` vs `captaincy/`.** CONTEXT D-13 says `captain/`; existing dir is `captaincy/`. Recommendation: use existing `captaincy/` and document the deviation in the plan. This is a filesystem-housekeeping decision the user can confirm at plan-check time, but **not a blocker** — both work.
2. **Should `xPts_90th_1gw` be exposed in TypeScript as required vs optional?** Recommendation: `xPts_90th_1gw?: number` (optional) matching the Phase 27/28 additive-rollout convention (lines 142–147 of types.ts). Confirmed by precedent.
3. **Does the panel re-render on tab switch?** Yes — React Query cache survives across tab unmount/remount. `staleTime: 6h` means no extra fetch unless 6h elapsed. No action needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | `pipeline/merge.py` | ✓ (assumed — pipeline already runs) | — | — |
| Node + Next.js | `src/app/api/captain-picks/route.ts` | ✓ | 16.2.1 | — |
| `@tanstack/react-query` | `useCaptainPicks` | ✓ | ^5.95.2 | — |
| `@vercel/blob` | route handler USE_BLOB path | ✓ | ^2.3.1 | — |
| Vitest + jsdom | tests | ✓ | ^4.1.2 / ^25.0.1 | — |
| `pipeline/cache/merged_players.json` | integration tests | conditionally — only after `cd pipeline && python run.py` | — | All integration tests use `it.skip` until cache populated (existing pattern, see `tests/lib/xpts-engine.test.ts`) |

No missing dependencies. No fallbacks needed.

---

## Validation Architecture

`workflow.nyquist_validation` is **enabled** in `.planning/config.json`. `[VERIFIED]`

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (project root) — runs `tests/**/*.test.ts` |
| Quick run command | `npx vitest run tests/lib/captain-picks.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-03 | `captain_picks.json` has `ceiling` with `xPts_90th_1gw` field | integration (it.skip) | `npx vitest run tests/lib/captain-picks.test.ts -t "ceiling pick"` | Wave 0 — to create |
| CAP-03 | Ceiling pick has highest `xPts_90th_1gw` among status='a' players | integration (it.skip) | same | Wave 0 — to create |
| CAP-03 | `xPts_90th_1gw` field present on every player in merged_players.json | integration (it.skip) | same | Wave 0 — to create |
| CAP-03 | Pipeline math: `xPts_90th_1gw == round(xPts_1gw + 1.28*sigma_1gw, 3)` (within tolerance) | integration (it.skip) | same | Wave 0 — to create |
| CAP-04 | `captain_picks.json` has `eo_adjusted` field | integration (it.skip) | same | Wave 0 — to create |
| CAP-04 | EO pick has `selected_by_percent < 25.0` OR fallback used | integration (it.skip) | same | Wave 0 — to create |
| CAP-04 | EO pick is highest `xPts_90th_1gw` among low-owned players | integration (it.skip) | same | Wave 0 — to create |
| CAP-03/04 | Both picks have `status === 'a'` (when picks exist) | integration (it.skip) | same | Wave 0 — to create |
| CAP-03 | `<CaptainPicksPanel>` renders ceiling card with player name when data loaded | component (it) | `npx vitest run tests/lib/captain-picks.test.ts -t "renders ceiling card"` | Wave 0 — to create |
| CAP-04 | `<CaptainPicksPanel>` renders EO-adjusted card | component (it) | same | Wave 0 — to create |
| CAP-03/04 | `<CaptainPicksPanel>` shows "same player" note when ceiling == EO | component (it) | same | Wave 0 — to create |
| CAP-03/04 | `<CaptainPicksPanel>` shows loading state | component (it) | same | Wave 0 — to create |
| CAP-03/04 | `<CaptainPicksPanel>` shows error state | component (it) | same | Wave 0 — to create |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/captain-picks.test.ts`
- **Per wave merge:** `npm test` (full suite — must remain green; current baseline 272 pass + 26 skip)
- **Phase gate:** Full suite green + manual `cd pipeline && python run.py` check that `pipeline/cache/captain_picks.json` exists with valid JSON before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/captain-picks.test.ts` — new file, structure mirrors `tests/lib/differential-flag.test.ts`:
  - 1 placeholder `it()` so the file passes when implementation is empty
  - 8 `it.skip` integration tests reading `pipeline/cache/captain_picks.json` and `pipeline/cache/merged_players.json`
  - 5 `it.todo` (or live `it()`) component tests using `@testing-library/react.render` against `<CaptainPicksPanel />` with mocked `useCaptainPicks`
- No new framework install needed — Vitest + React Testing Library + jsdom already present.
- No `conftest.py` / shared fixtures needed — match existing pattern of inline `readFile()` per test.

---

## Security Domain

`security_enforcement` is not explicitly disabled in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Captain picks are public (single-user tool, no per-user data) |
| V3 Session Management | no | No session state |
| V4 Access Control | no | Single-user tool |
| V5 Input Validation | yes (server-side) | `_safe_float` cast for ownership; `status == 'a'` filter; route handler returns valid JSON or 404/500 — pattern verified against existing routes |
| V6 Cryptography | no | No secrets in cache file |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cache file injection (write-time) | Tampering | `pipeline/upload.py` uses `json.dumps(... ensure_ascii=False).encode('utf-8')` — pure serialiser, no template interpolation. Same path as merged_players.json — already audited. |
| Cache file path traversal (read-time) | Information Disclosure | `join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json')` — fixed path, not user-controlled. Same as `/api/set-pieces` route. |
| Stale cache served as fresh | Tampering | Existing `last_updated.json` mechanism (run.py lines 197–223) marks stale on pipeline failure. No new attack surface. |
| Type confusion in player schema | Tampering | `_safe_float` mitigates string→number coercion. Status filter (`status == 'a'`) is exact string match. |

No new auth paths, no new network endpoints to external services. `/api/captain-picks` is read-only, returns the cache file verbatim.

---

## File Map

### Files to Create (5)

| Path | Purpose |
|------|---------|
| `pipeline/cache/captain_picks.json` | Pipeline-generated cache (created at runtime; not committed — gitignored or .gitignore-aligned with merged_players.json convention; verify `.gitignore` for `pipeline/cache/*.json` exclusion) |
| `src/app/api/captain-picks/route.ts` | App Router GET handler (33 lines, copy of set-pieces route) |
| `src/lib/hooks/useCaptainPicks.ts` | React Query hook fetching `/api/captain-picks` |
| `src/components/captaincy/CaptainPicksPanel.tsx` | Two-card panel (existing dir reuse — see Risks §1; CONTEXT says `captain/` but recommend `captaincy/`) |
| `tests/lib/captain-picks.test.ts` | Wave 0 stubs + component tests |

### Files to Modify (4)

| Path | Change |
|------|--------|
| `pipeline/merge.py` | (1) Add `_compute_captain_picks(result, gameweek)` helper before `merge_players()` (~line 415, after `_compute_differential_flag`); (2) inside `merge_players()` after line 840 (post ceiling tercile, before strip block at line 842), add per-player `xPts_90th_1gw` write + call `_compute_captain_picks`; (3) change return type to `tuple[list, dict]`. |
| `pipeline/run.py` | Line 146: change `merged = merge_players(...)` → `merged, captain_picks = merge_players(...)`; after `save('merged_players.json', merged)` (line 147) add `save('captain_picks.json', captain_picks)`. |
| `src/lib/types.ts` | (1) Add `xPts_90th_1gw?: number` to `MergedPlayer` (after line 147 with the other xPts_* fields); (2) add new exports `CaptainPick` and `CaptainPicks` interfaces matching `captain_picks.json` schema. |
| `src/app/page.tsx` | Import `CaptainPicksPanel`; in the `{activeTab === 'gems' && ...}` branch (line 107), wrap `<GemTable />` and the new `<CaptainPicksPanel />` in a fragment. |

### Total touched: 9 files (5 new, 4 modified). No deletes.

---

## Sources

### Primary (HIGH confidence)
- `pipeline/merge.py` — direct read; lines 7–11 (`_safe_float`), 281–328 (`_compute_xpts_sigma`), 386–414 (`_compute_differential_flag`), 786–798 (`_sigma_*gw` attachment), 802–823 (differential post-loop), 824–840 (ceiling tercile), 842–846 (strip block), 415–848 (`merge_players` body)
- `pipeline/run.py` — direct read; lines 91–229 (full `run()` function); save() calls at lines 108, 111, 147, 163, 164
- `pipeline/upload.py` — `save()` Blob/local toggle (lines 25–30)
- `src/lib/types.ts` — direct read; `MergedPlayer` interface (lines 90–166), `xPts_*` fields (lines 140–153)
- `src/lib/hooks/usePlayers.ts` — hook pattern
- `src/lib/hooks/useSetPieces.ts` — direct hook clone target
- `src/app/api/set-pieces/route.ts` — direct route clone target (33 lines)
- `src/app/api/players/route.ts` — confirmed identical pattern
- `src/app/page.tsx` — Gems tab branch placement (line 107)
- `src/components/set-pieces/SetPieceTakerPanel.tsx` — panel structural template
- `src/components/captaincy/CaptaincyPanel.tsx` — pre-existing component (dir collision check)
- `src/components/gem-table/DifferentialBadge.tsx` — native `title` tooltip convention
- `tests/lib/differential-flag.test.ts` — Wave 0 test stub template
- `tests/lib/xpts-engine.test.ts` — pipeline integration test pattern
- `.planning/phases/31-captaincy-ceiling/31-CONTEXT.md` — locked decisions D-01..D-14
- `.planning/phases/28-xpts-engine/28-01-SUMMARY.md` — sigma scratch field convention
- `.planning/phases/30-differential-tracker/30-01-SUMMARY.md` — helper-before-`merge_players` placement, post-loop block convention
- `.planning/REQUIREMENTS.md` — CAP-03/CAP-04 source of truth
- `.planning/config.json` — nyquist_validation=true, security defaults
- `package.json` — `next` 16.2.1, `react` 19.2.4, `vitest` 4.1.2 versions
- `node_modules/next/dist/docs/index.md` — Next.js 16 App Router context

### Secondary (MEDIUM confidence)
None required — no external research consulted.

### Tertiary (LOW confidence)
None — no LOW-confidence findings in this research.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive verified in package.json + existing source
- Architecture: HIGH — direct precedents in Phase 26 (set-pieces panel + cache + route + hook), Phase 28 (sigma fields), Phase 30 (helper + post-loop block + flag write)
- Pitfalls: HIGH — derived from direct reads of merge.py and verified `_sigma_1gw` deletion sequence
- Validation: HIGH — Wave 0 pattern locked in `tests/lib/differential-flag.test.ts`

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable codebase, 30-day window). Re-verify if Phase 28/30 sigma or differential blocks change before plan execution.
