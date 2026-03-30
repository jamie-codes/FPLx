---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Decision Engine
status: executing
stopped_at: Completed 11-02-PLAN.md
last_updated: "2026-03-30T17:21:16.947Z"
last_activity: 2026-03-30
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 13
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** Phase 11 — explainability-replacement-shortlist

## Current Position

Phase: 11 (explainability-replacement-shortlist) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-03-30

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
| Phase 07-pipeline-schema-extension P01 | 2 | 2 tasks | 2 files |
| Phase 07-pipeline-schema-extension P02 | 4 | 2 tasks | 2 files |
| Phase 07-pipeline-schema-extension P03 | 2 | 2 tasks | 4 files |
| Phase 08 P01 | 5 | 2 tasks | 4 files |
| Phase 08 P02 | 158 | 2 tasks | 3 files |
| Phase 09 P01 | 147 | 2 tasks | 5 files |
| Phase 10-buy-hold-sell-captaincy-engines P01 | 90 | 3 tasks | 2 files |
| Phase 10-buy-hold-sell-captaincy-engines P03 | 8 | 2 tasks | 4 files |
| Phase 11-explainability-replacement-shortlist P02 | 2 | 2 tasks | 2 files |

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
- [Phase 07-01]: defcon.py accepts summaries dict — pure computation module with no I/O, all fetching in run.py
- [Phase 07-01]: xmins.py processes ALL players including GKs; mins_risk gated on status='a' + blank news (locked decision)
- [Phase 07-02]: xmins_stats parameter defaults to None so existing callers don't break; all 6 projected fields always non-null on every player
- [Phase 07-02]: import time as _time alias in run.py avoids collision; get_element_summary added to top-level fpl_client import
- [Phase 07-03]: All 6 new MergedPlayer fields are non-nullable (number/MinsRisk) — Python pipeline writes 0.0 for missing data, never null (per Research Pitfall 7)
- [Phase 08]: getMinsRiskConfig returns null for both 'injured' and falsy/undefined values
- [Phase 08]: isRotationRisk covers rotation_risk and cameo (both deprioritised as buy candidates in transfer sort)
- [Phase 08]: Rotation risk penalty is buy-side only — rotation_risk sell candidates still surfaced normally
- [Phase 08]: MinsRiskBadge placed on sell-side player only in TransferPanel (confirms why player is a sell candidate)
- [Phase 09]: columnVisibility is fully derived from gwHorizon state — no onColumnVisibilityChange handler needed
- [Phase 09]: PositionFilter mb-4 removed in favour of wrapper div mb-2 to prevent double vertical margin
- [Phase 10-buy-hold-sell-captaincy-engines]: Position averages for Buy/Hold/Sell verdicts computed from full allPlayers population (not squad-only) — prevents false signals
- [Phase 10-buy-hold-sell-captaincy-engines]: BUY_THRESHOLD=1.0 (strictly above avg), SELL_THRESHOLD=0.90 (>10% below avg) in recommend.ts
- [Phase 10-buy-hold-sell-captaincy-engines]: computePositionAverages exported from recommend.ts for reuse by captaincy-engine.ts (Plan 02)
- [Phase 10-buy-hold-sell-captaincy-engines]: CaptainTypeBadge is inline in CaptaincyPanel.tsx — co-location reduces indirection for a component used only there
- [Phase 11-explainability-replacement-shortlist]: Ranked by pts_delta (proj_pts_1gw delta) descending per D-05 — NOT gem_delta
- [Phase 11-explainability-replacement-shortlist]: Budget arithmetic mirrors transfer-engine.ts: available_budget = bankBalance/10 + sellPlayer.now_cost/10

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-30T17:21:06.288Z
Stopped at: Completed 11-02-PLAN.md
Resume file: None
