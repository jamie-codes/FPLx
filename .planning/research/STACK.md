# FPL Analyst — Stack Additions Research

**Researched:** 2026-05-09 (v1.16 delta added; v1.14 retained) — v1.18 delta added 2026-05-12
**Mode:** Subsequent-milestone delta research (extends, does not replace existing stack)
**Overall confidence:** HIGH

---

## v1.18 Forecast Transparency & AI Intelligence — Stack Delta

### Bottom Line Up Front (v1.18)

| Feature | New deps? | Net new files | Touches existing |
|---|---|---|---|
| MC-01 (display) | **None.** `pipeline/simulate.py` fully implemented. Display components consume existing `MergedPlayer` fields. | 1–2 UI components | `GemTable` columns, row-expand, `MergedPlayer` type already has `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` |
| CAL-01 | **None.** `ComposedChart` + `ReferenceLine` already used in `AccuracyTab.tsx`. `CalibrationBucket` type exists. | 0–1 chart variants | `AccuracyTab.tsx`, calibration section |
| SENS-01 | **None.** `computeFragility()` fully implemented in `src/lib/sensitivity.ts`. `FragilityBadge.tsx` exists. | 0 (wire-up only) | `GemTable` row-expand, `TransferPanel` |
| WHY-01 | **None.** `ExplainPanel.tsx` already has `rejectionReasons?: string[]` prop. | 0 (wire-up only) | `GemTable` row-expand, `ExplainPanel` |
| NLP-01 | **None.** `@anthropic-ai/sdk` 0.93.0 in deps, `/api/prose-summary` route exists. | 0 (use existing route) | `ProseSummaryBlock.tsx` already wired |
| NLP-02 | **None.** Same SDK. New `/api/player-insight` POST route + client hook. | 1 API route, 1 hook, 1 UI component | `GemTable` row-expand, `TransferPanel` |

**Net new npm packages (v1.18): 0**
**Net new Python packages (v1.18): 0**
**Net new external services (v1.18): 0**
**Net new pipeline files (v1.18): 0 (simulate.py already ships MC-01)**

---

### MC-01: Monte Carlo Simulator Display

