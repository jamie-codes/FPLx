---
phase: 105-nlp-02-per-player-llm-insight-route-hook-ui
reviewed: 2026-05-13T10:45:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/app/api/player-insight/route.ts
  - src/app/api/player-insight/route.test.ts
  - src/components/gem-table/GemTable.tsx
  - src/components/gem-table/GemTable.test.tsx
  - src/components/shared/PlayerInsightSection.tsx
  - src/components/shared/PlayerInsightSection.test.tsx
  - src/components/squad/DecisionSummaryTab.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/OpportunityCostTable.test.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/lib/hooks/usePlayerInsight.ts
  - src/lib/hooks/usePlayerInsight.test.ts
  - src/lib/types.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 105: Code Review Report

**Reviewed:** 2026-05-13T10:45:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 105 NLP-02 adds an on-demand per-player LLM insight route, a React Query mutation hook, and UI integration points in GemTable, OpportunityCostTable, and PlayerInsightSection. The architecture is sound: on-demand only, no auto-fire from useEffect, fire-and-forget Vercel Blob caching, and a retry+guardrail scheme.

One critical defect exists: the `passesGuardrail` call becomes a complete no-op whenever the player corpus file is unavailable (missing blob, fetch failure, or missing local file), silently allowing hallucinated player names through on the degraded path. Four warnings cover missing input validation bounds, a misleading GW=1 fallback in GemTable, an unsafe type cast, and a stale error display issue. Two info items note individual string length gaps.

## Critical Issues

### CR-01: Guardrail silently disabled when player corpus is unavailable

**File:** `src/app/api/player-insight/route.ts:157-182`

**Issue:** `readPlayerCorpus()` returns `[]` on any failure (missing blob, failed fetch, missing local file — lines 64, 66, 73, 80). When `corpus` is empty, `passesGuardrail(prose, allowed, [])` iterates zero candidates and unconditionally returns `true`. The LLM can name any other player and the response is returned as valid. This silently disables the cross-player name guardrail on the degraded path — the very scenario where hallucination risk is highest (cold start, Blob not yet populated, pipeline failure). Both retry attempts use the same empty corpus, so the strict-mode retry provides no additional protection.

**Fix:** Add an explicit corpus-empty guard before the retry loop. Return 503 (corpus unavailable is a service configuration problem) or treat an empty corpus as a hard guardrail failure (422). A less-breaking alternative is to log a warning and skip the cross-name check, but that must be an explicit, documented policy:

```typescript
const corpus = await readPlayerCorpus()
// Guard: empty corpus means the guardrail cannot function — fail closed.
if (corpus.length === 0) {
  return Response.json(
    { error: 'Service unavailable', detail: 'player corpus unavailable' },
    { status: 503 },
  )
}
```

If the preference is to degrade gracefully rather than fail closed, at minimum add a distinct error response so callers can distinguish corpus-miss from LLM error, and document the policy explicitly.

## Warnings

### WR-01: GemTable falls back to `gw=1` when accuracy data is unavailable

**File:** `src/components/gem-table/GemTable.tsx:143-149`

**Issue:** `insightGw` is derived as `(lastGwActualGwN ?? 0) + 1`. When `accuracyData` is null or `gws_covered` is empty, `lastGwActualGwN` is `null`, so `insightGw` becomes `1`. This is used as the cache key for localStorage (`playerInsight:{id}:gw1`) and sent to the API route (where `gw: z.number().int().positive()` does pass validation for `1`). The bug is that:

1. Insights cached with `gw=1` during a loading transient will be served from the cache later when the real gameweek is e.g. 36, because `readCachedInsight` is called in the `useState` initialiser with whatever `gw` is at mount time.
2. If the accuracy hook loads after mount, `insightGw` changes from 1 to 36, but the `useState` initialiser only runs once — so the stale GW-1 cache hit is served and the user sees an insight from an entirely wrong gameweek.
3. LLM calls made while `insightGw=1` produce responses keyed to the wrong gameweek, wasting tokens.

TransferPanel uses `nextGw` (fallback to 0, which the route rejects with 400) so it is less affected. GemTable has no squad context and is solely reliant on the accuracy hook.

