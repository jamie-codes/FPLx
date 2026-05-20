# Phase 128: Pre-Season Auto-Activation — Research

**Researched:** 2026-05-20
**Domain:** Pipeline gate logic (Python), Vercel Blob artifact writes, Next.js 16 API Route, TanStack Query hook, React UI (status pill + dismissible banner)
**Confidence:** HIGH — all claims verified against live codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Activation Sequencing in run.py (AUTO-01/02)**
- D-01: Activation block lives **nested inside the IS_OFF_SEASON block**, after the GW38 gate section.
- D-02: Activation guard sequence:
  1. Evaluate tri-state predicate: `IS_OFF_SEASON AND len(events) >= 38 AND not any(e.get('finished') for e in events) AND bool(events[0].get('deadline_time'))`
  2. If predicate true → check if `pre_season_active.json` exists (blob list or local path)
  3. If artifact **absent** → write `pre_season_active.json` AND call `suggest_squad(bootstrap, archive, force=True)`
  4. If artifact **present** → skip silently (idempotent)
- D-03: `force=True` bypasses blob + local idempotency check only — skips the "already exists → return early" guard; all other ILP logic runs normally.
- D-04: `suggest_squad` signature gains `force: bool = False`; existing GW38 callers pass no argument.

**pre_season_active.json Schema + API (AUTO-02/03)**
- D-05: Schema: `{"activated_at": "2026-08-01T04:12:33Z", "season_id": "2526"}`
- D-06: `season_id` = `f"{year-1}{str(year)[2:]}"` where year = `int(events[0]['deadline_time'][:4])`
- D-07: `/api/pre-season-active` returns **404** when artifact absent; `usePreSeasonActive()` treats null (from 404) as "Awaiting"
- D-08: Response shape: `{ activated_at: string, season_id: string }`

**Status Pill in NextSeasonPlannerTab (AUTO-03)**
- D-09: Pill lives at the top of tab content, first element, before "Pre-Season Squad" heading
- D-10: zinc background for "Awaiting", green background for "Live"; match existing solver badge classes
- D-11: When "Awaiting", rest of tab still renders (formation grid, health indicator, solver badge visible)

**First-Activation Banner (AUTO-03)**
- D-12: Banner appears between status pill row and formation grid — inline, not a toast
- D-13: Shown only when `usePreSeasonActive()` returns active data AND `localStorage['nsp_activation_seen_{seasonId}']` not set
- D-14: Banner text: `"🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices."`
- D-15: Dismiss: × icon top-right; onClick sets localStorage key → banner disappears forever for this season
- D-16: `seasonId` in localStorage key comes from `usePreSeasonActive()` data (`season_id` field)

### Claude's Discretion
- Exact Tailwind classes for pill and banner (follow existing solver badge classes; green = `bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200`; zinc = `bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300`)
- TanStack Query `staleTime` for `usePreSeasonActive()` — suggest 60 000 ms
- `pre_season_active.json` write uses `save()` from `upload.py`
- Error handling: non-fatal; log and continue, matching existing `suggest_squad`/`squad_health` patterns

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTO-01 | Pipeline detects next-season bootstrap publication via tri-state gate inside IS_OFF_SEASON block; 4×-daily cron | `run.py` IS_OFF_SEASON block at line ~148; idempotency pattern from `suggest_squad.py` lines 263–278; `save()` from `upload.py` |
| AUTO-02 | Pipeline writes `pre_season_active.json` on first detection; `suggest_squad.py` gains `force=False` and re-runs ILP on activation | `suggest_squad.py` idempotency check lines 263–278 to refactor; `save()` for artifact write; `suggest_squad(bootstrap, archive)` signature at line 253 |
| AUTO-03 | `usePreSeasonActive()` hook + `/api/pre-season-active` route; zinc "Awaiting" / green "Live" pill + dismissible banner with localStorage suppression | `usePreSeasonSquad.ts` pattern to mirror; `pre-season-squad/route.ts` readBlobOrLocal pattern to reuse; `NextSeasonPlannerTab.tsx` integration point at line 180; `types.ts` to extend |
</phase_requirements>

---

## Summary

Phase 128 is a well-scoped, fully pre-decided phase. Every architectural decision is locked in CONTEXT.md. The research task is to verify that the codebase exactly matches those decisions (no drift), confirm all reuse candidates work as described, and surface any integration hazards the planner needs to plan around.

**The codebase is fully consistent with CONTEXT.md.** The `run.py` IS_OFF_SEASON block at line 148, `suggest_squad.py` idempotency pattern at lines 263–278, `upload.py` `save()` helper, `pre-season-squad/route.ts` `readBlobOrLocal()` helper, `usePreSeasonSquad.ts` TanStack Query pattern, and `NextSeasonPlannerTab.tsx` injection points all exist exactly as described. No drift found.

