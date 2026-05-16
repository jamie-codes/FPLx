# Architecture Patterns — v1.21 Polish, Intelligence & Team News

**Domain:** FPL Analyst — subsequent milestone, integrating team news surfacing (SCRAPER-01), weekly AI prose summary wiring (NLP-01), and model versioning UI (VER-01) into the existing Python pipeline → Vercel Blob → Next.js 16 Route Handlers → TanStack Query → React stack.
**Researched:** 2026-05-16
**Confidence:** HIGH — all findings derived from direct codebase reads of `pipeline/accuracy.py`, `pipeline/run.py`, `pipeline/prose_summary.py`, `src/app/api/prose-summary/route.ts`, `src/app/api/accuracy/route.ts`, `src/lib/types.ts`, `src/components/news/NewsBanner.tsx`, `src/components/captaincy/CaptainPicksPanel.tsx`, `src/components/transfers/OpportunityCostTable.tsx`, `src/lib/hooks/useProseSummary.ts`, `src/lib/hooks/useProseRefresh.ts`, and `src/components/squad/ProseSummaryBlock.tsx`.

---

## Headline Finding: Most v1.21 Infrastructure Already Exists

Before answering the architectural questions, the single most important fact for the roadmapper:

| Feature | What's Already Built | What's Outstanding |
|---------|---------------------|--------------------|
| SCRAPER-01 Team News | `news` and `news_added` fields are in `MergedPlayer`, in `FPLElement`, and are read from `bootstrap-static` by the pipeline already. `NewsBanner` component exists (`src/components/news/NewsBanner.tsx`). `computeNewsSeverity()` exists. `useNewsFlagEnabled()` hook exists. `NewsBanner` is already wired into `OpportunityCostTable` (TransferPanel buy rows). | Wire `NewsBanner` into `CaptainPicksPanel` candidate rows. No new route, no new pipeline step, no new type. |
| NLP-01 Weekly Prose | `pipeline/prose_summary.py` already runs in the pipeline daily and writes `weekly_summary.json` to Blob. `/api/prose-summary` GET + POST both exist. `useProseSummary`, `useProseRefresh`, and `ProseSummaryBlock` are all shipped in `DecisionSummaryTab`. The prompt uses captain names, top transfer, chip recommendation, and lifecycle risks — all sourced from existing decision-engine outputs. | The route and UI are functionally complete. The open question is whether the *prompt payload* needs to be broadened (e.g., OCS rows, chip strategy label). The architecture is done; only content tuning remains. |
| VER-01 Model Versioning | `accuracy.py` already writes a `versions[]` array to `accuracy_backtest.json`. Each entry has `formula_version` (a `FORMULA_VERSION = 'v1.12-a'` string constant in `accuracy.py`), `recorded_at`, `hit_rate`, and `gate_flags`. The dedup/append logic is implemented. `/api/accuracy` already serves the full `accuracy_backtest.json` including `versions[]`. `useAccuracy()` already fetches it. | Build a `VersionHistoryTable` UI component in `AccuracyTab` that reads `useAccuracy().data.versions` and renders the comparison table. Update `FORMULA_VERSION` constant when the formula changes. No new route, no new pipeline step. |

**Implication for roadmapper:** v1.21 is almost entirely *UI surface work and content wiring*, not infrastructure. The build order for the three architectural questions is SCRAPER-01 first (one-component add), VER-01 second (one-component add to AccuracyTab), NLP-01 last (content-only prompt tuning if needed, otherwise already done).

---

## Existing Architecture (Verified Baseline — v1.20 shipped)