**Fix:** Guard the `PlayerInsightSection` render in GemTable behind a truthy `insightGw` check, or do not render the section until `accuracyData` is loaded:

```tsx
// Only render when we have a confident GW number
const insightGw = lastGwActualGwN !== null ? lastGwActualGwN + 1 : null

// In the expanded row:
{insightGw !== null && (
  <PlayerInsightSection
    player={row.original}
    gw={insightGw}
    rejectionReasons={rejection.reasons}
    fragility={{ tier: fragility.tier, reasons: fragility.reasons }}
  />
)}
```

### WR-02: `lifecycle_label` is never threaded from call sites to the API despite being in the schema

**File:** `src/components/shared/PlayerInsightSection.tsx:50-78`, `src/app/api/player-insight/route.ts:39`

**Issue:** The API route schema declares `lifecycle_label` as an optional field and incorporates it into the XML prompt context (`lifecycle="${xmlEscape(lifecycle_label)}"`). The `PlayerInsightRequest` type in `types.ts` (line 931) also declares `lifecycle_label?: string`. However, `PlayerInsightSection` never accepts a `lifecycle_label` prop and never includes it in the `mutate` payload. Both call sites in GemTable and OpportunityCostTable omit it. The field is dead in the prompt. This means the LLM loses context that could improve response quality (e.g. knowing a player is labelled 'sell' or 'fixture_trap').

In GemTable, lifecycle labels are not computed (no squad context). In OpportunityCostTable, `lifecycleLabels` is available in scope (passed to `PlayerMoveCell`) but not threaded down. In GemTable the field may correctly be omitted, but in OpportunityCostTable (TransferPanel context) the label is available and intentionally designed to be part of the prompt.

**Fix:** Add `lifecycleLabel?: string` to `PlayerInsightSectionProps` and include it in the mutate payload when present:

```typescript
// In PlayerInsightSectionProps:
lifecycleLabel?: string

// In mutate payload:
mutate({
  gw,
  player: { ... },
  rejection_reasons: rejectionReasons,
  fragility,
  lifecycle_label: lifecycleLabel,
})
```

Then in `PlayerMoveCell` in `OpportunityCostTable.tsx`, thread the lifecycle label from the `lifecycleLabels` map for the buy candidate.

### WR-03: Type cast `t.buy as unknown as ScoredPlayer` passes `MergedPlayer` where `ScoredPlayer` is required — `computeRejection` caller is also affected

**File:** `src/components/transfers/OpportunityCostTable.tsx:119,150`

**Issue:** Both `computeRejection(t.sell as unknown as ScoredPlayer, ...)` and `<PlayerInsightSection player={t.buy as unknown as ScoredPlayer} ...>` cast `MergedPlayer` to `ScoredPlayer` using a double-cast that bypasses TypeScript. `ScoredPlayer` extends `MergedPlayer` with 8 required numeric fields (`gem_score`, `fdr_score`, `form_score`, `xg_score`, `xa_score`, `ownership_score`, `minutes_score`, `set_piece_score`). At runtime, these fields are `undefined` on the cast object.

For `PlayerInsightSection`, the component only accesses `player.id`, `player.web_name`, `player.element_type`, `player.haul_prob`, `player.blank_prob`, `player.p10_pts`, `player.p90_pts` — all of which exist on `MergedPlayer`, so the cast is safe for this component today. However, the `as unknown as ScoredPlayer` is a promise that is not enforced by the type system, and any future code that reads `player.gem_score` from the cast object will silently get `undefined`. `computeRejection` accesses `gem_score` internally and will receive `undefined`, which degrades gracefully due to `?? 0` guards in that function, but only by coincidence.

**Fix:** The cleanest solution is to accept `MergedPlayer` in `PlayerInsightSection`'s props (since only `MergedPlayer` fields are used) and change the `computeRejection` signature or use an explicit `Partial<ScoredPlayer>` where score fields are optional:

```typescript
// PlayerInsightSectionProps — accept MergedPlayer directly
export interface PlayerInsightSectionProps {
  player: Pick<MergedPlayer, 'id' | 'web_name' | 'element_type' | 'haul_prob' | 'blank_prob' | 'p10_pts' | 'p90_pts'>
  gw: number
  rejectionReasons: string[]
  fragility: { tier: FragilityTier; reasons: string[] }
}
```

