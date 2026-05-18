# Requirements: FPL Analyst v1.23

**Defined:** 2026-05-18
**Core Value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## v1.23 Requirements

### Test Health (TH)

- [ ] **TH-01**: All 5 pre-existing captain-picks test failures pass (`tests/lib/captain-picks.test.ts` — CAP-03/CAP-04 CaptainPicksPanel rendering tests)
- [ ] **TH-02**: All 10 MobileNav test failures pass (`src/components/nav/MobileNav.test.tsx` — NAV-01 through NAV-05, drifted after Phase 119 added Lineup tab)
- [ ] **TH-03**: All 8 useRivals test failures pass (`src/lib/hooks/useRivals.test.ts` — ML-01/02/08, D-05)
- [ ] **TH-04**: club-form difficulty-tier test passes (`tests/lib/club-form.test.ts` — 1 failure, difficulty tier classification assertion)

### Documentation (DOC)

- [ ] **DOC-01**: Phase 60 VERIFICATION.md written and committed (clears VERIFY-60 deferred item from v1.22)

### Verification (VER)

- [x] **VER-01**: Phase 48 XPtsCell `appearance_pts` hover card confirmed live with production pipeline data (pipeline/cache already has values — needs live visual confirmation and sign-off)

## Future Requirements

_(Deferred — not in scope for v1.23)_

- Full feature backlog items (v1.8+) remain in `.planning/notes/feature-backlog.md`

## Out of Scope

- New features or capabilities of any kind
- Refactoring beyond what is needed to fix failing tests
- Pipeline changes beyond what is needed to fix failing tests

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| TH-01  | Phase 120 | Pending |
| TH-02  | Phase 120 | Pending |
| TH-03  | Phase 120 | Pending |
| TH-04  | Phase 120 | Pending |
| DOC-01 | Phase 121 | Pending |
| VER-01 | Phase 121 | Complete |
