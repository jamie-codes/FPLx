# Technology Stack — v1.18 Forecast Transparency & AI Intelligence

**Project:** FPL Analyst v1.18
**Researched:** 2026-05-13
**Mode:** Subsequent-milestone delta — extends the validated v1.0–v1.17 stack
**Overall confidence:** HIGH (direct verification against `package.json`, `pipeline/requirements.txt`, installed `node_modules`, `pipeline/simulate.py`, `pipeline/prose_summary.py`, `/api/prose-summary/route.ts`, and Anthropic Models Overview 2026-05-13)

---

## Bottom Line Up Front

**Net new npm packages: 0**
**Net new Python packages: 0**
**Net new external services: 0**

Every capability v1.18 requires is already installed and exercised in the codebase. The Monte Carlo engine ships in `pipeline/simulate.py`, the Anthropic SDK is wired both server-side (`/api/prose-summary/route.ts`) and pipeline-side (`pipeline/prose_summary.py`), Recharts already renders the reliability diagram in `AccuracyTab.tsx`, and the MC fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) are present in the current `merged_players.json` cache.

v1.18 is an activation + wire-up milestone. The work is gate flips, new call sites, one new Route Handler (`/api/player-insight`), one new hook, one new UI trigger — not new dependencies.

| Feature | New deps? | New files | Touches existing |
|---|---|---|---|
| MC-01 display | None | 1 component (`MCDistributionBar.tsx`) | GemTable row-expand, MergedPlayer fields already present |
| CAL-01 chart fix | None | 0 (threshold edit) | `pipeline/accuracy.py` sparse-bucket filter, `AccuracyTab.tsx` health indicator |
| SENS-01 in TransferPanel | None | 0 | `TransferPanel.tsx` (engine in `sensitivity.ts` already shipped) |
| WHY-01 in TransferPanel | None | 0 | `TransferPanel.tsx` (engine in `explain.ts` already shipped) |
| NLP-01 (already shipped Phase 67) | None | 0 | Existing — no v1.18 work |
| NLP-02 new route | None | 1 route + 1 hook + 1 component | New: `/api/player-insight`, `usePlayerInsight`, `PlayerInsightTrigger` |

---

## Recommended Stack (v1.18 carry-forward)

### Core Framework (no changes)

| Technology | Version | Purpose | Why |
|---|---|---|---|
| Next.js | 16.2.1 | App Router, Route Handlers | Existing. `Response(ReadableStream)` is standard Web API — no Next-specific streaming adapter needed |
| React | 19.2.4 | UI | Existing |
| TypeScript | ^5 | Type system | Existing |
| TanStack Query | ^5.95.2 | Server-state cache | Existing. NLP-02 uses `useMutation` (NOT `useQuery`) — avoids auto-refetch which would burn Claude tokens |
| TanStack Table | ^8.21.3 | GemTable, DefconTable | Existing |
| Tailwind CSS | v4 | Styling | Existing |
| Vitest | ^4.1.2 | Unit tests | Existing |
| Zod | ^4.3.6 | Route Handler body validation | Existing. NLP-02 `POST` body uses `z.object({...}).safeParse()` — same pattern as `/api/prose-summary/route.ts` |
| @vercel/blob | ^2.3.1 | Pipeline output store | Existing |

### LLM Integration (no changes — already installed)

| Technology | Installed Version | Purpose | Why |
|---|---|---|---|
| `@anthropic-ai/sdk` (Node) | **0.93.0** | NLP-01, NLP-02 Route Handlers | Verified at `node_modules/@anthropic-ai/sdk/package.json`. Supports `messages.create()`, `messages.stream()`, `cache_control` with TTL `'5m' \| '1h'`, `extended-cache-ttl-2025-04-11` beta header — all surface area v1.18 needs |
| `anthropic` (Python) | **>=0.98.1** (requirements.txt) — **0.40.0 pinned in workflow** | NLP-01 pipeline `prose_summary.py` | Mismatch flagged below — requirements floor is recent, workflow installs an older pin. Either is sufficient for `messages.create()` non-streaming with `claude-haiku-4-5` |

### Charts (no changes — already installed)

| Technology | Installed Version | Purpose | Why |
|---|---|---|---|
| recharts | **3.8.1** | CAL-01 reliability diagram, MC distribution bar, BackTab | Already in active use: `BackTab.tsx`, `AccuracyTab.tsx` (`ComposedChart` + `ReferenceLine`), `RankSimTab.tsx`. `ScatterChart` and `Scatter` are also exported by 3.8.1 if a per-player overlay is desired |

