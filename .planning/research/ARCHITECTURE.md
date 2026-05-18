# Architecture Research — v1.24 End of Season & Off-Season Intelligence

**Domain:** FPL Analyst — subsequent milestone adding Season Review, Next Season Planner, Summer Window Tracker, and multi-source transfer news scraping to the existing Python pipeline → Vercel Blob → Next.js 16 Route Handlers → TanStack Query → React stack.
**Researched:** 2026-05-18
**Confidence:** HIGH — all findings derived from direct codebase inspection of `pipeline/run.py`, `pipeline/lineup_news.py`, `pipeline/chip-modes.ts`, `src/lib/types.ts`, `src/lib/chip-modes.ts`, `src/lib/hooks/useDecisionHistory.ts`, `src/lib/hooks/useSeasonAnalytics.ts`, `src/app/api/season-analytics/route.ts`, `src/app/api/decision-history/route.ts`, `src/app/api/lineup-news/route.ts`, `src/app/page.tsx`, `src/components/accuracy/BackTab.tsx`, `.planning/PROJECT.md`.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  GitHub Actions Cron (daily)                                         │
│  pipeline/run.py                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌───────────────────┐ │
│  │fpl_client│  │understat │  │lineup_news │  │transfer_news (NEW)│ │
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘  └─────────┬─────────┘ │
│       └─────────────┴──────────────┴────────────────────┘            │
│                            │                                         │
│                merge.py, accuracy.py, simulate.py, etc.             │
│                            │                                         │
│                     Vercel Blob (JSON artifacts)                     │
└─────────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │    Next.js 16 API Routes     │
              │  src/app/api/{artifact}/     │
              │  (Blob → parse → serve)      │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │   TanStack Query hooks       │
              │   src/lib/hooks/use*.ts      │
              │   (cache, staleTime, retry)  │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │  src/app/page.tsx            │
              │  (single-page, client comp)  │
              │  Section: Analyse/Plan/Squad │
              │  SubTab state + sectionMemory│
              └─────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `pipeline/run.py` | Orchestrates daily data fetch + artifact writes | Python, GitHub Actions cron |
| `pipeline/lineup_news.py` | Per-player availability + news headlines (in-season) | FPL bootstrap + RSS/HTML scrapers |
| `pipeline/transfer_news.py` (NEW) | Transfer rumour + signing news feed | RSS + optional Twitter/X, separate module |
| Vercel Blob | Immutable artifact store (JSON), flat namespace | prefix-list pattern across all routes |
| `src/app/api/*/route.ts` | Blob read + serve; proxies FPL API on-demand | Next.js Route Handlers, Node.js runtime |
| `src/lib/hooks/use*.ts` | Server-state cache layer | TanStack Query v5, 6h staleTime default |
| `src/lib/types.ts` | Single source of truth for all TypeScript interfaces | Shared between pipeline output and UI |
| `src/app/page.tsx` | Section/sub-tab navigation state, lifted shared state | Client component, SECTIONS const + SubTab union |
| localStorage | Decision history ring buffer (38 GWs), team ID, plan persistence | Client-only, no server involvement |
| FPL API `/entry/{id}/...` | Live squad/picks/history data for squad-specific features | On-demand from API routes |

---

## Feature Integration Analysis

### SCRAPER-02: Multi-Source Transfer News

**Should it extend `lineup_news.py` or be a separate module?**

Use a **separate module**: `pipeline/transfer_news.py`.

`lineup_news.py` is purpose-built for in-season per-player availability (status_label, availability_factor) anchored to FPL bootstrap. Transfer news is structurally different:

- Off-season, the FPL bootstrap is stale or empty. `lineup_news.py` produces zero meaningful players because availability_factor derives from the `chance_of_playing_next_round` field which is absent in summer. `transfer_news.py` does not need FPL bootstrap at all — it is purely article-driven.
- Twitter/X requires `tweepy` or `ntscraper` and a credentials env var (`TWITTER_BEARER_TOKEN`). This dependency does not belong in `lineup_news.py`'s scope.
- The two artifacts have different schemas, different consumers, and different off-season behaviour.
- The isolation pattern is already established in the codebase: the `lineup_news.py` docstring explicitly references `set_piece_quality.py` as the template for per-source try/except isolation.

