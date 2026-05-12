# Pitfalls Research

**Domain:** FPL Analyst v1.18 — Adding Monte Carlo simulation, calibration charts, sensitivity flags, rejection explainers, and LLM prose to an existing Next.js 16 / React 19 / Python analytics app (~28k LOC).
**Researched:** 2026-05-12
**Confidence:** HIGH — based on direct inspection of `pipeline/simulate.py`, `pipeline/accuracy.py`, `src/lib/sensitivity.ts`, `src/lib/explain.ts`, `src/app/api/prose-summary/route.ts`, and `src/lib/prose-guardrail.ts`. All pitfalls grounded in existing code, not hypothetical.

**Critical context from codebase inspection:**
- MC is already implemented in `pipeline/simulate.py` at `N_SIMS=1000` (configurable via `MC_ITERATIONS` env), gated behind `mc_enabled` in `accuracy_backtest.json`. The 10k target is aspirational — the code currently defaults to 1,000.
- 832 total merged players; ~480 hit the BGW short-circuit (no active fixtures); ~352 actually run through MC per pipeline execution.
- Calibration is already computed in `pipeline/accuracy.py::_compute_calibration_data` using 10-decile bucketing with `sample_n < 5` sparse filter.
- Sensitivity (`computeFragility`) already shipped in Phase 64/93 (`src/lib/sensitivity.ts`). WHY-01 rejection explainer already shipped in Phase 65/94 (`src/lib/explain.ts`). NLP-01 prose summary already shipped in Phase 67 (`pipeline/prose_summary.py`, `/api/prose-summary`).
- `maxDuration = 30` is already set on the prose-summary route; no other API routes have this guard.

---

## Critical Pitfalls

### Pitfall 1: MC at 10k sims in the Python pipeline is fine — but in-browser JS is not

**What goes wrong:**
Developers see that `simulate.py` runs server-side and assume MC is only ever a pipeline concern. Then NLP-02 per-player insights or a future "what-if" UI needs to re-run MC in the browser (e.g., to show real-time sensitivity to user-edited start_prob). 10k sims × 352 active players = 3.52M Poisson/Bernoulli draws run synchronously on the main thread freezes the tab for 2-5 seconds on modern hardware.

Even at the current 1,000-sim default: 1,000 × 352 = 352k draws. In pure TypeScript (no WASM, no typed arrays), each draw involves `Math.random()` + branch logic. Profile shows ~150-400ms on M2 MacBook, which exceeds the 50ms "long task" threshold and triggers Chrome's input-blocking penalty.

**Why it happens:**
The existing TypeScript codebase has `src/lib/rank-sim.ts` which runs a sigma-propagation approximation rather than a full MC. Developers may be tempted to port `simulate.py` directly to TypeScript to enable "live what-if" without understanding the scale difference between a closure approximation (~0.1ms) and 1,000 full simulations (~400ms).

**How to avoid:**
- Keep MC exclusively in the pipeline (Python). The pipeline already runs this correctly.
- For in-browser what-if: use the existing `rank-sim.ts` sigma-approximation (it is fast and already tested). Do not re-implement full MC in TypeScript.
- If future features genuinely need in-browser MC (e.g. Sensitivity Flags showing a live distribution shift), limit to 200-500 sims per player with a Web Worker. Never on the main thread.
- The `N_SIMS=1000` floor in `simulate.py` is appropriate for pipeline use. The v1.18 PROJECT.md target of "10k sims" can be achieved in the pipeline by setting `MC_ITERATIONS=10000` in the GitHub Actions environment. At 352 active players × 10k sims = 3.52M NumPy draws — this takes ~2-4 seconds in Python, acceptable for a daily pipeline run.

**Warning signs:**
- Any file in `src/lib/` importing `Math.random()` in a loop over the full player list is the anti-pattern
- A React component that calls a function containing `for(let i=0; i<sims; i++)` inside `useMemo`