### Pipeline (no changes — already installed)

| Technology | Installed Version | Purpose | Why |
|---|---|---|---|
| numpy | **2.2.3** (locally) — declared `>=1.26.0` in requirements.txt | MC-01 simulation (`rng.poisson`, `rng.binomial`, `np.cumsum`, `np.percentile`) | Already exercised in `pipeline/simulate.py`. PCG-64 default RNG is seeded for reproducible CI runs (`MC_SEED`) |
| pandas | >=2.2.0 | Existing pipeline data ops | Existing |
| requests | >=2.32.0 | FPL fetch | Existing |
| soccerdata | 1.8.8 | Understat shots scraping | Existing |
| Python | 3.11 (workflow) | Pipeline runtime | Existing — `default_rng()` API is Py 3.8+ |

### Storage (no changes)

| Technology | Purpose | Why |
|---|---|---|
| Vercel Blob | `merged_players.json`, `accuracy_backtest.json`, `weekly_summary.json` | Existing pipeline output channel — MC fields and gate already flow through it |
| localStorage | NLP-02 per-player insight cache, decision history (v1.16), manual plan (v1.9) | Mirrors `MANUAL_PLAN_KEY` precedent in `manual-plan.ts`. NLP-02 cache key = `fplx_player_insight_{playerId}_{pipelineRunDate}` |

---

## Stack Additions Detail (v1.18)

### MC-01 — Monte Carlo Simulator

**Pipeline status: COMPLETE** — `pipeline/simulate.py` already runs `numpy.random.default_rng().poisson()` for goals/assists and `rng.binomial()` for clean-sheet Bernoulli draws. Outputs `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory`. All fields present in the local `pipeline/cache/merged_players.json` keys (verified 2026-05-13).

**Iteration budget:** `N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))`. Default 1000, hardcoded floor 1000, env-overridable. To reach the 10k target stated in PROJECT.md feature notes, set `MC_ITERATIONS=10000` in **both** GitHub Actions workflow `env:` and Vercel project env (the `mc_enabled` gate is independent — see Gaps below).

**Why numpy, not scipy:** scipy is **not** in `pipeline/requirements.txt` and is **not** installed in the GitHub Actions workflow (confirmed: `pipeline/saves.py:14` documents "scipy is NOT available in the runtime environment"). All MC arithmetic — Poisson, Binomial, percentile, cumsum — is in numpy's core. scipy would add ~40MB install footprint and ~15s cold-start in Actions for zero capability gain. Use closed-form `math.exp`/`math.factorial` for Poisson CDF math where vectorisation isn't needed (already the pattern in `pipeline/saves.py`).

**Why numpy in the pipeline, not TypeScript in the browser:** ~700 active players × 10k sims × 5 GWs × 3 random draws per fixture ≈ 105M random samples per pipeline run. numpy's PCG-64 vectorised path is 10–50× faster than any JS Poisson sampler; a TypeScript implementation would freeze the browser main thread, and a Vercel Route Handler implementation would exhaust the Hobby plan's 10s default timeout (and 60s max). Pipeline pre-computation with Blob caching means zero client-side latency.

**What v1.18 needs (display layer only):**
- `MCDistributionBar.tsx` — reads existing MergedPlayer fields, renders blank% / haul% / P10 / P90 inline. Pure React + Tailwind, no Recharts needed for the bar (a `flex`-row of coloured cells is sufficient and avoids Recharts axis overhead at row scale)
- `mc_enabled: true` flipped in `accuracy_backtest.json` summary — the pipeline writes MC fields only when this gate is true (`pipeline/run.py:193`), so the gate is the single switch unlocking all MC-dependent UI

### CAL-01 — Calibration Charts

**Status: Already rendered.** `AccuracyTab.tsx` lines 394–434 already use `ComposedChart` + `ReferenceLine` + `Line` from `recharts@3.8.1` for the reliability diagram. `CalibrationBucket`, `CalibrationData` types exist; position-split pill toggle is wired.

**What v1.18 needs:**
- Raise the sparse-bucket filter in `pipeline/accuracy.py::_compute_calibration_data` from `sample_n < 5` to **`sample_n < 15` for GK/DEF**, `sample_n < 8` for MID/FWD. Rationale: the existing `< 5` was sized for the all-positions aggregate (~50 obs/decile at BACKTEST_GWS=5); GK position-specific tabs see ~8 obs/decile, and a single haulting GK shifts the actual rate by 12+ percentage points — the chart looks miscalibrated when the model is fine.
- Add a position-pool total guard rendering "Insufficient data" when total observations for the selected position pool < 50.
- Optional calibration health sentence in `DecisionSummaryTab` reading from `useAccuracy()` — pure prop drilling, no new dep.

