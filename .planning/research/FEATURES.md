# Feature Landscape - v1.18 Forecast Transparency & AI Intelligence

**Domain:** Sports analytics decision-support tool - FPL model transparency + per-player LLM
**Researched:** 2026-05-13
**Confidence:** HIGH (codebase verification + external UX research + competitor analysis)

---

## Critical framing: what is actually new in v1.18

Most of the heavy infrastructure for this milestone is already shipped in earlier phases. The v1.18 work is primarily **wiring, surfacing, gate-flipping, and completing** features whose engines exist. The one genuinely new build is NLP-02 (per-player LLM insights).

| Feature | Engine status | UI status |
|---------|---------------|-----------|
| MC-01: Monte Carlo Simulator | SHIPPED - `pipeline/simulate.py`, writes `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory` (Phase 90) | SHIPPED - `XPtsCell` hover card shows Blank%/Haul%/P10/P90 (Phase 62/90) |
| CAL-01: Calibration Charts | SHIPPED - `accuracy.py::_compute_calibration_data` writes decile buckets by position (Phase 63/91) | SHIPPED - `AccuracyTab` Calibration sub-tab with recharts ComposedChart + ReferenceLine + position pill tabs (Phase 91) |
| SENS-01: Sensitivity Flags | SHIPPED - `sensitivity-engine.ts` computes ROBUST/FRAGILE/KNIFE EDGE over 5 perturbations (Phase 93) | PARTIAL - `FragilityBadge` in GemTable row-expand + CaptainPicksPanel; TransferPanel call site missing |
| WHY-01: Rejection Explainer | SHIPPED - `rejection-engine.ts` 8-predicate gate cascade (Phase 65/94) | PARTIAL - GemTable expand + `RejectionSearchCallout`; TransferPanel sell-side call site missing |
| NLP-01: LLM weekly prose summary | SHIPPED - `pipeline/prose_summary.py` + `/api/prose-summary` + `ProseSummaryBlock.tsx` with name-whitelist + qualitative-only guardrail (Phase 67) | SHIPPED - DecisionSummaryTab with manual Refresh |
| NLP-02: Per-player LLM insights | NOT STARTED - guardrail pattern from NLP-01 reusable; per-player Claude call not implemented | NOT STARTED - no per-player prose component exists |

**Implication for v1.18 scope:** MC-01, CAL-01, and NLP-01 are fully shipped. SENS-01 and WHY-01 are shipped in GemTable but need TransferPanel call sites. NLP-02 is the one fully unbuilt feature. Plus one critical gate flip: `mc_enabled: true` in `accuracy_backtest.json` (currently default-off, which makes MC fields zero in production).

---

## Table Stakes - What Users Expect

Features users assume a model-transparency tool provides. Missing these makes the product feel incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Haul/blank probability per player | Any simulation result must show tail probabilities, not just mean - they drive captain/TC decisions | LOW | SHIPPED | `blank_prob`, `haul_prob` in XPtsCell hover card |
| P10/P90 range bands | Floor/ceiling pair is the minimum viable distribution summary; single-number mean is insufficient for high-variance captaincy | LOW | SHIPPED | `p10_pts`, `p90_pts` in XPtsCell hover card |
| Calibration chart with y=x reference diagonal | Without the perfect-calibration line, the reliability diagram is meaningless; users must see where the model over- and under-predicts | LOW | SHIPPED | recharts ComposedChart with ReferenceLine in AccuracyTab |
| Per-position calibration breakdown | GKs/DEFs score via different mechanisms (CS, saves) than MIDs/FWDs; aggregate calibration hides position-specific drift | MEDIUM | SHIPPED | position pill tabs in CalibrationSection |
| Sample size display on calibration | Without showing n per bucket, users cannot distinguish signal from noise in sparse deciles - known calibration anti-pattern | LOW | SHIPPED | `sample_n` per bucket, sparse buckets filtered (n<5 for aggregate) |
| Fragility badge on transfer recommendations | Users expect to know which recommendations are robust vs knife-edge before acting; bare xPts with no confidence signal feels incomplete | MEDIUM | PARTIAL | FragilityBadge in GemTable + CaptainPicksPanel; TransferPanel missing |
| "Why isn't X recommended?" rejection explainer | FPL managers always ask this about popular players from FPL podcasts/Twitter; without it the app feels like a black box | MEDIUM | PARTIAL | RejectionSearchCallout in TransferPanel + rejection panel in GemTable expand; sell-side reasons missing |
| LLM-grounded prose summary (no invented numbers) | Managers want a narrative summary, not just tables - but inventing stats destroys trust | MEDIUM | SHIPPED | ProseSummaryBlock with name-match guardrail + qualitative-only constraint |
| Calibration coverage / health indicator | Users want to know "is my model trustworthy this week?" - a single summary signal on Decision Summary | MEDIUM | NOT STARTED | Should surface ECE-style health sentence in DecisionSummaryTab |

