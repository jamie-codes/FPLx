---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Decision Engine
status: planning
stopped_at: Roadmap created — ready for phase planning
last_updated: "2026-03-29T00:00:00.000Z"
last_activity: 2026-03-29
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.1 Decision Engine — pipeline-first build of projected points, minutes risk, buy/hold/sell, captaincy, explainability, and FPL auth.

## Current Position

Phase: Phase 7 (not started)
Plan: —
Status: Roadmap created — ready for phase planning
Last activity: 2026-03-29 — v1.1 roadmap written (Phases 7–12)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: FPL login (session-cookie auth) is v1.x — NOT v1. Transfer suggestions use `now_cost` labelled as approximate when unauthenticated.
- [Setup]: Custom FDR must be built in Phase 2 from rolling xGA — never use official `team_h_difficulty` as primary signal.
- [Setup]: Sell price uses `selling_price` from `my-team` when authenticated; unauthenticated mode labels budget as approximate.
- [Setup]: DGW/BGW normalisation (per-90 stats) must be designed into Phase 2 pipeline — not retrofitted later.
- [Setup]: `player_id_map.json` is a manual one-time mapping file — no string-matching between FPL and Understat names.
- [Phase 01-data-foundation]: Zod 4 strips unknown fields by default — no explicit .strip() needed; satisfies D-04
- [Phase 01-data-foundation]: parseFPLBootstrap wraps safeParse — callers decide throw-vs-stale-cache per D-06
- [Phase 01-data-foundation]: Proxy URL appends trailing slash before query string to match FPL API convention
- [Phase 02-understat-pipeline-merged-data-api]: D-08: USE_BLOB env var routes /api/players between Vercel Blob (prod) and pipeline/cache/ (dev); no Zod validation on output; raw string response to avoid JSON round-trip
- [Phase 02-understat-pipeline-merged-data-api]: D-09: usePlayers uses queryKey ['players'] and staleTime 6h — single cache key for all consumers
- [Phase 03-gem-rating-table]: DefCon likelihood dimension deferred to Phase 4 — per-match element-summary data not yet available
- [Phase 03-gem-rating-table]: xG/xA excluded from gem composite when null (not zero-filled) per Research Pitfall 12
- [Phase 03-gem-rating-table]: Min-max normalisation uses full player population before position filtering
- [Phase 03-gem-rating-table]: page.tsx stays server component; GemTable carries all interactivity as 'use client'
- [Phase 03-gem-rating-table]: Position filter passes numeric PositionCode (1/2/3/4) to column filter, never string labels
- [Phase 03-gem-rating-table]: Null xG/xA scores display em-dash (\u2014) not zero per Research Pitfall 6
- [Phase 04-defcon-analysis]: page.tsx converted to client component for tab state — server wrapper added no SSR benefit since both GemTable and DefConTables are client components
- [Phase 04-defcon-analysis]: DefCon API route is local-only (no USE_BLOB switch) — defcon_stats.json always served from pipeline/cache/
- [Phase 05-squad-view-transfer-suggestions]: Sort suggestions: affordable (budget_sufficient=true) before unaffordable, then gem_delta desc within each tier
- [Phase 05-squad-view-transfer-suggestions]: squad-adapter.ts Zod schema created in Plan 02 (parallel wave unblocking) — matches Plan 01 canonical types
- [Phase 05-squad-view-transfer-suggestions]: SquadView receives allPlayers as ScoredPlayer[] — no re-scoring inside the component
- [Phase 05-squad-view-transfer-suggestions]: TransferPanel manages submittedId separately from teamId input — squad does not reload on every keystroke
- [Phase 06-club-form-value-gems-and-polish]: tier() bug was a return-value swap — weak teams already correctly identified by thresholds, only the label mapping was wrong
- [v1.1 Roadmap]: Phase 7 must complete before any other v1.1 phase — proj_pts_next_gw gates 80% of v1.1 features
- [v1.1 Roadmap]: element-summary fetches shared between defcon.py and xmins.py via run.py cache — never fetched twice
- [v1.1 Roadmap]: recommend.ts must derive from same gem_score source as transfer-engine.ts — no contradictory signals
- [v1.1 Roadmap]: projected_pts fields must be absolute FPL points (2–15 range) — normalise() from gem-score.ts must NOT be applied
- [v1.1 Roadmap]: FPL auth is UI-initiated only — never added to pipeline/run.py or any cron-scheduled code
- [v1.1 Roadmap]: rotation risk classification gated on status == 'a' with blank news — injury-period minutes excluded from classification window

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-29
Stopped at: v1.1 roadmap created — Phases 7–12 written to ROADMAP.md
Resume file: None
