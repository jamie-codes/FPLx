# Project Research Summary

**Project:** FPL Analyst v1.18 -- Forecast Transparency and AI Intelligence
**Domain:** Sports analytics decision-support tool -- model transparency activation and per-player LLM integration
**Researched:** 2026-05-12
**Confidence:** HIGH

## Executive Summary

v1.18 is an activation and wire-up milestone, not a greenfield build. Direct codebase inspection confirms that five of the six headline features are already fully implemented in the codebase from phases 62-94: Monte Carlo display (MC-01), calibration charts (CAL-01), sensitivity flags (SENS-01), rejection explainer (WHY-01), and weekly LLM prose summary (NLP-01). The pipeline computes MC fields, writes calibration buckets, and calls Claude Haiku on every run. The TypeScript engines (computeFragility, computeRejection) are tested and wired into GemTable and CaptainPicksPanel. The only genuinely new build in this milestone is NLP-02: a per-player LLM insight route, hook, and UI trigger. Everything else is enabling gates, extending existing engines to new surfaces (TransferPanel), and polishing column visibility.

The recommended approach is to sequence work by dependency exposure: first enable the mc_enabled gate so MC fields propagate through the existing stack, then extend SENS-01 and WHY-01 to TransferPanel (two engines already exist, only call sites are missing), then build NLP-02 last after MC context is live and fragility/rejection context is available to enrich the per-player prompt. Zero new npm packages, zero new Python packages, and zero new external services are required for the entire milestone.

The critical risks are concentrated in NLP-02: cost explosion from missing localStorage cache (a single bug calling the API on all visible rows simultaneously could cost USD 16-32/season), hallucinated rejection reasons if the reasons[] array is not injected into the prompt, and stale prose if cache invalidation is not keyed on pipeline_run_date. The calibration chart has a secondary risk: the existing sparse-bucket filter (sample_n < 5) was sized for the all-positions aggregate view -- position-specific GK tabs have around 8 observations per decile at 5 finished GWs, below the stability threshold, and will show false miscalibration signals.

## Key Findings

### Recommended Stack

No new dependencies are needed for v1.18. The full capability exists in the already-installed stack: @anthropic-ai/sdk 0.93.0 covers NLP-02 (messages.create, non-streaming, maxDuration 30); recharts 3.8.1 covers MC distribution bar display (ComposedChart and ReferenceLine already used in AccuracyTab); @tanstack/react-query 5.95 covers the new useMutation hook for NLP-02; and the Python pipeline already uses numpy for MC simulation. The claude-haiku-4-5 model (verified alias to claude-haiku-4-5-20251001, USD 1/5 per MTok) is already in use for NLP-01 and is the correct choice for NLP-02 2-3 sentence outputs.

**Core technologies (all already installed):**
- @anthropic-ai/sdk 0.93.0 -- Claude API calls, server-side only via Node.js runtime (not Edge Runtime)
- recharts 3.8.1 -- MC distribution bar, calibration chart (both patterns already in AccuracyTab)
- numpy (Python pipeline) -- Monte Carlo simulation, 10k sims via MC_ITERATIONS env var
- localStorage -- NLP-02 prose cache, keyed by (player_id, pipeline_run_date)
- TanStack Query 5.95 -- useMutation for on-demand NLP-02 calls; NOT useQuery (avoids auto-refetch)