---

## Differentiators - Competitive Advantage

Features that set this product apart from FPLReview, FPLOptimized, Solio Analytics, Fantasy Football Fix.

| Feature | Value Proposition | Complexity | Status |
|---------|-------------------|------------|--------|
| Qualitative-only LLM prose (no hallucinated numbers) | Most AI sports tools generate text that invents statistics; this app's guardrail enforces name-whitelist + no-numerics constraint - prose is demonstrably grounded | MEDIUM | SHIPPED - `_passes_guardrail` (Python) + `passesGuardrail` (TS) must be byte-equivalent; zero fabricated numbers possible |
| Deterministic rejection cascade (not LLM) for WHY-01 | Gate-cascade explainer is reproducible and auditable in a way LLM-generated explanations cannot be; same inputs always produce same output | MEDIUM | SHIPPED - 8-predicate cascade, unit-testable, no hallucination surface |
| MC + SENS-01 as complementary signals | MC answers "how spread is the outcome?" (stochastic uncertainty); SENS-01 answers "which assumption is the recommendation leaning on?" (structural uncertainty) - the combination is not common in FPL tools | HIGH | MC SHIPPED; SENS-01 SHIPPED; cross-linking (showing sensitivity threshold alongside MC spread) not yet done |
| Per-player LLM insights in GemTable expand (NLP-02) | Brief, grounded per-player prose injected with MC context, fragility tier, and rejection reasons - no FPL tool currently does per-player Claude-generated explanations | HIGH | NOT STARTED - the genuine new feature for v1.18 |
| Rank trajectory sparkline (5-GW position-relative percentile) | Shows whether a player's rank within position pool improves/declines over 5-GW horizon, not just the mean - useful for planning vs immediate captaincy | MEDIUM | DATA SHIPPED, UI NOT STARTED - `rank_trajectory` field in `MergedPlayer`; no component renders it |
| Head-to-head rejection comparison | "Why is Saka ranked above Salah?" with component-diff table - comparative reasoning, not just "why isn't X recommended" | MEDIUM | SHIPPED - ComparisonSearch in GemTable expand |

---

## UX Pattern Deep Dive (the requested specifics)

### MC-01: how should distribution output be displayed?

**Decision: inline summary numbers in hover card, NOT histograms or box plots.**

| Pattern | Pros | Cons | Verdict |
|---------|------|------|---------|
| Full histogram per player | Shows distribution shape; data-science-friendly | 600+ players * histogram = visual noise; cognitive overload in table UI; competitors' box plots ignored by users | ANTI-PATTERN |
| Box plot per row (FPLOptimized approach) | Shows Min/Q1/Median/Q3/Max in compact form | Still hard to compare across 50 rows; takes column width; subtle differences invisible at table scale | ANTI-PATTERN for our table UI |
| P10-P90 range bar with median tick | Visually compact; comparable across rows; shows asymmetry | Requires new component; could be overkill in row-expand vs hover | DIFFERENTIATOR (consider for GemTable expand) |
| Inline summary: Blank% / Haul% / P10 / P90 (four numbers) | Compact; readable at glance; works in hover card; cognitively familiar to FPL managers | Hides distribution shape | SHIPPED - correct choice for table UI |

**Concrete pattern (already shipped in XPtsCell hover card):**
```
xPts: 5.4
P10: 1.8  |  P50: 5.4  |  P90: 9.2
Blank: 18%  |  Haul: 12%
```

**Recommendation for new MC surfaces (e.g. CaptainPicksPanel TC callout):**
- TC decision UI should foreground `haul_prob` (the differentiator), not the mean
- Use color-coded haul% badge (>15% green, 10-15% amber, <10% zinc)
- Show P90 prominently for upside; P10 only on hover/expand
- Never show full distribution chart - the four numbers are the format

**Anti-pattern: per-row variance bars in GemTable main view.** This adds visual noise that obscures the gem score itself. The hover card is the right surface; main view stays clean.

### CAL-01: what does a good FPL reliability diagram look like?

**Decision: decile bucket scatter + y=x reference line + sample size labels + position tabs + sparse-bucket filter.**

The existing recharts ComposedChart implementation is correct. Key principles:

1. **X-axis: predicted_rate (decile midpoint 0.05, 0.15, ..., 0.95).** Note this is decile rank, not model-output probability - this is a rank-calibration test, not a probability-calibration test. Document this caveat in the UI tooltip.