**Pipeline status: COMPLETE.** `pipeline/simulate.py` implements 10k sims per player per GW using `numpy.random.default_rng().poisson()` (goals/assists) and `rng.binomial()` (CS Bernoulli). Outputs `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `xPts_5gw_p10/p50/p90`, `rank_trajectory`. All fields are defined in `MergedPlayer` (types.ts lines 184–198) and written to `merged_players.json` via Vercel Blob.

**Default simulation budget:** `MC_ITERATIONS` env var, default 1000. To reach the 10k target from PROJECT.md, set `MC_ITERATIONS=10000` in GitHub Actions secrets and Vercel env.

**Decision: Python pipeline only, not TypeScript client-side.** 10k sims × ~700 active players × 5 GWs × 3 random draws = ~105M random samples per run. `numpy`'s `default_rng` (PCG-64) is 10–50× faster than any JS Poisson sampler. A TypeScript client-side implementation would freeze the browser's main thread at this scale; a Next.js API route implementation would exhaust Vercel Hobby's 10s default timeout. Pipeline pre-computation with Blob caching is zero client latency.

**What v1.18 needs:** Display components that read `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` from the already-populated player object. Potentially a `McOutcomeBar` or similar inline distribution indicator.

**No new dependencies.**

---

### CAL-01: Calibration Charts

**Status: Already implemented.** `AccuracyTab.tsx` uses `ComposedChart` + `ReferenceLine` + `Line` from `recharts@3.8.1` to render the reliability diagram (lines 394–434). `CalibrationBucket`, `CalibrationData`, and position-split pill toggle are all implemented. `xPts`-vs-actual chart at lines 480–524.

**What v1.18 needs for an extended reliability diagram (MC haul% vs actual haul rate):** reuse exactly the same `ComposedChart` + `ReferenceLine` pattern. No new charting primitives. If a scatter-plot overlay is desired (individual player dots), `ScatterChart` and `Scatter` are present in recharts 3.8.1 exports (verified via `node_modules/recharts/types/index.d.ts`).

**No new dependencies.**

---

### SENS-01: Sensitivity Flags

**Status: Fully implemented (Phases 64 + 93).** `src/lib/sensitivity.ts` exports `computeFragility()` covering 5 perturbations (start_prob, mins_60_prob, fixture difficulty, cost, news doubt), returning tristate `{ tier: 'robust' | 'fragile' | 'knife_edge', reasons: string[] }`. `FragilityBadge.tsx` and `FragilityNote.tsx` are ready display components.

**What v1.18 needs:** Ensure fragility output is wired into GemTable row-expand and TransferPanel rows. The computation and display components exist; only the wiring point may be missing.

**No new dependencies.**

---

### WHY-01: Rejection Explainer

**Status: Partially implemented (Phase 65).** `ExplainPanel.tsx` accepts `rejectionReasons?: string[]` and renders a "Why not recommended:" block. Threshold-based rejection strings can be derived from existing `MergedPlayer` fields (xPts below position median, fragility, rotation risk, blank GW, etc.) in a pure TypeScript utility.

**What v1.18 needs:** A `computeRejectionReasons(player, threshold)` utility function that maps the existing field values to plain-English reason strings. No new libraries — same pattern as the existing `computeFragility()` and `buildExplainReasons()` functions.

**No new dependencies.**

---

### NLP-01: LLM Prose Summary (Weekly, Decision Summary Tab)

**Status: Fully implemented (Phase 67).** `/api/prose-summary` route handles GET (serve cached `weekly_summary.json`) and POST (squad-aware refresh via `claude-haiku-4-5`). `ProseSummaryBlock.tsx` is wired into `DecisionSummaryTab.tsx`. The guardrail (`prose-guardrail.ts`) prevents hallucinated player names.

**The existing route uses non-streaming (await + return).** This is correct for this use case. The prose is short (4–5 sentences), `maxDuration=30` is sufficient, and non-streaming is far simpler to test (no partial-state UI complexity).

**No new dependencies. No streaming needed for NLP-01.**

---

### NLP-02: Per-Player LLM Insights (GemTable Row Expand + TransferPanel)

**Status: Not yet built.** Needs a new API route, hook, and UI component.

**Architecture: non-streaming POST, same pattern as existing prose-summary route.**

```typescript
// app/api/player-insight/route.ts
// POST body: { player_id, web_name, xPts_1gw, blank_prob, haul_prob,
//             fragility_tier, rejection_reasons[], position }
// Response: { insight: string, generated_at: string }
// Model: claude-haiku-4-5 (fastest, cheapest, sufficient for 1–2 sentence insight)
// max_tokens: 128 (one sentence is sufficient)
// maxDuration: 30 (Hobby plan max)
```

**Streaming for NLP-02:** Optional. If the per-player insight is 1–2 sentences (target), non-streaming latency (~400–800ms for Haiku) is acceptable and avoids partial-render complexity. Add streaming only if UX testing reveals perceptible lag.

**If streaming is added for NLP-02:** The `@anthropic-ai/sdk` 0.93.0 `MessageStream` API supports it without any new packages:

```typescript
// Route Handler — streaming variant
const stream = client.messages.stream({ model, max_tokens, messages })
return new Response(stream.toReadableStream(), {
  headers: { 'Content-Type': 'text/event-stream' }
})