**What NOT to add:** TypeScript MC in browser (freezes main thread at 1k sims), Vercel AI SDK (ai package adds 200KB bundle, AnthropicStream removed in v4), streaming for NLP-02 (100-token Haiku response arrives sub-second as single chunk), Edge Runtime for any LLM route (SDK SSE parsing known to fail, GitHub issue #292).

### Expected Features

**Already delivered (do not re-scope):**
- MC-01: Monte Carlo pipeline + XPtsCell hover card with blank%, haul%, P10, P90
- CAL-01: Calibration reliability diagram in AccuracyTab with position-split tabs and sparse-bucket filter
- SENS-01: computeFragility() with ROBUST/FRAGILE/KNIFE EDGE tristate, FragilityBadge in GemTable and CaptainPicksPanel
- WHY-01: computeRejection() 8-predicate cascade with ComparisonSearch head-to-head in GemTable expand
- NLP-01: Weekly prose summary in DecisionSummaryTab with name-whitelist guardrail and manual Refresh

**Must deliver for v1.18 launch:**
- NLP-02: Per-player LLM insights -- new /api/player-insight POST route, usePlayerInsight mutation hook, PlayerInsightTrigger component in GemTable expand and TransferPanel
- mc_enabled gate flip: set mc_enabled to true in accuracy_backtest.json after verifying a successful pipeline run (without this, blank_prob/haul_prob are undefined in production and the entire MC display is invisible)

**Should deliver for completeness:**
- SENS-01 in TransferPanel: call computeFragility(buy, true, xPtsGain) and render FragilityBadge inline for buy candidates (engine exists, call site missing)
- WHY-01 in TransferPanel: call computeRejection for sell-side players to explain sale recommendations (engine exists, call site missing)
- Calibration sparse-bucket fix: raise minimum from sample_n < 5 to sample_n < 15 for GK/DEF position-specific tabs

**Defer to v1.19+:**
- rank_trajectory sparkline (field already computed in pipeline, no UI surface yet)
- MC-enabled calibration (use actual MC haul_prob as predicted_rate instead of decile-rank proxy)
- BACK-01 x SENS-01 cross-linking (fragility markers on historical decision rows)

### Architecture Approach

The architecture is a five-layer stack that already carries all v1.18 data: GitHub Actions pipeline writes MC fields and calibration to Vercel Blob JSON, Next.js route handlers pass them through unchanged, TanStack Query caches them with 6h staleTime, and React components call pure TypeScript engines (computeFragility, computeRejection, computeMCLabels) inline in render. The only new component boundary introduced by v1.18 is the NLP-02 path: PlayerInsightTrigger (React) to usePlayerInsight (mutation hook) to POST /api/player-insight (new route) to Anthropic Haiku API. No new cache files, no new Blob artifacts, no new pipeline modules.

**Major components and their v1.18 status:**
1. pipeline/simulate.py -- MC-01 engine, COMPLETE; needs MC_ITERATIONS=10000 in GitHub Actions env
2. pipeline/accuracy.py::_compute_calibration_data -- CAL-01 engine, COMPLETE; needs sparse-bucket fix for GK position view
3. src/lib/sensitivity.ts::computeFragility -- SENS-01 engine, COMPLETE; needs call site added in TransferPanel
4. src/lib/explain.ts::computeRejection -- WHY-01 engine, COMPLETE; needs call site added in TransferPanel
5. src/app/api/player-insight/route.ts -- NLP-02 route, NOT YET BUILT; ~80 LOC, mirrors /api/prose-summary POST
6. src/components/gem-table/MCDistributionBar.tsx -- MC display, NOT YET BUILT; renders blank_prob/haul_prob/P10/P90
7. src/components/gem-table/PlayerInsightTrigger.tsx -- NLP-02 UI, NOT YET BUILT; on-demand trigger with localStorage cache

**New files required:**
- src/app/api/player-insight/route.ts
- src/lib/hooks/usePlayerInsight.ts
- src/components/gem-table/MCDistributionBar.tsx
- src/components/gem-table/PlayerInsightTrigger.tsx

**Modified files:** GemTable.tsx, TransferPanel.tsx, src/lib/types.ts

### Critical Pitfalls

1. **NLP-02 cost explosion from missing cache** -- If useEffect triggers NLP-02 on every row expand without a localStorage cache keyed on (player_id, pipeline_run_date), a single bug opening all 50 visible GemTable rows costs ~USD 30/season. Prevention: demand-trigger only (user clicks Get AI insight), staleTime 24h, localStorage cache invalidated on pipeline refresh, rate-limit guard in the API route.

2. **WHY-01 guardrail gap -- LLM invents rejection reasons** -- The existing prose-guardrail.ts checks only player names, not reason coverage. If NLP-02 receives "player X was not recommended" without the structured reasons[] array, Claude invents plausible reasons from training data. Prevention: NLP-02 buildUserPrompt must inject structured rejection_reasons XML block from computeRejection output; system prompt must restrict output to paraphrasing only provided reasons; guardrail retry must fall back to raw reasons[] display on two failures.

3. **Calibration sparse-bucket false alarm for GK position** -- sample_n < 5 was sized for the all-positions aggregate (~50 observations/decile). The GK position-specific tab has ~8 observations/decile at BACKTEST_GWS=5. A single haulting GK shifts actual_rate by 12+ percentage points -- the chart looks broken when the model is fine. Prevention: raise filter to sample_n < 15 for GK/DEF in _compute_calibration_data; add a position-pool total guard showing Insufficient data when total position observations < 50.

4. **Sensitivity flag spam late in season** -- computeFragility fires on any player with start_prob < 0.85 (START_PROB_FLOOR = 0.70 with 0.15 perturbation). In GW30+, fixture congestion and rotation push 40-60% of candidates below 0.85, making every recommendation fragile. Prevention: tier-based visual weight (robust=no badge, fragile=amber dot, knife_edge=amber pill) before surfacing flags in new UI contexts; never add new perturbations without a false-positive backtest.

5. **MC gate not flipped -- all MC-dependent UI is silent** -- Without mc_enabled: true in accuracy_backtest.json, blank_prob and haul_prob are undefined in merged_players.json. The MCDistributionBar renders nothing and the AI Intelligence milestone looks incomplete. Prevention: first task of Phase 1 is to verify the pipeline runs cleanly with the gate flipped and MC fields are non-null in the output.

## Implications for Roadmap

Based on the dependency graph and the already-implemented status of most features, the natural build order follows infrastructure-first, display-second, new-build-last.

### Phase 1: MC Gate Activation + MC Display Components

**Rationale:** The mc_enabled gate is a binary switch that unlocks all downstream MC-dependent UI simultaneously. Flipping it first means every subsequent phase can assume haul_prob and p10_pts are populated. NLP-02 context assembly can include them, and MCDistributionBar has real data to render. This is a low-risk first step (one verification, one gate flip, one new component).

**Delivers:** mc_enabled: true in production, MCDistributionBar in GemTable row expand showing blank%/haul%/P10/P90, MC_ITERATIONS=10000 in GitHub Actions env.
**Addresses:** MC-01 activation; mc_enabled gate flip (P1 priority)
**Avoids:** Silent MC display, NLP-02 prompts missing MC context
**Research flag:** No research needed -- gate mechanism is documented in accuracy.py and verified.

### Phase 2: Calibration Sparse-Bucket Fix + Health Indicator

**Rationale:** CAL-01 charts are already rendered in AccuracyTab. The outstanding work is a targeted bug fix (sparse-bucket filter for GK position) and a small additive surface (calibration health sentence in DecisionSummaryTab). Shipping the fix before user traffic reaches CAL-01 prevents false model-is-broken impressions from early-season GK data.

**Delivers:** Corrected sample_n thresholds by position (< 15 for GK/DEF, < 8 for MID/FWD), position-pool total guard with Insufficient data banner, calibration health indicator in DecisionSummaryTab reading from useAccuracy().
**Addresses:** CAL-01 sparse-bucket risk (Pitfall 3); sample size display on calibration
**Avoids:** False miscalibration alarm for GK position, early-season empty chart axis
**Research flag:** No research needed -- exact threshold values specified in PITFALLS.md.

### Phase 3: SENS-01 Extension to TransferPanel

**Rationale:** computeFragility is already tested and used in GemTable and CaptainPicksPanel. Adding the call site in TransferPanel puts fragility context at the point where managers act on recommendations. Doing this before NLP-02 means the per-player prompt context can include fragility_tier from the live TransferPanel computation.

**Delivers:** FragilityBadge inline in each TransferPanel buy-candidate row, tier-based visual hierarchy (robust=no badge, fragile=amber dot, knife_edge=pill) applied consistently across all surfaces.
**Addresses:** SENS-01 table-stakes feature; Pitfall 4 (flag spam) via visual tier design
**Avoids:** Fragility UX inconsistency between GemTable and TransferPanel; late-season warning fatigue
**Research flag:** No research needed -- call signature computeFragility(buy, true, xPtsGain) is verified.

### Phase 4: WHY-01 Extension to TransferPanel

**Rationale:** computeRejection already runs in GemTable. TransferPanel needs it for sell-side context. Comes after Phase 3 because both changes touch TransferPanel -- combining them would reduce churn, but the rejection engine needs lifecycleMap setup distinct from the fragility call. Sequencing SENS-01 first keeps each phase atomic.

**Delivers:** Top-2 rejection reasons inline for sell-candidate rows in TransferPanel (computed locally using computeLifecycleLabel over squad, avoiding prop drilling), RejectionReasonsList component.
**Addresses:** WHY-01 why-is-X-not-recommended in the action context; sets up reasons[] array that NLP-02 Phase 5 injects into prompts
**Avoids:** LLM inventing rejection reasons in NLP-02 (rejection context exists before NLP-02 is built)
**Research flag:** No research needed -- engine and predicate set are verified in ARCHITECTURE.md.

### Phase 5: NLP-02 Per-Player LLM Insights

**Rationale:** The one genuinely new build in v1.18 comes last because it depends on all prior phases: MC context (Phase 1), fragility tier (Phase 3), and rejection reasons (Phase 4) are all injected into the per-player prompt. Building NLP-02 last maximises prompt quality and means the guardrail can be validated against real context from the live stack.

**Delivers:** POST /api/player-insight route (mirrors /api/prose-summary POST, same Node.js runtime, same maxDuration: 30, same claude-haiku-4-5), usePlayerInsight mutation hook with localStorage cache keyed on (player_id, pipeline_run_date), PlayerInsightTrigger in GemTable expand and TransferPanel with demand-trigger debounce (>1s expand), extended guardrail checking rejection_reasons coverage.
**Addresses:** NLP-02 (the P1 differentiator -- per-player AI insights in GemTable expand)
**Avoids:** All three NLP-02 pitfalls: cost explosion (localStorage cache + demand trigger), hallucinated rejection reasons (structured XML block), stale prose (cache key includes pipeline date)
**Research flag:** No deep research needed -- route pattern fully specified in ARCHITECTURE.md. Open decision: batch vs on-demand; PITFALLS.md recommends on-demand with cache, avoiding the USD 16-32/season cost-explosion scenario.

### Phase Ordering Rationale

- Gate flip (Phase 1) before display work: avoids building against undefined fields
- Pipeline fix (Phase 2) before user-facing shipping: prevents false model-broken signals from GK sparse data
- SENS-01 (Phase 3) before WHY-01 (Phase 4): both touch TransferPanel; SENS-01 is simpler (no lifecycleMap threading); WHY-01 builds on the same touch
- NLP-02 (Phase 5) last: maximises prompt context richness; gate must be active for MC context injection
- Each phase is independently deployable with no rollback dependency on the next

### Research Flags

No phases require /gsd-research-phase for this milestone. All research was performed in the current session with direct codebase verification.

- Phase 1: Gate mechanism documented in accuracy.py and run.py; MCDistributionBar follows existing recharts ComposedChart pattern
- Phase 2: Exact threshold values and guard conditions specified in PITFALLS.md
- Phase 3: computeFragility(buy, true, xPtsGain) call signature verified in ARCHITECTURE.md
- Phase 4: computeRejection signature and lifecycle computation verified in ARCHITECTURE.md
- Phase 5: Route design, interfaces, prompt structure, guardrail extension, and caching strategy fully specified in STACK.md and ARCHITECTURE.md

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All capability verified against installed node_modules, pipeline/simulate.py, and route handlers. Zero new deps confirmed. |
| Features | HIGH | Feature status (shipped/partial/not-started) verified by direct codebase read. Competitor analysis MEDIUM (public pages only). |
| Architecture | HIGH | All integration points verified in GemTable.tsx, TransferPanel.tsx, CaptainPicksPanel.tsx, AccuracyTab.tsx, explain.ts, sensitivity.ts, prose-summary/route.ts. NLP-02 route design MEDIUM (not yet built, mirrors verified pattern). |
| Pitfalls | HIGH | All pitfalls grounded in existing code inspection -- not hypothetical. Exact threshold values, cost calculations, and warning signs all verified. |

**Overall confidence:** HIGH

### Gaps to Address

- **TransferPanel allPlayers availability:** computeRejection needs the full player population. TransferPanel was not deeply inspected for whether usePlayers() data is already in scope or needs threading. Resolve at Phase 4 planning by reading TransferPanel.tsx top-level props. Safe fallback: local computeLifecycleLabel recomputation avoids prop drilling.

- **mc_enabled gate flip process:** The gate flip modifies accuracy_backtest.json in Vercel Blob directly. The exact mechanism (pipeline re-run writes it vs manual Blob upload) needs confirmation at Phase 1 planning. The pipeline guard in accuracy.py preserves the gate value across runs, so a one-time manual flip should persist.

- **NLP-02 batch vs on-demand final decision:** PITFALLS.md recommends pre-generating top-20 player insights in the pipeline. ARCHITECTURE.md specifies on-demand. Recommendation: ship on-demand with localStorage cache first; add pipeline pre-generation only if on-demand latency (~800ms) proves unacceptable in user testing.

## Sources

### Primary (HIGH confidence)
- pipeline/simulate.py -- MC-01 full implementation, N_SIMS default, mc_enabled gate
- pipeline/accuracy.py -- _compute_calibration_data, BACKTEST_GWS=5, sample_n threshold
- pipeline/prose_summary.py -- NLP-01 Python-side Claude call, guardrail, qualitative-only prompt
- src/lib/sensitivity.ts -- computeFragility engine, START_PROB_FLOOR=0.70, 5-perturbation set
- src/lib/explain.ts -- computeRejection 8-predicate cascade, computeHeadToHead
- src/lib/prose-guardrail.ts -- name-only guardrail scope (confirmed does NOT cover rejection reasons)
- src/app/api/prose-summary/route.ts -- maxDuration=30, claude-haiku-4-5, non-streaming pattern
- src/components/accuracy/AccuracyTab.tsx -- CalibrationSection verified at line 344+
- src/components/gem-table/GemTable.tsx -- WHY-01 and SENS-01 integration verified
- src/components/captaincy/CaptainPicksPanel.tsx -- MC and SENS-01 integration verified
- src/components/squad/DecisionSummaryTab.tsx -- NLP-01/NLP-02 prose block verified
- src/lib/types.ts -- MC fields on MergedPlayer, CalibrationBucket shapes verified
- node_modules/@anthropic-ai/sdk/lib/MessageStream.d.ts -- streaming API surface confirmed
- node_modules/recharts/types/index.d.ts -- ScatterChart, ComposedChart, ReferenceLine exports confirmed
- Anthropic Models Overview (platform.claude.com/docs/en/about-claude/models/overview) -- claude-haiku-4-5 alias and pricing, verified 2026-05-12

### Secondary (MEDIUM confidence)
- FPLOptimized Scenarios page (fploptimized.com/scenarios.html) -- competitor MC UI box plot approach, fetched 2026-05-12
- FPLPulse (fplpulse.com) -- 100k MC sims for mini-league rank predictions
- GitHub issue anthropics/anthropic-sdk-typescript#292 -- Edge Runtime SSE parsing failure
- Stable reliability diagrams, PMC 7923594 -- sparse-bin instability in calibration charts (peer reviewed)
- ICLR 2025 calibration post -- ECE bias with sparse bins (peer reviewed)

### Tertiary (LOW confidence)
- None -- all claims trace to verified sources at HIGH or MEDIUM confidence level.

---
*Research completed: 2026-05-12*
*Ready for roadmap: yes*
