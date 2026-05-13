# Architecture Patterns — v1.18 Forecast Transparency & AI Intelligence

**Domain:** FPL Analyst — subsequent milestone, integrating MC simulation distributions, calibration evidence, sensitivity flags, rejection explainers, and Claude API per-player insights into the existing Python pipeline -> Vercel Blob -> Next.js 16 Route Handlers -> TanStack Query -> React stack.
**Researched:** 2026-05-13
**Confidence:** HIGH — derived from direct codebase reads of `pipeline/simulate.py`, `pipeline/accuracy.py`, `pipeline/prose_summary.py`, `pipeline/run.py`, `src/app/api/prose-summary/route.ts`, `src/lib/sensitivity.ts`, `src/lib/mc-labels.ts`, `src/lib/explain.ts`, `src/lib/hooks/useProseSummary.ts`, `src/lib/hooks/useProseRefresh.ts`, `src/components/captaincy/CaptainPicksPanel.tsx`, `src/components/gem-table/GemTable.tsx`, `src/components/squad/DecisionSummaryTab.tsx`, `src/components/accuracy/AccuracyTab.tsx`, and `src/lib/types.ts`. Anthropic API patterns verified against `@anthropic-ai/sdk` usage in `prose-summary/route.ts`.

---

## Headline Finding: Most v1.18 Infrastructure Already Exists

Before answering the five architectural questions, the single most important fact for the roadmapper:

| Feature | What's Already Built | What's Outstanding |
|---------|---------------------|--------------------|
| MC-01 Monte Carlo | `simulate.py` writes `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory` to `merged_players.json`. `MergedPlayer` type extended. `computeMCLabels` consumed by `CaptainPicksPanel`. | (1) Flip `mc_enabled` gate from `false` to `true` after a non-regression pipeline run. (2) New `MCDistributionBar` component for GemTable row-expand and TransferPanel. |
| CAL-01 Calibration | `_compute_calibration_data()` already writes `accuracy_backtest.json.calibration{by_position: {all,1,2,3,4}}`. `CalibrationSection` in `AccuracyTab.tsx` already renders reliability diagram. | (Optional) Single-line calibration health indicator on Decision Summary. |
| SENS-01 Sensitivity | `src/lib/sensitivity.ts` `computeFragility()` (5 perturbations) and `FragilityBadge` consumed by GemTable row-expand + CaptainPicksPanel. | Call site in TransferPanel for buy candidates with `isTransfer=true, xPtsGain` arg. |
| WHY-01 Rejection Explainer | `src/lib/explain.ts` `computeRejection()` + `computeHeadToHead()` consumed by GemTable row-expand and `ComparisonSearch`. | Call site in TransferPanel for non-recommended players (top 2 reasons inline). |
| NLP-01 Weekly Prose | `pipeline/prose_summary.py` -> `weekly_summary.json`. `/api/prose-summary` GET + POST (squad-aware refresh). `useProseSummary`, `useProseRefresh`, `ProseSummaryBlock` shipped in `DecisionSummaryTab`. | None — complete. |
| NLP-02 Per-Player Prose | None of it built yet. | New `POST /api/player-insight` Route Handler, `usePlayerInsight` mutation hook, `PlayerInsightTrigger` UI component, Blob caching layer per player per GW. |

**Implication for roadmapper:** v1.18 is mostly *wiring* and *gate activation*, plus one truly new vertical (NLP-02 per-player). Phase ordering should reflect this — gate activation first (it unblocks downstream MC display + richer per-player LLM context), then UI-only call-site additions, then the one net-new route.

---

## Existing Architecture (Verified Baseline — v1.17 shipped)

```
+--------------------------------------------------------+
| GitHub Actions cron (pipeline.yml, daily)              |
| pipeline/run.py - try/except orchestrator              |
|   bootstrap + fixtures + element-summary               |
|   xmins -> bonus -> saves -> merge_players             |
|   IF mc_enabled (read from prior accuracy_backtest):   |
|     simulate.compute_simulations(merged, xmins_v2_gate)|     <-- simulate.py wired
|   insights, gw_intel, price_changes                    |
|   defcon, accuracy.compute_accuracy_backtest()         |     <-- writes calibration{}
|   prose_summary.run() -> weekly_summary.json           |     <-- Claude Haiku call, server-side
|   data_health.json (last artifact, deliberately last)  |
+----------------------+---------------------------------+
                       |
                       v   pipeline/cache/ (local)  OR  Vercel Blob (prod)  - USE_BLOB env switch
+----------------------+---------------------------------+
| merged_players.json (single source of truth)           |
|   PER-PLAYER ARRAY; v1.18 fields already declared:     |
|     blank_prob, haul_prob, p10_pts, p90_pts,           |
|     xPts_5gw_p10/p50/p90, rank_trajectory              |
| accuracy_backtest.json                                 |
|   summary{ mc_enabled: bool }   <-- gate lives here    |
|   calibration{ by_position: {...} }                    |
|   per_gw_rows{...}, versions[]                         |
| weekly_summary.json   (Claude Haiku prose)             |
| captain_picks.json / captain_picks_gw{N}.json          |
| (~20 other artifacts)                                  |
+----------------------+---------------------------------+
                       |
                       v
+----------------------+---------------------------------+
| Next.js 16 Route Handlers (/api/*) - server-side       |
|   /api/players          GET  -> merged_players.json    |
|   /api/accuracy         GET  -> accuracy_backtest.json |
|   /api/prose-summary    GET  -> weekly_summary.json    |
|   /api/prose-summary    POST -> Claude Haiku           |     <-- ANTHROPIC_API_KEY server-only
|   (all GETs: 'public, s-maxage=3600, stale-while-     |
|    revalidate=86400' cache header)                     |
+----------------------+---------------------------------+
                       |
                       v
+----------------------+---------------------------------+
| TanStack Query (6h staleTime convention)               |
|   usePlayers(), useAccuracy()                          |
|   useProseSummary() [GET], useProseRefresh() [POST]    |
+----------------------+---------------------------------+
                       |
                       v
+----------------------+---------------------------------+
| React Components (client)                              |
|   AccuracyTab.tsx      -> CalibrationSection (Recharts)|
|   CaptainPicksPanel    -> computeMCLabels + Fragility  |
|   GemTable.tsx         -> computeRejection + Fragility |
|   DecisionSummaryTab   -> ProseSummaryBlock            |
+--------------------------------------------------------+
```

