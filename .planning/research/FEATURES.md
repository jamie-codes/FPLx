# Feature Landscape — v1.18 Forecast Transparency & AI Intelligence

**Domain:** Sports analytics tool — FPL decision support with model transparency and AI prose
**Researched:** 2026-05-12
**Confidence:** HIGH (grounded in codebase inspection + external research)

---

## Critical framing: what is actually new in v1.18

Most of the heavy infrastructure for this milestone is already shipped in earlier phases.
The v1.18 work is primarily **wiring, surfacing, and completing** features whose engines exist.

| Feature | Pipeline / engine status | UI status |
|---------|-------------------------|-----------|
| MC-01: Monte Carlo Simulator | SHIPPED — `pipeline/simulate.py` runs 1000 sims/player, writes `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory` (Phase 90) | SHIPPED — `XPtsCell` hover card shows Blank%/Haul%/P10/P90 (Phase 62/90) |
| CAL-01: Calibration Charts | SHIPPED — `accuracy.py::_compute_calibration_data` writes decile buckets by position (Phase 63/91) | SHIPPED — `AccuracyTab` Calibration sub-tab with recharts scatter plot + position selector (Phase 91) |
| SENS-01: Sensitivity Flags | SHIPPED — `sensitivity-engine.ts` computes ROBUST/FRAGILE/KNIFE EDGE over 5 perturbations (Phase 93) | SHIPPED — `FragilityBadge` in GemTable row-expand and TransferPanel cards |
| WHY-01: Rejection Explainer | SHIPPED — `rejection-engine.ts` gate cascade (Phase 65/94) | SHIPPED — GemTable expand shows rejection panel; `RejectionSearchCallout` in TransferPanel (Phase 94) |
| NLP-01: LLM prose summary on Decision Summary | SHIPPED — `pipeline/prose_summary.py` + `/api/prose-summary` GET + `ProseSummaryBlock.tsx` (Phase 67) | SHIPPED — visible in DecisionSummaryTab with manual Refresh |
| NLP-02: Per-player LLM insights in GemTable / TransferPanel | PARTIAL — prose guardrail and weekly global summary shipped; per-player Claude call not implemented | NOT STARTED — no per-player prose component exists |

**Implication for v1.18 scope:** MC-01, CAL-01, SENS-01, WHY-01, and NLP-01 are shipped.
The milestone has one genuine remaining feature: **NLP-02 per-player LLM insights**.
Everything else is integration polish (column visibility tuning, MC enabling the `mc_enabled` gate,
UX refinements) rather than net-new feature delivery.

---

## Table Stakes — What Users Expect

Features users assume a model-transparency tool provides. Missing these makes the product feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Haul/blank probability per player | Any simulation result must show the tail probabilities that drive decisions, not just the mean | LOW | SHIPPED — `blank_prob`, `haul_prob` in XPtsCell hover card |
| P10/P90 range bands | Range bands (floor/ceiling) are the minimum viable distribution summary; single-number mean is insufficient for high-variance captain decisions | LOW | SHIPPED — `p10_pts`, `p90_pts` in XPtsCell hover card |
| Calibration chart with perfect-calibration reference line | Without the y=x reference diagonal, the reliability diagram is meaningless; users must see where the model over- and under-predicts | LOW | SHIPPED — recharts ComposedChart with ReferenceLine in AccuracyTab Calibration sub-tab |
| Per-position calibration breakdown | GKs and DEFs score via different mechanisms (CS, saves) than MIDs and FWDs; aggregate calibration hides position-specific drift | MEDIUM | SHIPPED — position pill tabs in CalibrationSection |
| Fragility badge on transfer recommendations | Users expect to know which recommendations are robust vs knife-edge before acting; a bare xPts number with no confidence signal is incomplete | MEDIUM | SHIPPED — FragilityBadge in TransferPanel suggestion cards and GemTable expand |
| "Why isn't X recommended?" explainer | FPL managers always ask this about popular players they've read about; without it the app feels like a black box | MEDIUM | SHIPPED — RejectionSearchCallout in TransferPanel + rejection panel in GemTable expand |
| LLM-grounded prose summary (no invented numbers) | Managers want a narrative summary, not just tables; but if it invents stats the trust collapses immediately | MEDIUM | SHIPPED — ProseSummaryBlock with name-match guardrail, qualitative-only prose constraint |
| Sample size display on calibration | Without showing n per bucket, users cannot distinguish signal from noise in sparse deciles; this is a known calibration diagram anti-pattern | LOW | SHIPPED — `sample_n` displayed per bucket, sparse buckets filtered (n<5) |

---

## Differentiators — Competitive Advantage

