# Project Research Summary

**Project:** FPL Analyst v1.18 Forecast Transparency and AI Intelligence
**Domain:** Sports analytics decision-support tool -- FPL model transparency plus Claude-grounded per-player LLM prose
**Researched:** 2026-05-13
**Confidence:** HIGH (every recommendation traces to direct codebase reads or peer-reviewed / official sources)

## Executive Summary

v1.18 is overwhelmingly an **activation, wire-up, and surfacing** milestone -- not a greenfield build. Five of the six headline features (MC-01, CAL-01, SENS-01, WHY-01, NLP-01) already have shipping engines and partial UI; the work is flipping the `mc_enabled` gate so MC fields become non-null in production, adding missing call sites in `TransferPanel`, tightening the calibration sparse-bucket filter for position-specific tabs, and shipping one genuinely new vertical -- NLP-02 per-player LLM insights. The result is a single new Route Handler (`/api/player-insight`), one new hook (`usePlayerInsight`), three small components (`MCDistributionBar`, `PlayerInsightTrigger`, plus optional calibration health indicator), and **zero net-new dependencies**: `@anthropic-ai/sdk@0.93.0`, numpy, recharts, TanStack Query, Zod, and Vercel Blob are all already installed and exercised in the codebase.

The recommended approach mirrors patterns already validated in this codebase: MC pre-computed in the Python pipeline (700 players x 10k sims x 5 GWs is intractable in any other surface), MC fields co-located in `merged_players.json` (single source of truth -- prevents the type-drift problem the project has explicitly avoided since v1.7), calibration co-located in `accuracy_backtest.json` (same compute, same cadence, same consumer), and Claude calls server-side only via Node.js Route Handlers (never Edge -- `@anthropic-ai/sdk` SSE parsing fails on Edge per anthropics/anthropic-sdk-typescript#292). NLP-02 specifically uses non-streaming `messages.create()` against `claude-haiku-4-5-20251001` (USD 1/USD 5 per MTok), TanStack Query `useMutation` (not `useQuery` -- avoids auto-refetch cost explosion), and a two-tier cache (localStorage plus Vercel Blob keyed on `(player_id, pipeline_run_date)`).

The risk surface is concentrated in two areas: **LLM hallucination** (mitigated by structured XML context injection of real `computeRejection` reasons plus `computeFragility` tier, a qualitative-only system prompt forbidding numeric values, and a two-attempt name-whitelist guardrail with deterministic fallback to the structured `reasons[]` array), and **API cost explosion** (mitigated by demand-trigger only -- no `useEffect` auto-fire on row mount -- plus the durable Blob cache; worst-case pathological use was calculated at approximately USD 16-32/season from a single bug, so on-demand plus cache is non-negotiable). Three additional pitfalls are non-LLM: late-season fragility flag spam (use tier-based visual weight, robust=silent), calibration looking miscalibrated at small GK sample sizes (raise `sample_n` threshold to less than 15 for GK/DEF, less than 8 for MID/FWD), and the never-ported `Math.random()` MC loop in browser TS (forbidden -- use pre-computed pipeline scalars).

## Key Findings

### Recommended Stack

**Net-new dependencies: 0 npm, 0 Python, 0 external services.** v1.18 reuses the validated v1.0-v1.17 stack end-to-end. The single most important model decision is using `claude-haiku-4-5` (alias to pinned `claude-haiku-4-5-20251001`) for both NLP-01 (already shipped) and NLP-02 -- fastest, cheapest at USD 1/USD 5 per MTok, 200k context. Full detail in [STACK.md](./STACK.md).

**Core technologies (carry-forward, no version bumps):**
- **Next.js 16.2.1** App Router plus Route Handlers -- POST handler for `/api/player-insight` mirrors existing `/api/prose-summary` POST exactly; `maxDuration = 30`, Node.js runtime only.
- **@anthropic-ai/sdk 0.93.0** (Node) -- `messages.create()` non-streaming, `cache_control: ephemeral` available but **not used in NLP-02** (system prompt approximately 80 tokens, far below the 1024-token cache minimum; defer to v1.19+).
- **TanStack Query 5.95.2** -- `useMutation` (not `useQuery`) for NLP-02; auto-refetch on `useQuery` would multiply Claude costs.
- **numpy 2.2.3** in pipeline -- `default_rng()` Poisson/Binomial draws already in `simulate.py`; scipy explicitly NOT available in pipeline runtime (`pipeline/saves.py:14`).
- **recharts 3.8.1** -- already renders the reliability diagram in `AccuracyTab.tsx`; no second charting lib.
- **Vercel Blob 2.3.1** -- durable two-tier cache for NLP-02 insights, key `player_insights/gw{N}/element_{id}.json` with `addRandomSuffix: false`.
- **localStorage** -- NLP-02 per-player insight cache keyed on `(player_id, pipeline_run_date)`; mirrors `MANUAL_PLAN_KEY` precedent in `manual-plan.ts`.

**Three workflow hygiene fixes (NOT new deps):** align `anthropic` Python pin from 0.40.0 to 0.98.1 (matches `requirements.txt` floor), add explicit `numpy==2.2.3` to the workflow install line (currently transitive via pandas), and set `MC_ITERATIONS=10000` plus `MC_SEED=42` in the GitHub Actions env block to reach the production budget.

### Expected Features

Full feature analysis in [FEATURES.md](./FEATURES.md). **The headline finding: 5 of 6 features are partially or fully shipped -- v1.18 is largely wire-up, plus one genuinely new build (NLP-02).**

**Must have (table stakes -- all SHIPPED or partial):**
- Haul/blank probability per player plus P10/P90 range -- SHIPPED in `XPtsCell` hover card (blocked only by `mc_enabled` gate flip).
- Calibration chart with y=x reference plus per-position breakdown plus sample-size display -- SHIPPED in `AccuracyTab.tsx` (needs sparse-bucket fix for GK/DEF).
- Fragility badge on transfer recommendations -- PARTIAL: shipped in GemTable plus CaptainPicksPanel; TransferPanel call site missing.
- Rejection explainer (Why is X not recommended?) -- PARTIAL: shipped in GemTable expand; TransferPanel sell-side missing.
- LLM-grounded weekly prose summary (no invented numbers) -- SHIPPED in `ProseSummaryBlock` with name-whitelist plus qualitative-only guardrail.
- Calibration coverage / health indicator on Decision Summary -- NOT STARTED (approximately 30 LOC additive).

**Should have (competitive differentiators):**
- **Per-player LLM insights (NLP-02)** -- THE one genuinely new feature. No competing FPL tool currently offers Claude-grounded per-player explanations with structured-context grounding.
- Deterministic rejection cascade (not LLM) -- SHIPPED; reproducible and auditable in a way LLM-generated explanations cannot be.
- Qualitative-only LLM prose with name-whitelist guardrail -- SHIPPED for NLP-01; same pattern extends to NLP-02.

**Defer (v1.19+):**
- `rank_trajectory` sparkline (data exists in `MergedPlayer`, visual design decision needed).
- NLP-02 squad-aware regeneration (parallel to NLP-01 POST refresh).
- MC-enabled calibration (use actual MC P(haul) percentiles as `predicted_rate` instead of decile-rank proxy).
- Prompt caching (`cache_control: ephemeral`) -- defer until system prompt exceeds 1024 tokens or batch pattern adopted.
- Batch pre-generation of top-20 player insights in pipeline.

### Architecture Approach

Pipeline (Python) -> Vercel Blob -> Next.js Route Handlers -> TanStack Query -> React. Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md). The pipeline produces facts; the browser computes opinions. MC, calibration, and weekly prose live in pipeline-written JSON; sensitivity, rejection, MC labels, and lifecycle labels are pure-TypeScript display-time functions over `MergedPlayer` fields.

