# Stack Research — v1.21 Polish, Intelligence & Team News

**Domain:** FPL Analyst — incremental additions (SCRAPER-01, NLP-01, VER-01)
**Researched:** 2026-05-16
**Confidence:** HIGH — all three features are already partially or fully implemented in the codebase; findings are grounded in direct code inspection, not training-data inference.

---

## Bottom Line Up Front

**Net new npm packages: 0**
**Net new Python packages: 0**
**Net new external services: 0**

All three v1.21 features are extensions of already-implemented pipeline and backend code. The work is UI integration — rendering data that already flows through the system.

| Feature | Backend status | What remains |
|---------|---------------|-------------|
| SCRAPER-01 (FPL news in transfer/captain surfaces) | COMPLETE — `news`, `news_added`, `chance_of_playing_next_round` in `merge.py` + `MergedPlayer` type + `NewsBanner` component | Wire `<NewsBanner>` into `CaptainPicksPanel` and `OpportunityCostTable` / `PlayerMoveCell` |
| NLP-01 (weekly prose summary UI) | COMPLETE — `prose_summary.py`, `run.py` pipeline wiring, `/api/prose-summary` GET+POST route | Build `useProseSummary` hook + `WeeklyNarrativeBlock` component + mount in `DecisionSummaryTab` |
| VER-01 (model version comparison UI) | COMPLETE — `FORMULA_VERSION` constant, `versions[]` array in `accuracy_backtest.json`, `VersionRecord` TypeScript type | Build `VersionHistoryTable` component + add "Versions" pill to `AccuracyTab` |

---

## Core Technologies (unchanged — carried forward)

| Technology | Current Version | v1.21 Integration Point |
|------------|----------------|------------------------|
| Next.js | 16.2.1 | Existing `/api/prose-summary` GET+POST route used for NLP-01; no new routes needed |
| React | 19.2.4 | New `WeeklyNarrativeBlock` (NLP-01), `VersionHistoryTable` (VER-01); `<NewsBanner>` mount in existing components (SCRAPER-01) |
| TypeScript | ^5 | `VersionRecord[]` type already in `src/lib/types.ts` (line 455); `MergedPlayer.news` already typed (lines 26–28) |
| `@anthropic-ai/sdk` | ^0.93.0 | Already wired in `/api/prose-summary` POST; no version change needed |
| `@vercel/blob` | ^2.3.1 | `weekly_summary.json` cache already served via GET path; `merged_players.json` already contains news fields |
| TanStack Query | ^5.95.2 | New `useProseSummary` hook (mirrors `useInsights` pattern); `useAccuracy()` already fetches `versions[]` |
| TanStack Table | ^8.21.3 | `VersionHistoryTable` can be a plain `<table>` — TanStack Table not needed for a static list |
| Tailwind CSS | ^4 | All UI work uses existing utility classes |
| Zod | ^4.3.6 | POST body schema already validates captains / transfer / chip / risks in `/api/prose-summary` |
| recharts | ^3.8.1 | Optional for VER-01 hit-rate bar chart — `BarChart` pattern from `BackTab` is the model; not required if a plain table suffices |
| Vitest | ^4.1.2 | TDD RED→GREEN cycle for new components |
| `@testing-library/react` | ^16.3.2 | Component tests for new NLP-01 and VER-01 components |

---

## Feature-by-Feature Stack Analysis

### SCRAPER-01: FPL News Feed in Transfer/Captain Surfaces

**Finding: All code exists. Work is call-site wiring only.**

The FPL `bootstrap-static` `news` field is already extracted in `pipeline/merge.py` (lines 992–995: `news`, `news_added`, `chance_of_playing_next_round`). These fields flow through `merged_players.json` → `/api/players` → `usePlayers()` → `MergedPlayer` TypeScript type (already declared in `src/lib/types.ts` lines 26–28 and 132–134). The `NewsBanner` component (Phase 88 SCRAPER-01) and `computeNewsSeverity` classifier already exist and are already used in `SquadView`. The `useNewsFlagEnabled()` gate is already live.

**v1.21 work — no new files, no new libraries:**
- Add `<NewsBanner news={candidate.news} chance_of_playing_next_round={candidate.chance_of_playing_next_round} />` to `CaptainPicksPanel` `CandidateRow`
- Add `<NewsBanner>` to `PlayerMoveCell` buy rows in `OpportunityCostTable`
- Both components already receive `MergedPlayer`-shaped data; `news` and `chance_of_playing_next_round` are already present

**No library changes. No pipeline changes. No new types.**

---

### NLP-01: Weekly Prose Summary — UI Layer

**Finding: Backend fully implemented. UI layer is the remaining work.**