**Phase to address:**
MC-01 pipeline enhancement (bumping `MC_ITERATIONS`). Any UI phase for MC result display must use pre-computed pipeline fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`) — never re-run MC in the browser.

---

### Pitfall 2: Calibration diagram with fewer than 5 finished GWs shows "model is wrong" when it isn't

**What goes wrong:**
The existing `_compute_calibration_data` uses a `sample_n < 5` sparse-bucket filter (D-07 in Phase 63). With only 3-4 finished GWs in the backtest window (`BACKTEST_GWS = 5`), the top and bottom deciles have tiny populations — GKs and defenders in the top decile may have 3-4 observations total. At those sample sizes, a single outlier haulter (Salah 20-pointer) or a single non-haulter (Haaland blanked) shifts `actual_rate` by 20-30 percentage points. The diagram looks wildly miscalibrated when the model is actually performing within noise.

More specifically: the calibration diagram bins by xPts rank-decile across ALL positions in the "all" view. With BACKTEST_GWS=5 and ~400 players per GW who played ≥10 minutes, each decile has ~200 observations total — adequate. But position-specific views (e.g. GKs alone) have ~80 total across 5 GWs, and each decile has only ~8 observations. The existing `sample_n < 5` filter is not sufficient for position-specific reliability — you need ~30 per bucket for the observed rate to be stable.

**Why it happens:**
The `sample_n < 5` guard was set for the "all positions" view. Position-specific views (tabs: GK, DEF, MID, FWD) were added in Phase 91 without recalibrating the minimum bucket size for the smaller pools.

**How to avoid:**
- For position-specific calibration tabs (GK, DEF, MID, FWD), increase the sparse-bucket filter from `sample_n < 5` to `sample_n < 15` for GK/DEF (small position pools), and `sample_n < 8` for MID/FWD (larger pools).
- Display a `⚠ Insufficient data (n={total})` banner on any position-specific tab where the total pool across ALL buckets is fewer than 5 × BACKTEST_GWS (e.g. GKs: 4 teams × 2 GKs × 5 GWs ≈ 40, which is marginal).
- Never render error bars on calibration buckets without showing `n`. The existing `sample_n` field is already in the bucket shape — surface it.
- On cold start (fewer than 3 GWs in backtest), show "Calibration requires at least 3 completed gameweeks" and hide the chart entirely rather than showing a misleading 2-point diagram.

**Warning signs:**
- Calibration chart with only 2-3 data points displayed (not enough to identify a trend)
- `actual_rate` swings > 0.3 between adjacent decile buckets in the same position
- `sample_n` column hidden from the chart tooltip

**Phase to address:**
CAL-01 chart rendering phase. Update sparse-bucket constants by position before shipping the chart.

---

### Pitfall 3: Sensitivity flags spam — every recommendation becomes "fragile" late in season

**What goes wrong:**
`computeFragility` has 5 perturbations; perturbation (a) fires when `start_prob - 0.15 < 0.70`, meaning any player with `start_prob < 0.85` triggers it. In GW30+, fixture congestion, cup fixtures, and Pep-roulette mean 40-60% of "available" players have `start_prob` between 0.70 and 0.84. The result: every second transfer recommendation shows a fragility flag, users learn to ignore them, and the signal dies.

This was documented in the existing v1.16 PITFALLS.md (SENS-01, "threshold tuning") but the follow-up — actually tracking the trigger rate — was deferred to a post-season calibration check that hasn't happened yet.

**Why it happens:**
The threshold `START_PROB_FLOOR = 0.70` in `sensitivity.ts` was set for mid-season average conditions (~GW20). Late-season, the distribution of `start_prob` shifts left; the threshold becomes less discriminating.

**How to avoid:**
- Track `fragile_transfer_pct` in `data_health.json` (flagged in v1.16 PITFALLS but not yet implemented). If it exceeds 45% of active transfer candidates in a single GW, log a warning.
- For v1.18 SENS-01 UI surface: show the fragility tier visually (robust / fragile / knife_edge) without alarm-level UX for "fragile" — reserve `knife_edge` for red warnings. "Fragile" should be an amber informational hint, not a stop-sign.
- Do NOT add new perturbations to v1.18 without a backtest of false-positive rate across the already-shipped Phase 93 extension.
- The existing 5-perturbation set is sufficient for v1.18. More perturbations = more flags = faster user desensitisation.

**Warning signs:**
- `fragile_transfer_pct` > 45% across any single GW's transfer candidates
- `knife_edge` tier on >10% of top-10 transfer recommendations simultaneously
- User feedback that "everything is fragile"

**Phase to address:**
SENS-01 UI phase — establish tier-based visual hierarchy (robust/fragile/knife_edge) before surfacing flags in new UI contexts.

---

### Pitfall 4: WHY-01 rejection reasons must cite the actual model threshold, not invented ones

**What goes wrong:**
The existing `computeRejection` in `src/lib/explain.ts` is a pure function over real `MergedPlayer` data, computing reasons from `REJECTION_START_PROB_THRESHOLD = 0.70`, `REJECTION_OWNERSHIP_THRESHOLD = 20.0`, etc. The risk in v1.18 is NLP-02: a per-player LLM prose insight that paraphrases the rejection. If the LLM is given only "Player X was rejected" and asked to explain why, it may invent plausible-sounding reasons ("weak fixture against City's back four") that have nothing to do with the actual threshold that fired.

This is NOT hypothetical. The existing guardrail in `prose-guardrail.ts` only checks that no non-allowed player names appear in the prose. It does NOT check that stated reasons match the actual rejection flags.

**Why it happens:**
Developers build NLP-02 by passing player name + "why they weren't recommended" to Claude and treating the output as authoritative. The LLM is reasoning from context window, not from the actual `computeRejection` output.

**How to avoid:**
- NLP-02 context assembly for rejection insights MUST include the structured rejection output: the exact `reasons` array from `computeRejection` (e.g. `["rank #14 in MID by xPts", "start_prob < 70%"]`). Pass this as a structured XML or JSON block in the user prompt, analogous to how `prose_summary.py` passes `<captains>` and `<gems>`.
- The system prompt MUST instruct: "Paraphrase only the reasons listed in `<rejection_reasons>`. Do not add reasons not in the list."
- The rejection guardrail must be extended: after prose generation, check that each reason in the `reasons[]` array has a semantic match in the prose (approximate match, not exact). If the prose contains words like "injury" but no injury-related reason was in `reasons[]`, reject and retry.
- WHY-01 in the GemTable row-expand already shows the structured `reasons[]` directly without LLM. The LLM layer in NLP-02 is additive. If the guardrail fails both attempts, fall back to displaying the structured `reasons[]` without prose — this is preferable to displaying invented reasons.

**Warning signs:**
- NLP-02 prose mentions "injury" for a player with `status: 'a'` and `chance_of_playing_next_round: undefined`
- NLP-02 prose mentions specific opponent teams not in the fixture list
- NLP-02 prose gives a different rank number than the actual `xPtsRank` from `computeRejection`

**Phase to address:**
NLP-02 phase. Extend the prompt structure and guardrail before any NLP-02 prose is shown in the UI.

---

### Pitfall 5: LLM hallucinating player stats when context assembly is incomplete

**What goes wrong:**
The existing `prose_summary.py` architecture is carefully minimal: it passes only player names and teams — no statistics. The system prompt explicitly instructs "Refer to players qualitatively — do not include statistics, projected points, or numeric values." This is intentional to prevent hallucination of wrong numbers.

NLP-02 per-player insights will be tempted to pass xPts, form score, and other numbers into context so the LLM can use them. The risk: Claude receives `xPts_1gw: 6.2` and writes "projected for 6.2 points this week". If the pipeline then updates (daily refresh changes xPts to 5.8) and the cached NLP prose isn't invalidated, the UI shows a confident wrong number. Worse: Claude may generate plausible numbers that aren't in the context at all ("likely to score around 7-8 points based on form").

**Why it happens:**
Passing numbers into LLM context is tempting because it makes the prose feel more specific. But the LLM doesn't know which numbers are stale, which are estimates, and which are actuals — it treats them all as facts.

**How to avoid:**
- Extend the existing qualitative-only constraint to NLP-02: "Do not include numeric values, percentages, or statistics." Pass structural context (rank tier: "top 5", "mid-table", "bottom quarter") rather than exact numbers.
- If numeric context is genuinely needed (e.g. to explain a fragility reason), pass ranges not point estimates: "expected points: medium (6-8 range)" not "xPts_1gw: 6.2".
- NLP-02 prose must be invalidated when the pipeline refreshes. Key the React Query cache for NLP-02 on `players.last_updated` (already available from `useLastUpdated`) so stale prose is never shown alongside fresh stats.
- The player name guardrail already prevents hallucinating non-existent players. Extend it: before displaying NLP-02 prose, verify it does NOT contain any string matching `\d+\.?\d* points` (a numeric claim about points).

**Warning signs:**
- NLP-02 prose shows a specific points number not provided in the prompt context
- NLP-02 prose is more than 12 hours old while `last_updated` is recent
- NLP-02 prose mentions a fixture (e.g. "vs Arsenal") that isn't in the player's next 2 fixtures

**Phase to address:**
NLP-02 context assembly and cache invalidation design, before any prose is rendered.

---

### Pitfall 6: Streaming response handling — timeout and partial-render risk

**What goes wrong:**
The existing `/api/prose-summary` route uses `client.messages.create` (non-streaming) with `maxDuration = 30`. This works for the NLP-01 weekly summary (512 tokens, haiku responds in 2-4s). NLP-02 per-player insights may be triggered multiple times per page (15+ GemTable row-expands). Each non-streaming call holds a serverless function open for 2-4s. On Vercel Hobby plan (10s default), this is fine for one call. But if a React component triggers multiple concurrent NLP-02 calls (e.g. user rapidly expands 3 rows), 3 × 4s = 12s > 10s timeout.

Additionally, streaming responses in Next.js App Router require `return new Response(stream)` with `TransferEncoding: chunked` — NOT `Response.json()`. Developers who start with the existing `Response.json()` pattern and attempt to add streaming will see partial responses or dropped connections.

**Why it happens:**
The existing codebase only has one LLM call path (NLP-01 weekly summary, requested once per session). NLP-02 introduces a multi-call pattern. The `maxDuration = 30` set for NLP-01 is correct for one call; it does not protect against concurrent calls.

**How to avoid:**
- For NLP-02: use a single POST that accepts an array of player IDs (batched, not one-per-request). The API generates all insights in one call with a structured output format, then returns the batch. This is 1 API call with ~800-1200 tokens output instead of N calls × 100 tokens.
- Cache NLP-02 responses in `localStorage` keyed by `(player_id, pipeline_run_date)` — reuse across sessions until the next pipeline refresh. Do not call the API on every row expand.
- Do NOT attempt streaming for NLP-02. Non-streaming (the existing pattern) is simpler and produces better user experience for short prose (users see the complete paragraph appear, not word-by-word trickle). Reserve streaming for long-form content (>500 tokens).
- If streaming is genuinely needed for a future feature: use the Vercel AI SDK (`ai` package) which handles the `ReadableStream` + `TransferEncoding` plumbing correctly. Do not implement streaming manually with `new ReadableStream()` in Next.js App Router — the chunked encoding semantics are subtle.
- Keep `maxDuration = 30` as the floor. NLP-02 batch API calls may take 5-8s; 30s is adequate with 2 retry attempts.

**Warning signs:**
- More than 2 concurrent `fetch('/api/prose-summary')` calls from the same page render
- NLP-02 result missing from UI after row expand (silently timed out)
- React component showing "loading..." indefinitely for NLP-02

**Phase to address:**
NLP-02 API route design (batch structure, caching strategy) before implementing the UI row-expand trigger.

---

### Pitfall 7: API cost explosion for NLP-02 per-player insights at scale

**What goes wrong:**
Claude Haiku 4.5 costs $1.00/M input tokens + $5.00/M output tokens (verified, May 2026). A per-player insight generated on-demand for every GemTable row-expand is a cost trap:

- Scenario 1: User opens 20 row-expands per session × 38 GWs = 760 API calls/season
- Each NLP-02 call: ~500 tokens system + ~300 tokens user prompt + ~100 tokens output = ~900 tokens/call
- 760 calls × 900 tokens = 684K tokens/season × ($1/M input + $5/M output) ≈ $0.68/season at 90%/10% input/output split ≈ $0.10-0.20/season

That sounds small — but this is a personal tool where the developer pays. The risk is not the normal use case, it's pathological use:
- User leaves the GemTable with ALL rows expanded (e.g. debugging)
- A React effect triggers NLP-02 on every re-render of an expanded row
- A TanStack Query hook with `staleTime: 0` re-fetches NLP-02 on every tab switch

The real risk is a bug where NLP-02 fires on mount for all visible rows simultaneously — the GemTable shows ~50 visible rows. 50 × 900 tokens = 45K tokens per page load. At 4 sessions/day × 180 days = 720 sessions/season = 32.4M tokens = $16-32/season from a single bug.

**Why it happens:**
Developers assume TanStack Query's deduplication prevents redundant calls, but it only deduplicates the same query key. 50 rows with 50 different player IDs = 50 unique query keys = 50 simultaneous calls.

**How to avoid:**
- NLP-02 must be demand-triggered: only generate when the user explicitly expands a row AND the expand stays open for > 1 second (debounce, prevents accidental triggers).
- Cache NLP-02 results in `localStorage` with a pipeline-date key. The prose does not need to change until the pipeline refreshes (~daily). `staleTime: 24 * 60 * 60 * 1000` (24h) minimum.
- Rate-limit the API route: reject concurrent requests for the same session. Use a simple in-memory Set of in-flight player IDs with a 5-second TTL. Return 429 if the same player ID is requested while a call is in flight.
- Implement a server-side call counter via `ANTHROPIC_API_KEY` usage monitoring (Anthropic provides usage API). Add a budget guard: if monthly token usage > threshold, return a static fallback message ("AI insights temporarily unavailable") without calling the API.
- Consider pre-generating NLP-02 insights for the top-20 players by xPts in the pipeline (alongside `prose_summary.py`), then falling back to on-demand for lower-ranked players. 20 players × 900 tokens = 18K tokens/pipeline run = negligible cost.

**Warning signs:**
- `useEffect(() => { fetchNLP2(player.id) }, [])` in a row-expand component with no debounce
- TanStack Query hook for NLP-02 with `staleTime: 0` or no staleTime
- NLP-02 triggered for every player visible in the viewport on mount

**Phase to address:**
NLP-02 route and hook design. Caching and demand-trigger pattern must be in the design spec before implementation.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping `N_SIMS=1000` instead of bumping to `MC_ITERATIONS=10000` | Faster pipeline (2s vs 8s) | Noisier percentile estimates (p10/p90 ±15% at 1k vs ±5% at 10k) | Acceptable during development; set 10k in production env before shipping MC outputs to UI |
| Not extending the prose guardrail to cover rejection reasons | Faster NLP-02 implementation | LLM may invent reasons; cannot be detected post-hoc | Never — the guardrail is the only protection against hallucinated rejection explanations |
| Using `sample_n < 5` for all positions in calibration | Reuses existing code | Misleading calibration for GKs (pool of ~8/decile) | Never — fix position-specific thresholds before shipping CAL-01 to new UI contexts |
| Triggering NLP-02 on every row expand | Simpler state management | Cost explosion on adversarial use (all rows open) | Never without `localStorage` cache and 24h staleTime |
| Running MC in TypeScript for live what-if UI | Responsive UI without API calls | Main thread freeze at realistic sim counts | Acceptable only below 200 sims AND on a Web Worker |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic SDK (NLP-02 batch) | Calling `client.messages.create` inside a `map()` — creates N concurrent requests | Collect all player IDs, build a single prompt with XML-structured player list, one `messages.create` call returns all insights |
| Anthropic SDK (streaming) | Using `client.messages.stream` with `Response.json()` — crashes with "body already used" | Use `return new Response(stream.toReadableStream())` if streaming, or avoid streaming entirely for short prose |
| Vercel Hobby plan | Omitting `maxDuration` on any route that calls the Anthropic API | Every new API route calling Claude needs `export const maxDuration = 30` — without it, the default 10s timeout will cause sporadic 504s on first attempt |
| `prose-guardrail.ts` vs `prose_summary.py` | Adding a new guardrail check only in TypeScript but not in Python | Both implementations MUST stay byte-equivalent. The Python version runs at pipeline-write time; the TypeScript version runs at UI-display time. Divergence allows hallucinated pipeline prose to appear without client-side check catching it |
| Anthropic Batch API | Using synchronous `messages.create` for 20+ player insights | Anthropic's async Batch API is 50% cheaper for non-time-sensitive use. For pre-generated pipeline insights (top-20 players), use `client.beta.messages.batches.create` — results arrive async, acceptable for daily pipeline runs |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| MC re-run in browser | GemTable "What-if" feature freezes on player with fixtures | Use pre-computed `p10_pts/p90_pts` from pipeline; never run MC in React | At first call with > 200 sims × any active player |
| NLP-02 on all visible rows | 50 concurrent Anthropic calls on GemTable load | Demand-trigger with debounce; `localStorage` 24h cache | First full-page load with all rows expanded |
| Calibration recomputed on every pipeline run from full history | Pipeline adds 30s for late-season full-backtest scan | Keep `_compute_calibration_data` scoped to `BACKTEST_GWS=5` (already correct) | After GW38 with 5+ years of data if the BACKTEST_GWS constant is removed |
| Sensitivity flag shown for every player in GemTable | User fatigue; "fragile" badge loses meaning | Show sensitivity flags only on actively displayed recommendations (TransferPanel top-5, CaptainPicksPanel) — not as a GemTable column | When `fragile_transfer_pct` > 45% |
| Calibration `sample_n` check at bucket level vs position level | GK calibration tab shows "8 per bucket" which looks fine but is actually from 2 GWs of data | Guard at the position-pool level (total observations for that position in the backtest window) before rendering any chart | Early season (GW1-4) for GK position |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing raw FPL player stats (xPts, rank, ownership%) into the LLM system prompt without sanitisation | Prompt injection: a player's `news` field might contain text that shifts the LLM's persona (e.g. a contrived "Ignore previous instructions" news string, however unlikely from FPL's API) | Wrap all external data in XML tags with explicit role assignment (`<player_data>`, `<news>`). Claude's architecture is robust to basic injection but the defence-in-depth is worth implementing. |
| Logging Anthropic API key to console in error handler | Key exposure in Vercel function logs (searchable) | Existing pattern in `prose_summary.py` uses `os.environ.get('ANTHROPIC_API_KEY')` but does NOT log the key — maintain this. Never `print(api_key)` or `console.log(process.env.ANTHROPIC_API_KEY)`. |
| Storing NLP-02 prose in `localStorage` including structured rejection reasons | Rejection reasons expose model internals (threshold values, rank position) to local storage inspection — low risk for personal tool | Acceptable for single-user tool. Document that `localStorage` stores computed model outputs, not raw FPL session tokens. |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing calibration chart during first 3 GWs of season | Misleading "model is broken" visual from sparse data | Gate the CalibrationSection behind a minimum-data guard: `total_observations_for_position < 50` → show "Insufficient data — requires ~3 completed gameweeks" |
| Fragility "knife_edge" warning on every transfer recommendation after GW30 | Warning fatigue — users ignore all SENS-01 signals | Tier the visual weight: robust=no badge, fragile=small amber dot, knife_edge=amber pill. Reserve full-width warning cards for knife_edge only |
| NLP-02 per-player prose auto-loading for every expanded row | Page scroll through GemTable triggers 15+ API calls | Explicit "Get AI insight" button inside the row-expand; one-click per player, cached across session |
| WHY-01 rejection panel showing 5 reasons for a player who is actually borderline-good | User confused: player looks fine, but 5 reasons listed | The existing adaptive framing (positive vs negative mode) handles this. Don't add new rejection predicates that lower the "strong" threshold — Phase 94 already extended the predicate set enough |
| Calibration "all positions" tab showing strong diagonal as "model works" while GK tab is flat | User trusts model for GKs when data is insufficient for that view | Default to the "all" tab but add per-position tabs only when that position's sample count is adequate. Show sample count in tab header: "MID (n=200)" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **MC-01 (10k sims):** `simulate.py` currently defaults to `N_SIMS=1000`. The pipeline env var `MC_ITERATIONS=10000` must be set in GitHub Actions secrets — verify the workflow env block includes this before claiming "10k sims" in the UI. Check: `grep MC_ITERATIONS .github/workflows/pipeline.yml`.
- [ ] **CAL-01 (position-specific charts):** The `sample_n < 5` sparse filter exists but is set for the "all" aggregate view. Position-specific GK/DEF views need `sample_n < 15` or a position-pool total guard before the chart is trusted. Check: inspect `_compute_calibration_data` thresholds against GK pool size (~8/decile at 5 GWs).
- [ ] **SENS-01 (fragile % monitoring):** The v1.16 PITFALLS.md flagged adding `fragile_transfer_pct` to `data_health.json`. This has NOT been implemented. Check: `grep -r "fragile_transfer_pct" pipeline/` should return a match before this is considered done.
- [ ] **WHY-01 (NLP-02 reason grounding):** The existing prose guardrail only checks player names. The rejection-reason grounding check (prose matches actual `reasons[]` array) does not exist yet. Check: look for `reasons` array in the `buildUserPrompt` function of the NLP-02 route before claiming the guardrail covers rejection explanations.
- [ ] **NLP-02 (cache invalidation):** `localStorage` cache for NLP-02 prose must be keyed on `pipeline_run_date` (from `last_updated.json`), not just `player_id`. Check: cache key includes a date/timestamp component that changes on pipeline refresh.
- [ ] **NLP-01/NLP-02 (`maxDuration`):** The existing `maxDuration = 30` is only on the `/api/prose-summary` route. Any new route that calls the Anthropic API (e.g. `/api/player-insight` for NLP-02) needs its own `export const maxDuration = 30`. Check: `grep -r "maxDuration" src/app/api/` shows a value for every route that makes outbound LLM calls.
- [ ] **Calibration (cold start shape):** `_compute_calibration_data` returns `{'by_position': {'all': [], '1': [], ...}}` as the cold-start fallback. The UI must render "Insufficient data" for empty arrays, not an empty chart axis. Check: CalibrationChart component handles `buckets.length === 0` with an explicit message, not a blank canvas.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| MC in TypeScript freezing UI | MEDIUM | Remove the TypeScript MC and replace with a call to pre-computed `p10_pts/p90_pts` fields; use `rank-sim.ts` sigma-approximation for any live what-if; 1-2 days work |
| LLM inventing rejection reasons | HIGH | Immediately disable NLP-02 prose for WHY-01 (set a feature flag); fall back to showing raw `reasons[]` array (already implemented in Phase 65 UI); rebuild prompt context with structured `<rejection_reasons>` XML block; re-enable |
| API cost spike from NLP-02 | MEDIUM | Add `MC_ITERATIONS=0` equivalent: a `NLP2_ENABLED=false` env var that makes the route return a static fallback message; purge `localStorage` NLP-02 cache; audit all call sites for missing debounce/staleTime |
| Calibration showing misleading results | LOW | The chart is read-only — misleading data causes confusion but no data corruption. Add the position-pool guard to `_compute_calibration_data` and redeploy; next pipeline run regenerates calibration data |
| Sensitivity flag fatigue | LOW | Change the `fragile` tier's visual representation from a warning badge to a soft indicator; no algorithmic change needed; 1 component edit |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| MC in browser / main thread | MC-01 pipeline enhancement | Confirm no `Math.random()` loop over player list in TypeScript; UI uses pre-computed fields from `merged_players.json` |
| Calibration sparse data at position level | CAL-01 chart component | `sample_n` guard per-position is ≥15 for GK/DEF; chart shows "Insufficient data" banner when position pool < 50 observations |
| Sensitivity flag spam | SENS-01 UI phase | `fragile_transfer_pct` sanity check exists in `data_health.json`; visual hierarchy: robust=no badge, fragile=dot, knife_edge=pill |
| WHY-01 invented rejection reasons | NLP-02 prompt design | `buildUserPrompt` for NLP-02 includes structured `<rejection_reasons>` XML block; guardrail checks reason coverage |
| LLM hallucinating player stats | NLP-02 context assembly | System prompt includes "Do not include statistics or numeric values"; no xPts/form numbers in user prompt |
| Streaming / timeout | NLP-02 API route design | `export const maxDuration = 30` present on every new LLM route; batch API call pattern used (not per-player calls) |
| API cost explosion | NLP-02 caching design | `localStorage` cache with 24h staleTime; demand-trigger with debounce; rate-limit guard in API route |

---

## Sources

- `pipeline/simulate.py` — direct inspection; 832 total players, ~352 active (BGW short-circuit verified at ~480 `blank_prob: 1.0` entries in `pipeline/cache/merged_players.json`); `N_SIMS=1000` default with `MC_ITERATIONS` env var; `mc_enabled` gate in `accuracy_backtest.json`
- `pipeline/accuracy.py` — `_compute_calibration_data`, `BACKTEST_GWS=5`, `sample_n < 5` sparse filter (line 542); `MIN_MINUTES=10` exclusion
- `src/lib/sensitivity.ts` — `START_PROB_FLOOR=0.70`, `COST_HIT_XPTS_THRESHOLD=5.0`, 5-perturbation set; Phase 93 extension; `FragilityTier = 'robust' | 'fragile' | 'knife_edge'`
- `src/lib/explain.ts` — `REJECTION_START_PROB_THRESHOLD=0.70`, `computeRejection` adaptive framing, Phase 94 lifecycle predicate extensions
- `src/app/api/prose-summary/route.ts` — `maxDuration=30`, `claude-haiku-4-5`, non-streaming pattern, per-session batch structure
- `src/lib/prose-guardrail.ts` — player-name-only guardrail; does NOT cover numeric stat claims or rejection reason coverage
- `pipeline/prose_summary.py` — qualitative-only prompt engineering (no statistics in output); 2-attempt retry with strict-mode escalation; `None` fallback on both guardrail failures
- `.planning/research/PITFALLS.md` (v1.16) — SENS-01 threshold tuning and fragile_transfer_pct monitoring identified but not yet implemented
- Anthropic Claude Haiku 4.5 pricing: $1.00/M input, $5.00/M output (verified May 2026 via platform.claude.com/docs)
- Vercel Hobby plan: 10s default function timeout, 60s maximum; `maxDuration` export required to extend
- `src/lib/rank-sim.ts` — sigma-approximation for cumulative XI trajectory; this is the correct browser-side alternative to full MC

---
*Pitfalls research for: FPL Analyst v1.18 — Forecast Transparency & AI Intelligence*
*Researched: 2026-05-12*