The phase has five deliverables: (1) `suggest_squad.py` force-parameter refactor, (2) `run.py` activation block, (3) `src/lib/types.ts` new type, (4) `src/app/api/pre-season-active/route.ts` new API route, (5) `NextSeasonPlannerTab.tsx` + `usePreSeasonActive.ts` UI integration. All five are pure additions or surgical refactors — no existing logic is removed or restructured.

**Primary recommendation:** Follow the canonical references in CONTEXT.md verbatim. Reuse `readBlobOrLocal()` (copy/re-export from `pre-season-squad/route.ts`) and `save()` (`upload.py`). Mirror `usePreSeasonSquad.ts` for the new hook. Use the existing solver badge Tailwind classes for the pill. Test each layer with the project's established pytest/vitest patterns.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pre-season detection predicate | Pipeline (Python) | — | Gate logic runs in the cron job where bootstrap data is first fetched |
| `pre_season_active.json` artifact write | Pipeline (Python) | — | Follows every other pipeline artifact — `save()` routes to Blob/local |
| ILP squad force-recompute on activation | Pipeline (Python) | — | `suggest_squad.py` runs in pipeline context with PuLP available |
| `/api/pre-season-active` read endpoint | API / Backend (Next.js) | — | Blob/local read via `readBlobOrLocal()`; returns 404 when absent |
| `usePreSeasonActive()` hook | Frontend Client | — | TanStack Query; drives pill state and banner condition |
| Status pill (Awaiting/Live) | Browser / Client | — | Purely presentational; derived from hook return |
| First-activation banner | Browser / Client | — | `useState` dismissed flag + `localStorage` suppression; no server round-trip |
| localStorage banner suppression | Browser / Client | — | `nsp_activation_seen_{seasonId}` key; synchronous on dismiss click |

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib (`os`, `json`, `datetime`, `sys`) | 3.11.9 | Pipeline gate, JSON write, timestamp | Already used throughout `run.py` |
| `vercel_blob` | installed | Blob list check + artifact write | Same as `archive_season.py` idempotency check |
| `upload.save()` | internal | Routes Blob/local save | Used for every pipeline artifact |
| TanStack Query (`@tanstack/react-query`) | 5.95.2 | `usePreSeasonActive` data fetching + caching | Already in use; mirrors `usePreSeasonSquad.ts` |
| Next.js 16.2.1 | 16.2.1 | API route handler (`/api/pre-season-active`) | Project framework |
| Tailwind v4 | installed | Status pill + banner styling | Project CSS framework |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` 4.x + `@testing-library/react` | 4.1.2 / 16.3.2 | Frontend hook tests (usePreSeasonActive) | Vitest jsdom environment; mirror `useWatchlist.test.ts` pattern |
| `pytest` | 8.3.5 | Pipeline unit tests (suggest_squad force param, activation predicate) | Mirror `test_squad_health.py` / `test_run_offseason.py` patterns |

### Alternatives Considered

None — all tooling decisions are pre-locked. No new libraries required.

**Installation:** None required. All dependencies already in `package.json` and `pipeline/requirements.txt`.

---

## Architecture Patterns

### System Architecture Diagram

```
FPL Bootstrap API
       │  (4× daily cron)
       ▼
run.py: get_bootstrap_static()
       │
       ├── IS_OFF_SEASON=True ──────────────────────────────────────────────┐
       │                                                                     │
       │   [NEW: activation block — after squad_health section]             │
       │   Evaluate tri-state predicate:                                     │
       │     len(events)>=38 AND not any(e.finished) AND events[0].deadline_time │
       │                                                                     │
       │   predicate=True AND artifact absent                                │
       │       │                                                             │
       │       ├── save('pre_season_active.json', {activated_at, season_id}) │
       │       └── suggest_squad(bootstrap, archive, force=True)            │
       │               │                                                     │
       │               └── [REFACTORED] force=True bypasses idempotency check│
       │                   re-runs ILP → save('pre_season_squad.json')      │
       │                                                                     │
       │   predicate=True AND artifact present → skip (idempotent)          │
       │   predicate=False → skip (new season not yet published)            │
       └───────────────────────────────────────────────────────────────────┘