This eliminates the need for the cast entirely at the `PlayerInsightSection` call site.

### WR-04: SDK error on first attempt returns 502 immediately without retrying on attempt 2

**File:** `src/app/api/player-insight/route.ts:176-178`

**Issue:** The retry loop is intended to provide a second attempt with a stricter system prompt when the guardrail fails. However, when the Anthropic SDK throws an exception (network error, rate limit, timeout), the `catch` block at line 176 immediately returns a 502 response — it does not `continue` to attempt the second iteration. If the first call fails transiently (e.g. a momentary timeout) and the second call would have succeeded, the response is prematurely 502'd. The intent of having two loop iterations is wasted for transient SDK failures.

The test at line 70-80 only asserts that a 502 is returned; it does not assert that only one SDK call was made, so this early-exit behaviour on SDK errors is untested.

**Fix:** Decide whether transient SDK errors should be retried. If yes, `continue` instead of `return` (with appropriate logging):

```typescript
} catch (err) {
  // On last attempt, give up and surface 502; otherwise retry
  if (attempt === 1) {
    return Response.json({ error: 'LLM error', detail: 'upstream call failed' }, { status: 502 })
  }
  continue
}
```

If no retry is desired on SDK error (current behaviour is intentional), add a comment explaining that transient network errors are not retried and add a test asserting `create` was called exactly once on SDK error.

## Info

### IN-01: Individual strings in `rejection_reasons` and `fragility.reasons` have no maximum length

**File:** `src/app/api/player-insight/route.ts:34,37`

**Issue:** The Zod schema caps the number of items in each array (`max(10)`) but places no limit on individual string length: `z.array(z.string()).max(10)`. These strings are xmlEscaped and injected directly into the LLM prompt. An unexpectedly long rejection reason (e.g. a downstream pipeline bug) could inflate the prompt context, consuming tokens from the `max_tokens: 300` response budget or exceeding model context limits. In practice the strings come from the analyst engine and are short, but the API surface is unconstrained.

**Fix:** Add `.max(256)` to each individual string element:

```typescript
rejection_reasons: z.array(z.string().max(256)).max(10),
// and:
reasons: z.array(z.string().max(256)).max(10),
```

### IN-02: Route test suite re-imports the same module in each test without `vi.resetModules()` — ANTHROPIC_API_KEY delete test may interact with module-cached `new Anthropic()` call

**File:** `src/app/api/player-insight/route.test.ts:63-80`

**Issue:** Each `it` block calls `await import('./route')`. Without `vi.resetModules()` between tests, Vitest serves the cached module. The `Anthropic` client is instantiated at request-time inside `POST` (line 159 of route.ts), not at module load time, so env var checks per-request are safe. However, the `503 when ANTHROPIC_API_KEY missing` test deletes the env var with `delete process.env.ANTHROPIC_API_KEY` and the `beforeEach` restores it with `process.env.ANTHROPIC_API_KEY = 'test-key'`. If test ordering ever places the 503 test last (unlikely with Vitest's serial execution within a `describe`, but possible with `--reporter` or `--shard` usage), the subsequent `beforeEach` may not run before teardown.

Additionally, `(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(...)` is used in 8 tests but the mock state is only reset with `vi.clearAllMocks()` in `beforeEach`, which resets mock call counts but does NOT reset the `mockImplementation`. Tests that don't re-mock `Anthropic` (e.g. `503 when ANTHROPIC_API_KEY missing`) may inherit a `mockImplementation` from a prior test if execution order changes.

**Fix:** Add `vi.resetModules()` in `beforeEach` and re-import `Anthropic` inside each test, or add a dedicated `mockImplementation` call in `beforeEach` to establish a safe default:

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  // Restore safe default mock implementation
  ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
    return { messages: { create: vi.fn() } }
  })
  process.env.ANTHROPIC_API_KEY = 'test-key'
  process.env.USE_BLOB = 'true'
  // ...
})
```

---

_Reviewed: 2026-05-13T10:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