**No new chart library.** `ScatterChart` + `Scatter` are already exported by recharts 3.8.1 if a per-player overlay is desired in a future phase; do not import `d3` directly (recharts already bundles D3 internally — direct import doubles D3 in bundle).

### SENS-01 — Sensitivity Flags

**Status: Engine COMPLETE.** `src/lib/sensitivity.ts::computeFragility()` is fully implemented and tested (`sensitivity.test.ts`), exporting a tristate `{ tier: 'robust' | 'fragile' | 'knife_edge', reasons: string[] }` over 5 perturbations (start_prob, mins_60_prob, fixture difficulty, cost, news doubt). `FragilityBadge.tsx` exists. Currently called from `GemTable.tsx` and `CaptainPicksPanel.tsx`.

**What v1.18 needs:**
- Add the call site in `TransferPanel.tsx` for buy candidates: `computeFragility(buy, /*isBuyContext*/ true, xPtsGain)`.
- Standardise the visual tier hierarchy across surfaces: `robust = no badge`, `fragile = amber dot`, `knife_edge = amber pill`. This prevents late-season flag spam when fixture congestion pushes 40–60% of candidates below `start_prob < 0.85`.

**No new dependencies. No new files.**

### WHY-01 — Rejection Explainer

**Status: Engine COMPLETE.** `src/lib/explain.ts::computeRejection()` ships an 8-predicate cascade returning ranked `reasons[]`. `ExplainPanel.tsx` already accepts `rejectionReasons?: string[]`. Tests live at `__tests__/rejection.test.ts`.

**What v1.18 needs:**
- Add the call site in `TransferPanel.tsx` for sell-side rows (top-2 reasons inline).
- A small `RejectionReasonsList` presentational component (formatting only — no new logic).
- If `TransferPanel` doesn't already have `allPlayers` in scope, compute `lifecycleLabel` locally via `computeLifecycleLabel` to avoid prop drilling.

**Why this matters for NLP-02:** The `reasons[]` array is the structured context that NLP-02's prompt injects into Claude. Building this call site **before** NLP-02 lets the per-player prompt assemble its `<rejection_reasons>` XML block from real engine output, not hallucinated training-data reasoning. This is the single biggest defense against the LLM inventing rejection reasons (PITFALLS.md Pitfall 2).

**No new dependencies.**

### NLP-01 — Weekly LLM Prose Summary

**Status: Fully shipped Phase 67.** Both halves are live:
- `pipeline/prose_summary.py` calls `client.messages.create(model='claude-haiku-4-5', max_tokens=512, ...)` from Python with two-attempt strict-mode guardrail retry. Writes `weekly_summary.json` to Vercel Blob.
- `/api/prose-summary/route.ts` exposes a GET (serve cached summary) and POST (squad-aware refresh) using the same model, `maxDuration = 30`, non-streaming, with `prose-guardrail.ts` name-whitelist enforcement.

**No v1.18 work on NLP-01.** Verify only.

### NLP-02 — Per-Player LLM Insights (THE ONE GENUINELY NEW BUILD)

**Status: Not yet built.** Single new Route Handler, single new hook, single new UI component.

**Architecture — non-streaming POST, mirrors `/api/prose-summary` POST exactly:**

```typescript
// src/app/api/player-insight/route.ts
export const maxDuration = 30                       // Hobby plan max is 60s; 30 is generous for Haiku
// NO `export const runtime = 'edge'` — Node.js runtime only (see Anti-Additions)

const PostBodySchema = z.object({
  player_id: z.number().int().positive(),
  pipeline_run_date: z.string().min(10),            // cache key invalidates on new pipeline run
  player: z.object({
    web_name: z.string().min(1).max(64),
    team: z.string().min(2).max(8),
    position: z.enum(['GK','DEF','MID','FWD']),
    xPts_1gw: z.number().nullable(),
    blank_prob: z.number().min(0).max(1).nullable(),
    haul_prob: z.number().min(0).max(1).nullable(),
    fragility_tier: z.enum(['robust','fragile','knife_edge']).nullable(),
    rejection_reasons: z.array(z.string().min(1).max(160)).max(8).default([]),
  }),
})

export async function POST(request: Request) {
  // 1) parse + validate (z.safeParse)
  // 2) load player_corpus from merged_players.json (web_names) for guardrail
  // 3) build XML-tagged user prompt injecting fragility + rejection_reasons
  // 4) client.messages.create({
  //      model: 'claude-haiku-4-5',
  //      max_tokens: 160,                              // ~2-3 sentences sufficient
  //      system: '...qualitative only, no numbers...', // matches NLP-01 system style
  //      messages: [{ role: 'user', content: userMsg }],
  //    })
  // 5) two-attempt guardrail retry (strict mode on attempt 2) — reuse passesGuardrail
  // 6) 422 on guardrail failure; 502 on upstream API error; 503 on missing ANTHROPIC_API_KEY
}
```