```
+--------------------------------------------------------+
| GitHub Actions cron (pipeline.yml, daily)              |
| pipeline/run.py — try/except orchestrator              |
|   bootstrap + fixtures + element-summary               |
|   xmins -> bonus -> merge_players                      |
|   compute_simulations (MC_ENABLED=True)                |
|   insights, gw_intel, price_changes                    |
|   defcon, accuracy.compute_accuracy_backtest()         |
|     └─ writes versions[] to accuracy_backtest.json     |
|   prose_summary.generate_weekly_summary()              |
|     └─ Claude Haiku -> weekly_summary.json             |
|   data_health.json (last artifact)                     |
+----------------------+---------------------------------+
                       |
              pipeline/cache/ (local dev) OR Vercel Blob (prod)
                       |
+----------------------+---------------------------------+
| merged_players.json  (single source of truth)          |
|   includes: news, news_added, chance_of_playing_next_  |
|   round (from FPL bootstrap-static via merge.py)       |
| accuracy_backtest.json                                 |
|   summary{...}  calibration{...}  haulters[...]        |
|   versions[{formula_version, recorded_at,             |
|             hit_rate, gate_flags{...}}]                |
| weekly_summary.json  (Claude Haiku prose)              |
| captain_picks.json / captain_picks_gw{N}.json          |
| player_insights/gw{N}/element_{id}.json  (per-player) |
+----------------------+---------------------------------+
                       |
+----------------------+---------------------------------+
| Next.js 16 Route Handlers (/api/*)                     |
|   /api/players        GET  -> merged_players.json      |
|   /api/accuracy       GET  -> accuracy_backtest.json   |
|   /api/prose-summary  GET  -> weekly_summary.json      |
|   /api/prose-summary  POST -> Claude Haiku (live gen)  |
|   /api/player-insight POST -> Claude Haiku + Blob cache|
+----------------------+---------------------------------+
                       |
+----------------------+---------------------------------+
| TanStack Query (6h staleTime convention)               |
|   usePlayers()                                         |
|   useAccuracy()     -- serves versions[] already       |
|   useProseSummary() [GET]                              |
|   useProseRefresh() [POST mutation]                    |
|   useNewsFlagEnabled() -- reads accuracy summary gate  |
+----------------------+---------------------------------+
                       |
+----------------------+---------------------------------+
| React Components (client)                              |
|   CaptainPicksPanel  -- needs NewsBanner added         |
|   OpportunityCostTable -- NewsBanner already wired     |
|   AccuracyTab        -- needs VersionHistoryTable added|
|   DecisionSummaryTab + ProseSummaryBlock -- complete   |
+--------------------------------------------------------+
```

---

## Answers to the Three Architectural Questions

### Q1 (SCRAPER-01): How does team news appear in TransferPanel and CaptainPicksPanel?

**Finding: The data flow is already complete. Only `CaptainPicksPanel` is missing the UI wiring.**

The complete data trail:

1. **Pipeline source:** `bootstrap-static` (fetched by `pipeline/fpl_client.get_bootstrap_static()` in `run.py`) includes `elements[].news`, `elements[].news_added`, and `elements[].chance_of_playing_next_round` for every player.
2. **Merge step:** `pipeline/merge.py` passes these fields through to `merged_players.json`. The `FPLElement` Zod schema validates all three fields. `MergedPlayer` declares `news: string`, `news_added?: string`, and `chance_of_playing_next_round?: number | null`.
3. **API route:** `/api/players` passes `merged_players.json` directly — no field stripping. News fields are available on every `MergedPlayer` object the client receives.
4. **Gate hook:** `useNewsFlagEnabled()` reads `useAccuracy().data.summary.news_flag_enabled` (always `True` in pipeline, kill-switch via this hook). This hook already exists.
5. **Severity computation:** `computeNewsSeverity(chance_of_playing_next_round, news)` already exists in `src/lib/newsSeverity.ts`.
6. **Component:** `NewsBanner` component (`src/components/news/NewsBanner.tsx`) already exists — accepts `news`, `news_added?`, `chance_of_playing_next_round?`; renders severity-coloured inline text with icon; respects the gate hook; returns `null` when no news.
7. **TransferPanel:** `NewsBanner` is **already wired** into `OpportunityCostTable.tsx` on buy candidate rows (Phase 88).
8. **CaptainPicksPanel:** `NewsBanner` is **not yet wired** — the candidate rows have `web_name`, MC labels, and fragility badges but no news display.

**Integration decision: Add `NewsBanner` to `CaptainPicksPanel` `CandidateRow`.**

The `CaptainPicksPanel` already calls `usePlayers()` and maps captain candidates from `useCaptainPicks()`. Captain pick objects come from `captain_picks.json` (via `useCaptainPicks()`), not directly from `merged_players.json`. The candidate objects likely do not carry `news` fields — they carry only the fields written by `_compute_captain_picks()` in `pipeline/merge.py` (name, team, xPts, EO%, ceiling fields).