Tech baseline: Next.js 16 App Router, Route Handlers (no Pages API), React 19, TypeScript, TanStack Table v8 + Query, Tailwind v4, Vitest. Python: requests + pandas + numpy + soccerdata. SDK: `@anthropic-ai/sdk` (already a dependency).

---

## Answers to the Five Architectural Questions

### Q1: MC simulation output — `merged_players.json` or separate `mc_results.json`?

**Decision: Keep in `merged_players.json` (already implemented this way).**

**Why:**

1. **MC fields are per-player attributes**, not a separate domain object. `haul_prob`, `blank_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory` describe properties of each player — same cardinality and primary key as every other field (`element_id`).
2. **Co-locality avoids dual fetches and consistency windows.** GemTable, TransferPanel, and CaptainPicksPanel all render player rows where MC fields appear alongside `xPts_1gw`, `haul_prob`, `lifecycle_label`. Splitting into `mc_results.json` would force a second `/api/mc-results` fetch, a second TanStack Query, and a merge step that risks UI rendering a row whose MC fields haven't arrived yet (or worse, are from a different pipeline run than the player data above them).
3. **Established codebase precedent.** Every per-player computed field added since v1.0 — `attacking_difficulty`, `differential_flag`, `regression_signal`, `cs_prob_1gw`, `xPts_components_1gw`, `bonus_predictor`, `xmins_v2`, `start_prob`, `mins_60_prob`, `appearance_pts`, `saves_pts` — has been merged into `merged_players.json`. The PROJECT.md "Key Decisions" table calls out "`merged_players.json` as single source of truth — Good — prevented type drift across 6 phases." MC fields follow the same pattern and the type drift problem returns the moment two files describe the same primary key.
4. **Atomicity.** `simulate.py` runs *after* `merge_players()` in `run.py` and mutates each player dict in-place before `save('merged_players.json', merged)`. The pipeline writes one file; either both pre-MC and MC fields are present or the run failed before write. There is no window where `xPts_1gw` is fresh and `haul_prob` is stale.
5. **Size cost is negligible.** ~700 players * 8 MC fields * float64 = ~45KB additional JSON. `merged_players.json` is already ~2-3MB; this is <2%.

**When would a separate file be right?** If MC outputs ballooned (e.g., the full N_SIMS x N_PLAYERS distribution matrix, ~5.6GB at 10k sims) or if they refreshed on a different cadence than the rest of the pipeline. Neither is true — MC produces 8 summary scalars per player, and `compute_simulations()` runs in the same pipeline pass as merge.

**What still needs doing for Q1:**

| Component | State | Action |
|-----------|-------|--------|
| `simulate.py` field schema | DONE | None |
| `MergedPlayer` TypeScript type | DONE | None |
| `/api/players` passthrough | DONE | None |
| `mc_enabled` gate value | FALSE in current cache | Manually flip to `true` after one non-regression pipeline verification run; flip persists via `_read_existing_mc_enabled_flag` |
| `MCDistributionBar` UI | NOT YET | NEW component — see Q5 |

**D-05 invariant (already enforced in simulate.py):** `p90_pts` from MC overwrites the analytical `xPts_90th_1gw` (sigma-derived) field written by merge.py when MC is enabled. Captain ceiling claims are then grounded in 1000-iter MC, not a Gaussian approximation.

---

### Q2: Calibration data — extend `accuracy_backtest.json` or separate `calibration.json`?

**Decision: Extend `accuracy_backtest.json` (already implemented this way).**

**Why:**

1. **Derived from the same compute.** `_compute_calibration_data(per_gw_rows)` runs inside `compute_accuracy_backtest()` over the same per-GW predictions/actuals that produce hit rates and the version-history rows. They share input data; co-located storage matches co-located compute.
2. **Same consumer.** `AccuracyTab.tsx` reads `useAccuracy().data` and renders both the hit-rate summary and the `CalibrationSection` reliability chart. One hook, one fetch. A separate `calibration.json` would force `useAccuracy` to call two endpoints (or add a second query and join client-side).
3. **Same cadence.** Calibration buckets refresh whenever accuracy backtests rerun — they cannot diverge. The "calibration is stale relative to backtest" failure mode is impossible by construction when they share a file.
4. **Schema is fixed and small.** `calibration.by_position` is a 5-key object (`all`, `1`, `2`, `3`, `4`); each value is a list of decile buckets (~10 rows of `{predicted_haul_rate, actual_haul_rate, n, predicted_xpts_mean, actual_xpts_mean}`). Total payload < 5KB. Bundling has no cost.
5. **Existing pattern: `summary{}` and `calibration{}` and `versions[]` and `per_gw_rows{}` already coexist** in `accuracy_backtest.json`. Adding calibration was a sibling-key extension, not a structural change.

**When would a separate file be right?** If calibration grew to include per-player decile traces (cardinality ~700 x 10 buckets x 5 metrics) it would warrant separation. Current scope (position-level deciles only) does not.

