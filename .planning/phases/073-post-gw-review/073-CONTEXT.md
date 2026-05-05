# Phase 73: Post-GW Review - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 73 delivers a **Post-GW Review** card in the Squad section — a 5th sub-tab ("Review") showing your GW score, bench points left, captain delta vs optimal, your top scorer, and FPL average score for the last 3 settled GWs. Navigation is a pill toggle (e.g., "GW33 | GW34 | GW35").

Architecture split:
1. **Pipeline** writes `gw_review_gw{N}.json` to Vercel Blob for the last 3 settled GWs (global data only: average score)
2. **API route** `GET /api/gw-review?teamId=&gw=` merges Blob data with on-demand FPL picks data (team-specific: bench pts, captain delta, top scorer)

No changes to the scoring pipeline, optimiser, or captain logic.

</domain>

<decisions>
## Implementation Decisions

### Data Architecture
- **D-01:** Pipeline path chosen. `pipeline/run.py` writes `gw_review_gw{N}.json` for each of the last 3 settled GWs (detected via `bootstrap.events[*].finished == True`). Written to local cache + uploaded to Vercel Blob when `USE_BLOB=true`. Fields per file: `{ gw, average_score }`.
- **D-02:** No Phase 69 dependency. Daily cron is sufficient — review appears within ~24h of GW settling. Phase 73 ships independently.
- **D-03:** `GET /api/gw-review?teamId=&gw=N` API route: reads `gw_review_gw{N}.json` from Blob (or local cache); fetches `entry/{teamId}/event/{gw}/picks/` from FPL proxy on-demand; merges and returns combined `GwReview` object.
- **D-04:** `USE_BLOB` env-var pattern follows Phase 67/54/54 convention. Local dev: `pipeline/cache/gw_review_gw{N}.json` seed files (require `git add -f` — gitignored directory).

### Review Content
- **D-05:** `your_score` + `bench_pts_left` sourced from `entry_history.points` and `entry_history.points_on_bench` in the `/picks/` response. FPL computes bench pts directly — no manual per-player sum needed.
- **D-06:** Captain delta: `(optimal_captain_pts × 2) − (your_captain_pts × captain_multiplier)`. Optimal captain = pick with highest `total_points` among starting XI (picks where `position <= 11`). If delta = 0, you picked correctly; positive delta = missed points.
- **D-07:** Your top scorer = pick with highest `total_points` from starting XI (position 1–11). Display as "Player Name — Xpts".
- **D-08:** Benchmark = `average_score` from Blob data (= `bootstrap.events[gw].average_entry_score`). Labelled **"FPL average"** — not "top-10k" (no public top-10k endpoint). Honest label.

### GW Navigation
- **D-09:** GW pill toggle showing the last 3 settled GWs (e.g., "GW33 | GW34 | GW35"). Defaults to the most recent settled GW. Consistent with the 1/3/5 GW horizon toggle pattern used elsewhere.
- **D-10:** Pipeline writes exactly 3 files per run (sliding window: last 3 settled GWs). Overwritten each daily run — no per-GW accumulation or archival needed.

### Degraded States
- **D-11:** No team ID loaded → show "Load your squad to see GW reviews." (Same empty state guard as other Squad sub-tabs.)
- **D-12:** GW not yet settled (no Blob file, or `gw_review_gw{N}.json` missing) → show "GW review will appear once scores finalise."
- **D-13:** Pipeline hasn't run yet / Blob cold start → API route returns 503; UI shows "Review data unavailable — check back after the next pipeline run." Seed empty JSON files (`{ gw: null }`) in `pipeline/cache/` to prevent 500 on fresh checkout.