**How `transfer_news.py` is called from `run.py`:**

```python
try:
    from transfer_news import compute_transfer_news
    compute_transfer_news()
    print("Transfer news written.")
except Exception as tn_exc:
    print(f"[transfer_news] non-fatal error: {tn_exc}", file=sys.stderr)
```

This mirrors the lineup_news call at lines 145–150 of `run.py`. Non-fatal, no bootstrap dependency.

**Shared utility:** The fuzzy player matching logic (`_match_player()`, `_build_name_lookup()`) in `lineup_news.py` is useful for `transfer_news.py` too. Extract to `pipeline/player_matching.py` to avoid duplication. Both modules import from it.

**Off-season vs in-season architecture difference:**

| State | `lineup_news.py` | `transfer_news.py` |
|-------|----------------|--------------------|
| In-season | Active — FPL bootstrap drives availability; RSS adds headlines | Supplementary — transfer rumours and fitness news |
| Off-season (GW38 finished) | Produces empty players list (SCRP-05 guard triggers, Blob not written) | Primary active scraper — transfer news, new signings, pre-season fitness |

The pipeline does not need an explicit off-season gate flag for `transfer_news.py` because it does not depend on bootstrap data. It runs year-round.

**Blob artifact schema for `transfer_news.json`:**

```json
{
  "scraped_at": "<ISO UTC string>",
  "articles": [
    {
      "id": "<16-char hex — sha1(url+title)[:16]>",
      "headline": "<string, max 280 chars>",
      "summary": "<string | null, max 500 chars>",
      "url": "<string>",
      "source": "skysports | bbc | twitter",
      "published_at": "<ISO UTC string | null>",
      "player_id": "<int | null>",
      "player_name": "<string | null>",
      "tags": ["signing", "injury", "fitness", "rumour", "confirmed"],
      "scraped_at": "<ISO UTC string>"
    }
  ],
  "source_health": {
    "skysports": { "ok": true, "last_success": "...", "last_error": null },
    "bbc":       { "ok": true, "last_success": "...", "last_error": null },
    "twitter":   { "ok": false, "last_success": null, "last_error": "TWITTER_BEARER_TOKEN not set" }
  }
}
```

Key schema decisions:
- `player_id` is nullable: articles that cannot be fuzzy-matched to a FPL player still appear in the general feed
- `tags` array enables downstream filtering (Summer Window Tracker shows "signing"/"confirmed"; Planner badges filter on "signing")
- Stable `id` hash prevents duplicate cards on repeated renders of the same article
- Blob artifact name: `transfer_news.json` (latest run only — no per-GW versioning needed)
- Twitter source produces `null` for `published_at` when tweet metadata is unavailable

**New infrastructure needed:**

- `pipeline/transfer_news.py` — new scraper module
- `pipeline/player_matching.py` — extracted shared utility (or inline in transfer_news.py if extraction creates scope risk)
- `src/app/api/transfer-news/route.ts` — mirrors `lineup-news/route.ts` verbatim (different filename, same Blob list pattern)
- `src/lib/hooks/useTransferNews.ts` — TanStack Query hook, `staleTime: 1h` (transfer news changes more frequently than player data)

---

### Season Review

**Nav placement:**

Add as a new sub-tab in the **Analyse** section:

```typescript
{ id: 'season-review' as SubTab, label: 'Season Review', mobileLabel: 'Review' }
```

The Analyse section is the correct home because Season Review is a read-only analytical summary. The Squad section `review` sub-tab already means GW Review (per-gameweek). Placing season review there would create a naming collision and break the per-GW UX expectation.

**Data sources — no new Blob artifact required:**

Season Review aggregates from three existing sources entirely client-side:

1. `useDecisionHistory(teamId)` — captain and transfer decision history (localStorage ring buffer + `/api/decision-history`); provides `RegretEntry[]` and `TransferRegretEntry[]`
2. `useSeasonAnalytics(teamId)` — chip ROI and hit break-even data from `/api/season-analytics` (FPL API live); provides `ChipRoiEntry[]` and `HitTrackingEntry[]`
3. The `/api/season-analytics` route already fetches `/entry/{id}/history/` — extend it to also return `overallRank` and `totalPoints` (two fields from the last `current[]` entry, zero additional HTTP calls)