Features that set this product apart from FPL tools like FPLReview, FPLOptimized, or FPLPulse.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Qualitative-only LLM prose (no hallucinated numbers) | Most AI sports tools generate text that invents statistics; this app's guardrail enforces name-whitelist + no-numerics constraint — the prose is demonstrably grounded | MEDIUM | SHIPPED — `_passes_guardrail` in Python + `passesGuardrail` in TS must be byte-equivalent; enforces zero fabricated numbers |
| Deterministic rejection cascade (not LLM) for WHY-01 | Gate-cascade explainer is reproducible and auditable in a way that LLM-generated explanations are not; same inputs always produce same output | MEDIUM | SHIPPED — deterministic `computeRejection` over 6+ typed predicates |
| MC + SENS-01 as complementary signals | Stochastic distribution (MC) answers "how spread is the outcome?" and deterministic sensitivity (SENS-01) answers "which assumption is the recommendation leaning on?" — the combination is not common in FPL tools | HIGH | MC SHIPPED; SENS-01 SHIPPED; cross-linking (showing sensitivity threshold alongside MC spread) not yet done |
| Per-player LLM insights in GemTable expand (NLP-02) | Brief, grounded per-player prose in the row expand makes the data feel human-readable; no FPL tool currently does per-player Claude-generated explanations | HIGH | NOT STARTED — the genuine new feature for v1.18 |
| Rank trajectory sparkline (5-GW position-relative percentile) | Shows whether a player's rank within their position pool improves or declines over the 5-GW horizon, not just the mean — useful for planning vs immediate captaincy | MEDIUM | SHIPPED — `rank_trajectory` field in `MergedPlayer`; no UI surface yet for this field |
| Head-to-head rejection comparison (WHY-01-B) | "Why is Saka ranked above Salah?" with component-diff table — not just "why isn't X recommended" but comparative reasoning | MEDIUM | SHIPPED — ComparisonSearch in GemTable expand row |

---

## Anti-Features — Do Not Build

Features that seem appealing but create specific, predictable problems for this app.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| LLM prose that mentions statistics or projected-point values | Managers want the narrative to echo the numbers they see in the cards above | LLM will hallucinate or round incorrectly; if prose says "Salah projects 7.2 pts" and the card says 7.4, trust collapses; the guardrail enforces qualitative-only for this reason | Prose references players qualitatively ("a strong captaincy option this week"); cards above carry the numbers |
| Per-player LLM call with player name in prompt only (NLP-02 naive approach) | Appears to add insight | LLM has no current-season data; will hallucinate recent form, injuries, or fixtures from training data rather than current pipeline output | NLP-02 must inject structured context (xPts, fixture difficulty, start_prob, haul_prob) into every per-player prompt — same guardrail pattern as NLP-01 |
| MC distributions as a histogram or full density chart per player | Users familiar with data science expect the full distribution shape | 600 players × histogram = unrendered visual noise; cognitive overload in a table UI; the FPLOptimized tool surfaces box plots and most users ignore them | Summarise distribution with four numbers: blank%, haul%, P10, P90 — already shipped in XPtsCell hover card |
| Calibration chart with fewer than 5 data points per bin | Small samples look meaningful but are statistical noise | A bin with 3 observations showing 100% haul rate looks like a massive model failure even if it's noise; this is the primary calibration anti-pattern | Filter bins with sample_n < 5 (already shipped in `_compute_calibration_data`) |
| Calibration chart over a single gameweek | Single-GW calibration has extremely high variance (typically < 100 players per decile) | Appears to show dramatic miscalibration from random variance; results are not reproducible GW to GW | Aggregate over last 5 finished GWs (BACKTEST_GWS = 5) — already the approach |
| Sensitivity analysis for every player regardless of recommendation status | More data appears more informative | Computing ROBUST/FRAGILE/KNIFE EDGE for 600 players * 50 perturbations each is 30k xPts evaluations per render; even though cheap, rendering 600 fragility badges in the table at once is visual noise that obscures the useful signal | Compute and show fragility only for players that survived initial recommendation threshold |
| SENS-01 using MC simulation per perturbation | Full stochastic re-run for each of 50 perturbation scenarios appears more rigorous | 50 × 1000 sims per player per render cycle is impractical client-side; MC already captures stochastic uncertainty; SENS-01 is about structural sensitivity, not stochastic variation | SENS-01 stays deterministic (re-run analytical xPts formula at perturbed inputs) — already the design |
| LLM prose regenerated on every page load | Users want fresh prose | Each generation costs ~$0.0005 (Haiku pricing) and introduces latency; at 20 loads/day this adds up; more importantly, prose generated without a specific user squad is only marginally more useful than pipeline-generated prose | Cache prose in Vercel Blob at pipeline run time; expose manual Refresh button for squad-aware regeneration — already shipped |
| Rejection explainer driven by LLM | "Explain in natural language why X isn't recommended" sounds easy to implement with an LLM | LLM will invent reasons not grounded in the model; deterministic gate cascade is reproducible, unit-testable, and cannot hallucinate | Deterministic cascade with templated surface text — already shipped |
| Calibration chart that uses predicted_rate as the *model-computed* probability of haul | Appears to use the actual probability the model assigned | The model produces xPts (a point expectation), not a direct probability of haul; mapping xPts to P(haul) requires the MC simulation; without MC this requires decile-rank as a proxy | Use decile rank as predicted_rate proxy (already the approach: `predicted_rate == bucket_mid`) |

