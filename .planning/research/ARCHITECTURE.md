# Architecture Patterns — v1.18 Forecast Transparency & AI Intelligence

**Domain:** FPL Analyst — subsequent milestone, integrating MC simulation, calibration charts, sensitivity flags, rejection explainers, and Claude API prose into the existing pipeline-Blob-API-Query-React stack.
**Researched:** 2026-05-12
**Confidence:** HIGH — all findings derived from direct codebase reads of `pipeline/simulate.py`, `pipeline/accuracy.py`, `pipeline/prose_summary.py`, `pipeline/run.py`, `src/app/api/prose-summary/route.ts`, `src/lib/sensitivity.ts`, `src/lib/mc-labels.ts`, `src/lib/explain.ts`, `src/lib/hooks/useProseSummary.ts`, `src/lib/hooks/useProseRefresh.ts`, `src/components/captaincy/CaptainPicksPanel.tsx`, `src/components/gem-table/GemTable.tsx`, `src/components/squad/DecisionSummaryTab.tsx`, and `src/components/accuracy/AccuracyTab.tsx`.

---

## Critical Finding: Most v1.18 Features Already Have Infrastructure

Before detailing the architecture, the single most important finding from the codebase audit:

| Feature | Status |
|---------|--------|
| MC-01: Monte Carlo Simulator | **Pipeline complete.** `pipeline/simulate.py` fully implemented, called from `run.py` behind `mc_enabled` gate. `MergedPlayer` type extended with `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory`. |
| CAL-01: Calibration Charts | **Pipeline complete + UI complete.** `_compute_calibration_data()` in `accuracy.py` writes `accuracy_backtest.json.calibration`. `CalibrationSection` in `AccuracyTab.tsx` renders two Recharts charts (haul-rate reliability diagram + xPts mean chart). |
| SENS-01: Sensitivity Flags | **TypeScript engine complete + UI integrated.** `src/lib/sensitivity.ts` exports `computeFragility()` with 5 perturbations, tristate `FragilityTier`. `FragilityBadge` component exists. Already used in `GemTable.tsx` (row expand) and `CaptainPicksPanel.tsx`. |
| WHY-01: Rejection Explainer | **TypeScript engine complete + UI integrated.** `src/lib/explain.ts` exports `computeRejection()` (8-predicate cascade) and `computeHeadToHead()`. Both used in `GemTable.tsx` row expand. `ComparisonSearch` component implements head-to-head comparison. |
| NLP-01: LLM weekly prose | **Complete.** Pipeline: `prose_summary.py` → `weekly_summary.json` → Blob. API: `/api/prose-summary` GET. Hook: `useProseSummary`. UI: `ProseSummaryBlock` in `DecisionSummaryTab`. |
| NLP-02: Squad-aware prose refresh | **Complete.** API: `/api/prose-summary` POST (Phase 67). Hook: `useProseRefresh`. UI: `ProseSummaryBlock` "Refresh" button, payload assembled in `DecisionSummaryTab`. |

The v1.18 milestone is therefore about **wiring existing implementations to their display surfaces** and **enabling the `mc_enabled` gate** — not building from scratch. The roadmap phases are integration and activation phases, not new-implementation phases.

---

## Existing Architecture (Verified Baseline — v1.17 shipped)