**Decision quality scoring — client-side:**

Compute in a new pure TypeScript function `computeDecisionQuality(history, analytics)` in `src/lib/decision-quality.ts`.

Rationale for client-side: Pipeline has no team ID (personal tool architecture decision from v1.0 Key Decisions table). All required inputs are already fetched client-side by existing hooks. Consistent with how `computeSeasonSummary()` in `regret.ts`, `computeRejection()`, and lifecycle labels all work — pure TS over fetched data, no extra pipeline computation.

**What the score formula computes:**

```
processScore = weighted average of:
  - captainHitRate (40%): regretEntry.regret < 0 / total settled GWs
    (exists in computeSeasonSummary() in regret.ts — already computed)
  - hitBreakEvenRate (35%): hitTracking.filter(h => h.brokeEven).length / hitTracking.length
    (from useSeasonAnalytics — already available)
  - chipRoiPositiveRate (25%): chipRoi.filter(c => c.delta > 0).length / chipRoi.length
    (from useSeasonAnalytics — already available)

grade: A (>=0.65) | B (>=0.50) | C (>=0.35) | D (<0.35)
```

The grade separates process quality from luck: hitting a captain who scored 20 points is lucky; consistently picking the highest-EV option is skill. A manager who always picked the highest-xPts captain but had bad luck scores an A.

**Types extension needed in `src/lib/types.ts`:**

```typescript
// Extend existing SeasonAnalytics:
export interface SeasonAnalytics {
  chipRoi: ChipRoiEntry[]
  hitTracking: HitTrackingEntry[]
  overallRank?: number         // NEW — from history.current last entry .overall_rank
  totalPoints?: number         // NEW — cumulative sum
  seasonAvgPoints?: number     // NEW — already computed in route but not currently returned
}

// New type for the computed quality report:
export interface DecisionQualityReport {
  processScore: number          // 0–1 weighted composite
  captainHitRate: number        // 0–1
  hitBreakEvenRate: number      // 0–1 (null-safe: 0/0 = null, renders as N/A)
  chipRoiPositiveRate: number   // 0–1 (null-safe: 0/0 = null, renders as N/A)
  grade: 'A' | 'B' | 'C' | 'D' | null  // null when insufficient data
  totalCaptainGws: number
  totalHits: number
  totalChipsUsed: number
}
```

**Component:** `src/components/accuracy/SeasonReviewTab.tsx`

Placement in `accuracy/` is consistent with BackTab.tsx (which also uses `useDecisionHistory` and `useSeasonAnalytics`). The Season Review is a sibling to the backtester tabs.

Uses existing `useDecisionHistory`, `useSeasonAnalytics`, and `computeDecisionQuality()` from the new `decision-quality.ts` utility.

---

### Next Season Planner

**Nav placement:**

Add as a new sub-tab in the **Plan** section:

```typescript
{ id: 'next-season' as SubTab, label: 'Next Season', mobileLabel: 'GW1 Plan' }
```

Plan section is the correct home. The Next Season Planner is conceptually an extended Wildcard/Free Hit planner for GW1 starting conditions. It performs squad-building actions, not read-only analysis.

**Full-pool algorithm — what changes vs existing:**

`buildOptimalSquad()` in `src/lib/chip-modes.ts` is already a full-pool greedy builder over all 700+ `MergedPlayer[]`. The existing eligibility gate is:

```typescript
const eligible = players.filter(p => p.status === 'a' && p.xPts_1gw !== 0)
```

Off-season problem: `xPts_1gw` will be `0` or `undefined` for all players when FPL has no upcoming fixtures. The gate returns zero eligible players. The `buildOptimalSquad` function returns `null`.

Solution: A new `buildPreSeasonSquad()` function in `src/lib/chip-modes.ts` (co-located with `buildOptimalSquad`) that accepts a `scoreByPlayerId: Map<number, number>` parameter instead of relying on `xPts_1gw`. The caller computes scores from GW1–8 FDR data. Greedy algorithm and position quotas are identical to `buildOptimalSquad`.