---

## Feature Dependencies

```
NLP-02 (per-player LLM insights)
    └──requires──> NLP-01 guardrail pattern (prose-guardrail.ts + _passes_guardrail already shipped)
    └──requires──> structured per-player context injection (xPts, start_prob, haul_prob, fixture)
    └──enhances──> GemTable row-expand (adds prose below existing rejection panel)
    └──enhances──> TransferPanel suggestion card (adds prose below existing fragility badge)

MC-01 (data already in MergedPlayer)
    └──enhances──> XPtsCell hover card (already wired)
    └──enhances──> CaptainPicksPanel TC callout (already wired via haul_prob)
    └──could enhance──> rank_trajectory sparkline (field exists, no UI surface yet)
    └──could enhance──> NLP-02 (haul_prob injected into per-player prompt context)

CAL-01 (data + chart already shipped)
    └──depends on──> accuracy.py backtest pipeline (shipped)
    └──independent of──> MC-01 (uses analytical xPts, not MC percentiles)

SENS-01 (engine + badges already shipped)
    └──enhances──> WHY-01 rejection panel (can cite fragility in rejection reasons)
    └──enhances──> Decision Summary cards (fragile-call prefix already wired)
    └──cross-links──> BACK-01 regret history (fragile marker on past decisions)

WHY-01 (engine + UI already shipped)
    └──requires──> MergedPlayer fields (xPts, start_prob, differential_flag — all shipped)
    └──enhances──> SENS-01 (rejection reasons can include sensitivity threshold)
    └──cross-links──> BACK-01 (regret rows deep-link to "why was X recommended in GW32?")

rank_trajectory sparkline (data shipped, no UI)
    └──requires──> MC-01 pipeline (already computes rank_trajectory field)
    └──would enhance──> GemTable Analysis preset column
    └──would enhance──> TransferPanel long-horizon planning view
```

### Dependency Notes

- **NLP-02 requires NLP-01 pattern:** The guardrail (`prose-guardrail.ts` + `_passes_guardrail`) is the critical infrastructure that makes per-player LLM safe. NLP-02 must reuse the same pattern with per-player allowed-name set = {player.web_name}.
- **NLP-02 requires structured context injection:** Per-player prose without injecting current xPts, haul_prob, fixture difficulty, and start_prob will cause the LLM to draw on training data (stale) rather than current pipeline output. This is the primary implementation risk.
- **MC-01 enhances but does not block anything else:** The MC fields are already in `merged_players.json` behind the `mc_enabled` gate. Once that gate is flipped True in `accuracy_backtest.json`, all downstream consumers that read `haul_prob` and `p10_pts` automatically benefit.
- **rank_trajectory has no UI surface yet:** The field is computed and persisted but is not rendered anywhere. It is a deferred differentiator for a future phase.

---

## MVP Definition (for v1.18)

### Already Delivered (do not re-scope)

- [x] MC-01: Monte Carlo pipeline + XPtsCell hover card display
- [x] CAL-01: Calibration chart in AccuracyTab with position tabs
- [x] SENS-01: Fragility badges on GemTable + TransferPanel
- [x] WHY-01: Rejection explainer in GemTable expand + TransferPanel search
- [x] NLP-01: Weekly prose summary on Decision Summary tab with guardrail + Refresh

### Remaining for v1.18 Launch

- [ ] NLP-02: Per-player LLM insights in GemTable row expand and TransferPanel — the one genuinely unbuilt feature in the milestone scope
- [ ] `mc_enabled` gate flip: set `mc_enabled: true` in `accuracy_backtest.json` to activate MC fields in production (currently gates off by default)
- [ ] `rank_trajectory` UI surface: optional; field exists but no component renders it

### Add After v1.18 Validation (v1.19+)