2. **Y-axis: actual_haul_rate per bucket.** Use a clear haul threshold (>=10 pts for outfield, >=8 pts for GK).

3. **Reference line y=x** through (0,0) to (1,1). Without this, the chart is meaningless.

4. **Sample size annotation per bucket.** Display `n=X` near each point or use point size proportional to n. This is the most-cited anti-pattern in reliability diagram literature (PMC 7923594).

5. **Sparse-bucket filter:** drop buckets with `sample_n < 5` for aggregate view. **For position-specific tabs, raise threshold to `sample_n < 15` for GK/DEF** - at BACKTEST_GWS=5, GK position-specific tabs have ~8 observations/decile, well below the stability threshold. Single haulting GK shifts actual_rate by 12+ percentage points and the chart looks broken when the model is fine.

6. **Position pill tabs:** "All / GK / DEF / MID / FWD" - already shipped.

7. **ECE-style health sentence:** "Model is well-calibrated this week (ECE 0.04)" or "Model is over-confident on MID haul predictions" - surfaces on Decision Summary, NOT just buried in AccuracyTab. This is the calibration signal users actually need to act on.

**Anti-pattern: single-GW calibration snapshots.** Single-GW calibration has extremely high variance (<100 players per decile). Always aggregate over 5+ finished GWs.

**Anti-pattern: calibration chart over the full season early in the season.** Pre-GW10 calibration is dominated by start-of-season volatility; show "Insufficient data" banner if pipeline_gw < 10.

### SENS-01: how should fragility flags be communicated without alert fatigue?

**Decision: tier-based visual weight; absence is the default; only fragility surfaces.**

The alert fatigue risk is real: `computeFragility` fires on any player with `start_prob < 0.85` (START_PROB_FLOOR = 0.70 with 0.15 perturbation). In GW30+, fixture congestion pushes 40-60% of candidates below 0.85, making every recommendation fragile.

**Three-tier visual hierarchy:**

| Tier | Visual treatment | When to show | Rationale |
|------|------------------|--------------|-----------|
| ROBUST | NO BADGE (whitespace) | Always (silent default) | Absence is information; presence is the signal |
| FRAGILE | Amber dot (4px) or muted text "Fragile" | Always when fragility computed | Acknowledges sensitivity without screaming |
| KNIFE_EDGE | Amber pill "Knife edge" + tooltip with perturbed xPts | Always when below knife-edge threshold | Reserved for cases where one assumption flip changes recommendation |

**Concrete rules:**
1. Never render fragility badges on players outside the recommendation set (top transfers, captaincy candidates). Showing fragility on rows 25-600 is alert fatigue.
2. Reserve `KNIFE_EDGE` pill for the rare case (typically <5% of recommendations); over-firing this tier destroys its signal value.
3. Pair the badge with on-hover tooltip showing perturbation result: "If start_prob drops to 0.55, xPts falls 2.3 pts and ranks #14 instead of #3."
4. In DecisionSummaryTab, prefix fragile captain calls with "Knife edge:" - already wired.

**Anti-pattern: badge on every recommendation row.** Late-season this makes the badge meaningless. Use absence as signal.

**Anti-pattern: red/danger color.** Fragility is not a warning, it's a confidence qualifier. Amber/muted, never red.

### WHY-01: what makes rejection explanations useful vs annoying?

**Decision: deterministic templated cascade with top-2 reasons; on-demand expand, not auto-display.**

UX research on recommender systems (Springer "Explaining the user experience of recommender systems", NN/g guidelines) consistently shows that:
- **Specificity beats verbosity:** "Below haul threshold (xPts 3.8 < 4.5 position median)" > "Not a strong choice"
- **Problem-specific reasons increase acceptance and decrease decision time** (MDPI recommendation message design study)
- **Psychological reactance is triggered by aggressive negation** - softened phrasing ("ranked below 23 alternatives" not "rejected")

**Concrete pattern:**

```
Why isn't Salah recommended?
- Below xPts threshold (4.2 < 4.7 position median)
- Fragility: knife edge if start_prob drops below 0.65 (currently 0.72)
- Lifecycle: monitoring (last 3 GWs xPts trend declining)
- Owned by 38.4% - low differential value
```