```
+-------------------------------------------+
| GitHub Actions cron (pipeline.yml)        |
| pipeline/run.py  — try/except orchestrator|
|   bootstrap + fixtures + element-summary  |
|   xmins → bonus → saves → merge_players  |
|   if mc_enabled: compute_simulations()    | ← simulate.py ALREADY CALLED
|   insights, gw_intel, price_changes       |
|   defcon, accuracy (writes calibration)   |
|   prose_summary (Claude Haiku call)       |
|   data_health.json (last artifact)        |
+------------------+------------------------+
                   |
                   v  pipeline/cache/ or Vercel Blob
+------------------+------------------------+
| merged_players.json                       | ← blank_prob, haul_prob, p10/p90 WHEN mc_enabled=true
| accuracy_backtest.json                    | ← calibration{} ALREADY PRESENT
| captain_picks.json / captain_picks_gwN    |
| weekly_summary.json                       | ← NLP-01 output (pipeline-generated)
| [all other artifacts]                     |
+------------------+------------------------+
                   |
                   v
+------------------+------------------------+
| Next.js 16 Route Handlers (/api/*)        |
|  /api/players     → merged_players.json   |
|  /api/accuracy    → accuracy_backtest.json|
|  /api/prose-summary GET  → weekly_summary |
|  /api/prose-summary POST → Claude API     | ← ANTHROPIC_API_KEY server-side only
+------------------+------------------------+
                   |
                   v
+------------------+------------------------+
| TanStack Query (6h staleTime convention)  |
|  usePlayers(), useAccuracy()              |
|  useProseSummary(), useProseRefresh()     |
+------------------+------------------------+
                   |
                   v
+------------------+------------------------+
| React Components                          |
|  AccuracyTab.tsx  → CalibrationSection    | ← ALREADY RENDERS calibration charts
|  CaptainPicksPanel → computeMCLabels      | ← ALREADY uses MC fields
|  CaptainPicksPanel → computeFragility     | ← ALREADY uses sensitivity
|  GemTable.tsx     → computeRejection      | ← ALREADY uses WHY-01 in row expand
|  GemTable.tsx     → computeFragility      | ← ALREADY uses SENS-01 in row expand
|  DecisionSummaryTab → ProseSummaryBlock   | ← ALREADY shows NLP-01/NLP-02
+------------------+------------------------+
```

---

## Integration Point Map: New vs Modified vs Existing

### MC-01: Monte Carlo Simulator

**What still needs doing:** The `mc_enabled` gate in `accuracy_backtest.json.summary` is `false` by default. To activate, a human must manually flip it to `true` after verifying a successful pipeline non-regression run. No code changes are needed for the existing simulation. However, the **MC distribution panel** — showing `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` in a visual distribution bar for each player in GemTable or TransferPanel — does not yet exist as a standalone component.

| Component | Status | Action |
|-----------|--------|--------|
| `pipeline/simulate.py` | DONE | Enable via `mc_enabled` gate flip |
| `MergedPlayer` types (blank_prob, haul_prob, etc.) | DONE | No change |
| `computeMCLabels` in `CaptainPicksPanel` | DONE | No change |
| MC distribution bar in GemTable row expand | NOT YET | NEW component `MCDistributionBar` |
| MC distribution in TransferPanel | NOT YET | Extend existing TransferPanel |

**Data flow (MC display):**
```
merged_players.json (blank_prob, haul_prob, p10_pts, p90_pts)
  → /api/players (passthrough, no change)
  → usePlayers() (no change, 6h staleTime)
  → GemTable row expand: NEW MCDistributionBar component
  → TransferPanel: inline P10/P50/P90 trio in player card
```

**Gate activation protocol (D-01 in simulate.py):**
1. Verify `mc_enabled = false` in current `accuracy_backtest.json.summary`
2. Manually flip to `true` in the JSON file and push to Blob
3. Next pipeline run reads the gate and calls `compute_simulations()`
4. Verify merged_players.json output has `blank_prob`, `haul_prob` fields
5. Version-history entry in `accuracy_backtest.json.versions` captures the activation

### CAL-01: Calibration Charts

**What still needs doing:** Calibration charts already render in `AccuracyTab.tsx` under the "Calibration" sub-tab. The only outstanding work is surfacing a **calibration health indicator** in the Decision Summary (a single sentence like "Model is well-calibrated: actual rates track predictions within 5pp"). This requires reading the calibration data downstream from `useAccuracy()`.

| Component | Status | Action |
|-----------|--------|--------|
| `_compute_calibration_data()` in `accuracy.py` | DONE | No change |
| `CalibrationSection` in `AccuracyTab.tsx` | DONE | No change |
| Calibration health indicator in `DecisionSummaryTab` | NOT YET | NEW — read `useAccuracy().data.calibration` |

### SENS-01: Sensitivity Flags

**What still needs doing:** `computeFragility()` runs in `GemTable` row expand and `CaptainPicksPanel`. The `FragilityBadge` component exists. The outstanding gap is surfacing fragility in the **TransferPanel** for transfer candidates — today TransferPanel shows transfers but does not call `computeFragility`.