**Architecture decision: Join news fields from `usePlayers()` at the component level, keyed by player `id`.**

The `CaptainPicksPanel` already imports both `useCaptainPicks()` and `usePlayers()`. The fix is:
1. Build a `Map<number, MergedPlayer>` from `usePlayers().data` keyed by `id` (same pattern as other components that join captain picks with player detail).
2. For each candidate row, look up `playersMap.get(candidate.id)` to access `news`, `news_added`, and `chance_of_playing_next_round`.
3. Render `<NewsBanner news={player?.news ?? ''} chance_of_playing_next_round={player?.chance_of_playing_next_round} />` inside the candidate row.

This is the identical pattern used by `OpportunityCostTable` and `GemTable` where buy-candidate or row-expanded players join the full player record for news context.

**No new route. No new pipeline step. No changes to `MergedPlayer`.** The `news` field is already surfaced. This is a pure UI addition.

**Data flow:**

```
FPL bootstrap-static
  └─ elements[].news / news_added / chance_of_playing_next_round
       └─ pipeline/merge.py -> merged_players.json
            └─ /api/players (GET, passthrough)
                 └─ usePlayers() [TanStack Query, 6h staleTime]
                      └─ CaptainPicksPanel: Map<id, MergedPlayer>
                           └─ CandidateRow -> NewsBanner (NEW wiring)
                                └─ computeNewsSeverity() -> severity tier
                                     └─ renders: "⚠ Suspected knock..." (red/amber/zinc)
```

---

### Q2 (NLP-01): Where does the weekly prose summary live, and what is the cache strategy?

**Finding: The complete architecture is already shipped. No new infrastructure.**

The full stack is implemented:

| Layer | Implementation | Status |
|-------|---------------|--------|
| Generation | `pipeline/prose_summary.generate_weekly_summary()` called in `run.py` daily. Builds prompt from top-3 captains (by `xPts_1gw`, excluding GKs), top-3 differential gems (`selected_by_percent < 15%`), plus chip and transfer placeholders. Returns `{ prose, gw, generated_at }`. Wrapped in `try/except` — non-fatal. | DONE |
| Storage | `weekly_summary.json` written to `pipeline/cache/` (local) or Vercel Blob (prod) via `save()`. | DONE |
| Route | `GET /api/prose-summary` reads Blob or local cache, returns JSON with `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. `POST /api/prose-summary` accepts a `ProseRefreshPayload` (captains, transfer, chip, risks), calls Claude Haiku, returns fresh prose. `maxDuration = 30`. Guardrail: two-attempt loop with `passesGuardrail()`. | DONE |
| Query hook | `useProseSummary()` — TanStack Query, `queryKey: ['prose-summary']`, 6h staleTime. Returns `ProseSummary | null` (returns `null` on 404 — graceful when not yet generated). | DONE |
| Mutation hook | `useProseRefresh()` — `useMutation`, posts `ProseRefreshPayload`, returns `ProseSummary`. | DONE |
| UI | `ProseSummaryBlock` in `DecisionSummaryTab`. Shows global prose from `useProseSummary()`; refresh button fires `useProseRefresh()` with squad-aware `ProseRefreshPayload`; component override replaces global prose with squad-specific fresh prose. Guardrail failure = `null` display (hidden). | DONE |

**Cache strategy (confirmed):**

- **Pipeline-generated prose (primary):** Generated once per daily pipeline run. Cached in Blob (`weekly_summary.json`). Served by GET with a 1h edge cache (`s-maxage=3600`). Cost: one Haiku call per day.
- **On-demand squad refresh (secondary):** User-triggered via Refresh button. Posted to `/api/prose-summary`, generates a squad-aware prose tailored to the user's captains, transfers, and risk flags. No Blob write for the user-specific version — it lives as component state only (`override` in `ProseSummaryBlock`). Cost: one Haiku call per user refresh.

**What NLP-01 v1.21 might need (content question, not architecture):**

The current pipeline prompt in `run.py` passes only `captains` (top-3 by `xPts_1gw`) and `gems` (top-3 differentials). The `POST` body schema (`ProseRefreshPayload`) also accepts `transfer`, `chip`, and `risks`. The v1.21 question "built from existing decision engine outputs (captain picks, OCS rows, chip strategy, lifecycle labels)" suggests enriching the pipeline-generated version to also pass chip timing and lifecycle risk data.

**Architecture decision: No new route or hook. Enrich the pipeline prompt payload in `prose_summary.py` and `run.py`.**

If the pipeline prose should include chip strategy and lifecycle flags:
1. Extend `generate_weekly_summary()` to accept optional `chip` and `risks` params (already supported by `POST`'s Zod schema on the UI side — proof the shape works).
2. In `run.py`, compute chip best-GW and top lifecycle-risk players from `merged` and `captain_picks`, pass to `generate_weekly_summary()`.
3. No route change. No hook change. No component change.

The on-demand squad refresh (`POST`) already accepts these fields from the UI (the `ProseRefreshPayload` type in `types.ts` includes `chip` and `risks`). The gap is only in the pipeline-generated version.

**Model and cost:**

- Model: `claude-haiku-4-5` (in `prose-summary/route.ts`). Note: `pipeline/prose_summary.py` uses a slightly different model string — verify both are aligned to the same model version at implementation time.
- `max_tokens: 512` (weekly prose is 4-5 sentences).
- No prompt caching needed on the weekly prose route: one call per day, system prompt caching saves <$0.001/month.

---

### Q3 (VER-01): Where does the version tag come from, and how are versions compared in AccuracyTab?

**Finding: The versioning backend is fully implemented. Only the UI comparison view is missing.**

**Where the version tag comes from (confirmed):**

```python
# pipeline/accuracy.py line 37
FORMULA_VERSION = 'v1.12-a'  # bumped manually when prediction formula changes; pattern v{milestone}-{letter}
```

This is a **module-level string constant** in `accuracy.py`. It is not derived from a git hash (avoiding the git-in-prod problem), not read from a config file (avoiding config drift), and not auto-incremented (avoiding implicit changes). The pattern is `v{milestone}-{letter}` where `letter` allows multiple formula iterations within a single milestone without bumping the version number itself.

**How versions accumulate in `accuracy_backtest.json` (confirmed):**

Each pipeline run calls `_read_existing_versions(cache_dir)` to load the prior versions array from `accuracy_backtest.json`. A new record is appended only when `FORMULA_VERSION` is not already in the existing set (dedup by set membership, not just tail check). The schema of each record:

```json
{
  "formula_version": "v1.12-a",
  "recorded_at": "2026-05-16T12:00:00Z",
  "hit_rate": 0.4231,
  "gate_flags": {
    "form_signal_enabled": true,
    "xmins_v2_enabled": true,
    "bonus_predictor_enabled": true,
    "save_predictor_enabled": false,
    "mc_enabled": true
  }
}
```

The top-level `versions[]` array is served by `/api/accuracy` (passthrough) and is already in the data returned by `useAccuracy()`.

**How versions should be compared in AccuracyTab (architecture decision):**

**Decision: Build a `VersionHistoryTable` component reading `useAccuracy().data.versions`. Pure UI addition — no new route, no new hook.**

The component:
1. Reads `versions` from `useAccuracy().data?.versions ?? []`.
2. Renders a table sorted by `recorded_at` descending (most recent first).
3. Columns: Formula Version | Recorded At | Hit Rate | Gate Flags (badge list).
4. No network calls. No new state.

Placement: inside `AccuracyTab`, as a new pill/tab alongside the existing "Summary | Calibration | Back" navigation that was added in Phase 96. A fourth pill "Versions" fits the existing `AccuracyTab` pill-nav pattern.

**VER-01 update workflow (for formula changes):**

When the prediction formula in `merge.py` or `simulate.py` changes:
1. Update `FORMULA_VERSION` in `accuracy.py` (e.g., `'v1.21-a'`).
2. Next pipeline run appends the new version record.
3. UI reflects the new entry automatically via `useAccuracy()`.

No migration needed. Old version records are append-only and never overwritten.

**What `FORMULA_VERSION` should be bumped to for v1.21:**

The current value is `'v1.12-a'`. Since PROJECT.md shows the v1.20 milestone is complete, the next version should be `'v1.20-a'` or `'v1.21-a'` (depending on whether any formula changes land in v1.21). If v1.21 ships no formula changes (only UI / news / prose wiring), the version should remain `'v1.12-a'` — do not bump a constant just because the milestone number changes. Bump it only when the prediction formula itself changes.

---

## Component Boundaries

### Data Flow Summary by Feature

```
SCRAPER-01 (team news in CaptainPicksPanel):

  FPL bootstrap-static elements[].news
    └─ pipeline/merge.py: passes through as-is (no compute)
         └─ merged_players.json: news, news_added, chance_of_playing_next_round
              └─ /api/players (GET, passthrough, unchanged)
                   └─ usePlayers() (6h staleTime, unchanged)
                        └─ CaptainPicksPanel:
                             Map<id, MergedPlayer> from usePlayers()
                               └─ CandidateRow: MODIFY to add:
                                    NewsBanner (EXISTING component, NEW call site)
                                      computeNewsSeverity() -> red/amber/zinc/none
                                      useNewsFlagEnabled() -> gate check (reads useAccuracy)