The pipeline generates `weekly_summary.json` on every daily run via `pipeline/prose_summary.py` → `pipeline/run.py` (line 397: `save('weekly_summary.json', summary)`). The `/api/prose-summary` route (Phase 67) has both:
- GET: reads `weekly_summary.json` from Blob, returns `{ prose, gw, generated_at }` — served with `Cache-Control: s-maxage=3600`
- POST: squad-aware on-demand refresh. Zod schema already validates `{ gw, captains[], transfer, chip, risks[] }`. Claude call uses `claude-haiku-4-5`, `maxDuration = 30`, non-streaming, two-attempt guardrail.

The prose guardrail (`src/lib/prose-guardrail.ts`) and XML prompt builder are both implemented.

**v1.21 work:**

1. **`useProseSummary` hook** — `src/lib/hooks/useProseSummary.ts`
   - GET path: `useQuery(['prose-summary'], () => fetch('/api/prose-summary').then(r => r.json()), { staleTime: 6 * 60 * 60 * 1000 })`
   - POST trigger: `useMutation(body => fetch('/api/prose-summary', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json()))`
   - Pattern: identical to `useInsights` / `useAccuracy`

2. **`WeeklyNarrativeBlock` component** — `src/components/summary/WeeklyNarrativeBlock.tsx`
   - Renders prose paragraph from GET response (pre-generated by pipeline)
   - "Refresh" button fires POST mutation with current Decision Summary context (captains, transfer, chip, risks)
   - States: loading / error / 404-not-yet-generated / prose display
   - Pattern: mirrors `PlayerInsightSection` component

3. **Mount in `DecisionSummaryTab`** — below the 4-card severity grid, above or replacing existing `ProseSummaryBlock` placeholder (verify whether stub exists in current code)

**Model in use:** `claude-haiku-4-5` (already hardcoded in POST handler). Cost: ~600 input tokens + 512 output tokens = ~$0.0034 per on-demand generation. Not a cost concern at personal-tool usage rates.

**Cost discipline:** GET path (pipeline pre-generated) = zero Claude spend. POST (on-demand) = only fires on explicit "Refresh" button press, never auto-triggered. Same discipline as `usePlayerInsight` (NLP-02).

**No new npm packages. No new Python packages. No pipeline changes.**

---

### VER-01: Model Version Comparison UI

**Finding: All data exists. Work is a display component only.**

`pipeline/accuracy.py` already:
- Declares `FORMULA_VERSION = 'v1.12-a'` (line 37) — bumped manually when formula changes
- Writes a `versions[]` array at the top level of `accuracy_backtest.json` (line 432) — deduped on `formula_version` across runs
- Each record: `{ formula_version, recorded_at, hit_rate, gate_flags }` (lines 392–415)

The live `pipeline/cache/accuracy_backtest.json` confirms one version record exists:
```json
{ "formula_version": "v1.12-a", "recorded_at": "2026-05-06T10:01:25...", "hit_rate": 0.1899,
  "gate_flags": { "form_signal_enabled": false, "xmins_v2_enabled": false, ... } }
```

TypeScript:
- `VersionRecord` interface already in `src/lib/types.ts` (lines 455–460)
- `AccuracyBacktest.versions?: VersionRecord[]` already typed (line 402)
- `useAccuracy()` already fetches the full `AccuracyBacktest` including `versions`

**v1.21 work:**

1. **`VersionHistoryTable` component** — `src/components/accuracy/VersionHistoryTable.tsx`
   - Reads `data?.versions` from `useAccuracy()` — already typed, already fetched
   - Renders a sorted table: formula_version | hit_rate | recorded_at | active gate flags
   - Optional: small `BarChart` (recharts, reusing `BackTab` pattern) comparing hit rates across versions

2. **Add "Versions" pill to `AccuracyTab`** — join existing `Summary | Calibration | Back` pill nav

**No new library. No new types. No API changes. No pipeline changes.**

---

## Installation

```bash
# No new packages required for v1.21.
# All three features use existing dependencies.
```

---

## Alternatives Considered