Vercel Blob / pipeline/cache/
   pre_season_active.json ─────────► /api/pre-season-active (Next.js GET)
                                              │
                                              │  404 if absent
                                              │  200 {activated_at, season_id} if present
                                              ▼
                                    usePreSeasonActive() [TanStack Query]
                                    staleTime: 60_000ms
                                    returns: PreSeasonActiveResponse | null
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                       null (Awaiting)                 non-null (Live)
                              │                               │
                     zinc "Awaiting" pill            green "Live" pill
                                                             +
                                          if !localStorage['nsp_activation_seen_{seasonId}']
                                                → show dismissible banner
                                          onClick dismiss → setItem + setDismissed(true)
```

### Recommended Project Structure

No new directories. New/modified files:

```
pipeline/
├── suggest_squad.py          # MODIFY: add force=False param; wrap idempotency in if not force
├── run.py                    # MODIFY: add activation block inside IS_OFF_SEASON else branch
└── tests/
    ├── test_suggest_squad.py # NEW: force param contract tests (does not currently exist)
    └── test_run_offseason.py # MODIFY: add activation predicate tests

src/
├── app/api/pre-season-active/
│   └── route.ts              # NEW: readBlobOrLocal + 404/200 pattern
├── lib/
│   ├── types.ts              # MODIFY: add PreSeasonActiveResponse interface
│   └── hooks/
│       ├── usePreSeasonActive.ts        # NEW: mirror usePreSeasonSquad.ts
│       └── usePreSeasonActive.test.ts  # NEW: 404→null, data shape tests
└── components/next-season/
    └── NextSeasonPlannerTab.tsx  # MODIFY: add pill + banner
```

### Pattern 1: suggest_squad.py force Parameter Refactor

**What:** Wrap the existing dual-path idempotency check (blob list + local path) in `if not force:` so `force=True` bypasses it and proceeds to full ILP execution.

**When to use:** Only the activation block in `run.py` passes `force=True`. GW38 callers use the default.

```python
# Source: suggest_squad.py lines 263–278 (VERIFIED: codebase read)
def suggest_squad(bootstrap: dict, archive: dict, force: bool = False) -> None:
    import os as _os
    if not force:
        # Existing idempotency check (unchanged)
        if _os.getenv('USE_BLOB', '').lower() == 'true':
            try:
                import vercel_blob
                result = vercel_blob.list({'prefix': SQUAD_KEY, 'limit': 1})
                if len(result.get('blobs', [])) > 0:
                    print("[suggest_squad] already exists — skipping.")
                    return
            except Exception as _exc:
                print(f"[suggest_squad] _blob_exists check failed ({_exc}); assuming not present.", file=sys.stderr)
        else:
            local_path = _os.path.join('pipeline', 'cache', SQUAD_KEY)
            if _os.path.exists(local_path):
                print("[suggest_squad] already exists — skipping.")
                return
    # ... rest of function unchanged
```

### Pattern 2: run.py Activation Block (inside IS_OFF_SEASON else branch)

**What:** Tri-state predicate evaluation → artifact existence check → conditional write + force-recompute.

**When to use:** Every pipeline run where IS_OFF_SEASON is True; runs after the squad_health section (~line 244).

```python
# Source: Derived from CONTEXT.md D-01/D-02, run.py lines 238-245 context (VERIFIED: codebase read)
# Place AFTER squad_health section, still inside `if IS_OFF_SEASON:` (indented)
        # Phase 128 AUTO-01/02: Pre-season auto-activation.
        # Predicate: IS_OFF_SEASON AND len(events)>=38 AND not any(e.finished) AND events[0].deadline_time present
        _pre_season_predicate = (
            len(events) >= 38
            and not any(e.get('finished') for e in events)
            and bool(events[0].get('deadline_time') if events else None)
        )
        if _pre_season_predicate:
            try:
                # Check artifact existence (same pattern as suggest_squad idempotency)
                _active_key = 'pre_season_active.json'
                _active_exists = False
                if os.getenv('USE_BLOB', '').lower() == 'true':
                    import vercel_blob as _vb
                    _result = _vb.list({'prefix': _active_key, 'limit': 1})
                    _active_exists = len(_result.get('blobs', [])) > 0
                else:
                    _active_exists = os.path.exists(os.path.join(cache_dir, _active_key))

                if not _active_exists:
                    # First activation: write artifact and force-recompute squad
                    from datetime import datetime as _dt, timezone as _tz
                    _year = int(events[0]['deadline_time'][:4])
                    _season_id = f"{_year-1}{str(_year)[2:]}"
                    save(_active_key, {
                        'activated_at': _dt.now(_tz.utc).isoformat(),
                        'season_id': _season_id,
                    })
                    print(f"[pipeline] Pre-season activation written: season_id={_season_id}")
                    # Force-recompute squad against fresh bootstrap prices
                    # (archive may be None if not yet written; guard accordingly)
                    archive_path = os.path.join(cache_dir, 'season_archive_gw38.json')
                    _arch = None
                    if os.path.exists(archive_path):
                        with open(archive_path, 'r', encoding='utf-8') as _f:
                            _arch = json.load(_f)
                    elif os.getenv('USE_BLOB', '').lower() == 'true':
                        import vercel_blob as _vb2
                        import requests as _req
                        _blist = _vb2.list({'prefix': 'season_archive_gw38.json', 'limit': 1})
                        _bs = _blist.get('blobs', [])
                        if _bs:
                            _arch = _req.get(_bs[0].get('url', ''), timeout=30).json()
                    if _arch is not None:
                        from suggest_squad import suggest_squad
                        suggest_squad(bootstrap, _arch, force=True)
                        print("[pipeline] Pre-season squad force-recomputed.")
                    else:
                        print("[pipeline] Pre-season activation: archive not available — squad recompute skipped.", file=sys.stderr)
                else:
                    print("[pipeline] Pre-season already activated — skipping.")
            except Exception as _pa_exc:
                print(f"[pipeline] Pre-season activation non-fatal error: {_pa_exc}", file=sys.stderr)
