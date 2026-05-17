---
gsd_state_version: 1.0
milestone: v1.22
milestone_name: Lineup Intelligence
status: ready to execute
stopped_at: Phase 117 planned
last_updated: "2026-05-17T16:30:00.000Z"
last_activity: "2026-05-17 — Phase 117 planned (2 plans, 2 waves)"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-17 — v1.22 milestone active)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** Phase 117 — scraper-pipeline-lineup-news-artifact

## Current Position

Phase: 117 (ready to execute)
Plan: —
Status: Planned — 2 plans (Wave 1: Python pipeline; Wave 2: TypeScript layer)
Last activity: 2026-05-17 — Phase 117 planned (2 plans: 117-01 Python pipeline, 117-02 TypeScript layer)

```
v1.22 Lineup Intelligence
Phase 117 [          ] 0%
```

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 77 | 02 | ~10 min | 2 | 5 |
| 89 | 02 | ~15 min | 2 | 2 |

**v1.21 velocity:**

- 3 phases (114-116), all complete
- Shipped 2026-05-17
- Team News wiring, rank sparklines, prose staleness, model versioning

**v1.22 velocity:**

- 0 phases complete (3 total)
- Started 2026-05-17

## Accumulated Context

### Decisions

_(No v1.22 decisions yet — roadmap phase only)_

### Key Context for Execution

- Phase 117 is entirely Python pipeline + one API route + one TS hook — no UI components
- FPL bootstrap fields (status, chance_of_playing_next_round, news, news_added) are already in merged_players.json; the new lineup_news.py module re-reads them to produce a separate artifact keyed by player_id
- Sky Sports and BBC prefer RSS (feedparser) over HTML scraping — RSS avoids Cloudflare challenges and JS-rendering risk; HTML fallback adds beautifulsoup4 + lxml
- Twitter/X is permanently excluded from scope — GitHub Actions Azure IPs blocked since Jan 2025; FPL bootstrap + RSS cover the same information with acceptable delay
- Pipeline isolation pattern is CRITICAL: every scraper call must live in its own try/except block OUTSIDE the main pipeline try; follow set_piece_quality pattern at run.py lines 241-251 exactly
- Never write players:[] to Blob — if result is empty, skip the Blob write and preserve previous run's valid data
- INFRA-02 staleness gate: engines treat lineup_news.json with scraped_at older than 48 hours as neutral (availability_factor defaults to 1.0)
- Phase 118 is pure TypeScript function extensions — optional lineupNewsMap param on suggestTransfers() and optimiseLineup()/benchOrder(); TDD-safe with mock data
- Phase 119 is additive UI only — useLineupNews() hook threaded into CaptainPicksPanel, TransferPanel OCS rows, and DecisionSummaryTab
- Stack additions: beautifulsoup4 4.14.3 + lxml 6.1.0 (pip); no npm additions

### Blockers/Concerns

- None active at roadmap definition.

## Deferred Items

### Carried from v1.21

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| VERIFY-60 | Phase 60 VERIFICATION.md not created | 60 | backlog |
| TEST-57 | captain-picks.test.ts 5 pre-existing failures from Phase 57 | 57 | backlog |
| Phase 48 hover card | non-functional until pipeline re-run produces appearance_pts | 48 | backlog |

### Items resolved by v1.21

| ID | Description | Resolution |
|----|-------------|------------|
| BACK-02-UAT | Phase 113 human UAT gate | Addressed in Phase 114 UAT-01 |
| RANK-SPARK | rank_trajectory sparkline in GemTable | Addressed in Phase 114 SPARK-01 |
| TRT-01 | Hits column label mismatch | Addressed in Phase 114 TRT-01 |
| TRT-02 | ChipToggle stub in RouteTreeTab | Addressed in Phase 114 TRT-02 |

## Session Continuity

Last session: 2026-05-17T15:56:52.865Z
Stopped at: Phase 117 context gathered
Next command: `/gsd-execute-phase 117`
