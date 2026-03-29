# Milestones

## v1.0 MVP (Shipped: 2026-03-29)

**Phases completed:** 6 phases, 19 plans (+ 1 gap-closure)
**Timeline:** 2026-03-27 → 2026-03-29 (3 days)
**Codebase:** ~6,600 LOC (TypeScript + Python), 166 files changed

**Key accomplishments:**

1. Next.js scaffold with FPL proxy Route Handler, Zod validation adapter, Vercel Blob caching, and 825-entry FPL-to-Understat player ID map
2. Python pipeline combining FPL API + Understat xG/xA with custom FDR (rolling xGA), per-90 normalisation, and GitHub Actions daily cron
3. Composite Gem Rating engine (7 dimensions) with min-max normalisation — sortable/filterable TanStack table at `/`
4. DefCon Analysis: per-match hit rates from element-summary history, position-split tables (DEF=10, MID/FWD=12 thresholds)
5. Squad View with Team ID input and Transfer Engine (position lock, budget enforcement, chip guard, save-transfer recommendation)
6. Club Form tab, Value Gems tab with filter pills, price trend columns, FixtureBadges, and LastUpdated banner

**Known Gaps:**
- DAT-01: Automated daily pipeline refresh — `pipeline/run.py` exists and GitHub Actions workflow is scaffolded but daily scheduling was not verified as operational for v1. Candidate for v1.1.

---