| Component | Status | Action |
|-----------|--------|--------|
| `src/lib/sensitivity.ts` (engine) | DONE | No change |
| `src/components/shared/FragilityBadge.tsx` | DONE | No change |
| `GemTable.tsx` row expand fragility | DONE | No change |
| `CaptainPicksPanel.tsx` fragility | DONE | No change |
| `TransferPanel.tsx` fragility for buy candidates | NOT YET | MODIFY — call `computeFragility(buyCandidate, true, xPtsGain)` |

**Integration pattern (transfer path):**
```typescript
// In TransferPanel, per transfer suggestion row:
const { tier, reasons } = computeFragility(suggestion.buy, true, suggestion.xPtsGain)
// isTransfer=true enables the cost perturbation (d)
// xPtsGain from suggestTransfers() output already available
```

### WHY-01: Rejection Explainer

**What still needs doing:** `computeRejection()` runs in `GemTable` row expand. The gap is surfacing rejection reasons in the **TransferPanel** for players that the engine ranked lower — answering "why isn't this player recommended?".

| Component | Status | Action |
|-----------|--------|--------|
| `src/lib/explain.ts` (engine: `computeRejection`, `computeHeadToHead`) | DONE | No change |
| `GemTable.tsx` row expand rejection panel | DONE | No change |
| `ComparisonSearch.tsx` head-to-head comparison | DONE | No change |
| `TransferPanel.tsx` rejection reasons for non-recommended players | NOT YET | MODIFY — show "Why not?" section using `computeRejection` |

**Integration note:** `computeRejection` needs the full population (`ScoredPlayer[]`) for xPts rank. `usePlayers()` already returns all players. The lifecycle labels `Map<number, LifecycleLabel>` needs to be computed (from `computeLifecycleLabel()` over the squad — already done in `DecisionSummaryTab` but not threaded to TransferPanel). Options: (a) pass lifecycle map as prop from page.tsx, (b) recompute inside TransferPanel with the squad data it already holds. Option (b) is simpler and avoids prop drilling.

### NLP-01: LLM Weekly Prose (Decision Summary)

**Status: COMPLETE.** No outstanding integration work.

- Pipeline: `prose_summary.py` → `weekly_summary.json` → Blob (DONE)
- API: `GET /api/prose-summary` (DONE)
- Hook: `useProseSummary()` (DONE)
- UI: `ProseSummaryBlock` in `DecisionSummaryTab` (DONE)
- Guardrail: `prose-guardrail.ts` exact-name check (DONE)

### NLP-02: Per-Player LLM Insights

**Status: The squad-aware POST endpoint is DONE. Per-player endpoint is NOT YET BUILT.**

The existing `/api/prose-summary` POST accepts a squad-level payload (captains, transfer, chip, risks). It does NOT accept a per-player context payload. For GemTable row expand and TransferPanel per-player insights, a new route (or an extended POST schema) is needed.

| Component | Status | Action |
|-----------|--------|--------|
| `/api/prose-summary` GET (pipeline prose) | DONE | No change |
| `/api/prose-summary` POST (squad-aware refresh) | DONE | No change |
| `/api/player-insight` POST (per-player prose) | NOT YET | NEW ROUTE |
| `usePlayerInsight(playerId)` | NOT YET | NEW MUTATION HOOK |
| Per-player insight block in GemTable row expand | NOT YET | MODIFY GemTable |
| Per-player insight block in TransferPanel | NOT YET | MODIFY TransferPanel |

**New `/api/player-insight` route design:**

```typescript
// Request body (validated with Zod)
interface PlayerInsightRequest {
  player: {
    name: string           // web_name — guardrail allowed name
    team: string           // team_short_name
    position: 'GK' | 'DEF' | 'MID' | 'FWD'
    xPts_1gw: number | null
    haul_prob: number | null   // MC field — optional, only when mc_enabled
    blank_prob: number | null  // MC field — optional, only when mc_enabled
    fragility_tier: 'robust' | 'fragile' | 'knife_edge' | null
    rejection_reasons: string[]  // from computeRejection (empty = positive framing)
    lifecycle_label: string | null
  }
}

// Response
interface PlayerInsightResponse {
  prose: string       // 2-3 sentence per-player insight
  player_name: string // echo for cache keying
  generated_at: string
}
```

