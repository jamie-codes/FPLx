# Phase 120: Test Suite Restoration - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all 25 pre-existing failing tests across 4 test files so the vitest suite is fully green. No new features, no refactoring beyond what is required to fix the failures. Every fix updates tests to match current implementation — not the other way around (implementation is not changed to satisfy old tests).

Files in scope: `tests/lib/captain-picks.test.ts` (5 failures), `src/components/nav/MobileNav.test.tsx` (10 failures), `src/lib/hooks/useRivals.test.ts` (8–9 failures), `tests/lib/club-form.test.ts` (1 failure).

</domain>

<decisions>
## Implementation Decisions

### captain-picks (TH-01 — 5 failures)

- **D-01:** Tests call `render(CaptainPicksPanel({}))` as a plain function call, not JSX. Fix by changing to `render(<CaptainPicksPanel />)`. This is the root cause of the "Cannot read properties of null (reading 'useState')" error.
- **D-02:** The component calls `usePlayers()` and `useCaptainPicks()`, both already mocked via `vi.mock(...)` at the top of the test file. No QueryClientProvider wrapper is needed for captain-picks — the mocks are sufficient once the JSX render call is used.

### MobileNav (TH-02 — 10 failures)

- **D-03:** All 10 tests fail with `"No QueryClient set"` because `MobileNav` renders `<LastUpdated />`, which calls `useLastUpdated()` (a TanStack Query hook). Tests have no provider.
- **D-04:** Fix by adding a `makeWrapper()` helper that wraps renders in `QueryClientProvider` — same pattern already used in `useRivals.test.ts`. Do NOT mock `LastUpdated` — use the real component tree with a proper provider.
- **D-05:** Phase 119 added a `lineup` sub-tab to the Squad section. The test at NAV-04 already expects 5 Squad pills (Decision/Transfers/Optimiser/Lineup/Review) and 8 total buttons. No nav structure changes needed — the test assertions are already up to date for Lineup.

### useRivals (TH-03 — 8–9 failures)

- **D-06:** Root cause: `FPLEventSchema` gained a required field `data_checked: z.boolean()` in Phase 98, but the test fixture `bootstrapPayload()` was never updated. `parseFPLBootstrap` returns `success: false`, the queryFn throws `'bootstrap shape invalid'`, and the hook's `retry: 1` setting delays re-execution by 1000ms — causing `waitFor(() => isSuccess)` to time out.
- **D-07:** Primary fix: add `data_checked: false` to the event object inside `bootstrapPayload()` in `useRivals.test.ts`.
- **D-08:** Secondary hardening: change `makeWrapper()` in `useRivals.test.ts` to use `retry: 0` (integer, not `false`) in the QueryClient `defaultOptions`. Note: TanStack Query v5 per-query `retry: 1` in the hook overrides QueryClient defaults — the `retry: 0` in makeWrapper expresses test intent but does not prevent hook-level retries. The payload fix (D-07) is the real solution.

### club-form (TH-04 — 1 failure)

- **D-09:** Root cause: `difficulty_score` in `club-form.ts` was changed from xGA-based to FPL official difficulty ratings (via `fplToAttDiff(fplDiff)` = `(fpl - 1) / 4`). All test fixtures hardcode FPL difficulty 3, giving every upcoming fixture `difficulty_score = 0.5`. The assertion `toBeLessThan(0.5)` fails on the boundary.
- **D-10:** Fix the test fixture, not the assertion. Update the upcoming fixture `event 32` (ARS home vs BUR) to `team_h_difficulty: 2`. This reflects realistic data (easy home game vs a weak team) and produces `difficulty_score = 0.25`, which is correctly `< 0.5`.

### Claude's Discretion

- Order of fixing the 4 files is at Claude's discretion — all are independent.
- Whether to write a single plan or split into waves is at Claude's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — v1.23 TH-01/02/03/04 requirements; defines the 4 test files and success criteria

### Failing test files (read to understand current assertions)
- `tests/lib/captain-picks.test.ts` — 5 failures; render-as-function root cause
- `src/components/nav/MobileNav.test.tsx` — 10 failures; missing QueryClientProvider
- `src/lib/hooks/useRivals.test.ts` — 8–9 failures; stale bootstrapPayload fixture (missing data_checked)
- `tests/lib/club-form.test.ts` — 1 failure; FPL difficulty boundary assertion

### Source files under test (read before modifying tests)
- `src/components/captaincy/CaptainPicksPanel.tsx` — component with useState hook; render call must be JSX
- `src/components/nav/MobileNav.tsx` — renders LastUpdated + ThemeToggle inline; requires QueryClientProvider in tests
- `src/lib/hooks/useRivals.ts` — has `retry: 1` query option; schema parse errors trigger silent retry timeout in tests
- `src/lib/club-form.ts` — `fplToAttDiff()` maps FPL difficulty (1–5) to difficulty_score (0–1); `tier()` thresholds at 0.4/0.6

### Schema files (root cause reference)
- `src/lib/fpl-adapter.ts` — `FPLEventSchema` requires `data_checked: z.boolean()` (added Phase 98); test bootstrapPayload must include this field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRivals.test.ts` `makeWrapper()` helper — exact same pattern to add to `MobileNav.test.tsx`; creates a fresh QueryClient with `retry: 0, gcTime: 0`
- `vi.mock('@/lib/hooks/useCaptainPicks', ...)` pattern in `captain-picks.test.ts` — hooks are already mocked; no provider needed once JSX render is used

### Established Patterns
- Component tests that render hooks: always wrap in `QueryClientProvider` via `makeWrapper()` (see useRivals.test.ts)
- Test fixture design: FPL difficulty ratings in test data should reflect realistic values (easy=1–2, medium=3, hard=4–5) to avoid boundary-condition assertion failures

### Integration Points
- `MobileNav` imports `SECTIONS` from `@/app/page` — `SubTab` type now includes `'lineup'` (Phase 119); test imports must use the updated type
- `FPLEventSchema` is a shared schema used by multiple hooks — any schema field additions require updating all test fixtures that mock bootstrap-static responses

</code_context>

<specifics>
## Specific Ideas

- `bootstrapPayload` fix is precise: add `data_checked: false` to the single event object — one-line change that unblocks all 8–9 useRivals failures
- captain-picks fix is precise: change `render(CaptainPicksPanel({}))` → `render(<CaptainPicksPanel />)` at each call site (5 occurrences in the failing tests)
- MobileNav: the test at NAV-04 already correctly expects 8 total buttons (3 section + 5 Squad pills); the button count check will pass once the QueryClientProvider error is resolved

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 120-test-suite-restoration*
*Context gathered: 2026-05-18*