```typescript
export interface BuildPreSeasonSquadParams {
  players: MergedPlayer[]
  budget: number                     // integer tenths, default 1000 (£100m)
  scoreByPlayerId: Map<number, number> // caller-supplied scoring signal
  teamCap?: number                   // default 3 (FPL rule)
}

export function buildPreSeasonSquad(params: BuildPreSeasonSquadParams): ChipSquadResult | null
```

The FDR heatmap (GW1–8) scoring: the caller derives `scoreByPlayerId` from `usePlayers()` data. Each player's score is the sum of (3 - fixture difficulty) across their GW1–8 fixtures (lower FDR = higher score). This reuses the `attacking_difficulty` field already in `MergedPlayer.fixtures[]`.

**Does the full-pool builder need a new API route?**

No. `usePlayers()` already returns all 700+ `MergedPlayer[]` objects from `/api/players`. `buildPreSeasonSquad()` runs client-side over this data in < 5ms (same as `buildOptimalSquad` in OptimiserPanel — confirmed by v1.6 key decision on C(15,11) enumeration being < 1ms).

**FDR data availability for GW1–8:**

At the end of a season, `merged_players.json` carries fixtures for the current GW forward. After GW38, the pipeline writes with zero forward fixtures. Once the next season's fixtures are published (typically June/July), the FPL API populates them in bootstrap fixtures.

Implementation note: verify at build time how many forward GWs appear in `MergedPlayer.fixtures[]`. If the fixture array covers GW1–8 of the new season, the score derivation is free. If not, show a "Fixture schedule not yet published — check back in July" empty state.

**Component:** `src/components/planner/NextSeasonPlannerTab.tsx`

Consumes: `usePlayers()` (existing, shared TanStack cache), no new hooks required for the core builder. Badges new signings from `useTransferNews()` (optional, adds SCRAPER-02 dependency for this feature only — can ship without it).

---

### Summer Window Tracker

**Data flow from SCRAPER-02 to the squad builder UI:**

```
pipeline/transfer_news.py
    → transfer_news.json (Vercel Blob)
    → GET /api/transfer-news
    → useTransferNews() hook
    → SummerWindowTab: article feed grouped by tag
    → NextSeasonPlannerTab: per-player new-signing badge
```

**How signing news feeds into price speculation:**

Transfer news does NOT integrate with `price_changes.json`. Price predictions require FPL net-transfer velocity (`transfers_in`, `transfers_out` per player), which is meaningless for unregistered summer signings. Instead:

- New signings surface as articles in `transfer_news.json` with `tags: ["signing"]`
- The Summer Window Tracker presents these as a news feed. The manager draws their own price conclusions.
- When a signing is registered in FPL, they appear in `bootstrap-static/elements` and flow naturally through the existing pipeline into `merged_players.json` and eventually into price change predictions.

No automated price speculation for summer signings. The UI surfaces articles, not predictions.

**Nav placement:**

Add as a new sub-tab in the **Analyse** section:

```typescript
{ id: 'summer-window' as SubTab, label: 'Summer Window', mobileLabel: 'Window' }
```

Read-only intelligence feed (like Insights or Price Changes). Belongs in Analyse, not Plan.

**Component directory:** `src/components/summer-window/SummerWindowTab.tsx`

New component directory — separate from `src/components/news/` because `NewsBanner` is an inline badge component, not a full-page feed.

---

### Polish Items

**TRT-06 ChipToggle in RouteTreeTab:** Modify `src/components/planner/RouteTreeTab.tsx` only. Add `ChipToggle` as a UI prop. The bridge continues writing `chip: null` per the existing TRT-09 key decision.

**TRT-02 label fix:** Cosmetic column label change in `src/components/planner/RouteTreeTab.tsx`. Zero logic change.

**MinsRiskBadge on 4 surfaces:** `MinsRiskBadge` exists at `src/components/squad/MinsRiskBadge.tsx`. Wire into:
1. `src/components/squad/SquadView.tsx` — player row after name
2. `src/components/squad/DecisionSummaryTab.tsx` — candidate display
3. `src/components/gem-table/GemTable.tsx` — expand row or column
4. `src/components/gem-table/PlayerComparisonModal.tsx` — player header

---

## New Files Summary