// Client hook — consume via SDK helper (no new dep)
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream'
const runner = MessageStream.fromReadableStream(res.body!)
// ...
```

**Important:** Use Node.js runtime (not Edge Runtime). The SDK has known SSE parsing failures on Vercel Edge Runtime (GitHub issue #292 in `anthropics/anthropic-sdk-typescript`). The existing prose-summary route correctly uses Node.js runtime (no `export const runtime = 'edge'`).

**Model recommendation:** `claude-haiku-4-5` (API alias → `claude-haiku-4-5-20251001`). Fastest model in the current generation, $1/$5 per MTok input/output, 200k context, 64k max output. Appropriate for short structured summaries grounded in structured model output. This matches what the existing route already uses. VERIFIED against [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) 2026-05-12.

**No new dependencies.**

---

### What NOT to Add (v1.18)

| Avoid | Why | Use Instead |
|---|---|---|
| `mathjs` / `jstat` / `simple-statistics` for Poisson | MC is already done in Python pipeline | `pipeline/simulate.py` with numpy |
| `@tensorflow/tfjs` / ONNX / any ML runtime | No ML inference needed — all stats are closed-form | Pure Python arithmetic in pipeline |
| `ai` (Vercel AI SDK) | Adds 200KB+ bundle; `AnthropicStream` removed in v4; existing codebase uses `@anthropic-ai/sdk` directly | `@anthropic-ai/sdk` 0.93.0 |
| `chart.js` / `victory` / `nivo` for calibration scatter | Second charting library creates bundle bloat and style inconsistency | `recharts` `ScatterChart` (already in bundle, already styled) |
| TypeScript MC in browser or API route | 10–50× slower than numpy; browser freezes, API route times out | Python pipeline pre-computation |
| Edge Runtime for LLM routes | SDK SSE parsing known to fail on Vercel Edge (GitHub issue #292) | Node.js runtime (default), `maxDuration=30` |
| `d3` direct import | Recharts already bundles D3 internally; direct import doubles D3 in bundle | Recharts composable primitives |
| `react-markdown` for LLM output | Prose is plain text by design; markdown adds render complexity and XSS surface | `<p>` tag, whitespace-preserving CSS |
| Streaming for NLP-01 | Weekly summary is 4–5 sentences, non-streaming latency is acceptable, existing route works | Existing non-streaming `/api/prose-summary` route |
| Per-player prompt caching (Anthropic prompt caching beta) | System prompts vary per player; caching benefit is minimal for short outputs | Plain `messages.create()` calls |

---

### Version Compatibility (v1.18)

| Package | Current Version | Notes |
|---|---|---|
| `@anthropic-ai/sdk` | 0.93.0 | `messages.stream()`, `toReadableStream()`, `MessageStream.fromReadableStream()` all present in installed types. No upgrade needed. |
| `recharts` | 3.8.1 | `ScatterChart`, `ComposedChart`, `ReferenceLine`, `Scatter`, `ScatterProps` all verified present in `node_modules/recharts/types/index.d.ts`. |
| `numpy` (Python) | existing | `default_rng().poisson()` and `rng.binomial()` already in `simulate.py`. |
| `next` | 16.2.1 | `Response(readableStream)` is standard Web API; no Next.js-specific streaming adapter needed. |

---

### Confidence Assessment (v1.18)

| Area | Confidence | Reason |
|---|---|---|
| MC-01 pipeline already complete | HIGH | Direct code inspection of `pipeline/simulate.py` and `src/lib/types.ts` |
| CAL-01 already in AccuracyTab | HIGH | Direct code inspection of `AccuracyTab.tsx` lines 394–524 |
| SENS-01 already implemented | HIGH | Direct code inspection of `sensitivity.ts`, `FragilityBadge.tsx` |
| WHY-01 partially implemented | HIGH | Direct code inspection of `ExplainPanel.tsx` |
| NLP-01 already implemented | HIGH | Direct code inspection of `/api/prose-summary/route.ts` |
| SDK 0.93.0 supports streaming | HIGH | Direct type inspection of `MessageStream.d.ts`, `messages.d.ts` |
| `claude-haiku-4-5` is correct model ID | HIGH | Verified against Anthropic official models overview 2026-05-12 |
| Edge Runtime incompatible with SDK streaming | MEDIUM | Single GitHub issue source; Node.js runtime is the safer choice regardless |
| No new npm installs needed | HIGH | All capability verified against installed `node_modules` |

---

### Sources (v1.18)

- `package.json` — installed versions verified directly
- `pipeline/simulate.py` — full MC implementation confirmed
- `src/lib/types.ts` lines 184–198 — MC fields on `MergedPlayer` confirmed
- `src/components/accuracy/AccuracyTab.tsx` lines 394–524 — calibration chart pattern confirmed
- `src/lib/sensitivity.ts` — `computeFragility()` confirmed
- `src/components/squad/ExplainPanel.tsx` — `rejectionReasons` prop confirmed
- `src/app/api/prose-summary/route.ts` — SDK usage, model choice, guardrail pattern confirmed
- `node_modules/@anthropic-ai/sdk/lib/MessageStream.d.ts` — `toReadableStream()` and `fromReadableStream()` confirmed
- `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` — `messages.stream()`, `MessageCreateParamsStreaming` confirmed
- `node_modules/recharts/types/index.d.ts` — `ScatterChart`, `ComposedChart`, `ReferenceLine`, `Scatter` exports confirmed
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — `claude-haiku-4-5` alias, pricing, `claude-haiku-4-5-20251001` pinned ID verified 2026-05-12 — HIGH confidence
- GitHub issue anthropics/anthropic-sdk-typescript#292 — Edge Runtime SSE parsing failure — MEDIUM confidence (single source, but Node.js runtime is correct regardless)

---

## v1.16 Modelling & Trust — Stack Delta

### Bottom Line Up Front (v1.16)

| Feature | New deps? | Net new files | Touches existing |
|---------|-----------|---------------|-------------------|
| SCRAPER-01 | **None.** No scraping needed — `bootstrap-static.elements[].news` already in pipeline (`merge.py:992`). MergedPlayer already carries `news: string` (`types.ts:26,129`). | 0 (UI surfacing only) | `TransferPanel.tsx`, `GemTable` columns, `StatusBadge` reuse |
| REFRESH-01 | **None.** GitHub Actions cron + workflow conditionals. No new actions. | 1 workflow edit (`.github/workflows/pipeline.yml`) | existing `pipeline.yml`, `pipeline/run.py` |
| DH-04 | **None.** `recharts@3.8.1` already in deps and used by `AccuracyTab.tsx` and `RankSimTab.tsx`. Sparkline = `<LineChart>` with hidden axes; no `react-sparklines` needed. | 1 component (`CronHistorySparkline.tsx`) | `DataHealthSection.tsx`, `data_health.json` writer |
| BACK-01 | **None.** `localStorage` is sufficient (mirrors `manual-plan.ts` `MANUAL_PLAN_KEY` pattern). No `idb-keyval` required at this scale. | 1 storage module (`src/lib/decision-history.ts`), 1 component (`BacktesterTab.tsx`) | `RankSimTab.tsx` patterns |
| SPQ-04 | **None.** Pure UI over existing `sp_quality.json`. | 1 component (`SetPieceLeagueTable.tsx`) | `set-pieces` tab page |

**Net new npm packages (v1.16):** 0
**Net new Python packages (v1.16):** 0
**Net new external services (v1.16):** 0
**Net new GitHub Actions:** 0
**Net new cache files (v1.16):** 0 (DH-04 reads from extended `data_health.json`; SCRAPER-01 reads existing `merged_players.json`)

---

### SCRAPER-01: FPL Official News Feed

**Critical finding [VERIFIED: WebFetch 2026-05-09]:** FPL `bootstrap-static.elements[].news` is the official injury/availability news source. It is **already pulled into the pipeline** at `pipeline/merge.py:992` (`'news': element.get('news', '')`) and **already on the `MergedPlayer` type** at `src/lib/types.ts:26,129`. There is **no need to scrape** — FPL's own bootstrap endpoint is the canonical source that every scraper would re-derive from anyway.

The brief misleadingly framed this as "scraping". The work is **UI surfacing + flag derivation**, not Python scraping infrastructure.

#### Stack changes

**Python:** None.
- The existing `news` field is a free-text string (e.g. `"Ankle injury - Unknown return date"`).
- FPL also exposes `news_added` (ISO 8601 timestamp), `chance_of_playing_next_round` (0/25/50/75/100/null), and `status` (`a`/`d`/`i`/`s`/`u`/`n`) — all currently in bootstrap, none currently persisted to `MergedPlayer` except `status` and `news`.
- **Add to merge:** `news_added: str | None` and `chance_of_playing_next_round: int | None` from `element.get(...)`. One-line additions next to line 992.

**TypeScript:** None new.
- Extend `MergedPlayer` with `news_added?: string | null`, `chance_of_playing_next_round?: number | null`.
- `StatusBadge` already exists (`src/components/squad/SquadView.tsx:36`) — reuse it in `TransferPanel` and `GemTable`.

#### What NOT to add

- **`beautifulsoup4`** [ASSUMED rejection] — FPL's bootstrap-static endpoint already provides structured news. Adding a HTML scraper is a step backwards.
- **`lxml`** — same reason; no HTML to parse.
- **A new GitHub Actions workflow for news** — news refresh is part of the existing pipeline cron; the bootstrap fetch already happens 4× daily.
- **A separate `news_feed.json` cache** — news is already inside `merged_players.json`. Adding a parallel cache duplicates state.
- **A separate `/api/news` route** — news ships with `/api/players` payload.
- **An LLM summariser for news** — `news` strings are short and pre-formatted by FPL editors; LLM rewrite adds latency and cost for negligible gain.

#### Acceptance criteria mapping

| Behaviour | Implementation |
|-----------|----------------|
| Show injury/suspension flag in TransferPanel | Reuse `<StatusBadge status={p.status} news={p.news} />` in transfer rows |
| Show flag in GemTable | New tiny `NewsBadge` cell or reuse `StatusBadge`; column hidden by default in Default preset, shown in Analysis preset |
| Indicate freshness | Render `news_added` via existing `formatRelativeTime()` (Phase 38 utility) |
| Filter out players with `chance_of_playing_next_round <= 25` from buy suggestions | One-line predicate in `suggestTransfers()` (already filters by `status` — extend) |

---

### REFRESH-01: Event-Based GitHub Actions Pipeline Triggers

**Critical findings [VERIFIED: WebFetch GitHub Actions docs 2026-05-09]:**
1. **GitHub Actions cron minimum granularity is 5 minutes.** Cannot schedule sub-5-minute runs.
2. **Cron cannot evaluate conditions before triggering.** Workflow runs unconditionally; date-aware logic must be **inside the workflow** (early-exit step) or done as a **dispatcher matrix**.
3. **`workflow_dispatch`** allows manual + API-triggered runs. Already enabled in `pipeline.yml:6`.
4. **`repository_dispatch`** allows external webhooks to trigger workflows with custom `event_type` and `client_payload` — useful if a separate cron service detects FPL deadline changes.

#### Recommended pattern

Keep the existing `cron: '0 6,12,18,0 * * *'` (4× daily UTC). **Add deadline-aware logic via:**

| Strategy | When | How |
|----------|------|-----|
| **Pre-flight skip step** | Off-deadline days | First step in `run-pipeline` job: read `bootstrap-static.events[].deadline_time` (ISO 8601, verified present), compute hours-to-deadline, exit job 0 if >48h *AND* last cache <24h old |
| **Dense schedule near deadline** | Deadline ±6h | Add a second cron entry running every 30 min (`*/30 * * * *`) that runs only if a deadline is within 6h (early-exit otherwise) |
| **Manual override** | Always | `workflow_dispatch` with optional `force_refresh: bool` input |
| **External webhook** *(optional)* | If/when a sentinel detects price changes | `repository_dispatch` with `event_type: fpl-price-change`; **deferred** unless user opts in |

#### Stack changes

**No new actions.** All capability uses built-ins:
- `actions/checkout@v4` — already in workflow
- `actions/setup-python@v5` — already in workflow
- Job conditionals via `if:` expressions and bash `exit 0`

**One workflow edit** (`.github/workflows/pipeline.yml`):
- Add `inputs:` block under `workflow_dispatch:` for `force_refresh`
- Add a "deadline guard" first step that fetches bootstrap-static, parses `events[]`, sets `should_run` GITHUB_OUTPUT
- Add `if: steps.guard.outputs.should_run == 'true'` to subsequent steps

**Optional Python helper:** `pipeline/deadline_guard.py` (~30 LOC) — pure stdlib, called from workflow step. Exits 0 with stdout `RUN` or `SKIP`.

#### What NOT to add

- **`@vercel/cron`** — already rejected v1.14; GitHub Actions is the established pattern (validated v1.2 DAT-01).
- **A separate "scheduler" repo** — overkill for personal tool.
- **External cron services (cron-job.org, EasyCron)** — adds external dependency; `repository_dispatch` from a tiny existing service would be the cleaner alternative if ever needed, and **even that is deferred**.
- **GitHub-hosted larger runner** — pipeline runs in <2 min on `ubuntu-latest`; no need.
- **Caching FPL bootstrap across runs** — bootstrap is the source of truth; caching it defeats the purpose of refresh.
- **A "smart cron" library in Python** — date math is one `datetime.fromisoformat()` + subtract; no `croniter` / `apscheduler` warranted.

#### FPL deadline source [VERIFIED]

`bootstrap-static.events[]` contains:
- `deadline_time`: ISO 8601 (e.g. `"2025-08-15T17:30:00Z"`)
- `deadline_time_epoch`: Unix seconds
- `is_current: bool`, `is_next: bool`, `finished: bool`

Use `is_next: true` event's `deadline_time` for "hours until next deadline" calculation.

---

### DH-04: Cron History Sparkline

#### Stack changes

**TypeScript:** None new.
- `recharts@3.8.1` already in `package.json` and used by `AccuracyTab.tsx` and `RankSimTab.tsx`.
- Sparkline pattern: `<LineChart>` with `<XAxis hide />`, `<YAxis hide />`, `<CartesianGrid hide />`, height ~24px, single `<Line stroke=... dot=false>`.
- Tooltip with timestamp + status on hover (reuse existing `<Tooltip>` from recharts).

**Python:** Extend `pipeline/data_health.py` to append a rolling history entry per run.

#### Data model addition

```ts
// src/lib/types.ts — extend DataHealth (already exists from v1.14 DQ-01)
export interface DataHealthRunEntry {
  timestamp: string         // ISO 8601
  status: 'ok' | 'warn' | 'error'
  duration_seconds?: number
  error_message?: string | null
}

