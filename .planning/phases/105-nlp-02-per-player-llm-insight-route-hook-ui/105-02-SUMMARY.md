---
phase: 105
plan: "02"
subsystem: nlp
tags: [nlp, llm, anthropic, vitest, wave-1, green-phase, player-insight]
dependency_graph:
  requires:
    - "105-01: RED-phase test scaffolding (route.test.ts, usePlayerInsight.test.ts, PlayerInsightSection.test.tsx, GemTable.test.tsx)"
    - "Phase 104: computeRejection + computeFragility wired (context for XML prompt)"
    - "Phase 102: MC fields active in pipeline (haul_prob, blank_prob, p10_pts, p90_pts)"
  provides:
    - "POST /api/player-insight route handler (Node.js, maxDuration=30)"
    - "usePlayerInsight mutation hook with localStorage cache"
    - "PlayerInsightSection component (idle/loading/success/error/guardrail states)"
    - "PlayerInsightRequest + PlayerInsightResponse types"
  affects:
    - "src/lib/types.ts (new PlayerInsightRequest + PlayerInsightResponse types)"
    - "src/app/api/player-insight/route.ts (new route handler)"
    - "src/lib/hooks/usePlayerInsight.ts (new hook)"
    - "src/components/shared/PlayerInsightSection.tsx (new component)"
    - "src/components/gem-table/GemTable.test.tsx (mock fields fixed — Wave 2 integration pending)"
tech_stack:
  added: []
  patterns:
    - "useMutation (not useQuery) for on-demand LLM fetch — no auto-refetch"
    - "mutationKey: ['playerInsight', playerId, gw] for in-flight dedup"
    - "Two-attempt guardrail retry loop (base prompt → strict mode)"
    - "Fire-and-forget Blob write with Promise.resolve().catch() guard"
    - "useState initialiser for synchronous localStorage cache-hit check on mount"
    - "USE_BLOB read at request time (not module load) for test overridability"
key_files:
  created:
    - src/lib/types.ts (PlayerInsightRequest + PlayerInsightResponse types added)
    - src/app/api/player-insight/route.ts
    - src/lib/hooks/usePlayerInsight.ts
    - src/components/shared/PlayerInsightSection.tsx
  modified:
    - src/components/gem-table/GemTable.test.tsx (mock fields: team_short_name, status, mins_risk, form, pts fields)
decisions:
  - "USE_BLOB read inside isUseBlob() function at request time (not const at module load) so per-test env overrides work without module cache invalidation"
  - "Promise.resolve(put(...)).catch() pattern for fire-and-forget Blob write — guards against mock returning undefined in tests"
  - "useState initialiser for cache check (not useEffect) — synchronous, avoids extra render cycle, never triggers mutation"
  - "GemTable integration (2 remaining GemTable tests) deferred to Wave 2 (105-03) as planned — component scaffold only in Wave 1"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-13"
  tasks: 4
  files: 5
---

# Phase 105 Plan 02: Wave 1 Core Infrastructure Summary

Wave 1 turns all 11 route tests, 8 hook tests, and 8 component tests GREEN. The full NLP-02 infrastructure is implemented: POST route with two-attempt guardrail, localStorage + Blob cache, on-demand mutation hook, and `PlayerInsightSection` component in all states. GemTable and OCT integration remains for Wave 2 (105-03) as planned.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1+2 | PlayerInsight types + /api/player-insight route | 6c241e4 | src/lib/types.ts, src/app/api/player-insight/route.ts |
| 3 | usePlayerInsight mutation hook | 11746ea | src/lib/hooks/usePlayerInsight.ts |
| 4 | PlayerInsightSection component | 97c6a7d | src/components/shared/PlayerInsightSection.tsx |
| fix | GemTable test mock fields fix | e616a0a | src/components/gem-table/GemTable.test.tsx |

## Test Results

| Test File | Tests | State |
|-----------|-------|-------|
| route.test.ts | 11 | GREEN (11/11) |
| usePlayerInsight.test.ts | 8 | GREEN (8/8) |
| PlayerInsightSection.test.tsx | 8 | GREEN (8/8) |
| GemTable.test.tsx | 3 | 1 GREEN, 2 pending Wave 2 integration |
| OpportunityCostTable.test.tsx | 9 + 3 todo | 9 GREEN, 3 todo (Wave 2) |

**Total new tests GREEN: 28/30** (2 require Wave 2 GemTable integration)

## Route Handler Implementation