**What still needs doing for Q2:** Nothing for the data layer. Optional: Decision Summary single-line health indicator that reads `useAccuracy().data.calibration` and outputs e.g. "Model haul predictions track actuals within 4pp across deciles" — a 30-LOC additive component, no new endpoint.

---

### Q3: Claude API integration patterns

The most important and most novel area. Four sub-decisions: caching, prompt caching headers, error handling, cost containment.

#### Q3a: Server-side Route Handler caching to Vercel Blob

**Decision: Two-tier cache by content type, with Blob as the durable second tier.**

For the **weekly prose summary (NLP-01)**, the pipeline already does this implicitly: `prose_summary.py` writes `weekly_summary.json` to Blob once per pipeline run (daily). `/api/prose-summary` GET simply reads Blob — there is no live LLM call in the GET path. Cost is fixed at one Haiku call per pipeline run.

For **per-player insights (NLP-02)**, the cardinality and refresh model are different:
- Up to ~700 players, but only a small fraction (probably <50) will be expanded by the user in a session.
- User clicks "Get AI insight" -> one Haiku call per click.
- The same player insight is reasonable to reuse within a GW (player context — `xPts_1gw`, `haul_prob`, fragility, rejection reasons — does not change until next pipeline run).

**Recommended caching layer for NLP-02 — per-player Blob cache keyed by (gw, element_id):**

```
Blob key:  player_insights/gw{N}/element_{element_id}.json
Contents:  { prose, player_name, generated_at, gw, model: 'claude-haiku-4-5' }
TTL:       Implicit — cache is invalidated when pipeline writes new merged_players.json
           (different GW number rotates the key prefix; old GW Blobs harmlessly remain).
```

**Route handler flow:**

```
POST /api/player-insight
  1. Validate body (Zod) — must include element_id and current_gw.
  2. Try Blob: list({ prefix: `player_insights/gw${gw}/element_${id}` })
     - HIT  -> fetch + return cached prose (Content-Source: cache header)
     - MISS -> fall through to step 3
  3. Read ANTHROPIC_API_KEY (503 if absent — same pattern as prose-summary).
  4. Read player corpus once (web_names) for guardrail.
  5. Build XML-structured prompt (only data from request body, no model recall).
  6. client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 256 })
  7. Validate response with single-name guardrail (player_name must appear; no
     other player names allowed).
  8. put(blobKey, JSON.stringify(payload), { access: 'public', addRandomSuffix: false })
  9. Return prose with Content-Source: live.
```

The `addRandomSuffix: false` is critical — Blob's default behaviour appends a random suffix to prevent overwrites, which would defeat the deterministic key. Verify before shipping that `put()` overwrites the existing blob when the same key is reused (Vercel Blob docs: setting `addRandomSuffix: false` means subsequent puts to the same pathname overwrite by default — confirm).

**Why Blob and not in-memory only:** Next.js Route Handlers in serverless mode (Vercel) are cold-started per request. An in-memory cache (e.g., a module-level `Map`) survives only for the lifetime of a warm container — typically minutes — and is per-instance, not shared. A user clicking the same player on two devices, or two seconds after a cold start, would re-pay the LLM cost. Blob makes the cache durable and instance-shared.

**Why not Next.js `unstable_cache` / `revalidateTag`:** Vercel's Data Cache is fast but ephemeral relative to LLM costs, and its 1MB-per-entry limit is fine for prose but its eviction policy is opaque. Blob storage is the durable surface this codebase already uses; consistency wins over a marginally faster cache hit.

**Why not KV / Redis / a DB:** Out of scope — PROJECT.md explicitly states "No database for v1". Blob is the established persistence primitive.

#### Q3b: Prompt caching headers (Anthropic's prompt caching feature)

**Decision: Apply prompt caching to the static system prompt and corpus, not to the dynamic user message.**

Anthropic supports prompt caching by adding `cache_control: { type: 'ephemeral' }` to the last block of a system or user content that should be cached. Cached prefix tokens are billed at 10% input cost on subsequent reads within ~5 minutes (extending to 1h with `type: 'ephemeral'` + the 1h beta header). The static parts of the per-player prompt are:

- The system prompt (instructions: "You are an FPL analyst… 2-3 sentences… only use input data… no other player names").
- (For NLP-02 multi-call sessions) The player corpus passed to the guardrail.

In the existing `/api/prose-summary` POST these are reconstructed per request without cache markers. For NLP-02, where a user might expand 10-30 players in quick succession, applying `cache_control` to the system block (a single block, ~150 tokens) yields cost reductions if Haiku pricing for cache reads is 10% of input cost.

**Implementation sketch:**

```typescript
const msg = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 256,
  system: [
    {
      type: 'text',
      text: systemPromptText,
      cache_control: { type: 'ephemeral' },  // cache the system prompt
    },
  ],
  messages: [{ role: 'user', content: userMsg }],
})
```