| File | Purpose |
|------|---------|
| `pipeline/transfer_news.py` | Transfer news scraper: Sky Sports RSS, BBC RSS, Twitter/X (gated); writes `transfer_news.json` |
| `pipeline/player_matching.py` | Extracted shared utility: `_match_player()`, `_build_name_lookup()` (from lineup_news.py) |
| `src/app/api/transfer-news/route.ts` | Serves `transfer_news.json` from Blob; mirrors lineup-news route pattern |
| `src/lib/hooks/useTransferNews.ts` | TanStack Query hook, 1h staleTime |
| `src/lib/decision-quality.ts` | Pure TS: `computeDecisionQuality()` → `DecisionQualityReport` |
| `src/components/accuracy/SeasonReviewTab.tsx` | Season Review: summary card + grade + chip ROI + hit break-even |
| `src/components/planner/NextSeasonPlannerTab.tsx` | Next Season Planner: full-pool squad builder + GW1–8 FDR heatmap |
| `src/components/summer-window/SummerWindowTab.tsx` | Summer Window: article feed grouped by tag |
| `pipeline/cache/transfer_news.json` | Seed file: `{ "scraped_at": "...", "articles": [], "source_health": {} }` |

## Modified Files Summary

| File | What Changes |
|------|-------------|
| `pipeline/run.py` | Add non-fatal `compute_transfer_news()` call block after lineup_news block |
| `pipeline/lineup_news.py` | Import `_match_player`, `_build_name_lookup` from player_matching.py (if extracted) |
| `src/lib/types.ts` | Extend `SeasonAnalytics` (overallRank, totalPoints, seasonAvgPoints); add `DecisionQualityReport`; add `TransferNewsArticle`, `TransferNews` interfaces; add new SubTab IDs to union |
| `src/app/api/season-analytics/route.ts` | Return `overallRank`, `totalPoints`, `seasonAvgPoints` from existing `/entry/{id}/history/` fetch (zero new HTTP calls) |
| `src/app/page.tsx` | Add new SubTab IDs to `SubTab` union; add entries to `SECTIONS`; mount new tab components |
| `src/lib/chip-modes.ts` | Add `buildPreSeasonSquad()` alongside existing `buildOptimalSquad()` |

---

## Data Flow Diagrams

### Season Review

```
User opens Analyse > Season Review
    → useDecisionHistory(teamId)
        ↳ localStorage ring buffer (instant render)
        ↳ /api/decision-history (background refresh)
    → useSeasonAnalytics(teamId)
        ↳ /api/season-analytics → FPL /entry/{id}/history/ (existing)
    → computeDecisionQuality(history, analytics) [pure TS, no fetch]
    → SeasonReviewTab renders:
        - Overall rank card
        - Season points total
        - Decision quality grade (A/B/C/D) with breakdown
        - Chip ROI table (from BackTab — reuse existing ChipRoiView)
        - Hit break-even summary
```

### SCRAPER-02 + Summer Window

```
GitHub Actions cron
    → pipeline/run.py
    → pipeline/transfer_news.py
        → Sky Sports RSS (feedparser, existing dependency)
        → BBC Sport RSS (feedparser, existing dependency)
        → Twitter/X (tweepy, new optional dependency, gated on env var)
        → fuzzy player match via player_matching.py
    → save('transfer_news.json') → Vercel Blob

GET /api/transfer-news → useTransferNews()
    → SummerWindowTab: grouped article feed (signings / fitness / rumours)
    → NextSeasonPlannerTab: badge on player row when articles[].player_id matches
```

### Next Season Planner

```
User opens Plan > Next Season
    → usePlayers() [existing, shared TanStack cache, /api/players from Blob]
    → Derive scoreByPlayerId from MergedPlayer.fixtures[] GW1–8 FDR sum (client-side)
    → buildPreSeasonSquad(players, budget=1000, scoreByPlayerId) [pure TS]
    → NextSeasonPlannerTab renders:
        - GW1–8 FDR heatmap (colour-coded by difficulty, per existing ClubFormTab pattern)
        - Generated 15-player squad with formation
        - Budget used / remaining
        - New signing badges from useTransferNews() (optional enhancement)
```

---

## Build Order (Dependency-First Sequencing)