**Context assembly without hallucination risk:**

The key anti-hallucination discipline is already established in the existing prose route: pass only structured data in the prompt, never ask Claude to recall knowledge about the player. Apply the same discipline to per-player insights:

```
System: "You are an FPL analyst. Describe this player's outlook using ONLY the data in <input>.
         Do not mention statistics not in the input. Do not mention other players. 2-3 sentences."

User: <input>
  <player name="Salah" team="LIV" position="MID" xPts="7.2" haul_prob="0.41"
          blank_prob="0.12" fragility="robust" lifecycle="buy_next_week" />
  <rejection_reasons />   <!-- empty = positive framing; or list reasons -->
</input>
```

The guardrail for per-player insights is simpler: the response must not contain any player name other than the one in `<input>` (single-name guardrail, not the multi-name corpus check used for the summary).

**Security: server-side only.** `ANTHROPIC_API_KEY` is accessed only inside `/api/player-insight/route.ts`. No client-side SDK usage ever. This is already established by the existing prose-summary route which reads `process.env.ANTHROPIC_API_KEY` server-side.

**Streaming vs non-streaming:**

Streaming is NOT recommended for per-player insights. Reasons:
1. Existing prose-summary route uses non-streaming `client.messages.create()` — consistent pattern is valuable.
2. 2-3 sentence response = ~100 tokens = sub-1-second Haiku response time. Streaming latency overhead exceeds the content length benefit.
3. Streaming requires `TransformStream` / `ReadableStream` response and client-side event parsing — added complexity for minimal UX gain.
4. Non-streaming with `maxDuration = 30` (already set on the prose-summary route) is sufficient.

---

## Component Boundaries

### Data Flow for New Components

```
merged_players.json (blank_prob, haul_prob, p10_pts, p90_pts when mc_enabled=true)
  ↓ /api/players (GET, passthrough — unchanged)
  ↓ usePlayers() (6h staleTime — unchanged)
  ↓ GemTable row expand
      ├── computeRejection(player, allPlayers, lifecycleMap)  [existing, WHY-01]
      ├── computeFragility(player, false)                     [existing, SENS-01]
      ├── NEW: MCDistributionBar({blank_prob, haul_prob, p10, p90})
      └── NEW: PlayerInsightTrigger → POST /api/player-insight

accuracy_backtest.json (calibration{} already present)
  ↓ /api/accuracy (GET, passthrough — unchanged)
  ↓ useAccuracy() (6h staleTime — unchanged)
  ↓ AccuracyTab.tsx
      └── CalibrationSection  [existing, CAL-01 — already renders]

suggestTransfers() output (xPtsGain per candidate — existing in TransferPanel)
  ↓ computeFragility(buyCandidate, true, xPtsGain)   [NEW call site in TransferPanel]
  ↓ computeRejection(sellCandidate, allPlayers, lcMap) [NEW call site in TransferPanel]
  ↓ NEW: FragilityBadge inline in TransferPanel row
  ↓ NEW: RejectionReasonsList in TransferPanel row
```

### New Files Required

| Path | Type | Purpose |
|------|------|---------|
| `src/components/gem-table/MCDistributionBar.tsx` | NEW component | Visual P10/P90 distribution bar with haul_prob + blank_prob percentages. Renders only when `haul_prob !== undefined`. |
| `src/app/api/player-insight/route.ts` | NEW API route | POST — accepts per-player structured context, calls Claude Haiku, returns 2-3 sentence insight. Server-side only, `ANTHROPIC_API_KEY` guard. |
| `src/lib/hooks/usePlayerInsight.ts` | NEW mutation hook | `useMutation` wrapping POST to `/api/player-insight`. Cache keyed by player name (no aggressive caching — on-demand user action). |
| `src/components/gem-table/PlayerInsightTrigger.tsx` | NEW component | "Get AI insight" button in GemTable row expand. Renders `<PlayerInsightBlock>` inline on demand. |

### Modified Files