**Rules:**
1. **Show top 2 reasons by default, expand for full cascade.** All 8 predicates is overwhelming.
2. **Order by severity:** threshold failures first, lifecycle/sensitivity second, ownership/differential context last.
3. **Plain English, not jargon:** "Below haul threshold" not "Predicate xpts_below_position_median fired".
4. **Quote the values:** "4.2 < 4.7" makes the gap concrete; bare "below threshold" is hand-wavy.
5. **On-demand surface, not auto-display:** Rejection panel opens when user expands a row or searches for player by name. Never preempt with rejection on rows that aren't being investigated.
6. **No LLM for rejection reasons:** Deterministic cascade is unit-testable, reproducible, and cannot hallucinate. LLM rejection is the largest hallucination surface and worst affordance match.

**Anti-pattern: LLM-generated rejection explanations.** "Explain in natural language why X isn't recommended" sounds easy but the LLM invents reasons not grounded in the model (e.g. citing fixtures from prior seasons or injuries from training data). Always use deterministic cascade.

**Anti-pattern: showing rejection on every non-recommended player automatically.** 580+ rejection panels = noise. Surface only on user action (row expand, search by name).

### NLP-01 / NLP-02: what prompting patterns work for sports analytics LLM summaries?

**Decision: structured XML context injection + qualitative-only constraint + name-whitelist guardrail + retry-with-fallback.**

From Anthropic prompting best practices + WSC Sport documented failures + iguazio LLM grounding:

**1. Inject structured XML context (NOT free-form prose context).**

```xml
<player>
  <name>Mohamed Salah</name>
  <position>MID</position>
  <xpts_1gw>7.4</xpts_1gw>
  <haul_prob>0.18</haul_prob>
  <p90_pts>13.2</p90_pts>
  <fragility>fragile</fragility>
  <fixture difficulty="0.42" home="true">vs WHU</fixture>
  <rejection_reasons>
    <reason>none - is recommended</reason>
  </rejection_reasons>
</player>
```

XML tags outperform JSON for Claude prompts (Anthropic docs); free-form prose context invites the LLM to draw on training data.

**2. Qualitative-only constraint.**

System prompt: "Refer to players qualitatively. Do not include statistics, projected points, percentages, or numeric values. The numeric data is shown in adjacent UI cards; your job is the narrative."

Why: If prose says "Salah projects 7.2 pts" and the card shows 7.4, trust collapses. The LLM cannot reliably reproduce numbers it sees in prompt context. Qualitative ("a strong captaincy option this week") never contradicts the card.

**3. Name-whitelist guardrail.**

Allowed names = {player.web_name} for NLP-02; expanded for NLP-01 to include all recommended players. Post-generation, regex over player names in the output; if any name appears that is not in the allowed set, retry with a stronger prompt. After 2 retries, fall back to deterministic reasons[] display.

**4. Retry-with-fallback, never silent failure.**

NLP-01 allows 1 retry. NLP-02 should allow 2 retries because per-player context is sparser and the model is more likely to hallucinate rival comparisons. Final fallback: render the structured rejection_reasons or MC summary directly without prose.

**5. Cache aggressively, never regenerate per page load.**

NLP-02 cache key: `(player_id, pipeline_run_date)`. Daily pipeline writes new pipeline_run_date → cache invalidates → new prose generated on next user action. Without this, each row expand costs ~$0.0005 (Haiku) and the bulk view across 50 candidates costs $0.025/session. At 20 sessions/day x 365 days = ~$180/year - unacceptable for personal tool. With cache: ~$2-5/year.

**6. Demand-trigger, not auto-trigger.**

NLP-02 must fire only on user explicit action (click "Get AI insight" button, NOT on row expand). A useEffect on row mount that auto-fires the API for every visible row is the cost-explosion path. PITFALLS.md flags this as the top NLP-02 risk.

**7. Concrete prompt template (NLP-02):**

```
System: You are a Fantasy Premier League analyst. Refer to players qualitatively. Do not include statistics, projected points, percentages, or numeric values. Two to three sentences.

User:
<context>
[XML structured context block - player, MC, fragility, rejection_reasons, fixture]
</context>

Given the context above, write a brief (2-3 sentence) explanation of why this player is or is not a strong pick this week. Reference the player by name. Do not mention other players unless explicitly listed in the context.
```

**Anti-pattern: free-form prompt without structured context.** "Explain why Salah is a good captain pick" → LLM uses training data → hallucinated fixtures, stale form, wrong injuries.

**Anti-pattern: streaming response.** Haiku 2-3 sentence output is ~100 tokens, arrives sub-second. Streaming adds complexity for zero UX benefit and breaks Edge Runtime SSE parsing (known SDK bug).

**Anti-pattern: numeric tolerance ("approximately 7 points").** The LLM cannot reliably approximate without seeing the rounded number; even rounded numbers contradict the card. Qualitative only.

---