export interface DataHealth {
  // ... existing v1.14 fields ...
  cron_history?: DataHealthRunEntry[]   // NEW v1.16 — last 7 entries, ordered oldest→newest
}
```

#### Pipeline change

`pipeline/data_health.py`: read previous `data_health.json`, prepend current run, truncate to last 7 entries. Atomic write (write temp + rename). ~15 LOC addition.

#### What NOT to add

- **`react-sparklines`** [VERIFIED: npm view] (last published 4 years ago; unmaintained). Use existing `recharts` — saves ~30KB and avoids dep duplication.
- **`d3` direct** — recharts wraps d3 already.
- **Pure CSS sparkline** — feasible (inline SVG `<polyline>`) but loses tooltip/hover ergonomics; with recharts already loaded, the marginal cost is zero.
- **A separate `cron_history.json` cache file** — extending `data_health.json` keeps API surface flat (one fetch).
- **Server-sent events / websockets** — pipeline runs every 6h; on-page-load fetch is sufficient.
- **Animation library (`framer-motion`)** — recharts has built-in `isAnimationActive`.

---

### BACK-01: Decision History Backtester

#### Storage decision

**Use `localStorage`.** Mirrors the existing `MANUAL_PLAN_KEY` pattern in `src/lib/manual-plan.ts:5`.

| Factor | localStorage | IndexedDB |
|--------|-------------|-----------|
| Quota | ~5–10 MB per origin | ~50% of disk |
| API | Synchronous, simple | Async, callback/promise |
| Data shape | JSON.stringify | Native objects |
| Project precedent | ✓ Used (manual-plan, fpl_team_id, theme) | ✗ Not used |
| BACK-01 size estimate | ~38 GWs × ~500 bytes ≈ 19 KB | over-engineered |

**Decision: localStorage.** A full season of decision history is well under 50 KB even with verbose entries.

#### Stack changes

**TypeScript:** None new.
- `idb-keyval@6.2.2` and `idb@8.0.3` are **available but explicitly not added** — overkill for this dataset.
- Reuse `loadFromStorage` / `saveToStorage` patterns from `src/lib/manual-plan.ts`.

#### Data model

```ts
// src/lib/decision-history.ts (NEW)
export const DECISION_HISTORY_KEY = 'fplx_decision_history'