**Model:** `claude-haiku-4-5` (alias → `claude-haiku-4-5-20251001`, pinned snapshot per Anthropic naming policy 2026-05-13). **$1 / input MTok, $5 / output MTok.** Fastest model in the current generation, 200k context, 64k max output — far more than NLP-02 needs.

**Latency profile (Haiku, ~150 input tokens + 160 output tokens):** typically 400–800ms total. Single chunk — non-streaming is correct.

**Why non-streaming:** Per-player insight is 2–3 sentences ≈ 100–150 output tokens. With Haiku these arrive as a single SSE chunk within 600ms; partial-render UI complexity is pure cost for no perceived speedup. The existing `/api/prose-summary` POST is non-streaming for the same reason.

**Why `useMutation`, not `useQuery`:** NLP-02 is demand-triggered (user clicks "Get AI insight"). `useQuery` would auto-refetch on window focus / mount, multiplying Claude calls and cost. `useMutation` runs only on `.mutate()` and pairs with a localStorage cache keyed on `(player_id, pipeline_run_date)` for 24h-ish reuse.

**Why localStorage cache (mandatory):** Without it, a single useEffect bug expanding all 50 visible GemTable rows = 50 Claude calls per page load. At ~200 input + 120 output tokens × $1/$5 per MTok ≈ $0.0008 per insight; 50 calls × 5 page loads/day × 7 days = **~$1.40/week** worst case. Add localStorage keyed on `pipeline_run_date` and the cost drops to a few cents per week (one call per player per refresh). Project precedent: `MANUAL_PLAN_KEY` in `manual-plan.ts:5`.

**Prompt caching (`cache_control: { type: 'ephemeral', ttl: '5m' }`):** Verified present in `@anthropic-ai/sdk@0.93.0` via Context7 (system prompt blocks and tool definitions accept it). **NOT recommended for NLP-02 v1.18.** The system prompt is ~80 tokens, well below the 1024-token minimum for cache hits to be billed. The user prompt varies per player. Cache write surcharge (1.25× base rate at 5m, 2× at 1h) would exceed any benefit. Defer prompt caching until: (a) system prompt grows past 1024 tokens, OR (b) batch pre-generation pattern is adopted where the same system prompt fires for 50+ players in a 5-minute window. Both are deferred to v1.19+.

**No streaming, no prompt caching, no Edge Runtime — and zero new dependencies.**

### Existing Pipeline Module Dependencies (carry-forward — no changes)

| Module | Purpose | Notes |
|---|---|---|
| `pipeline/simulate.py` | MC-01 | Already ships. Needs `MC_ITERATIONS=10000` env + `mc_enabled=true` gate flip |
| `pipeline/accuracy.py` | CAL-01 calibration buckets, `accuracy_backtest.json` | Needs sparse-bucket filter raised for GK/DEF |
| `pipeline/prose_summary.py` | NLP-01 weekly summary | Already shipping `weekly_summary.json` |
| `pipeline/merge.py` | Single source of truth for `MergedPlayer` shape | Existing |
| `pipeline/refresh_gate.py` | Event-aware scheduling (v1.16 REFRESH-01) | Existing |
| `pipeline/data_health.py` | Cron history, freshness banner (v1.16 DH-04) | Existing |
| `pipeline/captain_snapshots.py` | BACK-01 captain backtester (v1.16) | Existing |

---