- [ ] rank_trajectory sparkline component (data exists; deferred for visual design)
- [ ] NLP-02 squad-aware regeneration: parallel to NLP-01's POST /api/prose-summary refresh pattern, scoped to specific player context
- [ ] MC-enabled calibration: use actual MC P(haul) percentiles as predicted_rate in calibration chart rather than decile-rank proxy

### Future Consideration (v1.20+)

- [ ] Cross-linking: BACK-01 regret rows linking to "why was X recommended in GW32?" via WHY-01 explainer
- [ ] SENS-01 × BACK-01 integration: fragility marker on historical decision rows
- [ ] Stochastic calibration: use MC haul_prob directly as predicted_rate once enough GWs have accumulated to validate MC calibration signal

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| NLP-02 per-player LLM insights | HIGH — makes per-player rows feel intelligent; justifies the "AI" milestone name | MEDIUM — same guardrail pattern as NLP-01; main cost is prompt design and per-player API call budget | P1 |
| `mc_enabled` gate flip | HIGH — without this, blank_prob/haul_prob fields are zeros in production; all MC-dependent UI is silent | LOW — one line in `accuracy_backtest.json` + validation pipeline run | P1 |
| rank_trajectory sparkline | MEDIUM — useful for planning-horizon decisions; not immediately actionable for next-GW captaincy | MEDIUM — new component; needs visual design decision (sparkline vs numeric?) | P2 |
| MC-enabled calibration | LOW — current decile-proxy approach is statistically defensible; no user-visible regression | HIGH — requires rethinking the calibration pipeline to use MC output | P3 |

---

## Competitor Feature Analysis

FPL tools that have MC / calibration / AI features as of May 2026:

| Feature | FPLOptimized | FPLPulse | FPLReview | Our Approach |
|---------|--------------|----------|-----------|--------------|
| Monte Carlo simulation | Yes — 100 sims, box plot (Min/Q1/Median/Q3/Max), beat-field probabilities | Yes — 100k sims for mini-league rank predictions | Yes — "variance metrics" mentioned in marketing, no UI detail | 1000 sims (configurable via `MC_ITERATIONS`), haul%/blank%/P10/P90 inline in hover card; less visual noise than box plot |
| Calibration chart | Not found | Not found | Not found | Reliability diagram with position breakdown + sparse-bucket filter — genuinely differentiating in FPL tooling space |
| Sensitivity/fragility flags | Not found in any tool | Not found | Not found | ROBUST/FRAGILE/KNIFE EDGE badges — genuinely new in FPL context |
| Rejection explainer | Not found | Not found | Not found | Deterministic gate cascade with search entry point — new |
| LLM prose summary | Not found in FPL tools | Not found | Not found | Name-guardrailed, qualitative-only Claude prose — new; lower hallucination risk than unguarded approaches |
| Per-player AI insights | Not found | Not found | Not found | NLP-02 — the one remaining genuinely new feature |

Confidence on competitor analysis: MEDIUM (based on public documentation; internal feature sets may differ).

---

## Domain-Specific Risks and Anti-Patterns

### MC Anti-Patterns

**Overwhelming the UI with distributions.** FPLOptimized shows box plots per player in a grid — most users ignore them. The correct approach (already shipped) is to surface MC results inline in the existing XPtsCell hover card as four summary numbers, not as a chart per player.

**Under-sampling causing flaky probabilities.** With 1000 sims, a player with true haul_prob = 0.05 will show 0% haul in some runs and 12% in others due to sampling noise. The `MC_SEED = 42` ensures reproducible runs, but the floor should be acknowledged in UI (haul_prob values below 5% are effectively 0±noise).

**DGW double-counting.** Already mitigated: `simulate.py` groups fixtures by `event_id` and sums points within a GW group before accumulating the cumulative array. BGW gaps are padded with zeros.

### Calibration Anti-Patterns

**Small-bin noise.** Already mitigated: `_compute_calibration_data` filters buckets with `sample_n < 5`. With 5 GWs of data (~500–600 qualifying players/GW × 0.1 decile share = ~50–60 per bin), most bins have adequate samples. Position-split bins (especially GK with ~15 per bin) may still be sparse — the gap display (not zero display) is correct.

**Single-GW snapshots.** Already mitigated: BACKTEST_GWS = 5.

**Confusing predicted_rate proxy.** The current approach uses decile midpoint (0.05, 0.15, ..., 0.95) as `predicted_rate`, which approximates "top 10% of players by xPts should haul at rate R%". This is statistically valid as a rank-calibration test but is NOT the same as "the model assigned probability P to this haul". Document this caveat explicitly in the UI tooltip.