```
Phase 1: Polish (carry-forward items, zero new infrastructure)
  Deliverables: TRT-06 ChipToggle in RouteTreeTab, TRT-02 label fix,
                MinsRiskBadge on 4 surfaces
  Why first: Establishes clean baseline; no new types, routes, or hooks needed;
             confirms CI green before larger changes

Phase 2: SCRAPER-02 pipeline + API infrastructure
  Deliverables: pipeline/transfer_news.py, pipeline/player_matching.py (extracted),
                run.py wiring, GET /api/transfer-news, useTransferNews() hook,
                TransferNewsArticle + TransferNews types in types.ts,
                pipeline/cache/transfer_news.json seed
  Why second: Summer Window (Phase 4) and Planner signing badges (Phase 5) both
              depend on useTransferNews(). Season Review (Phase 3) is independent
              and can be built in parallel with Phase 2.

Phase 3: Season Review (independent of SCRAPER-02)
  Deliverables: Extend SeasonAnalytics type (overallRank, totalPoints, seasonAvgPoints),
                extend /api/season-analytics to return these fields,
                computeDecisionQuality() in decision-quality.ts,
                SeasonReviewTab component,
                SubTab + SECTIONS wiring in page.tsx
  Why third (can parallel Phase 2): Reuses two existing hooks; no new pipeline
                computation; low-risk incremental extension of existing types

Phase 4: Summer Window Tracker (requires Phase 2 infrastructure)
  Deliverables: SummerWindowTab component, wired into Analyse SECTIONS
  Why fourth: Direct dependency on useTransferNews() from Phase 2

Phase 5: Next Season Planner (core works without SCRAPER-02; badges need Phase 2)
  Deliverables: buildPreSeasonSquad() in chip-modes.ts,
                NextSeasonPlannerTab component,
                GW1-8 FDR heatmap,
                signing badges from useTransferNews(),
                SubTab + SECTIONS wiring in page.tsx
  Why fifth: Core squad builder works without transfer news (ship that first);
             signing badges added as enhancement once Phase 2 exists
```

**Critical path:** Phase 2 unblocks Phase 4 and Phase 5 signing badges. Phase 3 is independent — can be developed in parallel with Phase 2.

---

## Off-Season Data Availability

This is the most important architectural concern for v1.24. The FPL API enters an off-season state after GW38 finishes (approximately late May):

| Artifact | Off-Season State | Mitigation |
|----------|-----------------|------------|
| `fpl_bootstrap.json` | Present; player elements stale; no upcoming fixtures | Pipeline modules gate on `xPts_1gw !== 0`; `buildPreSeasonSquad` bypasses this gate |
| `merged_players.json` | Written with zero xPts values, empty fixtures[] | `buildPreSeasonSquad` uses caller-supplied score, not xPts; empty fixtures → "fixtures not yet published" empty state |
| `lineup_news.json` | SCRP-05 guard triggers (zero players from empty bootstrap); Blob not overwritten | Existing guard handles this correctly |
| `transfer_news.json` | Becomes the primary active artifact in summer | `transfer_news.py` has no bootstrap dependency; runs year-round |
| `captain_picks_gw{N}.json` | No new GWs; last season's snapshots persist in Blob | Season Review reads these correctly; immutable |
| FPL `/entry/{id}/history/` | Returns full prior season history even off-season | Season Review and season-analytics route work correctly |
| `price_changes.json` | Price changes may still occur for registered returning players | Existing pipeline continues; not relevant to Summer Window (no speculation for new signings) |

**Off-season pipeline run strategy:** The daily cron continues. No explicit off-season gate flag needed for `transfer_news.py` (no bootstrap dependency). Modules that depend on `xPts_1gw !== 0` (xmins, bonus, MC sims) will short-circuit gracefully when the field is 0 for all players.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Team-specific data in pipeline artifacts

**What people do:** Pre-compute Season Review summary (rank, decision grades) in the pipeline and write to Blob.
**Why it's wrong:** Pipeline has no team ID — this is a personal tool with no multi-tenancy. Storing user-specific data pipeline-side would require exposing credentials to the cron.
**Do this instead:** All team-specific aggregation client-side via existing FPL API routes (`/api/season-analytics`, `/api/decision-history`). Consistent with v1.0 Key Decision "No database for v1".