export interface DecisionRecord {
  version: 1
  gw: number
  capturedAt: string                      // ISO timestamp at capture
  captain: { id: number; xPts: number; actual?: number | null }
  viceCaptain: { id: number; xPts: number; actual?: number | null }
  transfers: Array<{ outId: number; inId: number; outXpts: number; inXpts: number }>
  chip: 'wildcard' | 'free_hit' | 'bench_boost' | 'triple_captain' | null
  hits: number                            // count of -4 hits taken
  squad: number[]                         // 15 player IDs at GW deadline
}

export interface DecisionHistory {
  version: 1
  teamId: number                          // namespaces history by FPL team
  records: DecisionRecord[]               // ordered by gw asc
}
```

#### Capture & enrichment flow

1. **Capture (manual or auto):** When user clicks "Save this week's decision" on Decision Summary, snapshot current squad + chosen captain + planned transfers into `localStorage`.
2. **Enrichment (post-GW):** When pipeline data updates and a captured GW is now `finished: true`, run client-side `enrichDecisionHistory()` to fill `actual` xPts from latest `merged_players.json` (uses `last_gw_actual_pts` field added v1.5).
3. **Backtester view:** New `BacktesterTab` under Squad section — table of GW × captain delta vs optimal × transfer regret × cumulative regret score.

#### What NOT to add

- **`idb-keyval`** / **`idb`** / **`localforage`** — see table above; localStorage is sufficient and matches project precedent.
- **`zustand`** / **`jotai`** — state management for one tab is overkill; reuse `useState` + storage helpers like `manual-plan.ts`.
- **`zod` schema for the storage payload** — versioned object (`version: 1`) with try/catch fallback to empty matches existing `loadManualPlan()` pattern; Zod is reserved for FPL API drift, not our own JSON.
- **Server-side storage / DB** — violates "No database for v1" decision (PROJECT.md key decisions table).
- **Cloud sync (Vercel KV, Supabase)** — single-user personal tool; localStorage per-browser is acceptable. Future cross-device sync is a deferred idea.
- **Date library (`date-fns`, `dayjs`)** — `formatRelativeTime` already exists in `src/lib/formatRelativeTime.ts` (Phase 38).

---

### SPQ-04: Set-Piece League Table

**No stack changes.** The `sp_quality.json` cache file shipped in v1.14 already contains all 20 teams' delivery quality scores. SPQ-04 is a pure-UI render: a sortable TanStack Table (already in deps as `@tanstack/react-table@8.21.3`) inside the existing Set Pieces tab.

#### What NOT to add

- **No new pipeline module** — `pipeline/set_piece_quality.py` already writes the data.
- **No new API route** — extend `/api/set-pieces` if needed, or fetch `sp_quality.json` via existing fetch path.
- **No new chart library** — table is the right primitive.

---

## Cross-Cutting v1.16 — What NOT to Add

| Tempting addition | Why reject |
|-------------------|------------|
| `beautifulsoup4` for SCRAPER-01 | FPL bootstrap-static already provides `news` field — no scraping needed |
| `lxml` | Same |
| `react-sparklines` for DH-04 | `recharts` already in deps; sparkline is `<LineChart>` with hidden axes |
| `idb-keyval` for BACK-01 | localStorage handles ~19 KB easily; matches project precedent |
| `croniter` / `apscheduler` for REFRESH-01 | Date math is trivial Python stdlib |
| External cron service | GitHub Actions cron + workflow_dispatch covers all needs |
| `@vercel/cron` | Rejected v1.14; GitHub Actions is the established cron substrate |
| LLM news rewrite | `news` strings are FPL-curated and concise |
| `framer-motion` for sparkline animation | recharts has `isAnimationActive` |
| `date-fns` / `dayjs` | `formatRelativeTime` already shipped Phase 38 |
| New `/api/news` route | News ships in `/api/players` |
| Separate `cron_history.json` | Extend `data_health.json` |

---

## Existing Stack Summary (after v1.18)

| Layer | Status |
|-------|--------|
| Next.js 16.2.1 / React 19.2.4 / TypeScript 5 | **No changes** |
| TanStack Query 5.95 / TanStack Table 8.21 | **No changes** — extend existing hook patterns |
| Tailwind v4 / dark mode | **No changes** |
| recharts 3.8.1 | **Reuse** — `ComposedChart`/`ReferenceLine` already used for CAL-01 |
| `@anthropic-ai/sdk` 0.93.0 | **Reuse** — already in deps, route exists; NLP-02 adds one new route |
| immer 11 / use-immer 0.11 | **No changes** |
| zod 4.3.6 | **No changes** — adapter-only |
| `@vercel/blob` 2.3.1 | **No changes** |
| Python: requests / pandas / numpy / soccerdata | **Reuse only** — `simulate.py` already uses numpy |
| Vercel Blob | **No changes** |
| GitHub Actions | **No changes for v1.18** |
| External APIs | **Claude API already used** — NLP-02 adds one more route calling it |

---

## Confidence Assessment (v1.16)

| Area | Confidence | Reason |
|------|------------|--------|
| SCRAPER-01: `news` field already in bootstrap | HIGH [VERIFIED: WebFetch + grep merge.py:992 + types.ts:26,129] | Verified directly in code and live API |
| SCRAPER-01: `chance_of_playing_next_round` available | HIGH [VERIFIED: WebFetch] | Standard FPL bootstrap field |
| REFRESH-01: GitHub Actions cron min 5 min | HIGH [VERIFIED: GitHub docs] | Documented limit |
| REFRESH-01: cron cannot pre-evaluate | HIGH [VERIFIED: GitHub docs] | Confirmed in docs |
| REFRESH-01: `events[].deadline_time` shape | HIGH [VERIFIED: WebFetch] | ISO 8601 + epoch both present |
| DH-04: recharts already in deps | HIGH [VERIFIED: package.json:23 + AccuracyTab.tsx:25] | Direct file inspection |
| DH-04: react-sparklines unmaintained | MEDIUM [ASSUMED] | Last publish 4y ago per npm; minor risk if revived |
| BACK-01: localStorage sufficient size | HIGH | 19 KB << 5 MB quota; trivial math |
| BACK-01: project precedent for localStorage | HIGH [VERIFIED: manual-plan.ts:5] | Direct file inspection |
| SPQ-04: sp_quality.json already shipped v1.14 | HIGH | Pipeline file `pipeline/set_piece_quality.py` exists |
| Cross-cutting: no new deps needed | HIGH | All five features fit existing libraries; verified package.json + requirements.txt |

## Assumptions Log (v1.16)

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-sparklines` is unmaintained | DH-04 | Low — recharts is the right call regardless |
| A2 | Brief's "scraper" framing is misleading and `news` field suffices | SCRAPER-01 | Medium — if the user actually wants Twitter/press conf scraping, scope expands; needs confirmation in /gsd-discuss-phase |
| A3 | localStorage 5 MB quota is enough for season-long decision history | BACK-01 | Very low — 19 KB estimate is conservative |
| A4 | `repository_dispatch` for external triggers is deferred (not required for v1.16) | REFRESH-01 | Low — built-in cron + workflow_dispatch covers stated requirement |
| A5 | Adding a deadline-aware second cron entry won't conflict with existing 4×/day cron | REFRESH-01 | Low — cron entries are independent jobs |

