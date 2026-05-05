---
phase: "067-llm-prose-summaries"
plan: "03"
subsystem: "llm-prose-refresh"
tags: [llm, anthropic, claude, mutation, refresh, prose-summary, fpl, tanstack-query, zod, vercel-edge]
dependency_graph:
  requires:
    - "Plan 01: passesGuardrail + findHallucinatedNames (src/lib/prose-guardrail.ts)"
    - "Plan 01: ProseSummary + ProseRefreshPayload types (src/lib/types.ts)"
    - "Plan 01: Wave 0 RED test contracts — POST 400, POST 422, POST 200 in route.test.ts"
    - "Plan 01: @anthropic-ai/sdk npm dependency"
    - "Plan 02: GET /api/prose-summary route (route.ts); useProseRefresh stub; ProseSummaryBlock with payload prop"
    - "Plan 02: DecisionSummaryTab with ProseSummaryBlock mounted at payload={null}"
  provides:
    - "src/app/api/prose-summary/route.ts: POST handler — zod validation, Anthropic SDK call, retry-once guardrail, 200/400/422/500/502/503 responses"
    - "src/app/api/prose-summary/route.ts: maxDuration=30 export (Pitfall 1 fix)"
    - "src/lib/hooks/useProseRefresh.ts: real useMutation wrapping POST /api/prose-summary; GUARDRAIL_FAILED sentinel on 422"
    - "src/components/squad/DecisionSummaryTab.tsx: proseRefreshPayload useMemo; ProseSummaryBlock payload wired"
    - "Phase 67 full close: NLP-01 + NLP-02 fully satisfied"
  affects:
    - "Phase 68+: in-app alerts can share the ProseSummaryBlock UI patterns (refresh button, loading state, silent-hide)"
tech_stack:
  added: []
  patterns:
    - "POST route with zod body validation + Anthropic SDK call + retry-once guardrail (mirrors Python twin in Plan 02)"
    - "maxDuration=30 export on route with slow external SDK call (Vercel Hobby timeout mitigation)"
    - "Server-side corpus load via USE_BLOB switch (merged_players.json) — body carries no corpus"
    - "useMutation with GUARDRAIL_FAILED sentinel for silent-hide D-13 path"
    - "proseRefreshPayload assembled inline from existing component state (no fresh hooks — D-05)"
    - "Chip derivation inlined in useMemo to avoid hoisting closures"

key_files:
  created: []
  modified:
    - "src/app/api/prose-summary/route.ts (45 → 221 lines — POST handler appended)"
    - "src/lib/hooks/useProseRefresh.ts (stub replaced — 26 lines total)"
    - "src/components/squad/DecisionSummaryTab.tsx (621 → 680 lines — 59 lines added)"
    - "src/app/api/prose-summary/route.test.ts (test fix for constructor mocks)"

key-decisions:
  - "Inline chip derivation inside proseRefreshPayload useMemo (option b from plan) to avoid hoisting bestGwForChip closure out of render body"
  - "Server reads merged_players.json corpus independently of POST body — keeps request size small (resolves Open Q4 from Plan 01)"
  - "502 detail field uses sanitised literal 'upstream call failed' — raw err.message never exposed (T-067-13)"
  - "No invalidateQueries in useProseRefresh — avoids re-fetching global summary and defeating D-03 component-state override"

patterns-established:
  - "POST route with guard exports: maxDuration before handlers, zod at body entry, env check before SDK init"
  - "Mutation hook with sentinel error: throw Error('GUARDRAIL_FAILED') on 422 for type-safe silent-hide"
  - "useMemo payload assembly from existing component state: no new hooks, null guard on !submittedId"

requirements-completed: [NLP-02]

duration: "~12 minutes"
completed: "2026-05-05"
---

# Phase 67 Plan 03: Squad-Aware Refresh Path Summary

**POST /api/prose-summary with zod + Anthropic Haiku retry-once guardrail wires the ↻ button end-to-end; DecisionSummaryTab builds ProseRefreshPayload from existing component state; page-reload-reverts-to-global falls out automatically from component-local override state.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-05-05
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments

- POST handler in route.ts: zod body validation with strict array max-lengths (DoS mitigation), Anthropic Haiku call, retry-once guardrail, 200/400/422/500/502/503 response shapes, maxDuration=30 to avoid Vercel Hobby 10s timeout
- Real useProseRefresh hook replaces Plan 02 stub: useMutation calling POST /api/prose-summary, GUARDRAIL_FAILED sentinel on 422 for silent D-13 hide
- DecisionSummaryTab builds ProseRefreshPayload useMemo from captaincyCandidates, ocsRows, bbScores/tcScores/fhResult, riskRows — no new hooks, null when !submittedId
- Human-verify checkpoint: all 6 UX steps approved — button disabled without squad, enabled + spinner on click, prose replaces in-place, page reload reverts to global summary
- Phase 67 closeout: NLP-01 (pipeline read path) + NLP-02 (squad-aware refresh) fully satisfied

## Task Commits

1. **Task 1: POST handler + real useProseRefresh** — `a02c52c` (feat)
2. **Task 2: ProseRefreshPayload in DecisionSummaryTab** — `b88d16a` (feat)
3. **Task 3: Human-verify checkpoint** — approved (no commit; plan metadata commit below)

## Files Created/Modified

- `src/app/api/prose-summary/route.ts` — 221 lines (45 pre-plan); POST handler appended after existing GET
- `src/lib/hooks/useProseRefresh.ts` — 26 lines; stub replaced with real useMutation
- `src/components/squad/DecisionSummaryTab.tsx` — 680 lines (621 pre-plan); proseRefreshPayload useMemo + ProseSummaryBlock payload wired
- `src/app/api/prose-summary/route.test.ts` — constructor mock fix (Rule 1 deviation, Task 1)

## Test Status

All 10 tests pass after Plan 03:

| Suite | Tests | Status |
|-------|-------|--------|
| src/app/api/prose-summary/route.test.ts | 5 (2 GET + 3 POST) | GREEN |
| src/components/squad/ProseSummaryBlock.test.tsx | 5 | GREEN |

Plan-level verification criteria:
- POST 400 (malformed body) — GREEN
- POST 422 (guardrail failure) — GREEN
- POST 200 (success) — GREEN
- GET 200 (cache hit) — GREEN
- GET 404 (no file) — GREEN
- All 5 ProseSummaryBlock component tests — GREEN
- `npx tsc --noEmit` — exits 0

## Human-Verify Checkpoint Outcome

**Approved — all 6 steps passed.**

| Step | Expected | Outcome |
|------|----------|---------|
| 1. Dev server + page load | Page renders | Passed |
| 2. No squad — ↻ button disabled | Greyed out (opacity ~40%) | Passed |
| 3. Load squad | Cards repopulate | Passed |
| 4. ↻ button enabled with squad | No opacity | Passed |
| 5. Click ↻ — spinner then updated prose | ⏳ while in-flight; new squad-aware paragraph | Passed |
| 6. Page reload reverts to global prose | D-04 revert confirmed | Passed |

## Decisions Made

- Inlined chip derivation inside the proseRefreshPayload useMemo (plan option b) to avoid hoisting the `bestGwForChip` closure out of the render body — less structural disturbance to DecisionSummaryTab
- Server-side corpus load independent of POST body: body never carries merged_players.json (~14 KB uncompressed) — resolves Open Q4 from Plan 01 context
- 502 response uses sanitised `'upstream call failed'` literal — raw `err.message` never returned in API response (T-067-13)
- No `invalidateQueries` in useProseRefresh — would re-fetch global summary and overwrite the D-03 component-state override, defeating the intent of the Refresh action

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] route.test.ts constructor mocks used arrow functions instead of regular functions**
- **Found during:** Task 1 (running route.test.ts after POST implementation)
- **Issue:** The test file used arrow functions `() => ({})` as class mocks for `Anthropic`. Arrow functions cannot be called with `new`, so Vitest threw "is not a constructor" at test execution time.
- **Fix:** Converted mock constructor definitions from arrow functions to regular `function()` declarations, which are compatible with `new` invocation.
- **Files modified:** src/app/api/prose-summary/route.test.ts
- **Verification:** All 5 route tests GREEN after fix.
- **Committed in:** a02c52c (Task 1 commit)

