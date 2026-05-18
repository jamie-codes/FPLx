# Phase 120: Test Suite Restoration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 120-test-suite-restoration
**Areas discussed:** MobileNav test isolation, useRivals timeout investigation, club-form boundary (0.5 exactly)

---

## MobileNav test isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Add QueryClientProvider wrapper | Wrap each render call in a makeWrapper() helper (same pattern useRivals.test.ts already uses). Tests render the real component tree. | ✓ |
| Mock LastUpdated in the test file | vi.mock('@/components/LastUpdated', () => ({ LastUpdated: () => null })). Keeps tests as pure nav-logic unit tests decoupled from data-fetching layer. | |

**User's choice:** Add QueryClientProvider wrapper
**Notes:** The root cause is `LastUpdated` rendering inside `MobileNav` and calling `useLastUpdated()` (TanStack Query) without a provider. Wrapping with QueryClientProvider mirrors the pattern in `useRivals.test.ts`.

---

## useRivals timeout investigation

**Pre-discussion finding:** Root cause identified via code inspection — `FPLEventSchema` gained `data_checked: z.boolean()` in Phase 98, but `bootstrapPayload()` in the test was never updated. Schema validation fails → queryFn throws → `retry: 1` delays execution → `waitFor(isSuccess)` times out.

| Option | Description | Selected |
|--------|-------------|----------|
| Fix payload + override retry in makeWrapper | Add data_checked to bootstrapPayload AND set retry: 0 in the QueryClient in makeWrapper() so intent is clear. | ✓ |
| Fix payload only | Add data_checked: false to bootstrapPayload. Leave retry: 1 in the hook. Future breakage would again be a silent timeout. | |

**User's choice:** Fix payload + override retry in makeWrapper
**Notes:** Acknowledged that per-query `retry: 1` in the hook overrides QueryClient `defaultOptions` in TanStack Query v5, so the `retry: 0` in makeWrapper expresses intent but does not technically prevent the hook's retry. The payload fix is the substantive solution.

---

## club-form boundary (0.5 exactly)

**Pre-discussion finding:** `difficulty_score` was switched from xGA-based to FPL official difficulty ratings in a prior phase. All test fixtures hardcode FPL difficulty 3, giving `(3-1)/4 = 0.5` for every fixture. Assertion `toBeLessThan(0.5)` fails on the boundary.

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the test fixture | Update upcoming fixture event 32 (ARS home vs BUR) to team_h_difficulty: 2. Realistic data; assertion passes as written. | ✓ |
| Relax the assertion | Change toBeLessThan(0.5) to toBeLessThanOrEqual(0.5). Quick fix but test becomes weaker — no longer distinguishes easy from medium. | |

**User's choice:** Fix the test fixture
**Notes:** FPL difficulty 2 for a home game vs Burnley (a weak team) is realistic. Produces `difficulty_score = 0.25`, well below the 0.5 boundary.

---

## Claude's Discretion

- Order of fixing the 4 files
- Whether to use a single plan or split into waves

## Deferred Ideas

None — discussion stayed within phase scope.
