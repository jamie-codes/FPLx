---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: Forecast Transparency & AI Intelligence
status: ready to execute
stopped_at: Phase 102 planned
last_updated: "2026-05-13T09:34:50.132Z"
last_activity: 2026-05-13 — Phase 102 planned (3 plans, Wave 1 parallel, MC-01/MC-02 covered)
progress:
  total_phases: 53
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12 — v1.17 complete, v1.18 started)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.18 Forecast Transparency & AI Intelligence — Phases 102-105 roadmapped 2026-05-13

## Current Position

Phase: 102 — MC Gate Activation & MCDistributionBar Display
Plan: —
Status: Ready to execute (3 plans, Wave 1 parallel)
Last activity: 2026-05-13 — Phase 102 planned (102-01 pipeline gate+hygiene, 102-02 MCDistributionBar+columns, 102-03 CaptainPicksPanel P10/P90)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 77 | 02 | ~10 min | 2 | 5 |
| 89 | 02 | ~15 min | 2 | 2 |

**Previous milestone (v1.17) velocity:**

- 5 phases (97–101), all complete
- Shipped 2026-05-12

**Previous milestone (v1.16) velocity:**

- 9 phases (88–96), all complete
- Shipped 2026-05-11 (2 days)

**Previous milestone (v1.14) velocity:**

- 4 phases (82–85), all complete
- Shipped 2026-05-09 (2 days)

**Previous milestone (v1.9) velocity:**

- 5 phases, 13 plans
- 2 days (2026-05-03 → 2026-05-04)
- 121 files changed, +27,865 / −1,388 lines

## Accumulated Context

### Decisions

