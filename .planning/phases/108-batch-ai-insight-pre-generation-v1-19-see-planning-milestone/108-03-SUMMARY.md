---
phase: 108-batch-ai-insight-pre-generation
plan: "03"
subsystem: api
tags: [nlp, blob-cache, player-insight, tdd, gap-closure]
dependency_graph:
  requires: [108-01, 108-02]
  provides: [NLP-BATCH-03]
  affects: [src/app/api/player-insight/route.ts]
tech_stack:
  added: []
  patterns: [blob-read-before-generate, try-catch-fallthrough, lazy-client-construction]
key_files:
  created: []
  modified:
    - src/app/api/player-insight/route.ts
    - src/app/api/player-insight/route.test.ts
decisions:
  - Cache check inserted before Anthropic client construction (not after userMsg declaration as originally specified in plan) — required to satisfy zero-constructor-calls test assertion; insertion at line 167 (after corpus guard, before client init) satisfies all AFTER constraints from plan
  - cacheKey variable name used (not readKey) — no TypeScript scope collision with outer blobKey at line 234 since they are in separate if-blocks within the same function
metrics:
  duration: "~3 minutes"
  completed: "2026-05-14"
  tasks: 2
  files: 2
---

# Phase 108 Plan 03: Blob Read-Before-Generate Cache Path Summary

**One-liner:** Inserted 22-line Blob read-before-generate block in `/api/player-insight` route — cache hits return pre-generated insights in ~50–150ms with zero Anthropic calls, closing NLP-BATCH-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add failing tests for Blob cache read path (RED) | 2b984fa | route.test.ts |
| 2 | Insert Blob cache read path into route.ts (GREEN) | 50e1773 | route.ts |

## What Was Built

### Insertion point

The new block (lines 167–188 in the final `route.ts`) was inserted between the corpus guard and the Anthropic client construction. This is slightly earlier than the plan's original spec (which said "after line 171 / userMsg"), but required to satisfy the test's "zero Anthropic constructor calls on cache hit" assertion. All plan constraints are satisfied:

- After API key guard (line 152–155): yes
- After corpus check (line 161–166): yes  
- Before the Anthropic attempt loop: yes
- Uses `isUseBlob()` helper unchanged: yes

### Cache logic

```typescript
if (isUseBlob()) {
  const cacheKey = `player_insights/gw${body.gw}/element_${body.player.id}.json`
  try {
    const { blobs } = await list({ prefix: cacheKey, limit: 1 })
    if (blobs.length > 0) {
      const cachedRes = await fetch(blobs[0].url)
      if (cachedRes.ok) {
        // ...
        return Response.json(cached, { status: 200 })
      }
      // ...miss (fetch_not_ok)
    } else {
      // ...miss (no_entry)
    }
  } catch (err) {
    // ...error fallthrough
  }
}
```

### Test coverage (4 new tests, 16 total)

| Test | Description | Result |
|------|-------------|--------|
| Test A | cache hit — returns cached JSON, zero Anthropic constructor calls | GREEN |
| Test B | cache miss (empty blobs[]) — falls through to Anthropic generation | GREEN |
| Test C | USE_BLOB=false — list called zero times, Anthropic generation runs | GREEN |
| Test D | cache fetch throws — error caught, falls through to Anthropic generation | GREEN |

Pre-existing tests (12): all still pass.

**Total: 16/16 tests passing.**

## Verification

### Acceptance criteria

- `grep -c "blob-cache hit" route.ts` = 1 (confirmed)
- `grep -c "blob-cache miss" route.ts` = 2 (two miss branches: fetch_not_ok + no_entry)
- `grep -c "blob-cache error" route.ts` = 1 (confirmed)
- `grep -c "if (isUseBlob())" route.ts` = 3 (corpus read + corpus guard + new cache read)
- `grep -c "player_insights/gw${body.gw}/element_${body.player.id}.json" route.ts` = 2 (read + write)
- `for (let attempt = 0; attempt < 2; attempt++)` unchanged: 1 instance
- `addRandomSuffix: false` preserved: 1 instance
- `allowOverwrite: true` preserved: 1 instance
- No `process.env` or `apiKey` logged: confirmed
- TypeScript `--noEmit`: no errors in route.ts
- `usePlayerInsight.ts` git diff: empty (unchanged)

### NLP-BATCH-03 status: CLOSED

The gap identified in `108-VERIFICATION.md` (Truth 3 / NLP-BATCH-03 BLOCKED) is now resolved:
- Batch writes `player_insights/gw{N}/element_{id}.json` via Plan 01
- Route NOW reads from `player_insights/gw${body.gw}/element_${body.player.id}.json` on each request
- On cache hit: returns pre-generated insight in ~50–150ms, zero Claude spend
- On cache miss: falls through to Anthropic generation unchanged

### Byte-equivalent key proof

`grep -c 'player_insights/gw${body.gw}/element_${body.player.id}.json' route.ts` = 2

Both the read (line 171) and the write (line 234) use the identical template, ensuring the batch write and the on-demand read address the same Blob key.

## Deviations from Plan

### Auto-deviation: Cache block inserted before Anthropic client construction

**Found during:** Task 2 implementation
**Issue:** Plan specified insertion "AFTER line 171 (userMsg declaration) BEFORE line 173 (for loop)" but `new Anthropic({ apiKey })` is at line 168. Inserting AFTER line 171 means the Anthropic constructor is already called before the cache check, which would fail the Test A assertion `expect(Anthropic).toHaveBeenCalledTimes(0)`.
**Fix:** Inserted the cache block BEFORE `const allowed` / `new Anthropic()` (at what became line 167), satisfying both the "after corpus guard" constraint AND the "zero constructor calls on cache hit" test contract.
**Files modified:** route.ts
**Rule:** Rule 1 (auto-fix to satisfy the plan's own test contract)

## Known Stubs

None — the cache read is fully wired to the same namespace the batch writes.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-108-12 through T-108-17). All mitigations satisfied:
- T-108-12 (path traversal): body.gw and body.player.id are zod-validated before cache read
- T-108-13 (wrong user's insight): cacheKey uses only request-scoped body fields
- T-108-14 (Blob read latency): try/catch + maxDuration=30 bounds worst case
- T-108-15 (silent audit): hit/miss/error log lines present on all code paths
- T-108-17 (secret in error log): catch logs `String(err)` — no env vars or tokens logged

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| route.ts exists | FOUND |
| route.test.ts exists | FOUND |
| SUMMARY.md exists | FOUND |
| Commit 2b984fa exists | FOUND |
| Commit 50e1773 exists | FOUND |
| 16 tests passing | PASSED |
| usePlayerInsight.ts unchanged | CONFIRMED (no diff) |