**Major components:**
1. **Python pipeline (existing)** -- `simulate.py` (MC), `accuracy.py` (calibration), `prose_summary.py` (weekly NLP-01). Daily GitHub Actions cron writes to Vercel Blob.
2. **`merged_players.json` (single source of truth)** -- MC fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory`) already present; gated on `mc_enabled: true` in `accuracy_backtest.json.summary`.
3. **Pure-TS engines (existing)** -- `computeFragility`, `computeRejection`, `computeMCLabels`, `computeLifecycleLabel` in `src/lib/*`. Run inline in React render, approximately 1ms per row.
4. **NEW: `/api/player-insight` Route Handler** -- Node.js runtime, `maxDuration = 30`, Zod-validated POST body, Blob cache check by `(gw, element_id)`, fall-through to Claude Haiku call, name-whitelist guardrail with two-attempt retry, layered error handling for 401/429/5xx/missing-key.
5. **NEW: `usePlayerInsight` hook plus `PlayerInsightTrigger` component** -- `useMutation` with `mutationKey: ['playerInsight', playerId, gw]` for in-flight dedup; demand-triggered button (never `useEffect` auto-fire).
6. **NEW: `MCDistributionBar` component** -- pure React plus Tailwind flex row (no Recharts at row scale); renders only when `haul_prob !== undefined` (gate-aware).

**Key architectural invariants (verified):**
- MC fields stay in `merged_players.json`, not a separate `mc_results.json`. Same primary key, same cadence, same consumer.
- Calibration stays in `accuracy_backtest.json`, not a separate `calibration.json`. Same compute, same fetch.
- `fragility_tier` is NOT in `merged_players.json` -- it is context-dependent (`isTransfer`, `xPtsGain`). Pure-TS engine only.
- ANTHROPIC_API_KEY is server-side only; never `NEXT_PUBLIC_*`.
- NLP-02 cache key includes `pipeline_run_date` so stale prose can never appear alongside fresh stats.

### Critical Pitfalls

Full enumeration in [PITFALLS.md](./PITFALLS.md). Top five for v1.18:

1. **NLP-02 API cost explosion via useEffect on row mount** -- 50 visible GemTable rows x 900 tokens x 4 sessions/day x 180 days approximately USD 16-32/season from a single bug. **Avoid:** demand-trigger only (explicit Get AI insight button click), localStorage cache keyed on player_id plus pipeline_run_date, useMutation not useQuery (no auto-refetch), mutationKey for in-flight dedup, Blob durable cache layer, Anthropic Console monthly spending cap as defence-in-depth.
2. **LLM hallucinating rejection reasons or inventing player statistics** -- Claude has no current-season data; passing a player name without structured context lets the model recall stale training data (wrong injuries, fictitious fixtures). **Avoid:** inject structured XML context (player, rejection_reasons, fragility, fixture tags) built from real computeRejection plus computeFragility output; system prompt forbids numeric values (qualitative only); two-attempt name-whitelist guardrail; deterministic fallback to raw reasons array on guardrail failure.
3. **Calibration chart shows model is broken at small position-specific sample sizes** -- sample_n less than 5 filter is fine for the all-positions aggregate (approximately 200 obs/decile) but fails for GK position tab (approximately 8 obs/decile at BACKTEST_GWS=5); a single haulting GK shifts actual_rate by 12+ percentage points. **Avoid:** raise threshold to sample_n less than 15 for GK/DEF, sample_n less than 8 for MID/FWD; add position-pool total guard (show Insufficient data if total less than 50); hide chart entirely if fewer than 3 completed GWs.
4. **Sensitivity flag spam after GW30** -- start_prob less than 0.85 triggers fragility for 40-60% of late-season candidates; everything becomes fragile; signal dies. **Avoid:** tier-based visual hierarchy (robust = no badge, fragile = small amber dot, knife_edge = amber pill); never render fragility on rows outside the recommendation set (top transfers, captaincy candidates); track fragile_transfer_pct in data_health.json and warn if exceeds 45%.
5. **Porting simulate.py MC to browser TypeScript** -- 700 players x 1000 sims x Math.random() loops freezes the main thread for 400ms+ (with 10k sims, 2-5 seconds). **Avoid:** the pipeline is authoritative; browser reads pre-computed scalars (blank_prob, haul_prob, p10_pts, p90_pts). For any future live what-if UI, use existing rank-sim.ts sigma-approximation, not full MC. If full MC is genuinely needed, cap at 200 sims and run in a Web Worker -- never on the main thread.

## Implications for Roadmap

Suggested **5-phase** structure. Order is driven by the dependency graph in [ARCHITECTURE.md](./ARCHITECTURE.md): MC gate flip unblocks every downstream MC consumer (including NLP-02 prompt context); calibration and TransferPanel wire-ups are independent additive changes; NLP-02 goes last because it benefits from fragility tier plus rejection reasons being available in TransferPanel as prompt-context inputs.

### Phase 1: MC Gate Activation plus MCDistributionBar Display

**Rationale:** The mc_enabled gate is the single switch unlocking all MC-dependent UI. simulate.py already runs; MC fields are already in merged_players.json; MergedPlayer type already declares them. Without the flip, every MC consumer is silent. This is the lowest-risk highest-leverage first move.

**Delivers:** mc_enabled true in accuracy_backtest.json summary; MC_ITERATIONS=10000 plus MC_SEED=42 in GitHub Actions env block; new MCDistributionBar.tsx component mounted in GemTable row-expand under a haul_prob is not undefined guard.

**Addresses:** MC-01 (table stakes) -- haul/blank probability per player plus P10/P90 range visible in UI.

**Uses:** existing simulate.py, existing usePlayers hook, Tailwind flex (no Recharts at row scale).

**Avoids:** Pitfall 5 (no Math.random loop in TS -- read pipeline scalars only).

### Phase 2: Calibration Sparse-Bucket Fix plus Health Indicator

**Rationale:** Independent of MC gate; purely additive. Without the position-specific threshold fix, the GK calibration tab looks miscalibrated when the model is fine, eroding the trust the calibration chart was built to establish.

**Delivers:** pipeline/accuracy.py _compute_calibration_data sparse-bucket filter raised to sample_n less than 15 for GK/DEF, sample_n less than 8 for MID/FWD; position-pool total guard (less than 50 obs -> Insufficient data banner); one-line calibration health indicator on DecisionSummaryTab reading useAccuracy data calibration.

**Addresses:** CAL-01 sparse-bucket UX risk; calibration coverage / health indicator table-stakes feature.

**Uses:** existing accuracy.py, existing useAccuracy hook, existing recharts ComposedChart.

**Avoids:** Pitfall 3 (false model broken impression on GK tab).

### Phase 3+4: Sensitivity plus Rejection Explainer in TransferPanel (combined)

**Rationale:** Both touch the same file (TransferPanel.tsx) and both are call-site additions over engines that already ship in src/lib/sensitivity.ts and src/lib/explain.ts. Combining into one PR avoids merge churn and keeps the panel import block consistent. Adding fragility to buy candidates and rejection reasons to sell-side rows completes the symmetry across recommendation surfaces.

**Delivers:** computeFragility call site for buy candidates with FragilityBadge per row (passing isTransfer=true and xPtsGain); computeRejection for sell-side with top-2 reasons inline; optional RejectionReasonsList presentational component.

**Addresses:** SENS-01 TransferPanel completion plus WHY-01 TransferPanel sell-side completion. These also produce the structured context Phase 5 LLM prompt depends on.

**Uses:** existing computeFragility, existing computeRejection, existing FragilityBadge, existing computeLifecycleLabel.

**Avoids:** Pitfall 4 (tier-based visual weight prevents flag spam late season -- robust = silent default, fragile = amber dot, knife_edge = amber pill).

### Phase 5: NLP-02 Per-Player Insight Route plus Hook plus UI

**Rationale:** Highest scope, highest risk; goes last so all upstream context is correct (MC fields non-null from Phase 1, fragility tier plus rejection reasons available from Phases 3+4). This is the one truly new vertical for v1.18.

**Delivers:** POST /api/player-insight Route Handler (Node.js runtime, maxDuration=30, Zod body, Blob cache by gw plus element_id with addRandomSuffix false, Haiku call with name-whitelist guardrail, layered error handling for 401/429/5xx/missing-key/422-guardrail); usePlayerInsight mutation hook with localStorage plus Blob two-tier cache; PlayerInsightTrigger component (explicit Get AI insight button, never useEffect); wired into GemTable row expand and TransferPanel; Anthropic Console monthly spending cap set.

**Uses:** existing @anthropic-ai/sdk 0.93.0, existing prose-guardrail.ts pattern, existing /api/prose-summary POST as the structural mirror, claude-haiku-4-5-20251001.

**Avoids:** Pitfalls 1 and 2 -- demand-trigger only, two-tier cache, structured XML context grounded in real computeRejection plus computeFragility output, qualitative-only system prompt, two-attempt guardrail with deterministic fallback.

### Phase Ordering Rationale

- **Phase 1 first** because the mc_enabled gate flip is a single line of state but unblocks haul_prob, blank_prob, p10_pts, p90_pts everywhere downstream -- including the NLP-02 prompt context Phase 5 depends on. Doing it first means Phase 5 ships with rich grounding on day one.
- **Phase 2 second** because it is independent (no MC dependency -- calibration uses analytical xPts decile-rank proxy) and purely additive; safe parallelisation candidate.
- **Phases 3+4 combined** because both touch TransferPanel.tsx with identical risk surface (call-site addition over a unit-tested engine) and Phase 5 prompt quality directly benefits from having rejection_reasons and fragility_tier already wired into TransferPanel as visible UI signals.
- **Phase 5 last** because it is the only phase with non-trivial new infrastructure (new route, new hook, Blob cache namespace, Anthropic spending-cap configuration) and the only phase where a single bug can spend money -- sequencing it last means all upstream context is validated before the LLM is in the loop.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (NLP-02):** Confirm Vercel Blob put with addRandomSuffix false overwrite semantics in the actual deployed runtime; verify current Anthropic prompt-caching token thresholds (1024-token minimum at time of research) before deciding caching is deferred; spec the precise XML prompt structure including rejection-reason coverage check beyond the existing name-whitelist guardrail. Consider running /gsd-research-phase for prompt-structure design.
- **Phase 1 (MC gate flip):** Confirm the actual flip mechanism -- accuracy.py reads the gate from the previous accuracy_backtest.json, so the flip is either a one-time direct Blob edit OR a pipeline patch that sets the flag from inside the run. Validate which path is cleaner before opening the PR.

Phases with standard patterns (skip research-phase):
- **Phase 2 (calibration fix):** Threshold change is a 1-line edit (pipeline/accuracy.py); position-pool guard is a 1-line conditional; health indicator is a ~30-LOC additive React component reading an existing hook.
- **Phases 3+4 (TransferPanel wire-ups):** Both engines are unit-tested and used in two existing call sites; this is mechanical addition of computeFragility plus FragilityBadge and computeRejection plus reasons list.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every version verified against installed package.json, node_modules/@anthropic-ai/sdk/package.json, pipeline/requirements.txt, and Anthropic Models Overview 2026-05-13. Zero net-new deps means zero version-compatibility risk. |
| Features | HIGH | Shipped status of MC-01 / CAL-01 / SENS-01 / WHY-01 / NLP-01 verified by direct codebase inspection; competitor analysis MEDIUM (public docs only) but does not affect roadmap. |
| Architecture | HIGH | All five architectural questions (MC storage, calibration storage, Claude integration, streaming vs non, sensitivity client vs pipeline) answered against verified codebase precedent. Two MEDIUM areas (Blob overwrite semantics, current prompt-caching thresholds) called out explicitly as Phase 5 research flags. |
| Pitfalls | HIGH | All seven critical pitfalls grounded in existing code: MC iteration count in simulate.py, calibration sample_n filter in accuracy.py line 542, START_PROB_FLOOR 0.70 in sensitivity.ts, existing prose-guardrail name-only scope, Haiku pricing verified May 2026, maxDuration pattern in existing route. No hypothetical risks. |

**Overall confidence:** HIGH

### Gaps to Address

- **MC gate flip mechanism** -- pipeline/run.py line 203 reads mc_enabled from the previous accuracy_backtest.json. Confirm whether flipping requires a one-time Blob edit (manual) or a pipeline patch that sets the flag from inside the run. Address in Phase 1 planning.
- **TransferPanel allPlayers scope** -- WHY-01 wiring needs the full player pool for computeLifecycleLabel; whether TransferPanel.tsx already has it in scope or needs threading from page.tsx is a Phase 3+4 detail. Safe fallback: local computeLifecycleLabel recomputation.
- **Vercel Blob addRandomSuffix false overwrite verification** -- Blob docs imply same-pathname put overwrites when addRandomSuffix is false, but confirm in deployed runtime before relying on it for the NLP-02 cache key. Phase 5 spike.
- **anthropic Python SDK pin mismatch** -- pipeline/requirements.txt declares 0.98.1 or greater, .github/workflows/pipeline.yml line 46 pins 0.40.0. Both work for non-streaming messages.create, but align to 0.98.1 in Phase 1 hygiene work.
- **Explicit numpy install in workflow** -- currently transitive via pandas; add numpy 2.2.3 to the explicit install line in Phase 1 to prevent silent breakage on future pandas upgrades.

## Sources

### Primary (HIGH confidence -- direct verification)
- C:\Users\jamie\fplx\package.json, node_modules/@anthropic-ai/sdk/package.json, node_modules/recharts/package.json -- installed dep versions
- C:\Users\jamie\fplx\pipeline\requirements.txt, .github\workflows\pipeline.yml -- pipeline runtime spec plus workflow pins
- C:\Users\jamie\fplx\pipeline\simulate.py -- full MC implementation, N_SIMS env config, PCG-64 default RNG
- C:\Users\jamie\fplx\pipeline\accuracy.py (line 542 sample_n less than 5, line 496 _compute_calibration_data) -- calibration compute
- C:\Users\jamie\fplx\pipeline\run.py lines 193-225 -- pipeline orchestration plus mc_enabled gate read
- C:\Users\jamie\fplx\pipeline\prose_summary.py -- NLP-01 Python Claude call pattern, two-attempt guardrail
- C:\Users\jamie\fplx\src\app\api\prose-summary\route.ts -- Node runtime, maxDuration 30, non-streaming POST, Zod body validation, error class hierarchy (mirror target for NLP-02)
- C:\Users\jamie\fplx\src\lib\sensitivity.ts, src\lib\explain.ts, src\lib\prose-guardrail.ts, src\lib\rank-sim.ts -- pure-TS engines plus guardrail scope
- C:\Users\jamie\fplx\pipeline\cache\merged_players.json -- MC fields verified present 2026-05-13
- Anthropic Models Overview (https://platform.claude.com/docs/en/about-claude/models/overview) -- verified 2026-05-13: claude-haiku-4-5 to claude-haiku-4-5-20251001, USD 1 / USD 5 per MTok, 200k ctx; deprecation list
- Anthropic prompt engineering best practices (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) -- XML tagging, document wrapping, quoting-before-answering
- Stable reliability diagrams for probabilistic classifiers, PMC 7923594 (https://pmc.ncbi.nlm.nih.gov/articles/PMC7923594/) -- small-bin instability is statistically documented
- Understanding Model Calibration, ICLR 2025 (https://iclr-blogposts.github.io/2025/blog/calibration/) -- ECE bias with sparse bins
- Google PAIR: Explainability + Trust (https://pair.withgoogle.com/chapter/explainability-trust/) -- perfect time to show explanations is in response to user action
- Context7 /anthropics/anthropic-sdk-typescript (2026-05-13) -- CacheControlEphemeral, extended-cache-ttl-2025-04-11 beta header

### Secondary (MEDIUM confidence)
- GitHub issue anthropics/anthropic-sdk-typescript#292 -- Edge Runtime SSE parsing failure (single source; Node.js default is the safer choice regardless)
- v1.16 STACK.md / PITFALLS.md prior research -- react-sparklines unmaintained, localStorage exceeds IndexedDB at this scale, fragile_transfer_pct monitoring not yet implemented
- FPLOptimized, FPLReview Ultimate Truth, Solio Analytics, FPLPulse mini-league predictions -- competitor feature surface
- DNV P10/P50/P90 terminology (https://www.dnv.com/article/terminology-explained-p10-p50-and-p90-202611/) -- canonical percentile band definitions
- Springer "Explaining the user experience of recommender systems", NN/g UX Guidelines for Recommended Content, MDPI Recommendation Message Design -- rejection explanation UX literature
- Iguazio LLM grounding glossary, WSC Sport automated commentary case study -- sports LLM hallucination patterns

### Tertiary (LOW confidence)
- None -- every recommendation in this synthesis traces to a HIGH or MEDIUM source.

---
*Research completed: 2026-05-13*
*Ready for roadmap: yes*