### LLM Anti-Patterns

**Hallucinating player names.** The most common and most damaging LLM failure in sports analytics. Already mitigated by `findHallucinatedNames` guardrail.

**Inventing statistics.** Already mitigated: prose prompt explicitly forbids numeric values; system prompt says "Refer to players qualitatively — do not include statistics, projected points, or numeric values."

**Stale training data overriding current context.** For NLP-02, this is the primary remaining risk. If the prompt says "explain why Salah is a strong captain pick" without injecting current fixture difficulty, haul_prob, and form, the LLM will draw on training data (e.g. referencing a fixture from a prior season). Mitigation: inject structured XML context with current pipeline fields into every NLP-02 prompt.

**Rate limits and cost blow-up at scale.** With 600+ active players, calling Claude Haiku once per player per pipeline run would be ~$0.30/run × 365 runs/year = ~$109/year — acceptable for a personal tool. But NLP-02 likely does not need all 600 players — only the top ~20 transfer candidates visible in GemTable and TransferPanel at any time. Scope to on-demand generation (user opens row expand → triggers call) to avoid bulk generation.

**Guardrail retry loop exhaustion.** NLP-01 allows 1 retry on guardrail failure. For NLP-02, the allowed set is smaller (just the one player), which makes guardrail failure less likely but hallucination of other player names more likely (the LLM may compare to rivals). Widen the allowed set to include players explicitly mentioned in the injected context (fixture opponents, similar players in the prompt).

---

## Sources

- Codebase inspection: `pipeline/simulate.py` (Phase 90 MC-01), `pipeline/accuracy.py` (Phase 63/91 CAL-01), `src/lib/sensitivity.ts` / `src/components/shared/FragilityBadge.tsx` (Phase 93 SENS-01), `src/components/gem-table/GemTable.tsx` + `src/lib/rejection-engine.ts` (Phase 65/94 WHY-01), `pipeline/prose_summary.py` + `src/components/squad/ProseSummaryBlock.tsx` + `src/lib/prose-guardrail.ts` (Phase 67 NLP-01). [VERIFIED — read directly in this session]
- `.planning/ROADMAP.md` — phase completion status and feature requirement IDs. [VERIFIED]
- `.planning/research/FEATURES.md` (prior v1.16 research) — WHY-01, SENS-01, NLP feature framing carried over. [VERIFIED]
- [FPLOptimized Scenarios page](https://fploptimized.com/scenarios.html) — competitor MC UI: box plot (Min/Q1/Median/Q3/Max), score-threshold probabilities, beat-field percentages. Fetched 2026-05-12. [VERIFIED]
- [FPLPulse](https://www.fplpulse.com/blog/fpl-mini-league-predictions-simulator) — 100k MC sims for mini-league predictions. [MEDIUM confidence — from search result summary]
- [Stable reliability diagrams for probabilistic classifiers, PMC 7923594](https://pmc.ncbi.nlm.nih.gov/articles/PMC7923594/) — small-bin instability in calibration charts is statistically documented; CORP/PAV approach for adaptive binning. [HIGH confidence — peer reviewed]
- [Understanding Model Calibration, ICLR 2025](https://iclr-blogposts.github.io/2025/blog/calibration/) — ECE bias with sparse bins; kernel-smoothed alternatives. [HIGH confidence — peer reviewed]
- [WSC Sport automated sports commentary generation](https://www.zenml.io/llmops-database/automated-sports-commentary-generation-using-llms) — real-world documented hallucination failures in LLM-generated sports commentary. [MEDIUM confidence — single source]
- [Google PAIR: Explainability + Trust](https://pair.withgoogle.com/chapter/explainability-trust/) — "The perfect time to show explanations is in response to a user's action"; users with AI explanations have 3.2x higher repeat usage. [HIGH confidence — Google Research]
- [Claude API prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — XML tagging, document wrapping, quoting-before-answering for grounded summarisation. [HIGH confidence — official docs]

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| What is already shipped | HIGH | Verified against codebase directly |
| NLP-02 implementation approach | HIGH | Same guardrail pattern is verified and working for NLP-01 |
| MC anti-patterns | HIGH | Independently verified: DGW handling, seed reproducibility, sample size floor |
| Calibration anti-patterns | HIGH | Academic literature confirms small-bin noise; codebase already mitigates |
| LLM hallucination risks | HIGH | Documented failures in sports AI; well-understood mitigation pattern already in place |
| Competitor feature set | MEDIUM | Based on public pages and search summaries; internal features may differ |

---

*Feature research for: FPL Analyst v1.18 Forecast Transparency & AI Intelligence*
*Researched: 2026-05-12*