```

### Pattern 3: /api/pre-season-active Route

**What:** GET-only route; reads `pre_season_active.json` via `readBlobOrLocal()`; returns 404 if absent.

**When to use:** Mirrors `pre-season-squad/route.ts` structure exactly.

```typescript
// Source: Derived from pre-season-squad/route.ts (VERIFIED: codebase read)
// src/app/api/pre-season-active/route.ts
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { PreSeasonActiveResponse } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

async function readBlobOrLocal(filename: string): Promise<string | null> {
  // ... identical to pre-season-squad/route.ts implementation
}

export async function GET() {
  try {
    const data = await readBlobOrLocal('pre_season_active.json')
    if (data === null) {
      return Response.json({ error: 'Pre-season not yet activated' }, { status: 404 })
    }
    const payload = JSON.parse(data) as PreSeasonActiveResponse
    return Response.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[pre-season-active] Unexpected error:', err)
    return Response.json({ error: 'Failed to load activation status' }, { status: 500 })
  }
}
```

**Cache-Control note:** 300s (5 minutes) s-maxage is more appropriate than 3600s used by pre-season-squad — activation state changes once per season but stale-while-revalidate ensures no user sees wrong state for long. [ASSUMED]

### Pattern 4: usePreSeasonActive Hook

**What:** TanStack Query hook; 404→null; non-null = Live; null = Awaiting.

**When to use:** Called once inside `NextSeasonPlannerTab`.

```typescript
// Source: Mirror of usePreSeasonSquad.ts (VERIFIED: codebase read)
// src/lib/hooks/usePreSeasonActive.ts
import { useQuery } from '@tanstack/react-query'
import type { PreSeasonActiveResponse } from '../types'

export function usePreSeasonActive() {
  return useQuery<PreSeasonActiveResponse | null>({
    queryKey: ['pre-season-active'],
    queryFn: async () => {
      const res = await fetch('/api/pre-season-active')
      if (res.status === 404) return null  // not yet activated → Awaiting
      if (!res.ok) return null             // treat errors as Awaiting (silent fallback per UI-SPEC)
      return res.json()
    },
    staleTime: 60_000,  // 60s — per CONTEXT.md discretion; consistent with D-08 in CONTEXT.md
  })
}
```

**Note:** `usePreSeasonSquad.ts` uses `staleTime: 6 * 60 * 60 * 1000` (6h). For the active-status endpoint the CONTEXT.md suggests 60 000ms — this is intentional since the activation state is expected to change during the pre-season window and the user wants reasonably fresh feedback. [VERIFIED: CONTEXT.md]

### Pattern 5: NextSeasonPlannerTab Integration

**What:** Add `usePreSeasonActive()` call, status pill row, and conditional banner.

**When to use:** `NextSeasonPlannerTab.tsx` return block.

```tsx
// Source: NextSeasonPlannerTab.tsx lines 179-195 (VERIFIED: codebase read)
// Insertion points:
//   1. Import usePreSeasonActive at top
//   2. Call hook inside component body
//   3. Add useState dismissed state
//   4. Add pill row as FIRST element before <h3>
//   5. Add banner between pill and <h3>

import { useState } from 'react'
import { usePreSeasonActive } from '@/lib/hooks/usePreSeasonActive'

// Inside NextSeasonPlannerTab():
const { data: activeData } = usePreSeasonActive()
const isActive = activeData !== null && activeData !== undefined
const seasonId = activeData?.season_id ?? ''
const [dismissed, setDismissed] = useState(
  () => typeof window !== 'undefined'
    ? localStorage.getItem(`nsp_activation_seen_${seasonId}`) === 'true'
    : false
)