`/api/player-insight` (POST, Node.js only, `maxDuration = 30`):
1. Zod validation of request body (`gw`, `player`, `rejection_reasons`, `fragility`, `lifecycle_label?`)
2. 503 guard: `ANTHROPIC_API_KEY` absent → immediate 503 response
3. `readPlayerCorpus()`: fetches `merged_players.json` from Blob or local cache for guardrail
4. Two-attempt retry loop:
   - Attempt 1: base system prompt ("FPL analyst, 2-3 sentences, qualitative")
   - Attempt 2: strict mode ("ONLY mention: {playerWebName}")
   - Each attempt: `claude-haiku-4-5-20251001`, `max_tokens: 300`
   - `passesGuardrail(prose, [player.web_name], corpus)` check
5. On guardrail pass: fire-and-forget Blob write + return 200
6. Both attempts fail: 422 response
7. SDK throws: 502 response

XML context format:
```xml
<player name="{web_name}" position="{pos}" lifecycle="{label}">
  <mc haul_prob="..." blank_prob="..." p10_pts="..." p90_pts="..."/>
  <fragility tier="{tier}"><reason>...</reason></fragility>
  <reasons><reason>...</reason></reasons>
</player>
```

## Hook Implementation

`usePlayerInsight(playerId, gw)` returns `useMutation` with:
- `mutationKey: ['playerInsight', playerId, gw]` — in-flight dedup
- `mutationFn`: POSTs to `/api/player-insight`, throws `GUARDRAIL_FAILED` on 422
- `onSuccess`: writes `PlayerInsightResponse` to `localStorage.setItem('playerInsight:{id}:gw{gw}', ...)`

`readCachedInsight(playerId, gw)` — exported pure function for synchronous cache reads.

## Component States

`PlayerInsightSection` (`player`, `gw`, `rejectionReasons`, `fragility`):
- **Idle (no cache)**: "Get AI insight" button
- **Cache hit on mount**: shows prose + "Refresh insight" immediately (no button click needed)
- **Loading**: "Generating…" button (disabled)
- **Success**: "AI ✨ Insight" heading + prose + "Refresh insight" button
- **Hard error**: "AI unavailable — try again" inline text
- **GUARDRAIL_FAILED**: "AI insight unavailable — showing analysis:" + rejectionReasons list

**Critical invariant preserved**: `mutate` is NEVER called from `useEffect` — cost-explosion safeguard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] USE_BLOB const evaluated at module load time**
- **Found during:** Task 2, route test run
- **Issue:** `const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'` evaluated at module import. Since Vitest caches modules across test iterations, the per-test `process.env.USE_BLOB = 'false'` override had no effect.
- **Fix:** Replaced with `function isUseBlob()` that reads `process.env.USE_BLOB` at call time.
- **Files modified:** `src/app/api/player-insight/route.ts`
- **Commit:** 6c241e4

**2. [Rule 1 - Bug] `put(...).catch(...)` crashes when mock returns undefined**
- **Found during:** Task 2, route test run (put called with allowOverwrite true test)
- **Issue:** `vi.fn()` mock for `put` returns `undefined` by default; calling `.catch()` on `undefined` throws `Cannot read properties of undefined (reading 'catch')`.
- **Fix:** Wrapped in `Promise.resolve(put(...)).catch(...)` to handle non-Promise return values.
- **Files modified:** `src/app/api/player-insight/route.ts`
- **Commit:** 6c241e4

**3. [Rule 1 - Bug] GemTable.test.tsx mock player missing required fields**
- **Found during:** GemTable test run after creating PlayerInsightSection
- **Issue:** Wave 0 scaffold mock player had no `team_short_name`, `status`, `mins_risk`, or points fields. `TeamBadge` called `.slice(0, 2)` on undefined `team_short_name`; `columns.tsx` called `.toUpperCase()` on undefined `status`.
- **Fix:** Added `team_short_name: 'LIV'`, `status: 'a'`, `mins_risk: 'nailed'`, `form`, `total_points`, `pts_last3gw`, `pts_last5gw`, `pts_gw_count` to the mock player.
- **Files modified:** `src/components/gem-table/GemTable.test.tsx`
- **Commit:** e616a0a

## Known Stubs

None — all components are fully wired. GemTable and OCT integration is Wave 2 scope by design, not a stub.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-network-endpoint | src/app/api/player-insight/route.ts | New POST endpoint at /api/player-insight; Zod-validated body; server-side API key guard (503 on absent key); Node.js only (no Edge). Within plan's stated threat model. |

## Self-Check: PASSED