| Path | Change |
|------|--------|
| `src/components/gem-table/GemTable.tsx` | Mount `MCDistributionBar` in row expand when `haul_prob !== undefined`. Mount `PlayerInsightTrigger`. |
| `src/components/transfers/TransferPanel.tsx` | Add `computeFragility(buy, true, xPtsGain)` + `FragilityBadge`. Add `computeRejection(sell, allPlayers, lcMap)` + rejection reason list. Add per-player `PlayerInsightTrigger`. |
| `src/components/captaincy/CaptainPicksPanel.tsx` | Already uses `computeMCLabels` and `computeFragility`. No MC-01-specific change needed unless MCDistributionBar is also wanted in captain cards (optional). |
| `src/components/accuracy/AccuracyTab.tsx` | Calibration charts already rendered. No MC-01-specific change unless calibration health indicator is in scope. |
| `src/lib/types.ts` | Add `PlayerInsightRequest`, `PlayerInsightResponse` interfaces. |

---

## Recommended Project Structure (additions only)

```
src/
├── app/api/
│   └── player-insight/
│       └── route.ts          # NEW — per-player Claude Haiku POST
├── components/
│   ├── gem-table/
│   │   ├── MCDistributionBar.tsx       # NEW — P10/P50/P90 + haul/blank bars
│   │   └── PlayerInsightTrigger.tsx    # NEW — on-demand insight button+block
│   └── shared/
│       └── FragilityBadge.tsx          # EXISTING (no change)
└── lib/
    └── hooks/
        └── usePlayerInsight.ts         # NEW — useMutation for POST /api/player-insight
```

---

## Build Order

The dependency graph imposes a clear sequence.

### Phase 1: Enable MC Gate + MC Display (MC-01)

**What:** Flip `mc_enabled = true` in accuracy_backtest.json (1 pipeline verification step), then build `MCDistributionBar` component and mount it in GemTable row expand.

**Why first:**
- MC data is the prerequisite for the next-GW distributions shown in the captain panel. The `haul_prob` field drives `computeMCLabels` which already runs in `CaptainPicksPanel`. Without the gate enabled, haul_prob is always `undefined` and the labels panel is invisible.
- MC data enriches the per-player prose context (passing `haul_prob` and `blank_prob` to the LLM context is more useful than omitting them). Gate must be active before NLP-02 can leverage it.
- Calibration data already exists and renders without MC — no gate dependency.

**Depends on:** Nothing (gate flip + UI-only work).

### Phase 2: Calibration Health Indicator (CAL-01 remainder)

**What:** Surface a single-line calibration health signal in `DecisionSummaryTab` reading from `useAccuracy().data.calibration`. The charts themselves are already done.

**Why second:** Small, purely additive, no new infrastructure. Provides visible evidence that the model is or isn't well-calibrated — context the manager needs before acting on the recommendations shown in the Decision Summary card below it.

**Depends on:** Nothing new. Uses existing `useAccuracy()` hook.

### Phase 3: Sensitivity in TransferPanel (SENS-01 remainder)

**What:** Call `computeFragility(buy, true, xPtsGain)` in `TransferPanel` and render `FragilityBadge` inline for each buy candidate. `xPtsGain` already computed by `suggestTransfers()`.

**Why third:** `computeFragility` is already unit-tested and used in two other places. This is a call-site addition, not new engine work. Transfer fragility is the most decision-relevant surface (the manager acts on TransferPanel suggestions; fragility context belongs next to the action).

**Depends on:** Nothing new (engine exists).

### Phase 4: Rejection Explainer in TransferPanel (WHY-01 remainder)

**What:** Call `computeRejection(sellCandidate, allPlayers, lifecycleMap)` for sell-side players in TransferPanel to explain why the engine is recommending them for sale. Show top 2 reasons inline.

**Why fourth:** Depends on knowing the lifecycle map. The lifecycle map must be threaded or re-computed locally in TransferPanel. Simpler to compute it inline: `computeLifecycleLabel(player)` over each squad player. This avoids prop-drilling from page.tsx. Comes after SENS-01 so TransferPanel is touched once for both augmentations.

**Depends on:** SENS-01 change (Phase 3) lands first; both changes are to TransferPanel, combining them reduces churn.

### Phase 5: New `/api/player-insight` Route + Per-Player LLM (NLP-02)

**What:** New API route, new hook, `PlayerInsightTrigger` component in GemTable row expand and TransferPanel.