| Feature | Alternative | Why Rejected |
|---------|-------------|-------------|
| NLP-01 | New `/api/weekly-narrative` route | Route already exists at `/api/prose-summary` with both GET and POST handlers — no duplication needed |
| NLP-01 | Server Component with streaming | Non-streaming established and tested; 4–5 sentences delivers in <1s from Haiku with zero partial-render complexity |
| NLP-01 | Auto-generate on `useEffect` mount | Violates cost discipline (NLP-02 precedent); POST must be user-triggered; GET serves pre-generated prose on load |
| VER-01 | Separate `versions.json` Blob file | Versions are already top-level in `accuracy_backtest.json`, already fetched by `useAccuracy()` — no new fetch needed |
| VER-01 | `recharts BarChart` for version comparison | A plain `<table>` renders the data clearly at the current volume (1–5 versions); defer chart if version count grows |
| SCRAPER-01 | External news scraper (FPL community sites, Twitter) | Unnecessary: FPL `bootstrap-static` already contains `news` per element — official, zero latency, zero external dependency |
| SCRAPER-01 | Polling endpoint for live news updates | Data freshness is once-daily via pipeline cron; live polling adds infrastructure complexity for no practical gain at daily-refresh cadence |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new npm package | All three features are wiring-only over existing stack | None needed |
| Any new Python package | Pipeline side fully implemented for all three features | None needed |
| `claude-haiku-4-5-20251001` (dated alias) in `/api/prose-summary` | Route currently uses `claude-haiku-4-5` (dateless alias); consistent with `prose_summary.py`; DO NOT change to match `/api/player-insight`'s dated alias unless Anthropic deprecates the dateless form | Keep `claude-haiku-4-5` in prose-summary route |
| Streaming for NLP-01 POST | Already non-streaming; 4–5 sentences fits well within 30s budget; partial-render adds UI state complexity for no perceived speedup | `client.messages.create(...)` non-streaming |
| `useProseSummary` auto-fire via `useEffect` | Cost explosion risk — same reasoning as NLP-02; POST must be user-triggered only | `useMutation` + explicit "Refresh" button |
| New Blob key for squad-aware prose | POST response is ephemeral (squad-context-specific); caching squad-aware prose would serve wrong context on next load | Return in-response only; GET serves pipeline-generated prose |
| `useNewsFlagEnabled()` gate bypass | Gate is already set `true` by pipeline (Phase 88 D-04); bypass would shadow the kill-switch contract | Let `NewsBanner` self-gate via `useNewsFlagEnabled()` |
| TanStack Table for `VersionHistoryTable` | 1–5 rows of static data; TanStack Table overhead not warranted | Plain HTML `<table>` with Tailwind classes |

---

## Version Compatibility Notes

| Concern | Status |
|---------|--------|
| `@anthropic-ai/sdk ^0.93.0` for NLP-01 POST route | Compatible — `/api/prose-summary` POST already uses `client.messages.create()` on this version |
| `zod ^4.3.6` for existing POST schemas | Compatible — schemas in `/api/prose-summary` use Zod 4 patterns already |
| TanStack Query v5 `useMutation` for `useProseSummary` | Compatible — identical pattern to `usePlayerInsight` hook |
| recharts `^3.8.1` for optional VER-01 bar chart | Compatible — `BarChart` already imported and used in `BackTab` |
| `useAccuracy()` fetching `versions?: VersionRecord[]` | Compatible — field is optional in `AccuracyBacktest` type; `undefined` handled gracefully with `?? []` |

---

## Sources

- `C:\Users\jamie\fplx\pipeline\merge.py` lines 992–995 — `news`, `news_added`, `chance_of_playing_next_round` confirmed extracted from `bootstrap-static`
- `C:\Users\jamie\fplx\src\lib\types.ts` lines 26–28, 132–134, 402, 455–460 — `MergedPlayer.news`, `VersionRecord`, `AccuracyBacktest.versions` confirmed
- `C:\Users\jamie\fplx\src\components\news\NewsBanner.tsx` — Phase 88 component confirmed
- `C:\Users\jamie\fplx\src\lib\newsSeverity.ts` — severity classifier confirmed
- `C:\Users\jamie\fplx\pipeline\prose_summary.py` — full NLP-01 pipeline implementation confirmed
- `C:\Users\jamie\fplx\pipeline\run.py` lines 358–403 — `generate_weekly_summary()` wiring confirmed; `weekly_summary.json` written on every run
- `C:\Users\jamie\fplx\src\app\api\prose-summary\route.ts` — GET+POST handlers confirmed; `claude-haiku-4-5`, `maxDuration = 30`, non-streaming, Zod schema, guardrail retry
- `C:\Users\jamie\fplx\pipeline\accuracy.py` lines 37, 85–100, 392–432 — `FORMULA_VERSION`, `_read_existing_versions()`, versions append logic confirmed
- `C:\Users\jamie\fplx\pipeline\cache\accuracy_backtest.json` lines 13452–13462 — live `versions` array with one record (`v1.12-a`, `hit_rate: 0.1899`) confirmed
- `C:\Users\jamie\fplx\package.json` — all current dependency versions confirmed
- Confidence: HIGH — all claims grounded in direct file inspection; no training-data assumptions

---

*Stack research for: FPL Analyst v1.21 — SCRAPER-01 / NLP-01 / VER-01*
*Researched: 2026-05-16*
