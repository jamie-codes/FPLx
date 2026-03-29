# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-29
**Phases:** 6 | **Plans:** 19 (+ 1 gap-closure) | **Commits:** 104
**Timeline:** 3 days (2026-03-27 → 2026-03-29)

### What Was Built

- Next.js + Python pipeline: FPL API + Understat xG/xA merged into `merged_players.json`, served via Vercel Blob, fetched with TanStack Query
- Gem Rating table: 7-dimension composite score with min-max normalisation, sortable/filterable TanStack Table
- DefCon Analysis: per-match contribution hit rates from element-summary history, position-split tables
- Squad View + Transfer Engine: Team ID input, position-locked transfer suggestions ranked by Gem delta with chip guard and save recommendation
- Club Form + Value Gems tabs with filter pills, price trend columns, FixtureBadges, and LastUpdated banner

### What Worked

- **TDD-first execution**: Pure functions (gem scoring, transfer engine, club form, value gems predicates) were written test-first — this caught the `tier()` inversion bug before it reached production and made UAT gaps straightforward to fix
- **Gap closure plan system**: When UAT found 4 issues (tier inversion + NaN price trends), the `--gaps-only` re-execution isolated fixes cleanly without disturbing completed work
- **Wave-based parallelisation**: Parallel agent execution per wave kept execution time low — 19 plans completed across 3 days
- **`USE_BLOB` env routing**: Dev/prod data source switching without credentials made local development fast

### What Was Inefficient

- **ROADMAP.md progress table drift**: The live ROADMAP.md showed Phase 3 as "In Progress" and Phase 6 at "0/3" even after completion — state tracking lagged execution. The archive needed manual correction.
- **STATE.md merge conflict on worktree merge**: Parallel worktree execution caused a conflict that required manual resolution — the stash/merge/pop pattern could be smoother
- **DAT-01 not verified**: The GitHub Actions cron was scaffolded in Phase 1 but never confirmed operational — would have been better to smoke-test it during Phase 1 rather than carry it as a known gap into v1.1

### Patterns Established

- **`merged_players.json` as single source of truth**: All downstream phases imported from this schema; never re-derived from raw FPL data in UI code
- **Adapter layer pattern**: `parseFPLBootstrap` wraps safeParse; callers decide throw vs stale-cache — this isolated FPL API fragility from business logic across all phases
- **Pure function extraction before UI**: Data computations (gem score, club form, transfer engine) were written as tested pure functions before building UI components — made verification straightforward
- **`?? 0` as pipeline field guard**: Any field from `merged_players.json` that could be absent (price trends, xG/xA) should be guarded at render time, not assumed present

### Key Lessons

1. **Verify pipeline cron early**: GitHub Actions scheduling should be smoke-tested in Phase 1, not assumed to work. A 5-minute manual trigger check would have closed DAT-01.
2. **State tracking is a first-class concern**: ROADMAP.md progress table updates should happen atomically with plan completion — stale progress values cause confusion in retrospect reviews
3. **Gap closure is cheaper than getting it right the first time if you have UAT**: The 2-bug gap closure (06-04) was handled cleanly by the GSD gap plan system. Good UAT coverage > perfect first-pass implementation.
4. **TDD pays off in analytics code**: The `tier()` inversion was caught instantly by tests because the scoring logic was extracted as a pure function. Without tests, this would have been a silent bug.

### Cost Observations

- Model: Sonnet 4.6 throughout (executor + verifier)
- Sessions: ~4-5 across 3 days
- Notable: Parallel wave execution made the token spend efficient — most cost was in verification agents, which caught real bugs

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 104 | 6 | First milestone — GSD workflow established |

### Cumulative Quality

| Milestone | Test Files | LOC (TS+Py) | Gap Closures |
|-----------|------------|-------------|--------------|
| v1.0 | ~15 | ~6,600 | 1 (06-04) |

### Top Lessons (Verified Across Milestones)

1. TDD-first for pure functions pays back in cheaper UAT and gap closure
2. DAT/infra requirements need operational smoke tests, not just scaffolding

---