// Pill (before existing <div> wrapper):
// Awaiting: bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
// Live:     bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200

// Banner (between pill and "Pre-Season Squad" h3):
// Show when: isActive && !dismissed
// On dismiss: localStorage.setItem(`nsp_activation_seen_${seasonId}`, 'true'); setDismissed(true)
```

### Anti-Patterns to Avoid

- **Importing `suggest_squad` at module level in `run.py`:** The existing IS_GW38 block imports `suggest_squad` inside the `try` block to avoid module-load side effects. The activation block must follow the same pattern — `from suggest_squad import suggest_squad` inside the `try` block. [VERIFIED: run.py line 214]
- **Calling `suggest_squad(bootstrap, archive, force=True)` when archive is None:** Archive may not be available if GW38 hasn't run yet. Guard with `if _arch is not None:` before calling. Log skip. [VERIFIED: existing GW38 pattern at run.py line 231-234]
- **Skipping the `not force:` guard in the local path idempotency check:** The existing code has two separate checks (Blob path and local path). Both must be wrapped in `if not force:`. Missing one means `force=True` still aborts early on local development. [VERIFIED: suggest_squad.py lines 265-278]
- **Using `useState` initialiser without SSR guard for localStorage:** `NextSeasonPlannerTab` is a `'use client'` component but `localStorage` is not available during SSR. Must guard with `typeof window !== 'undefined'`. [ASSUMED — standard Next.js pattern]
- **dismissed state initialised with wrong seasonId:** `dismissed` is initialised once via lazy useState. If `seasonId` is `""` on first render (data not yet loaded), the localStorage key becomes `nsp_activation_seen_` and the banner shows unnecessarily. Guard: only initialise dismissed lookup when `seasonId` is non-empty, or re-derive dismissed state after `seasonId` is known. [ASSUMED — worth testing]
- **Pill rendering during hook loading state:** UI-SPEC specifies "render nothing" for the pill during loading to avoid flash of "Awaiting" before data arrives. Do not render the pill when `activeData === undefined` (loading). [VERIFIED: UI-SPEC Component Inventory, Status Pill Row section]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blob artifact existence check | Custom blob API call pattern | `vercel_blob.list({'prefix': KEY, 'limit': 1})` | Exact pattern from `suggest_squad.py` lines 267-271; handles pagination edge cases |
| Local/Blob routing for artifact write | Custom env-branching logic | `upload.save()` | Routes automatically based on `USE_BLOB`; already handles `makedirs`, `json.dumps`, `contentType` |
| Blob/local artifact read in API route | Duplicate `readBlobOrLocal` | Copy from `pre-season-squad/route.ts` lines 15-33 | Already handles `ENOENT`, Blob 404, encoding |
| TanStack Query 404→null pattern | Custom fetch with null coercion | Mirror `usePreSeasonSquad.ts` | Established project pattern; handles staleTime, error vs null distinction |

**Key insight:** Every component of this phase has a working analogue already in the codebase. The implementation is almost entirely copy-and-specialise, not invent.

---

## Common Pitfalls

### Pitfall 1: Activation Block Position — IS_OFF_SEASON Timing vs IS_GW38 Timing

**What goes wrong:** The IS_GW38 block at line 196 of `run.py` has a critical comment: "MUST be BEFORE the IS_OFF_SEASON guard below." The activation block for Phase 128 is the opposite — it MUST be INSIDE the IS_OFF_SEASON block (after the squad_health section). Placing it outside or at the wrong nesting level means the predicate either runs during in-season (wrong) or misses the IS_OFF_SEASON context (never fires).

**Why it happens:** `run.py` has two off-season-related gates: IS_GW38 (which runs BEFORE IS_OFF_SEASON) and IS_OFF_SEASON. The activation block for Phase 128 belongs in the IS_OFF_SEASON `else` branch, not the IS_GW38 block.

**How to avoid:** Confirm the insertion point is the `else:` branch of `if not IS_OFF_SEASON:` (the block starting at line 251 with the skip-log prints). The activation block goes AFTER the skip-log section.

**Warning signs:** If the predicate runs during GW38 (IS_OFF_SEASON=False), `pre_season_active.json` is never written. If the block is placed at the same level as IS_GW38 (before the IS_OFF_SEASON check), it may fire during in-season on bootstraps where len(events)==38 but some events are finished.

[VERIFIED: run.py structure read]

### Pitfall 2: events[0].deadline_time IndexError

**What goes wrong:** The predicate accesses `events[0].get('deadline_time')`. If `events` is an empty list, this raises `IndexError` before the `bool()` check.

**Why it happens:** The outer predicate short-circuit `len(events) >= 38` guards this, but only if Python evaluates left-to-right (which it does with `and`). However, if someone reorders the predicate clauses, the guard fails.

**How to avoid:** Predicate must be: `len(events) >= 38 and not any(...) and bool(events[0].get(...))`. Keep `len(events) >= 38` as the FIRST clause.

**Warning signs:** `IndexError: list index out of range` in pipeline logs during off-season.

[VERIFIED: CONTEXT.md D-02 clause ordering; Python short-circuit evaluation]

### Pitfall 3: dismissed State Stale on First Render

**What goes wrong:** `useState` lazy initialiser runs once. If `seasonId` is `""` because `usePreSeasonActive()` hasn't resolved yet, the localStorage lookup uses key `nsp_activation_seen_` which is always absent — `dismissed` initialises to `false`. When data loads and `seasonId` becomes `"2526"`, `dismissed` is already `false` and the banner appears even if the user already dismissed it.

**Why it happens:** React `useState` initialiser only runs once on mount. The initial render has `activeData = undefined` (loading).

**How to avoid:** Derive `dismissed` state reactively, not in the useState initialiser. Options: (a) use a `useEffect` to set dismissed after `seasonId` is known, or (b) initialise dismissed to `true` (hidden) and only flip to `false` after checking localStorage with the correct key once `seasonId` is populated.

**Warning signs:** Banner re-appears after page refresh even though user already dismissed it.

[ASSUMED — standard React localStorage + async data hazard]

### Pitfall 4: archive Not Available for Force-Recompute

**What goes wrong:** The activation block calls `suggest_squad(bootstrap, archive, force=True)`. The archive (`season_archive_gw38.json`) is written by `archive_season.py` inside the IS_GW38 block — which runs during GW38 (IS_OFF_SEASON=False). When the pipeline runs in off-season, IS_GW38 is false, so archive_season is skipped. However, the archive from GW38 was already written; it persists in Blob/local cache.

**Why it happens:** The archive should always be available if GW38 has completed. But on a fresh environment (no prior GW38 run), it may be absent.

**How to avoid:** Guard `if _arch is not None:` before calling `suggest_squad`. Log `"archive not available — squad recompute skipped"` and continue. The activation artifact (`pre_season_active.json`) is still written even if the squad recompute is skipped.

**Warning signs:** `[pipeline] Pre-season activation: archive not available — squad recompute skipped.` in logs — not fatal, but means the squad won't be force-recomputed until the archive appears.

[VERIFIED: run.py lines 215-234 show the same guard pattern in the IS_GW38 block]

### Pitfall 5: localStorage Key Prefix Inconsistency

**What goes wrong:** The project's established `fplx_` prefix convention (used for `fplx_watchlist`, `fplx_manual_plan`, `fplx_mini_league_id`) is NOT used by the locked decision for the banner key: `nsp_activation_seen_{seasonId}`.

**Why it happens:** CONTEXT.md §code_context explicitly flags this: "LocalStorage key prefix: `fplx_` prefix for app storage; `nsp_activation_seen_{seasonId}` deviates slightly — planner should confirm or align."

**How to avoid:** The UI-SPEC (line 181) explicitly permits either `nsp_activation_seen_{seasonId}` or `fplx_nsp_activation_seen_{seasonId}`. Since this is a fresh key with no existing data, the planner should standardise to `fplx_nsp_activation_seen_{seasonId}` to match the project convention, unless the locked D-13/D-15 is treated as overriding.

**Warning signs:** Mixed localStorage key prefixes make future key audits harder.

[VERIFIED: UI-SPEC line 181; Grep of `fplx_` keys in codebase]

---

## Code Examples

### Existing readBlobOrLocal (copy verbatim for new route)

```typescript
// Source: src/app/api/pre-season-squad/route.ts lines 15-33 (VERIFIED: codebase read)
async function readBlobOrLocal(filename: string): Promise<string | null> {
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`)
      return await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      return await readFile(cachePath, 'utf-8')
    }
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) return null
    throw err
  }
}
```

### Pill Classes (from existing solver badge — reuse verbatim)

```tsx
// Source: NextSeasonPlannerTab.tsx lines 36-44 (VERIFIED: codebase read)
// "Live" pill — green variant:
"text-xs font-normal text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900 rounded px-2 py-1"

// "Awaiting" pill — zinc variant:
"text-xs font-normal text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1"
```

### Banner Tailwind Classes (from UI-SPEC)

```tsx
// Source: 128-UI-SPEC.md Component Inventory (VERIFIED: codebase read)
"rounded border border-green-400 bg-green-50 dark:bg-green-950 p-4 text-sm text-green-800 dark:text-green-200 mb-4 flex items-start justify-between"
// Dismiss button:
"ml-4 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
```

### Types.ts Addition

```typescript
// Source: CONTEXT.md D-08 (VERIFIED); append after PreSeasonSquadResponse at line 1142
export interface PreSeasonActiveResponse {
  activated_at: string  // ISO 8601
  season_id: string     // e.g. "2526"
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual activation (user configures flag) | Pipeline auto-detects via bootstrap tri-state predicate | Phase 128 | No user action required; detection is idempotent |
| `suggest_squad()` always-idempotent | `suggest_squad(force=True)` bypasses idempotency | Phase 128 | Enables fresh ILP computation against new-season prices |

**Deprecated/outdated:** Nothing deprecated in this phase. The idempotency pattern in `suggest_squad.py` is preserved for all non-force callers.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Cache-Control: s-maxage=300` is appropriate for `/api/pre-season-active` (vs 3600s used by pre-season-squad) | Architecture Patterns → Pattern 3 | If s-maxage is too long, CDN may serve stale "Awaiting" after activation for up to s-maxage seconds. Low risk — stale-while-revalidate covers it. |
| A2 | `dismissed` state must be derived reactively (not in useState initialiser) to avoid stale localStorage lookup | Common Pitfalls → Pitfall 3 | Banner re-appears after dismiss. High risk of bad UX. |
| A3 | SSR guard `typeof window !== 'undefined'` needed in useState initialiser for localStorage | Common Pitfalls → Pitfall 5, Pattern 5 | SSR crash or hydration mismatch. NextSeasonPlannerTab is `'use client'` so SSR risk is low but still present if component tree is server-rendered. |
| A4 | localStorage key should be standardised to `fplx_nsp_activation_seen_{seasonId}` | Common Pitfalls → Pitfall 5 | Consistency only; no functional risk since key is fresh |

---

## Open Questions

1. **localStorage key prefix alignment**
   - What we know: D-13/D-15 lock the key as `nsp_activation_seen_{seasonId}`; UI-SPEC explicitly permits `fplx_nsp_activation_seen_{seasonId}`; project convention is `fplx_` prefix
   - What's unclear: Which to use — locked decision vs project convention?
   - Recommendation: Standardise to `fplx_nsp_activation_seen_{seasonId}` (matches project convention; UI-SPEC explicitly permits it; no existing data to migrate). Planner should treat this as a minor override of D-13/D-15 note.

2. **dismissed state initialisation strategy**
   - What we know: `seasonId` is empty on first render; localStorage key depends on `seasonId`
   - What's unclear: Whether `useState` lazy init or `useEffect` is better
   - Recommendation: Use `useMemo` or a derived check: only render banner when `isActive && !dismissed && seasonId !== ''`. Re-read localStorage key synchronously inside the render condition with `typeof window !== 'undefined' && localStorage.getItem(...)`, rather than via useState. This avoids stale-init entirely.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Pipeline tests | ✓ | 3.11.9 | — |
| pytest | Pipeline tests | ✓ | 8.3.5 | — |
| vitest | Frontend tests | ✓ | 4.1.2 | — |
| @testing-library/react | Hook tests | ✓ | 16.3.2 | — |
| jsdom | Frontend tests | ✓ | 25.0.1 | — |
| vercel_blob (Python) | Pipeline Blob write | ✓ (installed) | installed | USE_BLOB=false → local |
| Node.js | Next.js API route | ✓ | v25 (per vitest setup comments) | — |

[VERIFIED: package.json, pipeline/tests/conftest.py, python3 --version, pip3 show pytest]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Frontend framework | Vitest 4.1.2 + jsdom + @testing-library/react |
| Frontend config | `vitest.config.ts` (project root) |
| Frontend quick run | `npm test` (vitest run) |
| Frontend full suite | `npm test` |
| Pipeline framework | pytest 8.3.5 |
| Pipeline config | `conftest.py` (sys.path injection) |
| Pipeline quick run | `python -m pytest pipeline/tests/ -x` |
| Pipeline full suite | `python -m pytest pipeline/tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | Tri-state predicate evaluates correctly across edge cases | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ (file exists; add new test class) |
| AUTO-01 | Predicate false when events has finished events | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ |
| AUTO-01 | Predicate false when len(events) < 38 | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ |
| AUTO-01 | Predicate false when events[0].deadline_time absent | unit (Python) | `python -m pytest pipeline/tests/test_run_offseason.py -x` | ✅ |
| AUTO-02 | `suggest_squad(force=True)` bypasses idempotency check | unit (Python) | `python -m pytest pipeline/tests/test_suggest_squad.py -x` | ❌ Wave 0 |
| AUTO-02 | `suggest_squad(force=False)` skips when artifact exists | unit (Python) | `python -m pytest pipeline/tests/test_suggest_squad.py -x` | ❌ Wave 0 |
| AUTO-03 | `usePreSeasonActive` returns null on 404 | unit (TS) | `npm test -- usePreSeasonActive` | ❌ Wave 0 |
| AUTO-03 | `usePreSeasonActive` returns data on 200 | unit (TS) | `npm test -- usePreSeasonActive` | ❌ Wave 0 |
| AUTO-03 | Banner dismissed state persists via localStorage | unit (TS) | `npm test -- usePreSeasonActive` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python -m pytest pipeline/tests/ -x` and/or `npm test`
- **Per wave merge:** full `npm test` + `python -m pytest pipeline/tests/`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pipeline/tests/test_suggest_squad.py` — covers AUTO-02 force param contract
- [ ] `src/lib/hooks/usePreSeasonActive.test.ts` — covers AUTO-03 hook contract (404→null, data shape, localStorage key)

*(Existing `test_run_offseason.py` covers AUTO-01 predicate tests — extend, don't create new file)*

---

## Project Constraints (from CLAUDE.md)

1. **Do not add `Co-Authored-By` trailers to git commits** — CLAUDE.md directive
2. **Read `node_modules/next/dist/docs/` before writing any Next.js code** — AGENTS.md directive; confirmed: route handler patterns checked against `01-app/01-getting-started/15-route-handlers.md` for Next.js 16.2.1
3. **Heed deprecation notices in Next.js docs** — AGENTS.md directive; Next.js 16.2.1 uses `Response.json()` not the older `NextResponse.json()`; existing `pre-season-squad/route.ts` already uses `Response.json()` — follow that pattern

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Read-only public artifact; no auth required |
| V3 Session Management | no | localStorage banner suppression is purely UX, not auth |
| V4 Access Control | no | `/api/pre-season-active` serves public pre-season metadata |
| V5 Input Validation | no | API route reads Blob artifact (trusted pipeline source); no user input |
| V6 Cryptography | no | No secrets handled in this phase |

No user-supplied input reaches any API or pipeline code in this phase. The only user interaction is a dismiss button click that writes a localStorage key. No security-relevant attack surface is introduced.

---

## Sources

### Primary (HIGH confidence)
- `pipeline/run.py` — IS_OFF_SEASON block structure, IS_GW38 block, idempotency patterns, non-fatal error wrappers; lines 148–245
- `pipeline/suggest_squad.py` — full idempotency pattern; `suggest_squad()` signature; lines 253–336
- `pipeline/upload.py` — `save()` implementation; lines 7–30
- `src/app/api/pre-season-squad/route.ts` — `readBlobOrLocal()` implementation; 404/200 pattern; lines 15–154
- `src/lib/hooks/usePreSeasonSquad.ts` — TanStack Query 404→null hook pattern
- `src/components/next-season/NextSeasonPlannerTab.tsx` — full component; integration points; solver badge Tailwind classes
- `src/lib/types.ts` — `SquadHealth`, `PreSeasonSquadResponse` type location; line 1138
- `vitest.config.ts` — test framework configuration
- `pipeline/tests/conftest.py` — pytest sys.path pattern
- `pipeline/tests/test_run_offseason.py` — IS_OFF_SEASON contract test pattern to extend
- `.planning/phases/128-pre-season-auto-activation/128-UI-SPEC.md` — approved UI design contract; Tailwind classes; accessibility requirements
- `.planning/phases/128-pre-season-auto-activation/128-CONTEXT.md` — all locked decisions D-01 through D-16
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Next.js 16 route handler API

### Secondary (MEDIUM confidence)
- `src/lib/hooks/useWatchlist.test.ts` — localStorage test pattern in vitest jsdom
- `vitest.setup.ts` — Node 25 localStorage patch; confirms localStorage testing approach

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Pipeline changes (run.py, suggest_squad.py): HIGH — canonical source code read; patterns fully verified
- API route (pre-season-active): HIGH — identical to pre-season-squad/route.ts; readBlobOrLocal verified
- Frontend hook: HIGH — mirrors usePreSeasonSquad.ts exactly
- UI integration (pill + banner): HIGH — NextSeasonPlannerTab read; UI-SPEC approved; Tailwind classes verified
- dismissed state initialisation hazard: MEDIUM — standard React pattern, flagged as pitfall

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable codebase; no fast-moving dependencies)