NLP-01 (weekly prose summary):

  pipeline/prose_summary.py (already generates prose daily)
    └─ weekly_summary.json (Vercel Blob)
         └─ /api/prose-summary GET (unchanged)
              └─ useProseSummary() (unchanged)
                   └─ ProseSummaryBlock (unchanged) in DecisionSummaryTab

  [Optional: enrich pipeline payload]
  captain_picks + merged (in run.py) -> chip best-GW, lifecycle risks
    └─ generate_weekly_summary(captains, gems, chip?, risks?) [MODIFY signature]

  User squad-aware refresh (already works):
  DecisionSummaryTab -> ProseRefreshPayload
    └─ useProseRefresh() POST /api/prose-summary
         └─ Claude Haiku -> prose
              └─ ProseSummaryBlock override state

VER-01 (model versioning in AccuracyTab):

  accuracy.py FORMULA_VERSION constant (already bumped manually per formula change)
    └─ accuracy_backtest.json versions[] (already appended per pipeline run)
         └─ /api/accuracy GET (passthrough, unchanged)
              └─ useAccuracy() (6h staleTime, unchanged)
                   └─ AccuracyTab:
                        NEW "Versions" pill in pill nav
                        └─ VersionHistoryTable (NEW component)
                             reads data.versions, renders sorted table
```

### New vs Modified Files

| Path | Type | Purpose |
|------|------|---------|
| `src/components/captaincy/CaptainPicksPanel.tsx` | MODIFY | Add `NewsBanner` to each `CandidateRow`. Build `Map<id, MergedPlayer>` from `usePlayers()` (hook already imported). Render `NewsBanner` for each candidate's news fields. |
| `src/components/accuracy/AccuracyTab.tsx` | MODIFY | Add "Versions" pill to existing pill-nav. Conditionally render `VersionHistoryTable` when the pill is active. |
| `src/components/accuracy/VersionHistoryTable.tsx` | NEW | Pure presentation. Reads `AccuracyData.versions[]`. Columns: version, date, hit rate, gate flags. No hooks, no fetch — parent passes data as prop. |
| `pipeline/prose_summary.py` | MODIFY (optional) | If enriching the pipeline prose with chip + risk data: extend `generate_weekly_summary()` function signature to accept `chip` and `risks` parameters matching `ProseRefreshPayload` shape. |
| `pipeline/run.py` | MODIFY (optional) | If enriching pipeline prose: derive chip and risk payloads from `captain_picks` and `merged` before the `prose_summary` call site. |
| `pipeline/accuracy.py` | MODIFY (on formula change only) | Bump `FORMULA_VERSION` string constant when the prediction formula changes. |

**Files explicitly NOT changing:**
- `/api/accuracy/route.ts` — already serves `versions[]` via passthrough.
- `/api/prose-summary/route.ts` — already complete for both GET and POST.
- `src/lib/hooks/useProseSummary.ts` — no change.
- `src/lib/hooks/useAccuracy.ts` — no change.
- `src/lib/types.ts` — `news`, `news_added`, `chance_of_playing_next_round` already on `MergedPlayer`. `ProseSummary`, `ProseRefreshPayload` already defined.
- `src/components/squad/ProseSummaryBlock.tsx` — no change.
- `src/components/news/NewsBanner.tsx` — no change (reuse as-is).

---

## Recommended Project Structure (additions only)

```
src/
├── components/
│   ├── captaincy/
│   │   └── CaptainPicksPanel.tsx          # MODIFY — add NewsBanner to CandidateRow
│   └── accuracy/
│       ├── AccuracyTab.tsx                # MODIFY — add Versions pill + VersionHistoryTable
│       └── VersionHistoryTable.tsx        # NEW — pure table, AccuracyVersionRecord[] prop