**Caveats:**
- Minimum cacheable prompt size is 1024 tokens for most models. A short system prompt (~150 tokens) is below the threshold and will not cache. To make caching effective, include the entire allowed-name corpus in the system prompt (sorted JSON, the existing strict-mode pattern). ~700 player names * ~3 tokens average = ~2100 tokens, comfortably above the threshold.
- Cache reads still count against rate limits. They only reduce token cost.
- Cache is per-organisation, per-model, per-cache-block-hash. Changing the corpus invalidates the cache (the player list won't change within a session; safe).

**Recommendation:** Apply prompt caching to NLP-02. Skip it for NLP-01 (one call per day, no caching benefit).

**LOW-MEDIUM confidence on the specific token thresholds** — confirm against current Anthropic docs (`docs.anthropic.com/en/docs/build-with-claude/prompt-caching`) at implementation time. Pricing changes have been known to alter cache economics.

#### Q3c: Error handling when API quota or rate limit is hit

**Decision: Distinguish four failure categories; degrade gracefully and surface a useful error UI per category.**

| Failure | Detection | Response Status | UI Behaviour |
|---------|-----------|-----------------|--------------|
| `ANTHROPIC_API_KEY` missing in env | `process.env.ANTHROPIC_API_KEY === undefined` | 503 Service Unavailable | "AI insights are not configured." Trigger button hidden. |
| Anthropic API auth error (401) | SDK throws `AuthenticationError` | 502 Bad Gateway | "AI service authentication failed." Manual refresh disabled for session. |
| Rate limit / quota (429) | SDK throws `RateLimitError` | 429 Too Many Requests | "Daily AI quota reached. Insights resume tomorrow." Button shows "AI quota reached" and remains disabled for 1h (TanStack Query staleTime). |
| Transient upstream error (5xx, network, timeout) | SDK throws other / generic catch | 502 Bad Gateway | "Couldn't generate insight. Retry?" Button re-enables for retry. |
| Guardrail rejection (LLM output mentions disallowed name or omits required name) | `passesGuardrail` returns false twice (after strict retry) | 422 Unprocessable Entity | "Generated insight didn't pass safety checks. Try again later." |

The existing prose-summary POST already handles cases 1, 2, 4, and 5 — see lines 194-234 of `prose-summary/route.ts`. Add explicit 429 handling for NLP-02 because per-player calls have higher request volume.

**Implementation:**

```typescript
try {
  const msg = await client.messages.create({...})
  ...
} catch (err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: 'AI auth failed' }, { status: 502 })
  }
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json(
      { error: 'AI quota reached', retryAfter: 3600 },
      { status: 429, headers: { 'Retry-After': '3600' } }
    )
  }
  return Response.json({ error: 'LLM error' }, { status: 502 })
}
```

`@anthropic-ai/sdk` exports `Anthropic.AuthenticationError`, `Anthropic.RateLimitError`, `Anthropic.APIError`, `Anthropic.APIConnectionError`, `Anthropic.BadRequestError` — pattern-match per the SDK error hierarchy (HIGH confidence — verified against SDK type exports).

**maxDuration:** Set `export const maxDuration = 30` (already set on prose-summary). Hobby plan allows up to 60s; 30s is comfortable headroom for one retry on the strict-mode path.

#### Q3d: Preventing runaway costs

**Decision: Layered defence — Blob cache (primary), client-side debouncing (secondary), per-day soft budget check (tertiary).**

Cost vectors for v1.18:

1. **NLP-01 weekly prose:** 1 Haiku call per pipeline run. Daily cron = ~30 calls/month. Cost ceiling: trivial.
2. **NLP-01 squad refresh (POST):** User-driven; expected <5 calls per session. Cost ceiling: trivial.
3. **NLP-02 per-player:** User-driven; *could* be 1 call per player expand. If a user expands all 700 players, that's 700 Haiku calls in a session. With Blob caching, subsequent same-GW expands cost 0.

**Cost containment ladder:**

| Defence | Mechanism | Effect |
|---------|-----------|--------|
| 1. Blob cache by `(gw, element_id)` | Q3a above | Eliminates repeat calls within a GW. Steady-state: every player called *at most once* per GW per managed Blob namespace. Worst case: 700 calls per GW (~$0.20 at Haiku pricing — trivial). |
| 2. Client-side mutation hook with single in-flight | `useMutation` with `mutationKey: ['playerInsight', playerId]`; ignore re-clicks while pending | Prevents double-click LLM spam. |
| 3. Confirm-before-call for low-info players | Don't auto-trigger on row expand. Trigger only on explicit "Get AI insight" button click. | User signals intent before spend. (Already the design — see NLP-02 spec.) |
| 4. (Optional) Per-day budget guard | Pipeline writes `daily_ai_budget.json { date, calls_made }`. Route handler increments and refuses calls beyond N (e.g., 500/day). | Hard ceiling. Probably overkill for single-user; recommend deferring unless multi-user. |
| 5. (Optional) Anthropic Console spending limit | Set hard monthly cap in Anthropic Console UI | Last-line defence against runaway bills. **Recommend enabling regardless.** |

**Most important containment:** Blob cache + on-demand trigger. This codebase is a single-user personal tool; an authenticated multi-user deployment would require defence 4.

#### Q3e: Server-side-only API key

The existing `prose-summary/route.ts` reads `process.env.ANTHROPIC_API_KEY` inside the handler and returns 503 if absent. Replicate verbatim for `/api/player-insight`. NEVER use `NEXT_PUBLIC_ANTHROPIC_API_KEY` — that prefix bundles into client JS. The Anthropic SDK has no client-side mode in this design.

---

### Q4: Should NLP routes stream or return full JSON?

**Decision: Non-streaming `client.messages.create()` returning full JSON. Same for NLP-01 and NLP-02.**

**Why:**

1. **Response size is small.** NLP-01 weekly prose targets 4-5 sentences (~150-250 tokens). NLP-02 per-player insight targets 2-3 sentences (~80-150 tokens). At Haiku's typical throughput (~200 tok/s) these arrive in ~1 second as a single chunk.
2. **Existing pattern is non-streaming.** `prose-summary/route.ts` POST uses `client.messages.create()`, returns `Response.json({ prose, gw, generated_at })`. Consistency is valuable; no need for two patterns.
3. **Guardrail discipline requires full response.** The existing two-attempt loop (lenient -> strict) needs the *complete* prose text to run `passesGuardrail(prose, allowed, corpus)`. Streaming would force either (a) collecting the stream into a buffer before guardrail (defeating streaming benefit) or (b) showing potentially-invalid prose to the user before the guardrail finishes. Neither is acceptable.
4. **Blob caching expects a string.** The cache payload is `{ prose: string, ... }` — naturally produced by full-response model. Streaming + cache would require buffering the stream server-side anyway.
5. **Frontend UX cost of streaming is high.** Streaming requires `ReadableStream` / `TransformStream` on the server and either Server-Sent Events parsing or a streaming-aware hook on the client. TanStack Query has limited first-class streaming support; adding a custom EventSource consumer is meaningful complexity for a sub-1s payload.

**Counter-arguments considered and rejected:**

- *"Streaming feels faster"* — at 100 tokens for NLP-02, the user sees a 200-400ms delay vs. instant. Below perception threshold. The user is more likely to perceive cold-start latency (200ms) and Blob-cache check (50ms) than the LLM completion time.
- *"Future-proofing for longer prose"* — if v1.19 introduces a 2000-token detailed analysis (e.g., a full mini-league rival breakdown), streaming may be revisited. For 250-token prose, non-streaming is correct.

**maxDuration setting:** `export const maxDuration = 30` (already used). Adequate for one retry on strict-mode guardrail.

**Cache-Control header on the response:** For NLP-02 cached-from-Blob responses, set `Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400` so Vercel's edge cache can also serve the response without invoking the route handler. For live LLM responses, set `Cache-Control: no-store` to ensure the Blob is the source of truth.

---

### Q5: Per-player sensitivity scores — compute in pipeline or client-side at display time?

**Decision: Client-side at display time. Already implemented this way — keep it.**

**Why:**

1. **Pure-TypeScript engine already exists.** `src/lib/sensitivity.ts` exports `computeFragility(player, isTransfer, xPtsGain?)` running 5 perturbations over fields already on `MergedPlayer` (`xPts_1gw`, `start_prob`, `cs_prob_1gw`, `bonus`, `price`). No new pipeline output is needed.
2. **Sensitivity depends on the *display context*, not just the player.** Same player has different fragility depending on `isTransfer` (true for buy candidates in TransferPanel; false for hold candidates in GemTable) and on `xPtsGain` (only known *after* `suggestTransfers()` runs in the browser). The pipeline cannot know which players the user will examine as transfer candidates — it would have to write fragility for every (player, context) combination.
3. **Cheap at render time.** 5 perturbations per player = ~5 multiply-add operations. Even iterating over 700 players: <1ms total. No memoisation needed for v1.18; if profiling shows otherwise, `useMemo` over `(playerId, isTransfer, xPtsGain)` is a 3-line change.
4. **Co-located with consumer logic.** Fragility tier matters for the captain panel (highlight robust captains), the gem table (badge fragility next to xPts), and the transfer panel (warn on knife-edge buys). All three are client components — putting fragility in a TypeScript pure function next to them maximises code locality.
5. **Pipeline already has too many fields.** Adding `fragility_tier` per player to `merged_players.json` adds size without adding capability the client doesn't already have. Resist field bloat — PITFALLS.md (existing) calls out merged_players.json schema churn as a known risk.

**Confirmed analogous decisions in the codebase:**
- `computeLifecycleLabel` — pure TS over MergedPlayer fields, client-side.
- `computeRejection` (WHY-01) — pure TS, client-side, depends on full population for rank.
- `computeFragility` (SENS-01) — pure TS, client-side.
- `computeMCLabels` — pure TS over MC-output fields, client-side.

All v1.7+ "interpretation" logic that *derives from* pipeline output runs in the browser. The pipeline produces facts; the browser computes opinions.

**What goes IN the pipeline:** Anything that depends on (a) data unavailable in the browser (raw FPL API, Understat shot data, historical per-GW rows), (b) compute too expensive for the browser (10k MC iterations across 700 players), or (c) cross-player aggregations that benefit from a single batch run (calibration deciles, position medians for `differential_flag`).

**What stays in the browser:** Interpretation, contextual labels, perturbation sensitivity, head-to-head comparisons, prose context assembly — anything where the function signature is `(player, otherPlayers, displayContext) -> ui_hint`.

---

## Component Boundaries

### Data Flow Summary by Feature

```
MC-01 distributions:
  merged_players.json (blank_prob, haul_prob, p10_pts, p90_pts) [gate=true]
    -> /api/players (unchanged passthrough)
    -> usePlayers() (6h staleTime, unchanged)
    -> GemTable row expand: NEW MCDistributionBar component
    -> TransferPanel row card: inline P10/P50/P90 trio
    -> CaptainPicksPanel: already consumes via computeMCLabels

CAL-01 calibration:
  accuracy_backtest.json (calibration.by_position) [already present]
    -> /api/accuracy (unchanged passthrough)
    -> useAccuracy() (6h staleTime, unchanged)
    -> AccuracyTab: CalibrationSection [already rendered]
    -> (optional) DecisionSummaryTab: NEW one-line health indicator

SENS-01 fragility:
  Pure TS - no pipeline data needed beyond MergedPlayer
    -> computeFragility(player, isTransfer, xPtsGain?) [exists]
    -> GemTable row expand [exists]
    -> CaptainPicksPanel [exists]
    -> TransferPanel buy candidates [NEW call site]

WHY-01 rejection reasons:
  Pure TS - needs full ScoredPlayer[] population for rank
    -> computeRejection(player, allPlayers, lifecycleMap) [exists]
    -> GemTable row expand [exists]
    -> ComparisonSearch head-to-head [exists]
    -> TransferPanel non-recommended players [NEW call site]

NLP-01 weekly prose:
  Pipeline: prose_summary.py -> weekly_summary.json
  /api/prose-summary GET + POST [both exist]
  useProseSummary + useProseRefresh hooks [exist]
  DecisionSummaryTab ProseSummaryBlock [exists]
  No change for v1.18.

NLP-02 per-player insight:
  Client triggers: PlayerInsightTrigger button
    -> usePlayerInsight (useMutation, mutationKey: ['playerInsight', playerId, gw])
    -> POST /api/player-insight {element_id, gw, player_context}
       -> Blob cache check (player_insights/gw{N}/element_{id}.json)
          -> HIT: return cached
          -> MISS: Claude Haiku call -> guardrail -> Blob put -> return
    -> PlayerInsightBlock renders in GemTable row expand + TransferPanel
```

### New vs Modified Files

| Path | Type | Purpose |
|------|------|---------|
| `src/components/gem-table/MCDistributionBar.tsx` | NEW | Render P10/P50/P90 distribution bar + `haul_prob`/`blank_prob` chips. Renders only when `haul_prob !== undefined` (gate-aware). |
| `src/app/api/player-insight/route.ts` | NEW | POST handler — Zod-validated body, Blob cache lookup, ANTHROPIC_API_KEY guard, Haiku call with prompt caching on system block, single-name guardrail, Blob put on success, full-JSON response. `maxDuration = 30`. |
| `src/lib/hooks/usePlayerInsight.ts` | NEW | `useMutation` wrapping POST. `mutationKey: ['playerInsight', playerId, gw]` for in-flight dedup. No TanStack Query caching — Blob is the durable layer. |
| `src/components/gem-table/PlayerInsightTrigger.tsx` | NEW | "Get AI insight" button + result block. Lazy render — never auto-call on row expand. |
| `src/lib/types.ts` | MODIFY | Add `PlayerInsightRequest`, `PlayerInsightResponse`. Add `cache_source: 'cache' \| 'live'` to response. |
| `src/components/gem-table/GemTable.tsx` | MODIFY | Mount `MCDistributionBar` (when `haul_prob !== undefined`) and `PlayerInsightTrigger` in row-expand panel. |
| `src/components/transfers/TransferPanel.tsx` | MODIFY | Add `computeFragility(buy, true, xPtsGain)` -> `FragilityBadge` per row. Add `computeRejection(sell, allPlayers, lcMap)` -> reasons list. Add `PlayerInsightTrigger`. |
| `src/components/squad/DecisionSummaryTab.tsx` | MODIFY (optional) | Add calibration health one-liner reading `useAccuracy().data.calibration`. |
| `src/components/accuracy/AccuracyTab.tsx` | NONE | Already complete. |

### Boundaries Summary

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Python pipeline -> Blob -> Next.js route | JSON files; daily cron | MC fields in merged_players.json (existing). Calibration in accuracy_backtest.json (existing). |
| Next.js route -> TanStack Query -> React | REST GET (cached) + POST (mutation) | `usePlayers`/`useAccuracy` already deliver MC + calibration. New `usePlayerInsight` is a mutation, not a query. |
| TS engines -> React | Pure function imports | `computeFragility`, `computeRejection`, `computeMCLabels` all callable inline in render. No hook wrapper. |
| React -> Claude API | Only via `POST /api/player-insight` or `POST /api/prose-summary` | API key never crosses the network boundary to the client. |
| Route handler -> Blob | `list()` for read, `put({ addRandomSuffix: false })` for write | Deterministic key — no GET on a randomised URL. |

---

## Recommended Project Structure (additions only)

```
src/
├── app/api/
│   └── player-insight/
│       └── route.ts                       # NEW - per-player Haiku POST + Blob cache
├── components/
│   ├── gem-table/
│   │   ├── MCDistributionBar.tsx          # NEW - P10/P50/P90 + haul/blank
│   │   └── PlayerInsightTrigger.tsx       # NEW - on-demand insight button + block
│   └── shared/
│       └── FragilityBadge.tsx             # EXISTING (no change)
└── lib/
    ├── hooks/
    │   └── usePlayerInsight.ts            # NEW - useMutation wrapper
    └── types.ts                           # MODIFY - add PlayerInsight request/response

pipeline/
├── simulate.py                            # EXISTING - no change
├── accuracy.py                            # EXISTING - no change (calibration in place)
└── prose_summary.py                       # EXISTING - no change
```

---

## Build Order

The dependency graph is shallow but important. Five phases, ordered.

### Phase 1: Enable MC Gate + Build MCDistributionBar (MC-01 remainder)

**What:** (1) Verify current `mc_enabled: false` in `accuracy_backtest.json.summary`. Run pipeline one cycle, confirm non-regression of `merged_players.json` size and shape. Manually flip `mc_enabled` to `true` in the JSON, push to Blob. Next cron run computes MC. (2) Build `MCDistributionBar` component, mount in GemTable row-expand under a `haul_prob !== undefined` guard.

**Why first:**
- `haul_prob` flows into `computeMCLabels` which already runs in `CaptainPicksPanel`. Until the gate flips, the label cascade is invisible.
- The richer per-player LLM context (Phase 5) wants `haul_prob` and `blank_prob` as inputs. Enabling MC first means NLP-02 can leverage them on day one.
- Gate flip is reversible (flip back to false; next run skips MC). Low-risk first step.

**Depends on:** Nothing.

### Phase 2: Calibration Health Indicator (CAL-01 remainder)

**What:** Single-line indicator on `DecisionSummaryTab` reading `useAccuracy().data.calibration`, summarising calibration error (e.g., mean absolute gap between predicted and actual haul rate across deciles).

**Why second:** Purely additive, 30 LOC, no new infrastructure. Builds manager confidence in the recommendations the Decision Summary card series below it provides.

**Depends on:** Nothing.

### Phase 3: Sensitivity in TransferPanel (SENS-01 remainder)

**What:** Call `computeFragility(buy, true, xPtsGain)` per buy candidate in TransferPanel. Render `FragilityBadge` inline.

**Why third:** `computeFragility` is unit-tested and used in two existing call sites. This is a call-site addition, not engine work. Transfer fragility is the most decision-relevant surface — the manager *acts* on TransferPanel.

**Depends on:** Nothing.

### Phase 4: Rejection Explainer in TransferPanel (WHY-01 remainder)

**What:** Call `computeRejection(player, allPlayers, lifecycleMap)` for sell-side or non-recommended players in TransferPanel. Top 2 reasons inline.

**Why fourth:** Lifecycle map is needed; computing it inline in TransferPanel over its squad data is simpler than prop-drilling from page.tsx. Phase 4 immediately follows Phase 3 — same file, one touch.

**Depends on:** Phase 3 (combine TransferPanel mods into one commit / one PR).

### Phase 5: NLP-02 Per-Player Insight Vertical (new route + hook + UI)

**What:** Build `POST /api/player-insight` with Blob caching, prompt-caching on system block, layered error handling, single-name guardrail. Build `usePlayerInsight` mutation hook. Build `PlayerInsightTrigger` component. Mount in GemTable row expand and TransferPanel. Set Anthropic Console spending limit before merging.

**Why fifth and last:**
- Benefits from Phase 1 (richer MC context for the prompt — `haul_prob`, `blank_prob`).
- Benefits from Phases 3-4 (fragility tier and rejection reasons available to pass into the LLM context for a more grounded insight).
- Highest scope, highest risk (LLM cost, guardrail correctness, Blob cache key strategy). Last in build order so all upstream context is correct.

**Depends on:** Phase 1 (MC gate active for richer context). Phases 3-4 strictly optional but recommended for prompt quality.

**Sub-tasks:**
1. Add `ANTHROPIC_API_KEY` and verify in deployment env.
2. Set Anthropic Console monthly spending cap (operational safety, not code).
3. Implement route with full error-class mapping (Q3c).
4. Implement Blob cache (`addRandomSuffix: false`, key by `gw + element_id`).
5. Add prompt caching `cache_control: 'ephemeral'` on system block (include corpus to clear 1024-token threshold).
6. Build `usePlayerInsight` mutation hook with `mutationKey: ['playerInsight', playerId, gw]`.
7. Build `PlayerInsightTrigger` (button + lazy block + loading + error states for each of the 5 failure categories).
8. Wire into GemTable row expand and TransferPanel.
9. Test: cold cache (live LLM), warm cache (Blob hit), missing API key (503), simulated 429 (retry-after behaviour), guardrail rejection.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: MC in the Browser

**What people do:** Port `simulate.py`'s NumPy Poisson sampling to JS and run 1000+ iterations client-side.

**Why wrong:** 1000 * 700 players = 700k draws per page load. Web Worker mitigates blocking but adds 1MB+ of JS, and floating-point disagreement with the Python output causes confusing UX inconsistencies.

**Instead:** Python pipeline is authoritative. Browser reads scalars.

### Anti-Pattern 2: Exposing ANTHROPIC_API_KEY to the Client

**What people do:** Import `@anthropic-ai/sdk` in a React component, or use `NEXT_PUBLIC_ANTHROPIC_API_KEY`.

**Why wrong:** `NEXT_PUBLIC_*` is bundled into client JS. Billing credential visible in DevTools.

**Instead:** Server-side route handlers only. `process.env.ANTHROPIC_API_KEY`. The existing `prose-summary/route.ts` is the reference.

### Anti-Pattern 3: Hallucination via Open-Ended Prompts

**What people do:** Ask "tell me about Salah this week" with no structured input.

**Why wrong:** Model recalls training data — stale, sometimes confused between players, may invent statistics.

**Instead:** Pass structured XML in the prompt with only the data from the request body. System prompt explicitly says "Refer to players qualitatively — do not include statistics or numeric values not in the input." Plus guardrail: single allowed player name; corpus-based rejection of any other name in output.

### Anti-Pattern 4: Calibration in a Separate Blob File

**What people do:** Write `calibration.json` as a new pipeline artifact with its own `/api/calibration` route.

**Why wrong:** Same compute, same cadence, same consumer. Two files = consistency window where one is fresh and one stale.

**Instead:** Live inside `accuracy_backtest.json.calibration`. Already implemented.

### Anti-Pattern 5: Streaming LLM Responses for Short Prose

**What people do:** Stream Haiku output progressively via `client.messages.stream()`.

**Why wrong:** 100-token response arrives in <1s anyway. Streaming requires `ReadableStream` server, SSE parser client, breaks the guardrail two-attempt loop, and is incompatible with the Blob cache `put(string)` pattern.

**Instead:** Non-streaming `client.messages.create()` -> full JSON response.

### Anti-Pattern 6: TanStack Query Caching of LLM Responses

**What people do:** Use `useQuery` for per-player insight; rely on TanStack Query staleTime for cost control.

**Why wrong:** TanStack Query cache is per-browser-tab and ephemeral. Two tabs = two LLM calls. Refresh = two LLM calls. It is the wrong layer for billing-significant cache.

**Instead:** `useMutation` for the call. Blob for the cache. Route handler enforces the cache lookup. Same player on a new tab still gets a cache hit.

### Anti-Pattern 7: Failing Open on Missing API Key

**What people do:** Catch the missing-key error and return placeholder prose like "AI insight not available."

**Why wrong:** Looks like a transient error; user retries; same failure. Worse, masks deployment misconfiguration.

**Instead:** Return 503 with explicit "service not configured" error. UI hides the "Get AI insight" button entirely when the route returns 503 on first check. The existing `/api/prose-summary` does this correctly.

### Anti-Pattern 8: Adding `fragility_tier` to merged_players.json

**What people do:** "Let's just put fragility in the pipeline output so the client doesn't compute it every render."

**Why wrong:** Fragility depends on `isTransfer` and `xPtsGain` — context the pipeline doesn't have. Pre-computing for all contexts = (2 isTransfer states) * (N transfer suggestions) — combinatorial. Pre-computing for just `isTransfer=false` and recomputing for transfers in the browser = two source-of-truth implementations that will drift.

**Instead:** Compute in TS at display time. ~1ms per row. Same for `lifecycle_label`, `rejection_reasons`, `mc_labels`.

---

## Integration Points Summary

### External Services

| Service | Pattern | Notes |
|---------|---------|-------|
| Claude API (Anthropic) | Server-side `@anthropic-ai/sdk` in Next.js Route Handlers | `claude-haiku-4-5`, `max_tokens` 256 (per-player) or 512 (weekly), non-streaming. ANTHROPIC_API_KEY env var only. Prompt caching on system block for NLP-02. |
| Vercel Blob | Server-side read in route handlers; server-side write from Python pipeline and from new player-insight route | `USE_BLOB` env switch. New cache namespace: `player_insights/gw{N}/element_{id}.json` with `addRandomSuffix: false`. |
| FPL API | Existing proxy `/api/fpl/[...proxy]` | No new endpoints needed. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pipeline -> Blob | JSON files written by Python | MC fields in merged_players.json. Calibration in accuracy_backtest.json. Weekly prose in weekly_summary.json. No new pipeline files. |
| Blob -> Route handler | `list()` + `fetch(blob.url)` for read; `put()` for write | Deterministic keys for cache (`addRandomSuffix: false`). |
| Route handler -> Client | Typed JSON responses with `Cache-Control` headers | Existing pattern: `public, s-maxage=3600, stale-while-revalidate=86400`. Player-insight cached responses: 24h s-maxage. Live LLM responses: `no-store`. |
| Client component -> Anthropic | Always via route handler | Never directly. No SDK in client bundle. |
| TS engines -> React | Pure function imports | computeFragility, computeRejection, computeMCLabels, computeLifecycleLabel. |

---

## Scalability Considerations

| Concern | Single user (current) | If 100 users (hypothetical) | If 10k users (further hypothetical) |
|---------|-----------------------|-----------------------------|--------------------------------------|
| Blob storage per-player insight cache | ~700 files * 200 bytes prose = ~150KB/GW; rotates per GW | ~150KB/GW (cache is shared globally — every user benefits from the same cached prose) | Same — cache is content-keyed, not user-keyed |
| Anthropic API spend NLP-02 | Worst case 700 calls/GW @ ~$0.005 = $3.50/GW | Same (shared cache!) | Same |
| Anthropic API spend NLP-01 | 1 call/day | 1 call/day (pipeline-driven, not user-driven) | 1 call/day |
| Route handler concurrency | Trivial | Negligible (cache hit rate >95%) | Add per-IP rate limit; cap concurrent LLM calls; consider warming the cache from pipeline |
| Pipeline run cost (MC + LLM) | ~1min compute, $0.01 Haiku | Same | Same |

The single biggest scalability win is that the NLP-02 cache is **content-keyed**, not user-keyed. The 100th user to click "Get insight on Salah" pays nothing — they hit the cache the first user populated.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| MC pipeline integration | HIGH | `simulate.py` + `run.py` call site + accuracy.py gate handling all verified in this session. Field schema verified against `MergedPlayer` type. |
| Calibration storage pattern | HIGH | `_compute_calibration_data()` in `accuracy.py` line 496; sibling-key in `accuracy_backtest.json.calibration` verified in this session. |
| SENS-01 + WHY-01 patterns | HIGH | Engines and badge components verified to exist with usage call sites in GemTable / CaptainPicksPanel / ComparisonSearch. |
| NLP-01 pattern | HIGH | `/api/prose-summary/route.ts` POST handler read in full this session — error handling, guardrail, ANTHROPIC_API_KEY pattern, maxDuration, XML prompt structure all verified. |
| Proposed Blob cache for NLP-02 | MEDIUM | Pattern is a direct extension of the existing `put`/`list` pattern. `addRandomSuffix: false` overwrite semantics inferred from Vercel Blob docs — verify in implementation. |
| Anthropic prompt caching specifics | MEDIUM | Pattern (cache_control on system block) is well-documented in Anthropic SDK. Token thresholds (1024-token minimum) and pricing (10% cost on cache reads) should be re-verified against current docs at implementation. |
| Anthropic error class hierarchy | HIGH | `Anthropic.RateLimitError`, `AuthenticationError`, etc. verified via SDK type exports; same pattern used in existing route. |
| Cost containment ladder | HIGH | Logic is straightforward; Blob cache + on-demand trigger is sufficient for single-user. Multi-user defence (per-day budget) flagged as optional. |
| Build-order dependency graph | HIGH | Derived from direct read of current call sites. Phase 1 (MC gate) unblocks Phase 5 (NLP-02 context). Phases 2-4 are independent additive changes. |

---

## Sources

All findings from direct codebase reads — no web search required.

- `.planning/PROJECT.md` — milestone context, key decisions table
- `pipeline/simulate.py` lines 1-80 — MC algorithm, field schema, N_SIMS env config
- `pipeline/accuracy.py` lines 73-82, 348-410, 496+ — `mc_enabled` gate persistence, calibration computation
- `pipeline/run.py` lines 193-225 — pipeline orchestration, gate read, conditional simulate call
- `src/app/api/prose-summary/route.ts` (full) — Anthropic API integration pattern, error classes, Zod validation, maxDuration, guardrail two-attempt loop
- Existing research files `.planning/research/STACK.md`, `FEATURES.md`, `PITFALLS.md`, `SUMMARY.md` — referenced for consistency

---
*Architecture research for: FPL Analyst v1.18 Forecast Transparency & AI Intelligence*
*Researched: 2026-05-13*