**Why fifth:** Benefits from MC data being enabled (Phase 1) so the LLM context can include `haul_prob` and `blank_prob`. Benefits from SENS-01/WHY-01 being in TransferPanel (Phase 3/4) since the insight context includes `fragility_tier` and `rejection_reasons`.

**Depends on:** Phase 1 (MC gate enabled for richer context). Routes are independent of Phases 3/4 but richer context produces better output.

**Key security constraint:** `ANTHROPIC_API_KEY` must only be read inside the route handler (`process.env.ANTHROPIC_API_KEY`). This is already the pattern in the existing `/api/prose-summary` route. No client-side Anthropic SDK import.

**Rate-limiting consideration:** Per-player insights are on-demand (user clicks "Get AI insight"). This is not a batch operation. No throttling needed for a single-user personal tool. If the route is eventually exposed to multiple sessions, add a per-IP rate limit via the request headers — but this is out of scope for a personal tool.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running MC in the Browser

**What people do:** Port `simulate.py`'s NumPy Poisson sampling to JavaScript and run 10k iterations client-side.

**Why it's wrong:** 10k × 700 players = 7 million random draws per page load. Even with `Math.random()` this takes 500ms+ in the main thread; with a Web Worker it ties up a worker thread and blocks on player data loading. The pipeline already runs this nightly; duplicating it in the browser buys nothing except bugs from numerical disagreement with the Python output.

**Instead:** Python pipeline produces MC fields; client reads them. `simulate.py` is authoritative.

### Anti-Pattern 2: Exposing ANTHROPIC_API_KEY to the Client

**What people do:** Import `@anthropic-ai/sdk` in a React component or pass the API key via a public env variable (`NEXT_PUBLIC_ANTHROPIC_API_KEY`).

**Why it's wrong:** Any `NEXT_PUBLIC_` env var is bundled into the client JS and visible in the browser's Network tab and source. The API key is a billing credential.

**Instead:** API key lives only in server-side route handlers (`process.env.ANTHROPIC_API_KEY`, not `NEXT_PUBLIC_`). Already correctly implemented in the existing `/api/prose-summary` route — replicate the same pattern for `/api/player-insight`.

### Anti-Pattern 3: Hallucination via Open-Ended Per-Player Prompts

**What people do:** Ask the LLM "tell me about Salah's FPL prospects this week" with no structured input. The model draws on training knowledge rather than current pipeline data.

**Why it's wrong:** Training data is stale. The model may invent stats, reference outdated injuries, or confuse players. This is precisely what the existing prose guardrail protects against — but the guardrail can only check names, not fabricated statistics.

**Instead:** Pass structured data in the prompt (`xPts_1gw`, `haul_prob`, `fragility_tier`, `rejection_reasons`). System prompt explicitly prohibits numeric values not in the input ("Refer to players qualitatively"). The per-player insight prompt must follow the same XML-structured input pattern as `prose_summary.py` and the existing POST handler.

### Anti-Pattern 4: Calibration in a Separate Blob File

**What people do:** Write `calibration.json` as a new pipeline artifact with its own `/api/calibration` route.

**Why it's wrong:** Calibration data is derived from the same accuracy backtest run that produces `accuracy_backtest.json`. Splitting it forces the UI to make two fetches and the pipeline to write two files. It creates a consistency window where one file is updated before the other.

**Instead:** Calibration data lives inside `accuracy_backtest.json` under `calibration{}`. Already implemented this way — `_compute_calibration_data()` is called inside `compute_accuracy_backtest()`. The existing `useAccuracy()` hook serves both.

### Anti-Pattern 5: Streaming LLM Responses for Per-Player Insights

**What people do:** Use `client.messages.stream()` to progressively render the 2-3 sentence insight.

**Why it's wrong:** A 100-token Haiku response arrives in <1 second as a single chunk anyway. Streaming requires a `ReadableStream` response on the server and a streaming-aware hook on the client — substantially more code than `client.messages.create()`. The existing prose-summary route and Python prose module both use non-streaming; consistency is valuable.

**Instead:** Non-streaming `client.messages.create()` with `maxDuration = 30` (already set on prose-summary route for the same reason).

---