## Alternatives Considered (and rejected)

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Random sampling library | numpy `default_rng()` | scipy.stats | scipy is **not** in pipeline runtime (confirmed `pipeline/saves.py:14`); numpy already exposes Poisson/Binomial vectorised. Adding scipy = +40MB install, +15s cold-start in Actions, zero capability gain |
| LLM SDK | `@anthropic-ai/sdk` 0.93.0 | Vercel AI SDK (`ai` package) | Adds ~200KB to client bundle; `AnthropicStream` helper removed in `ai` v4; the existing codebase already calls `@anthropic-ai/sdk` directly in 3 places — adding `ai` doubles the integration surface |
| LLM SDK | `@anthropic-ai/sdk` 0.93.0 | LangChain.js / LlamaIndex | Both add dozens of transitive deps for chains/agents this app doesn't use. v1.18 is one-shot `messages.create()` calls — no chains, no tool use, no RAG |
| Calibration chart | `recharts@3.8.1` `ComposedChart` | `chart.js`, `victory`, `nivo` | Existing recharts already renders the reliability diagram in `AccuracyTab.tsx`. Second charting lib = bundle bloat + style inconsistency |
| MC inline distribution | Tailwind flexbox + coloured `<div>`s | recharts BarChart per row | At GemTable row scale, Recharts axis/legend overhead dominates the actual data; pure CSS bar is faster to render and matches existing badge patterns |
| MC computation | Python pipeline + Vercel Blob cache | Browser TypeScript MC, or Next.js Route Handler MC | TS Poisson sampler 10–50× slower than numpy; browser freezes at 105M samples; Hobby Route Handler timeout is 10s default / 60s max — would not complete |
| Per-player insight delivery | Demand-triggered `useMutation` + localStorage | Server-side batch pre-generation in pipeline | Pre-generation = 700 players × $0.0008 × 4 refreshes/day = **~$2.24/day** = ~$70/month. On-demand with cache = a few cents per week. Defer pre-generation to v1.19 only if on-demand latency proves unacceptable |
| Per-player insight response | Non-streaming `messages.create` | Streaming `messages.stream` | Haiku 100-token response arrives as a single chunk in ~600ms. Streaming adds partial-render UI complexity, AbortController plumbing, and the GitHub issue #292 Edge-Runtime trap with no perceived speedup |
| Per-player insight runtime | Node.js (default) | Vercel Edge Runtime | `@anthropic-ai/sdk` has known SSE parsing failures on Edge (issue anthropics/anthropic-sdk-typescript#292). Existing `/api/prose-summary` is correctly Node-only — match the precedent |
| Prompt caching | Plain `messages.create` (no `cache_control`) | `cache_control: { type: 'ephemeral' }` on system prompt | NLP-02 system prompt is ~80 tokens, far below the 1024-token cache minimum. Write surcharge (1.25× at 5m) > savings. Re-evaluate when system prompt exceeds 1KB or batch patterns adopted |
| Per-player insight cache | localStorage keyed on `(player_id, pipeline_run_date)` | IndexedDB (`idb-keyval`) | ~700 players × ~300 bytes = ~210KB << 5MB localStorage quota; matches project precedent (`manual-plan.ts:5`) |
| Per-player insight rendering | Plain `<p>` whitespace-preserving | `react-markdown` | LLM output is plain text by design (qualitative paragraph). Markdown rendering adds XSS surface + bundle for no formatting benefit |

---

## Installation

**No npm install commands required.** All TypeScript dependencies are already in `package.json`.

**No pip install commands required** for v1.18 features. However, two pipeline-side hygiene fixes are recommended (NOT new dependencies):

```yaml
# .github/workflows/pipeline.yml — recommended edits

# 1) Make numpy install explicit (currently pulled in transitively via pandas)
# 2) Align anthropic pin with requirements.txt floor (>=0.98.1)
# 3) Add MC_ITERATIONS env so 10k is the production budget

- name: Install dependencies
  run: |
    pip install requests==2.32.3 pandas==2.2.3 numpy==2.2.3 \
                vercel-blob==0.4.2 python-dotenv==1.0.1 anthropic==0.98.1

env:
  USE_BLOB: 'true'
  BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  MC_ITERATIONS: '10000'   # Phase 90 MC-01 production budget (default in simulate.py is 1000)
  MC_SEED: '42'            # Phase 90 — reproducible CI runs
```

**Vercel project env vars (no SDK changes):**

```
ANTHROPIC_API_KEY=sk-ant-...   # already set; reused for NLP-02 route
```

---

## What NOT to Add (Anti-Additions)

These are the tempting-but-wrong additions for v1.18. Each is rejected for a specific reason.

| Tempting addition | Why reject | Use instead |
|---|---|---|
| **scipy** for MC simulation | Not installed in pipeline runtime; numpy `default_rng` already exposes Poisson/Binomial vectorised; adds +40MB install + ~15s Actions cold-start | `numpy.random.default_rng()` — already in `simulate.py` |
| **`mathjs` / `jstat` / `simple-statistics`** in browser for MC | MC is already pre-computed in the pipeline; client-side recomputation is wasteful and slow | Read `blank_prob` / `haul_prob` / `p10_pts` / `p90_pts` from MergedPlayer |
| **`@tensorflow/tfjs` / ONNX / any ML runtime** | No ML inference is happening — every v1.18 stat is closed-form Poisson/Bernoulli arithmetic | Pure numpy in pipeline |
| **Vercel AI SDK (`ai` package)** | ~200KB bundle bloat; `AnthropicStream` helper removed in v4; the codebase already calls `@anthropic-ai/sdk` directly in 3 places | `@anthropic-ai/sdk` 0.93.0 directly |
| **LangChain.js / LlamaIndex** | v1.18 is one-shot `messages.create()` — no chains, no tools, no RAG, no agent loops; adds dozens of transitive deps | `@anthropic-ai/sdk` directly |
| **Streaming for NLP-01** | Already shipped non-streaming (Phase 67); 4–5 sentence output is fast enough | Existing `/api/prose-summary` GET |
| **Streaming for NLP-02** | 2–3 sentence response from Haiku arrives in ~600ms as one chunk; partial-render UI cost > zero perceived speedup | Non-streaming `messages.create` |
| **Vercel Edge Runtime for any LLM route** | `@anthropic-ai/sdk` SSE parsing fails on Edge (anthropics/anthropic-sdk-typescript#292); existing prose-summary route is correctly Node-only | Node.js runtime (default), `maxDuration = 30` |
| **Prompt caching (`cache_control: ephemeral`) for NLP-02** | System prompt is ~80 tokens, below the 1024-token cache minimum; write surcharge (1.25× at 5m) outweighs savings | Plain `messages.create({ model, max_tokens, system, messages })` |
| **`chart.js` / `victory` / `nivo`** for calibration chart | recharts already renders the diagram in AccuracyTab; second lib = bundle bloat + style drift | recharts `ComposedChart` + `ReferenceLine` |
| **Direct `d3` import** | recharts already bundles D3 internally — direct import doubles D3 in bundle | recharts composable primitives |
| **`react-markdown` for LLM output** | LLM prose is qualitative plain text by design; markdown adds XSS surface for no formatting gain | `<p style={{ whiteSpace: 'pre-wrap' }}>` |
| **`react-sparklines` for rank trajectory** | Last published 4+ years ago (unmaintained); recharts already handles sparklines with `<LineChart>` + hidden axes | Recharts (defer rank_trajectory UI to v1.19) |
| **`zustand` / `jotai`** for NLP-02 cache state | One mutation hook per row doesn't need global state; `useMutation` + localStorage helpers match `manual-plan.ts` precedent | `useMutation` + tiny `loadInsight`/`saveInsight` helpers |
| **`idb-keyval` / `localforage`** for NLP-02 cache | ~210KB total << 5MB localStorage quota; sync API matches existing `manual-plan.ts` pattern | `localStorage.getItem`/`setItem` |
| **`date-fns` / `dayjs`** | `formatRelativeTime` already shipped Phase 38 | `src/lib/formatRelativeTime.ts` |
| **TypeScript Monte Carlo simulator in `src/lib/`** | 700 × 10k × 5 = 35M+ samples per run would freeze the main thread; numpy is 10–50× faster anyway | Python pipeline `simulate.py` |
| **Pre-generate all 700 player insights in pipeline** | 700 × $0.0008 × 4 refreshes/day ≈ $70/month; on-demand with localStorage cache is a few cents/week | Demand-triggered `useMutation` |
| **`@vercel/cron`** | Rejected v1.14/v1.16; GitHub Actions cron is the established substrate | Existing `.github/workflows/pipeline.yml` |
| **A second `prompt-cache.json` cache file** | Adds Blob write race; system prompt is tiny, no value | (don't add) |
| **A new `/api/mc-distribution` route for MC fields** | MC fields already ship in `/api/players` payload | Read from existing `usePlayers()` hook |
| **`pino` / `winston` server-side logging** | Vercel function logs are already streamed; `console.error` suffices for low-volume LLM routes | `console.error('NLP-02:', err)` |

---

## Integration Points with Existing Stack

### NLP-02 Route Handler — file-by-file impact

| File | Status | Change |
|---|---|---|
| `src/app/api/player-insight/route.ts` | **NEW** | ~120 LOC, mirrors `/api/prose-summary/route.ts` POST |
| `src/lib/hooks/usePlayerInsight.ts` | **NEW** | TanStack Query `useMutation` + localStorage cache helpers |
| `src/components/gem-table/PlayerInsightTrigger.tsx` | **NEW** | "Get AI insight" button + result display, demand-triggered |
| `src/lib/prose-guardrail.ts` | Reuse | Same name-whitelist function; consider extending coverage to `rejection_reasons` strings |
| `src/lib/types.ts` | Touch | Add `PlayerInsight` type and `PlayerInsightRequestBody` type |
| `src/components/gem-table/GemTable.tsx` | Touch | Mount `<PlayerInsightTrigger>` in row-expand panel |
| `src/components/squad/TransferPanel.tsx` | Touch | Mount `<PlayerInsightTrigger>` inline per row |

### MC-01 / SENS-01 / WHY-01 — file-by-file impact

| File | Status | Change |
|---|---|---|
| `pipeline/simulate.py` | Existing | No code change; `MC_ITERATIONS=10000` env in workflow |
| `pipeline/run.py` | Existing | No code change; `mc_enabled: true` flip in `accuracy_backtest.json` summary |
| `pipeline/accuracy.py::_compute_calibration_data` | Touch | Raise sparse-bucket filter for GK/DEF |
| `src/components/gem-table/MCDistributionBar.tsx` | **NEW** | Renders blank% / haul% / P10 / P90 |
| `src/components/squad/TransferPanel.tsx` | Touch | Add `computeFragility(buy, true, xPtsGain)` + `computeRejection` call sites |

---

## Version Compatibility Matrix

| Package | Installed | Required for v1.18 | Notes |
|---|---|---|---|
| `@anthropic-ai/sdk` | 0.93.0 | 0.93.0 (no upgrade) | `messages.create()`, `cache_control: ephemeral`, `extended-cache-ttl-2025-04-11` beta header — all present |
| `anthropic` (Python) | requirements.txt `>=0.98.1` | `>=0.40.0` (NLP-01 uses non-streaming `messages.create`) | **Workflow pins 0.40.0 — recommend aligning to 0.98.1** for consistency with requirements.txt |
| `recharts` | 3.8.1 | 3.x | `ComposedChart`, `ReferenceLine`, `Line`, `Scatter`, `ScatterChart` all exported (verified `node_modules/recharts/types/index.d.ts`) |
| `numpy` | 2.2.3 (local) / >=1.26.0 (req) | >=1.26 | `default_rng()` PCG-64, `poisson`, `binomial`, `cumsum`, `percentile` — all in core since 1.17 |
| `next` | 16.2.1 | 16.x | `Response(ReadableStream)`, `maxDuration` export, Route Handlers — all supported |
| `react` | 19.2.4 | 19.x | useEffect cleanup, useId, useMutation host — no version-specific concerns |
| `@tanstack/react-query` | 5.95.2 | 5.x | `useMutation` API stable since v5.0 |
| `zod` | 4.3.6 | 4.x | Strip-by-default, `.safeParse()` — already used in `/api/prose-summary` POST |
| `@vercel/blob` | 2.3.1 | 2.x | `list()` + `fetch(url)` pattern — already used in prose-summary route |

**Verified models (Anthropic Models Overview 2026-05-13):**

| Alias | Pinned ID | Price (input / output per MTok) | Use |
|---|---|---|---|
| `claude-haiku-4-5` | `claude-haiku-4-5-20251001` | $1 / $5 | **Use for NLP-01 (already) and NLP-02 (new)** — fastest, cheapest, 200k context, 64k max output |
| `claude-sonnet-4-6` | `claude-sonnet-4-6` (dateless pinned) | $3 / $15 | Not needed for v1.18; consider only if Haiku outputs prove insufficient |
| `claude-opus-4-7` | `claude-opus-4-7` (dateless pinned) | $5 / $25 | Not needed for v1.18 |

Deprecated (do not use, retiring 2026-06-15): `claude-sonnet-4-20250514`, `claude-opus-4-20250514`.

---

## Gaps & Risks (deferred to phase planning)

1. **`anthropic` Python SDK version mismatch.** `pipeline/requirements.txt` declares `>=0.98.1`, but `.github/workflows/pipeline.yml:46` pins `anthropic==0.40.0`. Both work for the non-streaming `messages.create` call in `prose_summary.py`, but the drift should be reconciled in Phase 1 hygiene work — align workflow to `anthropic==0.98.1` to match the requirements floor.

2. **`numpy` not explicitly installed in pipeline workflow.** It's pulled in transitively by pandas, but a future pandas upgrade or a `--no-deps` install path could break MC silently. Recommend adding `numpy==2.2.3` to the explicit install line.

3. **`MC_ITERATIONS` not set in workflow env.** Default in `simulate.py` is 1000 (with 1000 floor); to reach the 10k target stated in PROJECT.md MC-01 feature, set `MC_ITERATIONS=10000` in workflow `env:` block. Runtime cost: ~6× slower MC step; verify total pipeline wallclock stays under the GitHub Actions free-tier budget (~2 min today).

4. **`mc_enabled` gate flip mechanism.** The pipeline reads the gate from the previous `accuracy_backtest.json` (`run.py:203`). Flipping it requires either a one-time direct Blob edit OR a pipeline patch that sets `mc_enabled: true` and unlocks the gate from inside the run. Confirm at Phase 1 planning.

5. **Sparse-bucket thresholds for CAL-01.** Exact values: raise from `sample_n < 5` to `sample_n < 15` for GK/DEF, `sample_n < 8` for MID/FWD. Rationale in PITFALLS.md.

6. **`TransferPanel` `allPlayers` availability.** WHY-01 wiring needs the full player pool for `computeLifecycleLabel`. Whether `TransferPanel.tsx` already has it in scope vs needs threading is a Phase 4 detail — safe fallback is local `computeLifecycleLabel` recomputation.

7. **Prompt caching trigger threshold.** Defer until system prompt exceeds 1024 tokens OR a batch pre-generation pattern is adopted. Capability is installed; the cost math doesn't pay off at current scale.

---

## Sources

### Primary (HIGH confidence — direct verification)
- `C:\Users\jamie\fplx\package.json` — installed dep versions (Next 16.2.1, React 19.2.4, recharts 3.8.1, `@anthropic-ai/sdk` 0.93.0, TanStack Query 5.95.2, Zod 4.3.6)
- `C:\Users\jamie\fplx\node_modules\@anthropic-ai\sdk\package.json` — confirms `0.93.0`
- `C:\Users\jamie\fplx\node_modules\recharts\package.json` — confirms `3.8.1`
- `C:\Users\jamie\fplx\pipeline\requirements.txt` — `numpy>=1.26.0`, `anthropic>=0.98.1`
- `C:\Users\jamie\fplx\.github\workflows\pipeline.yml:46` — workflow pin `anthropic==0.40.0` (mismatch with requirements floor)
- `C:\Users\jamie\fplx\pipeline\simulate.py` — full MC implementation; `N_SIMS = max(1000, MC_ITERATIONS env)`, `MC_SEED` env, `numpy.random.default_rng()`
- `C:\Users\jamie\fplx\pipeline\saves.py:14` — documented "scipy is NOT available in the runtime environment"
- `C:\Users\jamie\fplx\pipeline\prose_summary.py` — Python Claude call pattern, two-attempt guardrail, `claude-haiku-4-5`
- `C:\Users\jamie\fplx\src\app\api\prose-summary\route.ts` — Node runtime, `maxDuration = 30`, non-streaming POST, Zod body validation, guardrail retry pattern (mirror target for NLP-02)
- `C:\Users\jamie\fplx\src\lib\sensitivity.ts` — `computeFragility()` tristate engine
- `C:\Users\jamie\fplx\src\lib\explain.ts` — `computeRejection()` 8-predicate cascade
- `C:\Users\jamie\fplx\pipeline\cache\merged_players.json` — MC fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) verified present 2026-05-13
- `C:\Users\jamie\fplx\pipeline\run.py:193-223` — `mc_enabled` gate mechanism
- Context7 `/anthropics/anthropic-sdk-typescript` (2026-05-13) — `CacheControlEphemeral` interface, `'extended-cache-ttl-2025-04-11'` beta header, `BetaCacheControlEphemeral`, prompt-cache pre-warming via `max_tokens: 0`
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — verified 2026-05-13: `claude-haiku-4-5` → `claude-haiku-4-5-20251001`, $1/$5 per MTok, 200k ctx; deprecation list (`claude-sonnet-4-20250514`, `claude-opus-4-20250514` retiring 2026-06-15)

### Secondary (MEDIUM confidence)
- GitHub issue anthropics/anthropic-sdk-typescript#292 — Edge Runtime SSE parsing failure (single source; Node.js runtime is the safer default regardless)
- v1.16 STACK.md decision log — `react-sparklines` unmaintained, localStorage > IndexedDB at this scale

### Tertiary (LOW confidence)
- None — every recommendation traces to HIGH or MEDIUM verified sources.

---

*Researched 2026-05-13. v1.18 stack delta is purely activation + wire-up — zero new dependencies, one new route handler, three new component files. Pipeline-side hygiene: align `anthropic` pin, make `numpy` explicit, set `MC_ITERATIONS=10000`.*