### Anti-Pattern 2: Full-pool ILP solver for Next Season Planner

**What people do:** Reach for `glpk.js` or a WASM integer programming solver for "optimal" squad selection.
**Why it's wrong:** v1.6 explicitly rejected this (WASM issues in Next.js, ~1MB bundle). The existing `buildOptimalSquad()` greedy algorithm already handles the same problem for Wildcard/Free Hit modes.
**Do this instead:** `buildPreSeasonSquad()` using the same greedy approach with a different eligibility signal.

### Anti-Pattern 3: Merging `transfer_news.py` into `lineup_news.py`

**What people do:** Add transfer news scraping to the existing lineup_news module.
**Why it's wrong:** The two artifacts have different schemas, different off-season behaviour, different dependencies (Twitter credentials), different consumers, and different update semantics. The `lineup_news.py` docstring explicitly references the per-module isolation pattern.
**Do this instead:** Separate module following the `set_piece_quality.py` isolation template.

### Anti-Pattern 4: Decision quality scoring in pipeline

**What people do:** Pre-compute `processScore` in Python and store in a Blob artifact.
**Why it's wrong:** Requires team ID pipeline-side; data already exists client-side; adds unnecessary Blob artifact for a derived metric.
**Do this instead:** Pure TypeScript function `computeDecisionQuality()` over already-fetched hook data, co-located with `computeSeasonSummary()` in `regret.ts` or extracted to `decision-quality.ts`.

### Anti-Pattern 5: New SubTab without updating the type union

**What people do:** Add a new sub-tab component and mount it in `page.tsx` without adding its id to the `SubTab` union type (line 56).
**Why it's wrong:** `sectionMemory: Record<Section, SubTab | null>` typing breaks; `SECTIONS` constant type validation fails; MobileNav tests fail at type-check time.
**Do this instead:** Update `SubTab` union AND `SECTIONS` constant atomically in a single commit. Five new IDs to add: `'season-review'`, `'summer-window'`, `'next-season'` (plus any others).

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Sky Sports RSS | `feedparser.parse(SKY_RSS_URL)` — already used in `lineup_news.py` | Reuse same constant + pattern in `transfer_news.py` |
| BBC Sport RSS | `feedparser.parse(BBC_RSS_URL)` — already used in `lineup_news.py` | Same as above |
| Twitter/X API | `tweepy.Client(bearer_token=...)` or `ntscraper` — NEW dependency | Gate with `if not os.getenv('TWITTER_BEARER_TOKEN'): return`; mark non-fatal; add to `requirements.txt` only when shipping |
| FPL `/entry/{id}/history/` | Existing fetch in `/api/season-analytics/route.ts` | Extend response to include `overallRank`, `totalPoints`, `seasonAvgPoints` — zero new HTTP calls |
| Vercel Blob | `list()` + `fetch(blob.url)` — established across all existing routes | `transfer_news.json` follows identical pattern to `lineup_news.json` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `lineup_news.py` ↔ `transfer_news.py` | Both import from `player_matching.py` | One-way dependency on shared utility; no circular imports |
| `useTransferNews` ↔ `SummerWindowTab` | Standard TanStack data prop | Same as all hook↔component boundaries in the app |
| `useTransferNews` ↔ `NextSeasonPlannerTab` | Badge display only, nullable `player_id` join: `articles.filter(a => a.player_id === player.id)` | Signing badges optional enhancement; component ships without them |
| `computeSeasonSummary()` (regret.ts) ↔ `computeDecisionQuality()` (decision-quality.ts) | `computeDecisionQuality` imports `computeSeasonSummary` | One-way dependency; decision-quality is the new higher-level aggregator |
| `buildOptimalSquad()` ↔ `buildPreSeasonSquad()` | Co-located in `chip-modes.ts`; share `MIN_SLOTS`/`MAX_SLOTS` constants | Avoid re-declaring position quota constants; pre-season function calls `optimiseLineup()` for bestXI derivation (same as buildOptimalSquad D-10) |

---

*Architecture research for: FPL Analyst v1.24 End of Season & Off-Season Intelligence*
*Researched: 2026-05-18*