## Open Questions (v1.16)

1. **SCRAPER-01 scope**: Does "FPL official news feed scraper" mean the bootstrap `news` field (recommended), or does the user want press-conference / external news? **Recommendation: confirm in /gsd-discuss-phase before planning. Bootstrap field is 95% of the value at 0% of the cost.**
2. **REFRESH-01 trigger granularity**: Is 5-minute cron resolution acceptable, or does the user want truly event-driven (price change → repo dispatch)? **Recommendation: ship deadline-aware schedule first; defer external dispatch.**
3. **BACK-01 capture trigger**: Auto-capture on each `last_updated` change, or manual "Save this week" button? **Recommendation: manual button to keep agency explicit.**

---

## v1.14 Stack Additions (RETAINED — already shipped)

### Bottom Line Up Front (v1.14)

| Feature | New deps? | Net new files | Touches existing |
|---------|-----------|---------------|-------------------|
| GK-01   | **None.** | 0 (math lives in `merge.py` / `pipeline/saves.py`) | `merge.py`, `XPtsCell` (`columns.tsx`), `MergedPlayer` type |
| DQ-01   | **None.** | 1 pipeline writer (`pipeline/data_health.py`), 1 API route, 1 hook, 1 component | `run.py`, `AccuracyTab.tsx`, `last_updated.json` writer |
| SP-QUAL-01 | **None.** Reuse existing `requests` + regex pattern in `understat_client.py` | 1 pipeline module (`pipeline/set_piece_quality.py`), 1 cache file, 1 API route, 1 hook | `SetPieceTakerPanel.tsx`, `run.py` |