### Claude's Discretion
- 5th sub-tab label ("Review" or "GW Review") and position in Squad SECTIONS array (after "Lineup")
- `GwReview` TypeScript type shape (fields: `gw`, `your_score`, `bench_pts_left`, `captain_name`, `optimal_captain_name`, `captain_delta`, `top_scorer_name`, `top_scorer_pts`, `average_score`)
- TanStack Query hook name (`useGwReview`) and `staleTime` (suggest 30 min — GW scores don't change after settling)
- Component name (`GwReviewTab`, `PostGwReview`, etc.)
- Visual layout of the review card (4–5 stats, compact grid or stacked rows)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 70 — Phase 73 implements PGW-01 and PGW-02 from this section (same feature, renumbered to 73 as next sequential phase)
- `.planning/REQUIREMENTS.md` §PGW-01, PGW-02 — if listed; cross-check the 5 success criteria in ROADMAP §Phase 70

### API Route Patterns (read to follow conventions)
- `src/app/api/insights/route.ts` — canonical `USE_BLOB` env-var pattern (local cache vs Vercel Blob list+fetch); copy this verbatim for the GET `/api/gw-review` route
- `src/app/api/prose-summary/route.ts` — Phase 67 pattern for pipeline-written JSON served via GET route

### FPL Proxy & Data Fetching
- `src/lib/hooks/useChipHistory.ts` — uses `entry/{teamId}/history/` via the existing FPL proxy; the `useGwReview` hook follows the same `enabled: !!teamId && /^\d+$/.test(teamId)` numeric guard pattern (T-34-01 injection mitigation)
- `src/app/api/fpl/[...proxy]/route.ts` — existing FPL proxy; `entry/{teamId}/event/{gw}/picks/` is a public FPL endpoint (past GW picks are public) routable through this proxy

### Navigation & Squad Section
- `src/app/page.tsx` — `SECTIONS` constant and `SubTab` type; 5th Squad sub-tab ("Review") must be added here following the same `{ id, label, mobileLabel }` pattern
- `src/components/squad/LineupTab.tsx` — most recent Squad sub-tab added in Phase 72; use as the structural template for the new Review tab

### Pipeline
- `pipeline/run.py` — where the `gw_review` writer block goes (after all other outputs; follows the `price_changes` writer block as a structural model)
- `pipeline/fpl_client.py` — FPL API client; the bootstrap `events` array is already fetched here; `average_entry_score` per GW is available from the cached bootstrap

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/hooks/useChipHistory.ts` → copy the `enabled: !!teamId && /^\d+$/.test(teamId)` guard and error handling into `useGwReview`; same hook structure
- `src/app/api/insights/route.ts` → copy the `USE_BLOB ? list(prefix) : readFile(cache)` block for the Blob-serving GET route
- `src/components/squad/LineupTab.tsx` → loading/empty/no-squad guard pattern for Squad sub-tabs; the Review tab needs the same guards (D-11)
- `pipeline/cache/price_changes.json` → model for a seeded empty JSON file required to prevent 500 on cold start (D-13); seed files require `git add -f` (pipeline/cache is gitignored)

### Established Patterns
- `USE_BLOB` env-var guard on every API route — new route must follow this convention
- `enabled: !!teamId && /^\d+$/.test(teamId)` — numeric teamId guard on hooks that call FPL proxy (T-34-01 injection mitigation)
- `staleTime` on all TanStack Query hooks — suggest 1800000 (30 min) for settled GW data

### Integration Points
- `pipeline/run.py`: new `gw_review` writer block detects last 3 finished GWs from `bootstrap['events']` where `event['finished'] == True`; writes `pipeline/cache/gw_review_gw{event_id}.json`
- `src/app/page.tsx`: add `{ id: 'review' as SubTab, label: 'Review', mobileLabel: 'Review' }` to Squad's `subTabs` array; add render guard `activeSection === 'squad' && activeSubTab === 'review'`
- FPL picks endpoint: `GET entry/{teamId}/event/{gw}/picks/` returns `{ entry_history: { points, points_on_bench, ... }, picks: [{ element, position, multiplier, is_captain, is_vice_captain, total_points }] }`

</code_context>

<specifics>
## Specific Ideas

- GW toggle pill buttons styled consistently with the 1/3/5 GW horizon toggle in `GwToggle.tsx` — reuse the same visual pattern
- Captain delta labelled clearly: "You picked [Captain] (+X pts)" with delta shown as a positive number when you missed points, or "Optimal captain — no delta" when correct
- "FPL average" label is intentional — do NOT change it to "top-10k average" (data doesn't support that claim)
- `points_on_bench` is a direct FPL API field — do not recompute bench pts from individual player totals

</specifics>

<deferred>
## Deferred Ideas

- Full season GW history (all GWs, not just last 3) — belongs in a future phase once the sliding-window pattern is established
- Per-team Blob persistence of team-specific review data — would require writing per-teamId blobs; deferred, client on-demand fetch is sufficient
- Comparison vs mini-league rivals' GW scores — requires Phase 58 rivals data integration; out of scope for Phase 73

</deferred>

---

*Phase: 73-Post-GW Review*
*Context gathered: 2026-05-05*