## Integration Points Summary

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API (Anthropic) | Server-side only via `@anthropic-ai/sdk` in Next.js route handlers | `ANTHROPIC_API_KEY` env var, never exposed to client. Two call sites: `POST /api/prose-summary` (existing), `POST /api/player-insight` (new). Same `claude-haiku-4-5` model, `max_tokens: 512`. |
| Vercel Blob | Server-side read in Next.js route handlers; server-side write from Python pipeline | `USE_BLOB` env var gates local vs Blob routing. Already used by all existing routes. |
| FPL API | Proxied via `/api/fpl/[...proxy]` catch-all | No new FPL endpoints needed for v1.18 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Python pipeline → Blob → Next.js API | JSON files written by pipeline, read by route handlers | MC fields travel in `merged_players.json`. Calibration in `accuracy_backtest.json`. No new files. |
| Next.js API → TanStack Query → React | REST GET/POST, typed JSON responses | `usePlayers()` and `useAccuracy()` already carry all MC and calibration data once gate is enabled. |
| TypeScript engines → React components | Pure function imports, no shared state | `computeFragility`, `computeRejection`, `computeMCLabels` are pure functions called inline in render. No hook wrapping needed. |
| React component → Claude API | Via route handler POST, `useMutation` hook | `usePlayerInsight` uses `useMutation` (not `useQuery`). On-demand, not automatic. Results are NOT cached in TanStack Query (each "Get AI insight" click is a fresh call). |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| MC pipeline integration | HIGH | `simulate.py` verified; `run.py` call site verified; gate mechanism verified in `accuracy.py` |
| Calibration chart integration | HIGH | `AccuracyTab.tsx` CalibrationSection verified (line 344+); `_compute_calibration_data()` verified |
| SENS-01 existing integration | HIGH | `sensitivity.ts`, `FragilityBadge.tsx`, usage in `GemTable.tsx` and `CaptainPicksPanel.tsx` all verified |
| WHY-01 existing integration | HIGH | `explain.ts`, usage in `GemTable.tsx` and `ComparisonSearch.tsx` verified |
| NLP-01/NLP-02 existing integration | HIGH | `prose_summary.py`, `/api/prose-summary`, `useProseSummary`, `useProseRefresh`, `ProseSummaryBlock`, `DecisionSummaryTab` all verified |
| Proposed `/api/player-insight` design | MEDIUM | Pattern directly mirrors existing `/api/prose-summary` POST which is verified; new route not yet built |
| Proposed TransferPanel SENS/WHY additions | MEDIUM | Engine functions are verified; TransferPanel was not deeply inspected for hook availability of `allPlayers` population |

---

## Sources

All findings from direct codebase read — no web search required for this integration architecture assessment.

- `pipeline/simulate.py` — full MC implementation, N_SIMS env var, gate integration
- `pipeline/accuracy.py` — `_compute_calibration_data()`, `mc_enabled` gate preservation
- `pipeline/prose_summary.py` — Python-side Claude call, guardrail implementation
- `pipeline/run.py` — pipeline orchestration, call sites for simulate, prose_summary
- `src/app/api/prose-summary/route.ts` — server-side Claude API pattern, POST body schema, guardrail usage
- `src/lib/sensitivity.ts` — `computeFragility` 5-perturbation engine, FragilityTier types
- `src/lib/mc-labels.ts` — `computeMCLabels` haul/ceiling/floor cascade
- `src/lib/explain.ts` — `computeRejection` 8-predicate cascade, `computeHeadToHead`
- `src/lib/__tests__/rejection.test.ts` — WHY-01 Phase 94 predicates verified via tests
- `src/lib/hooks/useProseSummary.ts`, `useProseRefresh.ts` — hook patterns
- `src/components/accuracy/AccuracyTab.tsx` — CalibrationSection verified present (line 344–531)
- `src/components/captaincy/CaptainPicksPanel.tsx` — MC and SENS integration verified
- `src/components/gem-table/GemTable.tsx` — WHY-01 and SENS-01 integration verified
- `src/components/squad/DecisionSummaryTab.tsx` — NLP-01/NLP-02 prose block verified
- `src/lib/types.ts` — MC fields on MergedPlayer, CalibrationBucket, ProseSummary verified

---
*Architecture research for: FPL Analyst v1.18 Forecast Transparency & AI Intelligence*
*Researched: 2026-05-12*