- [v1.18-roadmap] Phase 102 (MC-01 + MC-02) sequenced first because the `mc_enabled` gate flip is a single state change that unblocks every downstream MC consumer — including the NLP-02 prompt context Phase 105 depends on. simulate.py already runs; MC fields already in merged_players.json; only the gate is off in production.
- [v1.18-roadmap] Phase 103 (CAL-01 + CAL-02) is independent of MC (calibration uses analytical xPts decile-rank proxy, not MC) and purely additive — safe parallelisation candidate but sequenced second so MC gate ships first for downstream momentum. CAL-01 sparse-bucket threshold raised to `sample_n < 15` for GK/DEF, `sample_n < 8` for MID/FWD; position-pool guard hides chart entirely below 50 obs.
- [v1.18-roadmap] Phases SENS-01 and WHY-01 combined into Phase 104 because both touch TransferPanel.tsx with identical risk surface (call-site addition over unit-tested engines). Both `computeFragility` and `computeRejection` are unit-tested and already wired into other call sites; Phase 104 is mechanical addition not new logic.
- [v1.18-roadmap] Phase 105 (NLP-02) sequenced last because it has non-trivial new infrastructure (new POST Route Handler, new `usePlayerInsight` mutation hook, Blob cache namespace, Anthropic Console spending cap) and is the only phase where a single bug can spend money. Sequencing last means MC fields from 102 + rejection reasons/fragility tier from 104 are validated before the LLM is in the loop.
- [v1.18-roadmap] Zero net-new dependencies — `@anthropic-ai/sdk@0.93.0`, numpy 2.2.3, recharts 3.8.1, TanStack Query, Zod, Vercel Blob all already installed and exercised. Three workflow hygiene fixes only: align `anthropic` Python pin to 0.98.1, add explicit numpy 2.2.3 to install line, set `MC_ITERATIONS=10000` and `MC_SEED=42` in GitHub Actions env.
- [v1.18-roadmap] NLP-02 runtime: Node.js only — never Edge (`@anthropic-ai/sdk` SSE parsing fails on Edge per anthropics/anthropic-sdk-typescript#292). Non-streaming `messages.create` against `claude-haiku-4-5-20251001`. `useMutation` not `useQuery`. Trigger on demand only — never `useEffect` (cost-explosion pitfall: 50 rows × 900 tokens × 4 sessions × 180 days ≈ USD 16–32/season from one bug).
- [v1.18-roadmap] NLP-02 cache key includes `pipeline_run_date` so stale prose can never appear alongside fresh stats. Two-tier cache: localStorage + Vercel Blob (`player_insights/gw{N}/element_{id}.json`, `addRandomSuffix: false`).
- [v1.18-roadmap] NLP-01 (LLM prose summary on Decision Summary) already shipped in v1.12 via ProseSummaryBlock + `/api/prose-summary`; no work required this milestone. Listed in REQUIREMENTS.md "Already Shipped" section.

### Pending Todos

- Phase 102 spike: confirm `mc_enabled` gate flip mechanism — `pipeline/run.py` line 203 reads gate from previous `accuracy_backtest.json`, so flip is either a one-time direct Blob edit OR a pipeline patch that sets the flag from inside the run. Validate cleaner path before opening PR.
- Phase 105 spike: confirm Vercel Blob `put` with `addRandomSuffix: false` overwrite semantics in deployed runtime before relying on it for the cache key.
- Phase 105 prerequisite: `ANTHROPIC_API_KEY` must be present in deployment env before merge; configure Anthropic Console monthly spending cap as defence-in-depth.
- WR-02 (decision-severity.ts): captain returns MEDIUM (not LOW) when candidates.length < 2 — cleanup agent scheduled (carry-forward from v1.16)
- WR-01 (DecisionSummaryTab.tsx): duplicate transition classes on Load Squad button — cleanup agent scheduled (carry-forward from v1.16)
- WR-03/04 (MobileNav.test.tsx): 4→5 pills description wrong, Acc pill untested — cleanup agent scheduled (carry-forward from v1.16)
- Phase 48 hover card: non-functional in production until pipeline re-run produces appearance_pts in merged_players.json cache (carry-forward)

### Blockers/Concerns

- None active for v1.18 entry. Phase 102 mc_enabled flip mechanism is the only design unknown and resolves at planning time (research flag from SUMMARY.md).

## Deferred Items

| ID | Description | Phase | Target |
|----|-------------|-------|--------|
| BACK-02 | Transfer regret backtester (Python port of suggestTransfers required) | — | v1.19+ |
| MC-CAL | MC-enabled calibration (actual MC P(haul) percentiles as predicted_rate) | — | v1.19+ (requires MC-01 shipped) |
| PROMPT-CACHE | `cache_control: ephemeral` on NLP-02 system prompt | 105 | v1.19+ (defer until prompt > 1024 tokens) |
| NLP-BATCH | Pipeline pre-generation of top-20 player insights | 105 | v1.19+ (defer until on-demand latency proves unacceptable) |
| RANK-SPARK | `rank_trajectory` sparkline in GemTable (data exists in MergedPlayer) | — | v1.19+ (visual design decision needed) |
| TRT-06 | ChipToggle UI in RouteTreeTab — chipMode hardcoded null | 60 | v1.12 |
| TRT-02 | "Hits" column label cosmetic mismatch (shows totalTransfers, not totalHits) | 60 | v1.12 |
| VERIFY-60 | Phase 60 VERIFICATION.md not created — UAT recorded in STATE.md only | 60 | backlog |
| WR-02 | decision-severity.ts captain MEDIUM when candidates < 2 (should be LOW) | pre-v1.9 | backlog |
| WR-01 | DecisionSummaryTab Load Squad button duplicate transition classes | pre-v1.9 | backlog |
| WR-03/04 | MobileNav.test.tsx 4→5 pills description wrong, Acc pill untested | pre-v1.9 | backlog |
| TEST-57 | captain-picks.test.ts 5 pre-existing failures from Phase 57 CaptainPicksPanel rewrite | 57 | backlog |

## Session Continuity

Last session: 2026-05-13T09:34:50.121Z
Stopped at: Phase 102 context gathered
Resume file: .planning/phases/102-mc-gate-activation-mcdistributionbar-display/102-CONTEXT.md
Next command: `/gsd-execute-phase 102`