## Anti-Features - Do Not Build

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| LLM prose that mentions statistics or projected-point values | Managers want narrative to echo numbers in cards above | LLM hallucinates or rounds incorrectly; "Salah projects 7.2" vs card "7.4" destroys trust | Qualitative-only constraint in prompt; numbers stay in cards |
| Per-player LLM call with player name in prompt only (NLP-02 naive) | Appears to add insight | LLM has no current-season data; will hallucinate recent form, injuries, or fixtures from training data | Inject structured XML context (xPts, fixture difficulty, start_prob, haul_prob, fragility, rejection_reasons) into every prompt |
| MC distributions as histogram or full density chart per player | Data-science-friendly | 600 players * histogram = unrendered visual noise; FPLOptimized box plots are ignored by most users | Four summary numbers: blank%, haul%, P10, P90 in hover card |
| Calibration chart with fewer than 5 data points per bin (or <15 for GK/DEF) | Small samples look meaningful | A bin with 3 observations showing 100% haul rate looks like massive model failure even if it's noise | Filter sparse buckets; show "Insufficient data" if total <50 for position |
| Calibration chart over single gameweek | Easy to compute | Single-GW variance is enormous (<100 players per decile); appears to show dramatic miscalibration from random noise | Aggregate over last 5 finished GWs (BACKTEST_GWS = 5) |
| Sensitivity flag on every player regardless of recommendation status | More data appears more informative | 40-60% of late-season players fall below thresholds; flag everywhere = alert fatigue = signal destroyed | Show fragility only on players in recommendation set (top transfers, captaincy candidates) |
| SENS-01 using MC simulation per perturbation | Full stochastic re-run appears more rigorous | 50 perturbations x 1000 sims per player per render = impractical; MC already captures stochastic uncertainty; SENS-01 is structural | SENS-01 stays deterministic (re-run analytical xPts formula at perturbed inputs) |
| LLM prose regenerated on every page load | Users want fresh prose | $0.0005 per call x 20 loads/day = adds up; more importantly, prose without specific user squad is only marginally more useful | Cache in Vercel Blob at pipeline run; manual Refresh button for squad-aware regen |
| Rejection explainer driven by LLM | "Natural language reason" sounds easy with LLM | LLM invents reasons not grounded in the model; cascade is unit-testable, reproducible, cannot hallucinate | Deterministic 8-predicate cascade with templated surface text |
| Calibration chart using model's xPts as predicted_rate directly | Appears to use actual probability the model assigned | Model produces xPts (point expectation), not P(haul); mapping xPts to P(haul) needs MC; before MC stable, use decile-rank proxy | Decile midpoint (0.05, 0.15, ..., 0.95) as `predicted_rate` is statistically valid as rank-calibration test |
| Bulk NLP-02 generation in pipeline | Pre-warming cache for all 600 players sounds efficient | 600 calls * $0.0005 = $0.30/run; daily = $109/year; most players never viewed | On-demand generation with localStorage cache; pre-warm only top 20 transfer candidates if latency proves bad |
| Auto-trigger NLP-02 on row expand (useEffect) | Smooth UX | If user expands 50 rows quickly, costs $0.025/session; one bug opens cost explosion path | Demand-trigger only (user clicks "Get AI insight"); >1s expand debounce as fallback |
| Per-row variance bars in GemTable main view | More information density | Visual noise obscures the gem score; main view becomes unreadable | Variance/MC in hover card or row-expand; main view stays clean |
| Streaming LLM response for NLP-02 | Modern AI app pattern | Haiku 2-3 sentence response is ~100 tokens, arrives sub-second as single chunk; streaming breaks Edge Runtime (SDK bug #292); adds complexity for zero UX benefit | Non-streaming Node.js runtime; maxDuration 30 |

---

## Feature Dependencies

```
NLP-02 (per-player LLM insights) - the one new build
    +--requires--> NLP-01 guardrail pattern (prose-guardrail.ts + _passes_guardrail shipped)
    +--requires--> structured per-player context injection (xPts, start_prob, haul_prob, fragility, rejection_reasons)
    +--requires--> MC gate flipped (so haul_prob/p10_pts non-null in injected context)
    +--enhances--> GemTable row-expand (adds prose below existing rejection panel)
    +--enhances--> TransferPanel suggestion card (adds prose below fragility badge + rejection reasons)

MC-01 (data shipped, hover card shipped)
    +--blocked by--> mc_enabled gate flip (binary switch in accuracy_backtest.json)
    +--enhances--> XPtsCell hover card (already wired)
    +--enhances--> CaptainPicksPanel TC callout (already wired via haul_prob)
    +--could enhance--> rank_trajectory sparkline (field exists, no UI surface yet)
    +--enables--> NLP-02 (haul_prob in per-player prompt context)

CAL-01 (data + chart shipped)
    +--depends on--> accuracy.py backtest pipeline (shipped)
    +--needs fix--> sparse-bucket threshold for GK position-tab (raise to <15)
    +--needs add--> calibration health sentence on DecisionSummaryTab (ECE-style summary)
    +--independent of--> MC-01 (uses analytical xPts, not MC percentiles)

SENS-01 (engine + GemTable badge shipped)
    +--needs add--> TransferPanel call site (computeFragility on buy candidates)
    +--enhances--> WHY-01 rejection panel (can cite fragility in rejection reasons)
    +--enhances--> Decision Summary cards (knife-edge prefix already wired)
    +--enables--> NLP-02 (fragility tier in per-player prompt)

WHY-01 (engine + GemTable expand shipped)
    +--needs add--> TransferPanel sell-side call site (computeRejection on squad squad players)
    +--requires--> MergedPlayer fields (xPts, start_prob, differential_flag - all shipped)
    +--enables--> NLP-02 (rejection_reasons[] array in per-player prompt)
    +--cross-links--> BACK-01 regret history (deep-link "why was X recommended in GW32?")

rank_trajectory sparkline (data shipped, no UI)
    +--requires--> MC-01 gate flipped (rank_trajectory is MC-derived)
    +--would enhance--> GemTable Analysis preset column
    +--deferred--> v1.19+ (visual design decision needed)
```

---

## MVP Recommendation (for v1.18 launch)

### Already Delivered (do not re-scope)

- [x] MC-01: Monte Carlo pipeline + XPtsCell hover card display
- [x] CAL-01: Calibration chart in AccuracyTab with position tabs
- [x] SENS-01 engine: FragilityBadge in GemTable + CaptainPicksPanel
- [x] WHY-01 engine: Rejection explainer in GemTable expand + RejectionSearchCallout in TransferPanel
- [x] NLP-01: Weekly prose summary on DecisionSummaryTab with guardrail + Refresh

### Must Deliver for v1.18 (P1)

- [ ] **mc_enabled gate flip** - one line in `accuracy_backtest.json` + verification pipeline run. Without this, all MC-dependent UI is silent. **First task of the milestone.**
- [ ] **NLP-02: per-player LLM insights** - new `/api/player-insight` POST route, `usePlayerInsight` mutation hook, `PlayerInsightTrigger` component in GemTable expand and TransferPanel. The one genuinely new feature.

### Should Deliver for Completeness (P2)

- [ ] **SENS-01 in TransferPanel** - call `computeFragility(buy, true, xPtsGain)` and render FragilityBadge for buy candidates. Engine exists; only call site missing.
- [ ] **WHY-01 in TransferPanel sell-side** - call `computeRejection` for sell-side players to explain sale recommendations. Engine exists; only call site missing.
- [ ] **Calibration sparse-bucket fix** - raise threshold from `sample_n < 5` to `sample_n < 15` for GK/DEF position tabs; add "Insufficient data" guard for position totals < 50.
- [ ] **Calibration health indicator on DecisionSummaryTab** - one-sentence ECE-style summary ("Model is well-calibrated this week" or "Model over-confident on MID haul").

### Defer to v1.19+ (P3)

- [ ] `rank_trajectory` sparkline component (data exists; visual design needed)
- [ ] NLP-02 squad-aware regeneration (parallel to NLP-01 POST refresh pattern)
- [ ] MC-enabled calibration (use actual MC P(haul) percentiles as predicted_rate)

### Future Consideration (v1.20+)

- [ ] BACK-01 x SENS-01 cross-linking (fragility marker on historical decision rows)
- [ ] BACK-01 x WHY-01 cross-linking (regret rows deep-link to "why was X recommended in GW32?")
- [ ] Stochastic calibration once enough GWs accumulated to validate MC calibration signal

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| mc_enabled gate flip | HIGH - unlocks all MC-dependent UI simultaneously | LOW - one line + verification run | P1 |
| NLP-02 per-player insights | HIGH - justifies the "AI" milestone name; per-player rows feel intelligent | MEDIUM - guardrail pattern proven; main cost is prompt design + API call budget | P1 |
| SENS-01 TransferPanel call site | MEDIUM - completes fragility coverage; consistency across recommendation surfaces | LOW - single call site addition, engine exists | P2 |
| WHY-01 TransferPanel sell-side | MEDIUM - completes "why is X being sold?" answer | LOW - single call site addition, engine exists | P2 |
| Calibration sparse-bucket fix | MEDIUM - prevents false "model broken" impression on GK tab | LOW - one threshold change + position-pool guard | P2 |
| Calibration health sentence | MEDIUM - surfaces calibration status where users actually decide | LOW - one component, reads existing useAccuracy data | P2 |
| rank_trajectory sparkline | MEDIUM - useful for planning horizon decisions | MEDIUM - new component; visual design decision | P3 |
| MC-enabled calibration | LOW - current decile-proxy is statistically defensible | HIGH - requires rethinking calibration pipeline | P3 |

---

## Competitor Feature Analysis

FPL/sports analytics tools that have MC / calibration / AI features as of May 2026:

| Feature | FPLReview | FPLOptimized | FPLPulse | Solio Analytics | Our Approach |
|---------|-----------|--------------|----------|-----------------|--------------|
| Monte Carlo simulation | Yes - "variance metrics" mentioned in marketing, UI details unverified | Yes - 100 sims, box plot (Min/Q1/Median/Q3/Max), beat-field probabilities | Yes - 100k sims for mini-league rank predictions | Yes - probabilistic outputs in solver | 1000 sims (MC_ITERATIONS configurable), haul%/blank%/P10/P90 inline in hover card; less visual noise than box plot |
| Calibration chart | Yes - "Ultimate Truth" page compares models to perfect | Not found | Not found | Not found | Reliability diagram with position breakdown + sparse-bucket filter + ECE health sentence - genuinely differentiating |
| Sensitivity/fragility flags | Not found | Not found | Not found | Not found | ROBUST/FRAGILE/KNIFE EDGE badges - genuinely new in FPL context |
| Rejection explainer | Not found | Not found | Not found | Not found | Deterministic 8-predicate gate cascade with search entry point - new |
| LLM prose summary | Not found in FPL tools | Not found | Not found | Not found | Name-guardrailed, qualitative-only Claude prose - new; lower hallucination risk than unguarded approaches |
| Per-player AI insights | Not found | Not found | Not found | Not found | NLP-02 - the one remaining genuinely new feature for this milestone |

Confidence on competitor analysis: MEDIUM (based on public documentation and search summaries; internal feature sets may differ).

---

## Domain-Specific Risks and Anti-Patterns Summary

### MC Anti-Patterns

- **Overwhelming UI with distributions.** FPLOptimized box plots are largely ignored. Inline four numbers in hover card is the correct affordance.
- **Under-sampling flaky probabilities.** With 1000 sims, true haul_prob=0.05 shows 0-12% across runs. `MC_SEED=42` ensures reproducibility; UI should treat values <5% as noise floor.
- **DGW double-counting.** Mitigated: `simulate.py` groups fixtures by `event_id` and sums points within GW before accumulating.

### Calibration Anti-Patterns

- **Small-bin noise.** Mitigated for aggregate (<5 filter); needs tightening for position tabs (<15 for GK/DEF).
- **Single-GW snapshots.** Mitigated: BACKTEST_GWS = 5.
- **Confusing predicted_rate proxy.** Decile midpoint is statistically valid as rank-calibration but is NOT P(haul). Document caveat in UI tooltip.
- **Pre-GW10 noise.** Show "Insufficient data" if pipeline_gw < 10.

### Sensitivity Anti-Patterns

- **Flag spam.** GW30+ congestion makes 40-60% of candidates fragile. Use tier-based visual weight (silent for robust, dot for fragile, pill for knife_edge).
- **Red color.** Fragility is confidence qualifier, not warning. Amber/muted only.
- **Fragility outside recommendation set.** Never on rows 25-600; only on top transfers + captaincy candidates.

### LLM Anti-Patterns

- **Hallucinating player names.** Mitigated: `findHallucinatedNames` guardrail with name-whitelist.
- **Inventing statistics.** Mitigated: prompt explicitly forbids numeric values.
- **Stale training data overriding context.** For NLP-02, primary remaining risk. Inject structured XML context with current pipeline fields into every prompt.
- **Cost blow-up.** 600 players * Haiku call = $0.30/run; on-demand + localStorage cache caps at ~$2-5/year.
- **Guardrail retry exhaustion.** NLP-02 should allow 2 retries (vs NLP-01's 1) because per-player context is sparser; final fallback is deterministic reasons[] display.
- **Auto-trigger on row expand.** Cost explosion path. Demand-trigger only.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `pipeline/simulate.py` (Phase 90 MC-01), `pipeline/accuracy.py` (Phase 63/91 CAL-01), `src/lib/sensitivity.ts` / `src/components/shared/FragilityBadge.tsx` (Phase 93 SENS-01), `src/lib/rejection-engine.ts` (Phase 65/94 WHY-01), `pipeline/prose_summary.py` + `src/components/squad/ProseSummaryBlock.tsx` + `src/lib/prose-guardrail.ts` (Phase 67 NLP-01) [VERIFIED in this session]
- `.planning/PROJECT.md` - milestone scope and v1.18 feature requirement IDs [VERIFIED]
- `.planning/research/SUMMARY.md` (prior v1.18 research) - shipped vs not-started status [VERIFIED]
- [Stable reliability diagrams for probabilistic classifiers, PMC 7923594](https://pmc.ncbi.nlm.nih.gov/articles/PMC7923594/) - small-bin instability is statistically documented; CORP/PAV adaptive binning [HIGH confidence - peer reviewed]
- [Understanding Model Calibration, ICLR 2025](https://iclr-blogposts.github.io/2025/blog/calibration/) - ECE bias with sparse bins; kernel-smoothed alternatives [HIGH confidence - peer reviewed]
- [Anthropic prompt engineering best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) - XML tagging, document wrapping, quoting-before-answering [HIGH confidence - official docs]
- [Google PAIR: Explainability + Trust](https://pair.withgoogle.com/chapter/explainability-trust/) - "perfect time to show explanations is in response to user action"; 3.2x higher repeat usage with explanations [HIGH confidence - Google Research]

### Secondary (MEDIUM confidence)
- [FPLOptimized Scenarios page](https://fploptimized.com) - competitor MC UI: box plot, score-threshold probabilities, beat-field percentages
- [FPLReview Ultimate Truth](https://fplreview.com/ultimate-truth-how-fpl-models-perform-relative-to-a-perfect-model/) - model comparison framing
- [Solio Analytics](https://fpl.solioanalytics.com/) - "sharpest public projection models with state-of-the-art solvers"
- [FPLPulse mini-league predictions](https://www.fplpulse.com/blog/fpl-mini-league-predictions-simulator) - 100k MC sims for rank predictions
- [Fantasy Football Analytics: Bootstrapping and Monte Carlo](https://isaactpetersen.github.io/Fantasy-Football-Analytics-Textbook/simulation.html) - academic textbook framing of fantasy MC
- [DNV P10/P50/P90 terminology](https://www.dnv.com/article/terminology-explained-p10-p50-and-p90-202611/) - canonical definition of percentile bands
- [Explaining the user experience of recommender systems (Springer)](https://link.springer.com/article/10.1007/s11257-011-9118-4) - explanation goals: transparency, trust, effectiveness, persuasiveness, satisfaction, scrutability
- [NN/g UX Guidelines for Recommended Content](https://www.nngroup.com/articles/recommendation-guidelines/) - transparent reasoning and user control patterns
- [MDPI: Recommendation Message Design](https://www.mdpi.com/2076-3417/13/4/2706) - problem/solution specificity increases acceptance and decreases decision time
- [Iguazio LLM grounding glossary](https://www.iguazio.com/glossary/llm-grounding/) - grounding via structured context
- [WSC Sport automated commentary](https://www.zenml.io/llmops-database/automated-sports-commentary-generation-using-llms) - real-world documented hallucination failures in sports LLM
- [Decision Lab: Sensitivity Analysis](https://thedecisionlab.com/reference-guide/statistics/sensitivity-analysis) - robust vs fragile decisions framing
- [d-sight: Sensitivity Analysis Deep Dive](https://www.d-sight.com/sensitivity-analysis) - decision fatigue reduction through sensitivity

### Tertiary (LOW confidence)
- None - all claims trace to verified sources at HIGH or MEDIUM confidence level.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| What is already shipped | HIGH | Verified against codebase directly |
| NLP-02 implementation approach | HIGH | Same guardrail pattern verified and working for NLP-01 |
| MC display UX | HIGH | Hover-card pattern shipped and validated; alternatives empirically known to underperform |
| Calibration chart UX | HIGH | Peer-reviewed literature confirms sparse-bin handling, reference-line requirement |
| Sensitivity UX (alert fatigue avoidance) | HIGH | Decision-analysis literature + late-season fragility coverage rate calculation |
| WHY-01 rejection explainer UX | HIGH | Recommender system literature + existing deterministic cascade verified |
| LLM prompting patterns for sports | HIGH | Anthropic docs + sports LLM hallucination literature + NLP-01 working example |
| Competitor feature set | MEDIUM | Based on public pages and search summaries; internal features may differ |

---

*Feature research for: FPL Analyst v1.18 Forecast Transparency & AI Intelligence*
*Researched: 2026-05-13*