**2. [Rule 3 - Blocking] @anthropic-ai/sdk present in package.json but not installed in node_modules**
- **Found during:** Task 1 (TypeScript compile check — import resolution failure)
- **Issue:** `@anthropic-ai/sdk` was listed in package.json from Plan 01 but had not been installed into node_modules on this machine, causing `tsc --noEmit` and test runner import resolution to fail.
- **Fix:** Ran `npm install` to install the missing dependency.
- **Files modified:** package-lock.json (updated)
- **Verification:** Import resolved; tsc and tests pass.
- **Committed in:** a02c52c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug fix, 1 Rule 3 blocking dependency)
**Impact on plan:** Both fixes were necessary for tests and compilation to succeed. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Phase 67 Closeout

| Requirement | Status |
|-------------|--------|
| NLP-01: Pipeline writes weekly_summary.json via Claude with guardrail (Plan 02) | Satisfied |
| NLP-02: ↻ button regenerates prose squad-aware mid-week; page reload reverts (Plan 03) | Satisfied |
| D-03: override replaces global in displayed prose for the session | Confirmed via human-verify step 5 |
| D-04: page reload reverts to global pipeline summary | Confirmed via human-verify step 6 |
| D-06: button disabled with spinner during in-flight request | Confirmed via human-verify steps 2 + 5 |
| D-13: 422 hides prose block silently, no error message | Covered by route.test.ts POST 422 test + GUARDRAIL_FAILED sentinel |

## Recommendations for Phase 68+

- **In-app alerts:** If Phase 68 introduces in-app notification banners or alert blocks, the ProseSummaryBlock pattern (refresh button, isPending spinner, silent-hide on 422, component-state override, null payload = disabled) is directly reusable as a UI primitive. The `useProseRefresh` mutation hook pattern (GUARDRAIL_FAILED sentinel, onSuccess/onError callbacks) works cleanly for any mutation returning structured content.
- **Rate limiting:** T-067-15 (accepted) deferred hard rate limiting on POST /api/prose-summary. If quota becomes an issue at v1.12+, the route is the single integration point — adding an in-memory or Upstash rate limiter requires no component-layer changes.
- **Wildcard chip:** Plan 03 chip logic covers `bboost | 3xc | freehit`; wildcard was listed in the POST body schema but not in the inline chip derivation (wildcard is a transfer-phase chip, not a GW recommendation). If a future plan surfaces wildcard chip recommendations in DecisionSummaryTab, the useMemo derivation will need an additional branch.

## Known Stubs

None — all stubs from Plan 02 are resolved.

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat model:
- T-067-11 (prompt injection via player names): mitigated — zod max-length 64, names inside XML tags in user message, system prompt server-controlled
- T-067-12 (oversized POST body): mitigated — zod captains.max(5), risks.max(11), name fields max 64
- T-067-13 (API key exposure): mitigated — 502 detail uses sanitised literal, not raw err.message
- T-067-14 (slow Claude → 504): mitigated — maxDuration=30
- T-067-15 (forged squad state): accepted — FPL data public, personal-app scale, hard rate limiting deferred

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/app/api/prose-summary/route.ts (221 lines) | FOUND |
| src/lib/hooks/useProseRefresh.ts (26 lines) | FOUND |
| src/components/squad/DecisionSummaryTab.tsx (680 lines) | FOUND |
| commit a02c52c (Task 1) | FOUND |
| commit b88d16a (Task 2) | FOUND |
| export const maxDuration in route.ts | FOUND |
| useMutation in useProseRefresh.ts | FOUND |
| GUARDRAIL_FAILED in useProseRefresh.ts | FOUND |
| proseRefreshPayload in DecisionSummaryTab.tsx | FOUND |

---
*Phase: 067-llm-prose-summaries*
*Completed: 2026-05-05*