Full v1.14 detail (GK-01 save-point math, DQ-01 sanity checks, SP-QUAL-01 Understat shots scraping) preserved verbatim in git history (`git show HEAD~30:.planning/research/STACK.md` for original entries). Summary above is sufficient as carry-forward context for v1.16 planning.

### v1.14 confidence (carry-forward)

All v1.14 stack decisions shipped successfully and remain HIGH confidence. The pattern of "extend existing modules, add no dependencies" is the established norm for this codebase and is continued in v1.16 and v1.18.

---

## Sources

### Primary (HIGH confidence)
- `package.json` — direct read of dependency versions (all milestones)
- `pipeline/simulate.py` — MC implementation confirmed (v1.18)
- `src/lib/types.ts` lines 184–198 — MC fields on `MergedPlayer` confirmed (v1.18)
- `src/components/accuracy/AccuracyTab.tsx` lines 394–524 — calibration chart confirmed (v1.18)
- `src/lib/sensitivity.ts` — `computeFragility()` confirmed (v1.18)
- `src/components/squad/ExplainPanel.tsx` — `rejectionReasons` prop confirmed (v1.18)
- `src/app/api/prose-summary/route.ts` — SDK usage, model, guardrail pattern confirmed (v1.18)
- `node_modules/@anthropic-ai/sdk/lib/MessageStream.d.ts` — streaming API surface confirmed (v1.18)
- `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` — `messages.stream()` confirmed (v1.18)
- `node_modules/recharts/types/index.d.ts` — chart component exports confirmed (v1.18)
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — `claude-haiku-4-5` alias, pricing verified 2026-05-12 (v1.18)
- `pipeline/requirements.txt` + `.github/workflows/pipeline.yml` — Python deps (v1.14/v1.16)
- `pipeline/merge.py:992` + `src/lib/types.ts:26,129` — `news` field (v1.16)
- `src/lib/manual-plan.ts:5` — localStorage precedent (v1.16)
- [GitHub Actions events docs](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows) — cron limits, dispatch types (v1.16)

### Secondary (MEDIUM confidence)
- `npm view react-sparklines` — maintenance assessment (v1.16)
- GitHub issue anthropics/anthropic-sdk-typescript#292 — Edge Runtime SSE incompatibility (v1.18)

### Tertiary (LOW confidence)
- None — every claim traces to a verified source.

---
*v1.14 entries retained as carry-forward summary. v1.16 delta added 2026-05-09. v1.18 delta added 2026-05-12.*