pipeline/
├── prose_summary.py                       # MODIFY (optional) — chip + risks params
├── run.py                                 # MODIFY (optional) — enrich prose payload
└── accuracy.py                            # MODIFY on formula change — FORMULA_VERSION bump
```

---

## Build Order

Dependency graph is flat — all three features are independent. Recommended order by risk and value:

### Step 1: SCRAPER-01 — NewsBanner in CaptainPicksPanel (30–50 LOC)

**What:** Open `CaptainPicksPanel.tsx`. The component already has `usePlayers()` imported (used for `computeEOCandidates`). Build a `playersById` map. In `CandidateRow`, add `NewsBanner` below the player name and MC labels.

**Why first:** Smallest scope, zero infrastructure risk, immediate user value. `NewsBanner` and `computeNewsSeverity` are unit-tested. The gate hook (`useNewsFlagEnabled`) is already proven correct by existing `OpportunityCostTable` usage.

**TDD approach:** Test that a candidate with `chance_of_playing_next_round = 25` renders the `data-testid="news-banner"` element; test that a candidate with empty `news` does not. Mirror the `OpportunityCostTable` test pattern.

**Depends on:** Nothing.

### Step 2: VER-01 — VersionHistoryTable in AccuracyTab (60–80 LOC)

**What:** Create `VersionHistoryTable.tsx` as a pure presentational component accepting `versions: AccuracyVersionRecord[]` prop (define the type from the existing JSON shape). Modify `AccuracyTab.tsx` to add a "Versions" pill alongside "Summary | Calibration | Back". Render `VersionHistoryTable` when the pill is active.

**Why second:** Pure UI, zero infrastructure risk. All data is already available via `useAccuracy()`. Confirms the pipeline's version history is surfacing correctly before any formula changes are made.

**Type definition:** Add `AccuracyVersionRecord` to `src/lib/types.ts`:

```typescript
export interface AccuracyVersionRecord {
  formula_version: string
  recorded_at: string          // ISO 8601
  hit_rate: number             // 0.0–1.0
  gate_flags: {
    form_signal_enabled: boolean
    xmins_v2_enabled: boolean
    bonus_predictor_enabled: boolean
    save_predictor_enabled: boolean
    mc_enabled: boolean
  }
}
```

Then extend `AccuracyData` with `versions?: AccuracyVersionRecord[]`.

**Depends on:** Nothing.

### Step 3: NLP-01 — Prose prompt enrichment (pipeline-side, optional)

**What:** If the v1.21 spec requires the pipeline-generated prose to reference chip timing or lifecycle risks: (1) extend `generate_weekly_summary()` to accept optional `chip` and `risks` params; (2) in `run.py`, extract chip best-GW from `captain_picks` and top-3 lifecycle-risk players from `merged` before the prose generation call.

**Why last:** The UI stack is already complete and working. This is a content quality improvement to the pipeline-generated summary only. It is also the most optional — if the squad-aware POST-based refresh already provides good enough prose, this pipeline-side enrichment can be deferred entirely.

**Depends on:** Nothing architecturally. Verify the `ProseRefreshPayload` shape before extending `generate_weekly_summary()` — the POST body schema should be the single authority on what fields the prompt builder accepts.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching `news` from a Dedicated `/api/news` Route

**What people do:** Build a separate `/api/news` endpoint that re-fetches `bootstrap-static` on-demand to get the freshest news.

**Why wrong:** FPL bootstrap-static is fetched once per daily pipeline run anyway. A fresh re-fetch in a Route Handler would hit FPL's API from the server, potentially triggering rate limiting, adding request latency on every page load, and doubling FPL API calls. More critically, the `news` field is already in `merged_players.json` — which is what drives every other player signal. An out-of-sync news source would show news for players not in the merged dataset.

**Instead:** Use `news` from `merged_players.json` via `usePlayers()`. If fresher news is required between pipeline runs, the correct approach is to run the pipeline more frequently (GitHub Actions schedule change), not to add a parallel data channel.

### Anti-Pattern 2: Storing the Weekly Prose in a Separate Blob Key Per GW

**What people do:** Write `weekly_summary_gw{N}.json` instead of overwriting `weekly_summary.json`, to preserve history.

**Why wrong:** Accumulates Blob entries indefinitely. The prose summary is ephemeral decision content — it is only useful for the current GW. Unlike captain snapshots or transfer snapshots (which are explicitly kept as a decision audit trail), prose summaries have no retrospective value.

**Instead:** Single key `weekly_summary.json`, overwritten each run. The pipeline's `save()` function with `addRandomSuffix: false` already enforces this.

### Anti-Pattern 3: Deriving `FORMULA_VERSION` From Git Hash

**What people do:** Use `subprocess.check_output(['git', 'rev-parse', 'HEAD'])` to auto-tag versions.

**Why wrong:** (1) GitHub Actions runners may not have the full git history. (2) Git hashes are meaningless to a human trying to understand what changed between versions. (3) Every pipeline run would produce a new version record (because every run is a different commit), making the "versions" concept meaningless — the value of versioning is that it changes only when the formula changes, not when any file changes.

**Instead:** `FORMULA_VERSION` is a manually-maintained string constant in `accuracy.py`. Bump it only when `merge.py`, `simulate.py`, or `accuracy.py` changes the prediction math. The `v{milestone}-{letter}` pattern gives meaningful names.

### Anti-Pattern 4: Rendering `VersionHistoryTable` Inside `AccuracyTab` Without a Guard

**What people do:** Unconditionally render `VersionHistoryTable` from `data.versions`, causing a crash when `data` is undefined (loading state) or when `versions` is absent (pre-Phase-63 Blob cache).

**Instead:** Render `VersionHistoryTable` only when `data?.versions?.length > 0`. The existing AccuracyTab pattern wraps all data access in `data?.summary?....` optional chaining — follow the same defensive pattern.

### Anti-Pattern 5: Auto-Triggering `useProseRefresh` on Squad Load

**What people do:** Fire `useProseRefresh` in a `useEffect` whenever the squad data changes, to always show squad-specific prose.

**Why wrong:** This was explicitly ruled out in v1.18/v1.19 for `usePlayerInsight` and the same logic applies here. Cost explosion risk: if the squad loads on every navigation to the Decision tab, multiple Claude Haiku calls fire per session. The user would notice a loading state on every tab switch.

**Instead:** On-demand only. The Refresh button in `ProseSummaryBlock` is the only trigger. The global pipeline-generated prose is the default; squad-specific prose is opt-in. This is already the shipped design.

---

## Integration Points Summary

### External Services

| Service | Pattern | Notes |
|---------|---------|-------|
| FPL API | pipeline/fpl_client.py fetches `bootstrap-static` once per daily run. `news`, `news_added`, `chance_of_playing_next_round` come from `elements[]`. | No new API calls. Existing `FPLElement` Zod schema already validates all three news fields. |
| Claude API (Anthropic) | `POST /api/prose-summary` (existing). `POST /api/player-insight` (existing). No new routes. | `claude-haiku-4-5` in route handler; verify that `pipeline/prose_summary.py` uses the same model version. `maxDuration = 30` on both routes. |
| Vercel Blob | `weekly_summary.json` (overwritten per pipeline run). `accuracy_backtest.json` (versions[] accumulates). `merged_players.json` (news fields in place). | No new Blob keys for v1.21 features. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pipeline -> Blob | Python `save()` function writes JSON artifacts | `news` fields: already in `merged_players.json`. `versions[]`: already in `accuracy_backtest.json`. `weekly_summary.json`: already written daily. |
| Blob -> Route handler | `list()` + `fetch(blob.url)` | All three relevant routes already implement this pattern. No new routes. |
| Route handler -> TanStack Query -> React | GET routes with 6h staleTime convention | `useAccuracy()` already returns `versions[]`. `usePlayers()` already returns `news` fields. `useProseSummary()` already returns prose. |
| React component -> TS utility | Direct import | `computeNewsSeverity()`, `useNewsFlagEnabled()` are the utilities consumed by `NewsBanner`. Existing pattern. |
| AccuracyTab -> VersionHistoryTable | Prop: `versions: AccuracyVersionRecord[]` | Parent passes data, child is pure presentation. No direct hook access in child. |

---

## Scalability Considerations

These three features are essentially zero-cost additions:

| Feature | Overhead | Notes |
|---------|----------|-------|
| SCRAPER-01 news display | Zero network cost | Reads fields already in `merged_players.json`. No new fetches. |
| NLP-01 prose enrichment | ~1 additional Haiku call per pipeline run | If chip + risks added to pipeline prompt, it's still 1 call/day total. Negligible. |
| VER-01 versions table | Zero network cost | `versions[]` is a handful of objects already in `accuracy_backtest.json`. No new data fetched. |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| SCRAPER-01 data trail | HIGH | Verified `news` field in `FPLElement` schema, `MergedPlayer` type, `NewsBanner` component, `OpportunityCostTable` wiring, and `useNewsFlagEnabled` hook — all in this session. |
| SCRAPER-01 join pattern | HIGH | `CaptainPicksPanel` already imports `usePlayers()` for `computeEOCandidates`; the `Map<id, MergedPlayer>` join pattern is used in multiple components in the codebase. |
| NLP-01 completeness | HIGH | Read `prose-summary/route.ts` (full file), `useProseSummary.ts`, `useProseRefresh.ts`, `ProseSummaryBlock.tsx`, and the `run.py` prose generation block (lines 358–403) in full. Stack is complete. |
| VER-01 versions schema | HIGH | Read `accuracy.py` `FORMULA_VERSION` constant, `_existing_versions()` function, `new_version_record` dict construction, and dedup-append logic (lines 37, 85-99, 392-410) in full. |
| VER-01 UI gap | HIGH | `src/components/accuracy/AccuracyTab.tsx` not read directly, but the pill-nav pattern is well-established (Phase 96 added "Summary | Calibration | Back"); adding "Versions" follows the same pattern. |
| Prose prompt enrichment (optional) | MEDIUM | Would require verifying the current `generate_weekly_summary()` signature matches the `ProseRefreshPayload` shape. Shape appears compatible based on the POST body Zod schema, but verify at implementation. |

---

## Sources

All findings from direct codebase reads — no web search required.

- `.planning/PROJECT.md` — v1.21 milestone context, current feature status
- `src/lib/types.ts` lines 1-222, 936-975 — `FPLElement`, `MergedPlayer` news fields, `ProseSummary`, `ProseRefreshPayload`
- `src/components/news/NewsBanner.tsx` (full) — component interface, gate hook usage, severity rendering
- `src/components/news/types.ts` (full) — shared type contracts
- `src/components/captaincy/CaptainPicksPanel.tsx` lines 1-80 — current component structure, hook imports
- `src/components/transfers/OpportunityCostTable.tsx` lines 1-80 — existing `NewsBanner` wiring reference
- `src/app/api/prose-summary/route.ts` (full) — GET and POST handlers, Zod schema, guardrail, model
- `src/lib/hooks/useProseSummary.ts` (full) — query hook
- `src/lib/hooks/useProseRefresh.ts` (full) — mutation hook
- `src/components/squad/ProseSummaryBlock.tsx` (full) — component: global + override + refresh
- `pipeline/accuracy.py` lines 37, 85-115, 120-210, 380-434 — `FORMULA_VERSION`, version history, versions[] shape
- `pipeline/run.py` lines 358-403 — prose generation call site, payload construction

---
*Architecture research for: FPL Analyst v1.21 Polish, Intelligence & Team News*
*Researched: 2026-05-16*
