# Phase 113: Transfer Regret Backtester (v1.20) - Research

**Researched:** 2026-05-15
**Domain:** FPL backtester — pipeline snapshot, API extension, BackTab UI toggle + TransferRegretView
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Transfer recommendations computed post-hoc in TypeScript by `/api/decision-history`. No Python pipeline port of `suggestTransfers`.
- **D-02:** Pipeline side-writes `merged_players_slim_gw{N}.json` to Vercel Blob each run (when `USE_BLOB=true`). Slim projection containing: `id`, `element_type`, `web_name`, `now_cost`, `selected_by_percent`, `xPts_1gw`, `xPts_3gw`. Target ~50–75 KB per GW. New `pipeline/transfer_snapshots.py` module mirrors `captain_snapshots.py`.
- **D-03:** API reconstructs pre-transfer squad from post-transfer picks + FPL event_transfers. Fetch `/entry/{teamId}/event/{gw}/picks/` (post-transfer) and `/entry/{teamId}/transfers/` (element_in/element_out per GW), then swap element_in → element_out to recover pre-transfer lineup.
- **D-04:** All settled GWs are shown — every finished GW gets a row, regardless of whether the user transferred.
- **D-05:** When user held (no transfer that GW), User column shows "Held — no transfer". Engine column still shows top recommendation. Delta shows counterfactual gain/loss.
- **D-06:** Hold delta formula: `delta = engine_IN.actual_pts − engine_OUT.actual_pts`.
- **D-07:** Multi-transfer GWs (2-FT): one row per GW. `delta = Σ(engine swap gains) − Σ(user swap gains)`. Engine and User columns show compressed representations.
- **D-08:** BackTab gains "Captain | Transfer" segmented pill toggle at the top. First control in BackTab (above summary header). Reuses `GwToggle.tsx` segmented pill pattern.
- **D-09:** Default view on BackTab mount = Captain. Toggle state is component-local `useState<'captain' | 'transfer'>('captain')` inside BackTab.
- **D-10:** Each toggle view is fully self-contained: own summary header + bar chart + per-GW rows.
- **D-11:** Transfer Regret view layout: season summary header → recharts bar chart → per-GW detail rows. Matches captain regret layout from Phase 96 D-05.
- **D-12:** Per-GW row columns: GW | Engine ("Sell X (Npts) buy Y (Mpts)") | User ("Sell X buy Y" or "Held — no transfer") | Delta (signed with colour + label).
- **D-13:** Season summary: `"Total transfer regret: {X} pts across {N} GWs | Engine better: {N} | You better: {N} | Tied: {N}"`.
- **D-14:** Bar chart colour: positive delta → `#ef4444` (engine better); negative delta → `#22c55e` (user better); null/zero → `rgba(161,161,170,0.5)`.

### Claude's Discretion

- Exact field selection and ordering in `merged_players_slim_gw{N}.json` (must include at minimum: `id`, `element_type`, `web_name`, `now_cost`, `selected_by_percent`, all `xPts_*` fields used by `suggestTransfers`)
- How to handle GWs where `merged_players_slim_gw{N}.json` doesn't exist (empty/null engine column, "No snapshot" placeholder matching Phase 96 D-10)
- Column widths and responsive behaviour of per-GW rows
- Whether `computeTransferRegret()` lives in `src/lib/regret.ts` or a new `src/lib/transfer-regret.ts`
- `/api/decision-history` response shape for transfer entries (beyond what types dictate)
- Horizon passed to `suggestTransfers()` for post-hoc compute — default 1GW (`xPts_1gw`)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-02 | User can view a per-GW transfer regret report — what the transfer engine recommended that week vs what was actually done, with hindsight xPts delta (recommended gain vs actual gain) | Fully researched: pipeline snapshot pattern, API extension approach, UI component layout all confirmed against existing codebase. Implementation approach is TypeScript post-hoc compute from per-GW slim snapshot. |
</phase_requirements>

---

## Summary

Phase 113 delivers BACK-02 by mirroring the Phase 96 BACK-01 captain snapshot pattern across three surfaces: (1) a new `pipeline/transfer_snapshots.py` module side-writes `merged_players_slim_gw{N}.json` to Vercel Blob each pipeline run — a slim projection of `merged_players` containing only the fields `suggestTransfers()` requires; (2) `/api/decision-history` is extended to read these per-GW slim snapshots, reconstruct the user's pre-transfer squad from FPL picks + transfers endpoints, run `suggestTransfers()` post-hoc, look up actual realised points via `element-summary`, and return transfer regret entries alongside existing captain entries; (3) `BackTab.tsx` gains a "Captain | Transfer" segmented pill toggle, and a new `TransferRegretView` component renders the season summary, bar chart, and per-GW detail rows when the Transfer tab is active.

The architecture is a clean extension of the existing Phase 96 blueprint. All recharts imports, colour constants (`REGRET_RED/GREEN/GREY`), table-chrome classes (`TABLE_CLS/TH_CLS/TR_CLS/TD_CLS`), and the `localStorage` ring-buffer are already in place. The FPL `element-summary` fan-out pattern (used in Phase 110's FIX-06 for captain actual-pts) must be replicated for transfer OUT and IN players per GW. The main new complexity is squad reconstruction: swap `element_in → element_out` per GW in the transfers list to recover the pre-transfer 15-man squad that the engine would have seen.

The approach does not produce hindsight data for GWs before Phase 113 is deployed and the pipeline is re-run — this is an accepted constraint identical to Phase 96. Empty and "No snapshot" states must never show NaN, and must never block the captain view from rendering.

**Primary recommendation:** Follow the Phase 96 BACK-01 implementation blueprint exactly. Three separate waves: (1) pipeline + types; (2) API extension; (3) BackTab toggle + TransferRegretView + tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slim player snapshot | Pipeline (Python) | Vercel Blob | Data written at pipeline run time — captures per-GW state that would otherwise drift as prices and xPts change |
| Post-hoc transfer recommendation | API / Backend (TS) | — | Runs `suggestTransfers()` server-side against the frozen slim snapshot; keeps engine logic out of the client |
| Pre-transfer squad reconstruction | API / Backend (TS) | FPL API | Combines public FPL picks endpoint + FPL transfers endpoint to derive what squad the user held before making their move |
| Actual points lookup | API / Backend (TS) | FPL API | `element-summary/{id}/` fan-out per unique player id referenced in engine and user transfers |
| Transfer regret computation | API / Backend (TS) | — | `computeTransferRegret()` pure function (mirrors `computeRegret()`); lives in `src/lib/regret.ts` or new file |
| Toggle state management | Frontend (client) | — | Component-local `useState<'captain' \| 'transfer'>` inside `BackTab` — no URL state, no server involvement |
| Transfer regret visualisation | Frontend (client) | — | TransferRegretView: recharts BarChart + per-GW table rows; reads data from `useDecisionHistory` hook |
| Cache / ring buffer | Frontend (client) | — | `localStorage` ring buffer; transfer data can extend the existing `decisionHistory:teamId:{id}` key by adding `transferEntries` to the payload, or use a separate key |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | Already installed | Bar chart for transfer regret visualisation | All recharts imports already present in `BackTab.tsx` — `BarChart`, `Bar`, `Cell`, `XAxis`, `YAxis`, `ReferenceLine`, `Tooltip`, `ResponsiveContainer` |
| @tanstack/react-query | Already installed | Data fetching + caching for `useDecisionHistory` | Existing hook pattern; `useDecisionHistory` is extended, not replaced |
| @vercel/blob | Already installed | `list()` call to read `merged_players_slim_gw{N}.json` from Blob storage | Used by `readSnapshot()` in `decision-history/route.ts` — same pattern reused verbatim |
| vercel_blob (Python) | Already installed in pipeline | `upload_json()` call in `transfer_snapshots.py` | Used by `captain_snapshots.py` — identical one-liner pattern |

[VERIFIED: codebase grep — all packages confirmed present in existing source files]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + @testing-library/react | Already installed | Unit tests for BackTab toggle, TransferRegretView, computeTransferRegret | Extend `BackTab.test.tsx` with new `describe` blocks; follow exact mock pattern already used |

[VERIFIED: codebase — `vitest.config.ts`, `BackTab.test.tsx` confirmed]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `useDecisionHistory` | New `useTransferHistory` hook | Separate hook avoids coupling but doubles the API calls and the cache keys; extending is simpler and consistent with how captain + transfer data is one unified decision history response |
| `src/lib/regret.ts` for new function | New `src/lib/transfer-regret.ts` | Discretion area; both acceptable. Keeping in `regret.ts` is simpler; new file is cleaner if the function grows. Choose at implementation time. |

**Installation:** No new packages required for this phase. All dependencies already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
Pipeline run (USE_BLOB=true)
  merged_players dict
    └── transfer_snapshots.write_transfer_slim_snapshot(merged, gw)
          └── upload_json("merged_players_slim_gw{N}.json", slim_dict)
                └── Vercel Blob

GET /api/decision-history?teamId={id}
  │
  ├── FPL bootstrap → finishedGws + elementMap
  │
  ├── For each finishedGw (parallel):
  │     ├── readSnapshot(gw)             → captain_picks_gw{N}.json (existing)
  │     ├── readTransferSlimSnapshot(gw) → merged_players_slim_gw{N}.json (new)
  │     └── readGwPicks(teamId, gw)      → FPL /entry/{id}/event/{gw}/picks/
  │
  ├── fetchTransfers(teamId)             → FPL /entry/{id}/transfers/  (one call)
  │
  ├── For each finishedGw with slim snapshot:
  │     ├── reconstructPreTransferSquad(gwPicks, transfersForGw)
  │     │     └── swap element_in → element_out for each transfer that GW
  │     ├── suggestTransfers({ currentPicks: preTransferSquad, players: slimSnapshot, ... })
  │     │     └── top suggestion(s) → engine recommendation
  │     └── collect unique player IDs (engine OUT, engine IN, user OUT, user IN)
  │
  ├── element-summary fan-out (Promise.allSettled) for all unique player IDs
  │     └── actualPtsMap: Map<elementId, Map<gwRound, actualPts>>
  │
  ├── computeTransferRegret() per GW
  │     └── delta = Σ(engineIn.actual_pts) - Σ(engineOut.actual_pts)
  │             vs Σ(userIn.actual_pts) - Σ(userOut.actual_pts)   (hold: both legs = same player)
  │
  └── Response: { captainEntries: RegretEntry[], transferEntries: TransferRegretEntry[], ... }

BackTab (client component)
  useState<'captain' | 'transfer'>('captain')
    ├── Captain active → existing SeasonSummaryHeader + RegretChart + captain rows
    └── Transfer active → TransferSeasonSummaryHeader + TransferRegretChart + transfer rows
```

### Recommended Project Structure

```
pipeline/
├── transfer_snapshots.py    # NEW — mirrors captain_snapshots.py exactly
└── run.py                   # EDIT — add write_transfer_slim_snapshot call after line 231

src/
├── app/api/decision-history/
│   └── route.ts             # EDIT — add readTransferSlimSnapshot, squad reconstruction, transfer entries
├── components/accuracy/
│   ├── BackTab.tsx          # EDIT — add pill toggle + TransferRegretView section
│   └── BackTab.test.tsx     # EDIT — add describe blocks for toggle + transfer view
└── lib/
    ├── types.ts             # EDIT — add TransferRegretEntry, SlimPlayer, TransferDecisionHistory
    ├── regret.ts            # EDIT — add computeTransferRegret, computeTransferSeasonSummary
    └── hooks/
        └── useDecisionHistory.ts  # EDIT — extend response type to carry transferEntries
```

### Pattern 1: Slim Snapshot Module (mirrors captain_snapshots.py)

**What:** Python module with a single `write_transfer_slim_snapshot(merged, current_gw)` function — a no-op when `USE_BLOB` is unset, otherwise calls `upload_json` with a slim projection of the merged_players list.

**When to use:** Called from `pipeline/run.py` immediately after `merged_players` is fully assembled and saved (after line 231 in the current run.py).

**Example:**
```python
# pipeline/transfer_snapshots.py
# Source: mirrors pipeline/captain_snapshots.py [VERIFIED: codebase read]

import os

SLIM_FIELDS = (
    'id', 'element_type', 'web_name', 'team', 'now_cost',
    'selected_by_percent', 'xPts_1gw', 'xPts_3gw', 'xPts_5gw',
)

def write_transfer_slim_snapshot(merged: list, current_gw: int) -> None:
    """Upload slim player projection to Vercel Blob as merged_players_slim_gw{N}.json."""
    if os.getenv('USE_BLOB', '').lower() != 'true':
        return
    from upload import upload_json
    slim = [{k: p[k] for k in SLIM_FIELDS if k in p} for p in merged]
    upload_json(f'merged_players_slim_gw{current_gw}.json', slim)
    print(f"Transfer slim snapshot uploaded: merged_players_slim_gw{current_gw}.json")
```

[VERIFIED: captain_snapshots.py, upload.py read — pattern confirmed]

### Pattern 2: Blob Read for Per-GW Slim Snapshot (mirrors readSnapshot in route.ts)

**What:** `readTransferSlimSnapshot(gw)` follows the identical `list({ prefix, limit: 1 })` + `fetch(blobs[0].url)` pattern. Falls back to local `pipeline/cache/` when `USE_BLOB=false`.

**Example:**
```typescript
// Source: mirrors readSnapshot() in src/app/api/decision-history/route.ts [VERIFIED: codebase read]
async function readTransferSlimSnapshot(gw: number): Promise<SlimPlayer[] | null> {
  const filename = `merged_players_slim_gw${gw}.json`
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length || blobs[0].pathname !== filename) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) return null
      return (await res.json()) as SlimPlayer[]
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      const data = await readFile(cachePath, 'utf-8')
      return JSON.parse(data) as SlimPlayer[]
    }
  } catch {
    return null  // ENOENT / malformed JSON / blob failure → no snapshot (D-10 pattern)
  }
}
```

### Pattern 3: Pre-Transfer Squad Reconstruction (D-03)

**What:** Given the post-transfer picks array and the list of transfers for a specific GW, reconstruct the pre-transfer squad by swapping `element_in → element_out` for each transfer that occurred in that GW.

**Critical detail:** The FPL `/entry/{id}/transfers/` endpoint returns ALL transfers for the season; filter by `event === gw`. Each transfer entry has `element_in` (bought) and `element_out` (sold). To reconstruct the pre-transfer state, replace each `element_in` pick with a synthetic pick for `element_out`.

**Example:**
```typescript
// Source: D-03 from CONTEXT.md + FPLTransferEntry shape from season-analytics/route.ts [VERIFIED]
function reconstructPreTransferSquad(
  postTransferPicks: FPLPick[],      // from /entry/{id}/event/{gw}/picks/
  gwTransfers: FPLTransferEntry[],   // filtered from /entry/{id}/transfers/ where event === gw
): Pick<FPLPick, 'element'>[] {
  const squad = postTransferPicks.map(p => ({ element: p.element }))
  for (const t of gwTransfers) {
    // Swap element_in back to element_out (undo the transfer)
    const idx = squad.findIndex(p => p.element === t.element_in)
    if (idx !== -1) squad[idx] = { element: t.element_out }
  }
  return squad
}
// Then: suggestTransfers({ currentPicks: squad, players: slimSnapshot, ... })
```

### Pattern 4: element-summary Fan-Out for Actual Points

**What:** Collect unique player IDs across all GWs (engine OUT, engine IN, user OUT, user IN), fan out with `Promise.allSettled`, build `Map<elementId, Map<round, actualPts>>`. Identical to the pattern introduced in Phase 110 FIX-06 for captain actual points.

**Source:** `src/app/api/decision-history/route.ts` lines 129–158 (existing implementation). [VERIFIED: codebase read]

The transfer regret variant must include engine OUT, engine IN, user OUT, and user IN players (4× more unique IDs than captain tracking, which only needed the ceiling player). Still bounded: max 2 transfers per GW × 38 GWs × 4 sides = ~304 unique IDs worst case, but deduplicated in practice.

### Pattern 5: TransferRegretEntry Type Design

```typescript
// src/lib/types.ts additions [ASSUMED — shape below is recommended, planner can adjust]

export interface SlimPlayer {
  id: number
  element_type: 1 | 2 | 3 | 4
  web_name: string
  team: number
  now_cost: number
  selected_by_percent: string
  xPts_1gw?: number
  xPts_3gw?: number
  xPts_5gw?: number
}

export interface TransferRegretEntry {
  gw: number
  hasSnapshot: boolean        // false = no slim snapshot for this GW
  // Engine recommendation (from suggestTransfers post-hoc)
  engineSell: string[] | null   // web_name(s); null when no snapshot
  engineBuy: string[] | null    // web_name(s); null when no snapshot
  engineSellPts: number[] | null  // actual pts for engine OUT player(s)
  engineBuyPts: number[] | null   // actual pts for engine IN player(s)
  // User's actual transfer (from FPL event_transfers)
  isHold: boolean               // true = user made no transfer this GW
  userSell: string[] | null     // web_name(s); null when hold or unavailable
  userBuy: string[] | null      // web_name(s)
  userSellPts: number[] | null
  userBuyPts: number[] | null
  // Signed delta (D-06/D-07)
  delta: number | null          // null when no snapshot or actual pts unavailable
}

export interface TransferDecisionHistory {
  teamId: number
  gwsWithData: number
  entries: TransferRegretEntry[]
}
```

### Pattern 6: computeTransferRegret()

**What:** Pure function that computes the signed delta between engine recommendation and user action. Mirrors `computeRegret()` in `src/lib/regret.ts`.

**Delta formula (D-06/D-07):**
- 1-FT: `delta = (engineIn_pts - engineOut_pts) - (userIn_pts - userOut_pts)` where userIn/Out = null for hold GWs (hold treated as delta between engine's recommended swap and holding)
- Hold GW (D-06): `delta = engineIn_pts - engineOut_pts` (positive = engine right to transfer, user left pts on table)
- 2-FT (D-07): `delta = Σ(engineLeg gains) - Σ(userLeg gains)`

```typescript
// Recommended implementation in src/lib/regret.ts or src/lib/transfer-regret.ts
export function computeTransferDelta(
  engineBuyPts: number[],
  engineSellPts: number[],
  userBuyPts: number[] | null,    // null for hold GWs
  userSellPts: number[] | null,
): number | null {
  if (engineBuyPts.length === 0) return null
  const engineGain = sum(engineBuyPts) - sum(engineSellPts)
  if (userBuyPts === null || userSellPts === null) {
    // Hold GW: delta is counterfactual gain from the engine's recommended move
    return Math.round(engineGain * 10) / 10
  }
  const userGain = sum(userBuyPts) - sum(userSellPts)
  return Math.round((engineGain - userGain) * 10) / 10
}
```

[ASSUMED — formula derived from CONTEXT.md D-06/D-07; no existing implementation to verify against]

### Pattern 7: BackTab Toggle Integration

**What:** Add `useState<'captain' | 'transfer'>('captain')` at the top of `BackTab`. Render the pill toggle as the first element. Conditionally render either the existing captain view or the new `TransferRegretView`.

**Key concern:** The existing `BackTab` has a loading guard that returns early before any content renders. The toggle must be rendered at the same structural level as today's content — meaning the loading/error/empty guards fire based on the Captain data only, and the Transfer view has its own loading/empty/error guards internal to `TransferRegretView`.

**Confirmed structure from BackTab.tsx:**
```
BackTab({teamId})
  useDecisionHistory(teamId)      ← captain data + (after extension) transfer data
  useSeasonAnalytics(teamId)
  if isLoading → loading message (captain-scoped)
  if error    → error message (captain-scoped)
  if !data || empty → empty state (captain-scoped)
  return (
    <div>
      [NEW] PillToggle (captain | transfer)
      {view === 'captain' && <CaptainView entries={data.entries} ... />}
      {view === 'transfer' && <TransferRegretView entries={data.transferEntries} ... />}
    </div>
  )
```

[VERIFIED: BackTab.tsx read — existing structure confirmed; toggle placement deduced from CONTEXT.md D-08/D-09 and UI-SPEC]

### Anti-Patterns to Avoid

- **Returning NaN in delta:** Always null-guard `engineBuyPts`/`engineSellPts` before arithmetic. `null ?? 0` is wrong here — null should propagate to `delta: null`.
- **Using future GW data for retroactive recommendations:** The slim snapshot must be written at pipeline run time (deadline-minus-1-hour data), NOT derived from a later run's `merged_players`. The snapshot is the evidence trail. [VERIFIED: CONTEXT.md + ROADMAP cross-cutting constraint]
- **Blocking captain view on transfer data unavailability:** Transfer data errors must not propagate to the captain view loading/error guards. The two views are self-contained (D-10).
- **Running suggestTransfers on an empty slim snapshot:** Guard `slimSnapshot.length === 0` → treat as no snapshot (return `{ hasSnapshot: false, ... }`).
- **Collecting element_in/element_out IDs for ALL seasons' transfers:** FPL `/entry/{id}/transfers/` returns ALL historical transfers. Must filter by `event === gw` before reconstruction, and ensure element-summary fan-out only includes IDs referenced in finished GWs.
- **Using selling_price instead of now_cost for budget in post-hoc compute:** The post-hoc call cannot know the user's exact sell price at decision time. Use `now_cost` from the slim snapshot for both buy and sell sides. Pass `sellPrices: undefined` to `suggestTransfers()`. [VERIFIED: suggestTransfers.ts `sellValueFor()` falls back to `playerById.get(id)?.now_cost ?? 0` when `sellPrices` is undefined]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transfer suggestion engine | Custom post-hoc recommender | `suggestTransfers()` from `src/lib/suggest-transfers.ts` | 260-line engine handles position matching, budget filter, team cap, 1-FT/2-FT enumeration, cost, breakeven — all already correct |
| Blob per-GW read | Custom blob key lookup | `list({ prefix: filename, limit: 1 })` from `@vercel/blob` | Exact pattern already in `readSnapshot()` — copy verbatim |
| Player name lookup | Bootstrap re-fetch per GW | Fetch bootstrap once, build `Map<id, webName>` at route start | Already done for captain route; reuse same map |
| Actual points lookup | Re-running pipeline scoring | FPL `/element-summary/{id}/` history | The only authoritative source of settled actual points — same source used by captain backtester FIX-06 |
| Ring buffer serialisation | Custom JSON chunking | `persistHistory()` / `loadCachedHistory()` from `src/lib/regret.ts` | Already handles SSR safety, try/catch, trim-to-38 — extend for transfer data or reuse same key |

**Key insight:** This phase is almost entirely assembly of existing building blocks. The only truly new code is `write_transfer_slim_snapshot`, `readTransferSlimSnapshot`, `reconstructPreTransferSquad`, `computeTransferDelta`, and `TransferRegretView`.

---

## Common Pitfalls

### Pitfall 1: Squad Reconstruction Off-By-One (pre vs post transfer)

**What goes wrong:** FPL `/entry/{id}/event/{gw}/picks/` returns the squad AFTER the deadline — which is AFTER any transfers made for that GW. Failing to swap back `element_in → element_out` means `suggestTransfers()` runs on the post-transfer squad, which already contains the player the user bought. The engine will not recommend buying a player already in the squad (`ownedIds` exclusion), so the result will be a different recommendation than what the engine would have given before the transfer.

**Why it happens:** The picks endpoint reflects the final squad, not the squad at decision time.

**How to avoid:** Always apply the swap: for each `FPLTransferEntry` where `event === gw`, find `element_in` in the picks array and replace with `element_out`. This is D-03.

**Warning signs:** Engine recommends a player the user actually sold — this would indicate the swap went in the wrong direction.

### Pitfall 2: FPL Transfers Endpoint Returns All-Season Data

**What goes wrong:** `/entry/{id}/transfers/` returns ALL transfers for the entire season as a flat array. If the entire list is passed to `reconstructPreTransferSquad()`, the reconstruction will swap out multiple seasons' worth of transfers and produce a nonsensical squad.

**Why it happens:** The endpoint is season-aggregate, not per-GW.

**How to avoid:** Filter by `event === gw` before passing to reconstruction: `const gwTransfers = allTransfers.filter(t => t.event === gw)`.

[VERIFIED: season-analytics/route.ts fetchTransfers pattern read — confirmed flat season-aggregate array]

### Pitfall 3: element-summary Fan-Out With Too Many Concurrent Requests

**What goes wrong:** A season of 38 GWs with 2 transfers each = 76 transfers × 4 player sides = 304 element-summary fetches. This is technically bounded but can slow the API route significantly or trigger rate limits.

**Why it happens:** Naive `Promise.all` of all unique element IDs.

**How to avoid:** Deduplicate IDs first (a `Set<number>`), then fan out with `Promise.allSettled`. In the worst case (no player re-appears), this is ~304 fetches; with typical season overlap this drops to ~60–100. The existing captain fan-out (FIX-06) follows the same `Promise.allSettled` pattern — use it.

**Warning signs:** Route response times > 5s in development with a full season of data.

### Pitfall 4: suggestTransfers Returns Empty When Budget Is Unconstrained

**What goes wrong:** Without `sellPrices`, `suggestTransfers` uses `now_cost` for sell value. If the slim snapshot's `now_cost` for the "sell" player is lower than the "buy" player's `now_cost`, the budget check fails even though the user may have had a positive bank at decision time.

**Why it happens:** Bank balance at decision time is not stored in the slim snapshot.

**How to avoid:** Pass a generous bank value (e.g. `bank: 9999`) for post-hoc compute — the goal is to find the best xPts recommendation, not to enforce budget accurately. The delta is about xPts gain, not financial feasibility. Document this in a code comment as an explicit simplification for the post-hoc case.

[ASSUMED — logic derived from suggestTransfers.ts budget check; no existing pattern for post-hoc bank]

### Pitfall 5: Delta Colour Convention Reversed from Captain Regret

**What goes wrong:** In captain regret, `regret > 0` means "model was better" → RED (user lost points). In transfer regret, `delta > 0` means "engine was better" → also RED. The colour convention is the same, but the sign of "good for user" differs between captain (negative regret = user beat model) and transfer (negative delta = user was better). If this gets mixed up, red and green are swapped in the transfer view.

**Why it happens:** The two domains share colour semantics but different field sign conventions.

**How to avoid:** Delta > 0 = engine recommendation would have gained more points than user's action → RED. Delta < 0 = user's action (or hold) was better → GREEN. This matches D-14 exactly.

[VERIFIED: CONTEXT.md D-06, D-07, D-14 + UI-SPEC colour section]

### Pitfall 6: No-Transfer GW Shows Wrong Engine Recommendation

**What goes wrong:** When the user held (no transfer), `gwTransfers` for that GW is empty. `reconstructPreTransferSquad` returns the same squad as the post-transfer picks (no swaps). This is correct — the pre-transfer squad IS the same as the post-transfer squad when no transfer was made. The engine recommendation is therefore the engine's top suggestion for improving that squad.

**Why it happens:** No off-by-one here — this is the intended behaviour (D-05/D-06). The pitfall is incorrectly treating "no transfers found for GW" as a data error rather than a "hold" signal.

**How to avoid:** `isHold = gwTransfers.length === 0`. When `isHold`, set `userSell/userBuy = null`. Delta formula uses the hold variant: `delta = engineIn_pts - engineOut_pts` (D-06).

### Pitfall 7: BackTab Empty State Guard Fires Before Transfer Data Loads

**What goes wrong:** `BackTab` currently guards `if (!data || data.entries.length === 0)` and returns the empty state. If transfer entries are added to the same response object, an early season where captain data exists but transfer data is empty might hit this guard unexpectedly, or the reverse.

**Why it happens:** The early-return guard is currently based on captain entries. Transfer entries will be added to the same response.

**How to avoid:** Keep the captain-data guard exactly as-is. The Transfer view has its own empty state check within `TransferRegretView`: if `transferEntries.length === 0`, render the "No transfer history yet" copy (UI-SPEC §6). Do not entangle the two guards.

---

## Code Examples

### Verified Patterns from Existing Codebase

#### 1. Slim snapshot side-write in run.py (after line 231)

```python
# pipeline/run.py — add after line 231, inside USE_BLOB block
# Source: mirrors captain_snapshots pattern at lines 349-351 [VERIFIED: run.py read]
from transfer_snapshots import write_transfer_slim_snapshot
write_transfer_slim_snapshot(merged, current_gw)
```

#### 2. Pill toggle markup (from GwToggle.tsx pattern)

```tsx
// Source: src/components/gem-table/GwToggle.tsx [VERIFIED: codebase read]
// Adapt for 'captain' | 'transfer' with exact classes from UI-SPEC
<div
  role="group"
  aria-label="Backtester view"
  className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600 mb-4"
>
  {(['captain', 'transfer'] as const).map((v) => (
    <button
      key={v}
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`px-3 py-2 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
        view === v
          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
          : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
      }`}
    >
      {v === 'captain' ? 'Captain' : 'Transfer'}
    </button>
  ))}
</div>
```

#### 3. Bar chart data key for transfer regret

```tsx
// Source: mirrors RegretChart in BackTab.tsx [VERIFIED: codebase read]
// The only change from the captain chart: dataKey="delta" instead of dataKey="regret"
// and fill logic uses delta > 0 / delta < 0 instead of regret
<Bar dataKey="delta" isAnimationActive={false}>
  {entries.map((e, i) => (
    <Cell key={`cell-${i}`} fill={transferRegretFill(e.delta)} />
  ))}
</Bar>
```

#### 4. FPL Transfers endpoint shape (from season-analytics/route.ts)

```typescript
// Source: src/app/api/season-analytics/route.ts [VERIFIED: codebase read]
interface FPLTransferEntry {
  element_in: number
  element_out: number
  event: number
  time?: string
}
// Fetched from: `${FPL_BASE}/entry/${teamId}/transfers/`
// Returns flat array of ALL season transfers — filter by event === gw before use
```

#### 5. localStorage ring buffer extension strategy

```typescript
// Option A (recommended): Extend DecisionHistory type to include transferEntries
// Source: src/lib/types.ts DecisionHistory shape [VERIFIED: codebase read]
// Add to DecisionHistory:
//   transferEntries?: TransferRegretEntry[]
// Advantage: single ring buffer key, single fetch, single cache write
// The existing persistHistory() in regret.ts already serialises the full object
```

---

## Runtime State Inventory

> Transfer regret backtester is a greenfield feature addition, not a rename/refactor. However, a subset of runtime state is relevant to pipeline snapshot availability.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Vercel Blob will receive new `merged_players_slim_gw{N}.json` objects going forward. No existing objects to migrate. | Pipeline must be re-run after deployment for first snapshots to appear. |
| Live service config | None — no n8n workflows or external service config involved | None |
| OS-registered state | None — no scheduled tasks involved | None |
| Secrets/env vars | `USE_BLOB` env var (already in use by existing pipeline) controls whether slim snapshots are uploaded | No change needed — existing env var reused |
| Build artifacts | None — `transfer_snapshots.py` is a new module, no existing artifacts | None |

**Historical data gap:** GWs played before Phase 113 pipeline deployment will have no `merged_players_slim_gw{N}.json` in Blob. These GWs render with `hasSnapshot: false` → "No model snapshot" in Engine column. This is identical to the Phase 96 captain backtester pre-deployment behaviour and is explicitly accepted.

---

## Open Questions

1. **`SlimPlayer` type location: `types.ts` or local to route?**
   - What we know: `SlimPlayer` is only consumed by `readTransferSlimSnapshot` and as the `players` argument to `suggestTransfers` in the API route.
   - What's unclear: `suggestTransfers` accepts `MergedPlayer[]`. `SlimPlayer` is a structural subset — TypeScript structural typing means it should be assignable to `MergedPlayer[]` for the fields `suggestTransfers` actually reads.
   - Recommendation: Define `SlimPlayer` locally in `route.ts` or in `types.ts` as a Pick. Cast to `MergedPlayer[]` where needed with an explicit comment. Avoid adding a new exported type to types.ts unless the planner decides it's needed elsewhere.

2. **Bank value for post-hoc `suggestTransfers()` call**
   - What we know: The slim snapshot does not store the user's bank balance at decision time. CONTEXT.md is silent on this.
   - What's unclear: Using `bank: 0` will cause budget failures for any engine recommendation where `buy.now_cost > sell.now_cost`. Using `bank: 9999` bypasses budget entirely — reasonable for a hindsight tool.
   - Recommendation: Use `bank: 9999` (unconstrained) with a code comment explaining this is the post-hoc simplification. Document as ASSUMED below.

3. **`suggestTransfers` returning multiple suggestions per GW**
   - What we know: `suggestTransfers` returns a sorted array. The best suggestion (index 0) is the engine's primary recommendation. For 2-FT GWs, the top combo (kind='combo') may outrank individual singles.
   - What's unclear: For 2-FT reconstruction, should we take the top combo, or the top two singles?
   - Recommendation: Take `suggestions[0]` (the top result regardless of kind). If `kind === 'combo'`, use the combo's two legs for the Engine column. If `kind === 'single'`, use one leg. This matches D-07 (one row per GW).

4. **`useDecisionHistory` extension: same key or new key for transfer data?**
   - What we know: Transfer entries will be returned by the same `/api/decision-history` endpoint. The API can include both captain and transfer entries in one response.
   - What's unclear: CONTEXT.md discretion area mentions `transferHistory:teamId:{id}` as an alternative to the shared key.
   - Recommendation: Extend the existing `DecisionHistory` type with an optional `transferEntries?: TransferRegretEntry[]` field. This keeps one API call, one cache key, and the existing hook unchanged except for the type extension. The planner should choose.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js API route + TypeScript build | Yes | v25.8.1 | — |
| Python 3 | Pipeline `transfer_snapshots.py` | Yes | 3.11.9 | — |
| vercel_blob (Python) | `upload_json()` in `transfer_snapshots.py` | Yes (already used) | — | `USE_BLOB=false` → local cache only |
| @vercel/blob (npm) | `list()` in API route | Yes (already used) | — | Local `readFile` fallback already coded in `readSnapshot` |
| FPL API public endpoints | `/entry/{id}/transfers/`, `/entry/{id}/event/{gw}/picks/`, `/element-summary/{id}/` | Yes (network) | — | Partial failure → null fields (SC-5 pattern) |
| recharts | Bar chart in TransferRegretView | Yes (already installed) | — | — |
| @tanstack/react-query | useDecisionHistory hook | Yes (already installed) | — | — |
| vitest + @testing-library/react | BackTab.test.tsx extension | Yes (already installed) | — | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/components/accuracy/BackTab.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-02 | Toggle renders "Captain" and "Transfer" buttons | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | Captain view is default; Transfer view appears on toggle click | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | TransferRegretView renders loading state | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | TransferRegretView renders empty state when no snapshots | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | Delta > 0 renders "+Npts (engine better)" with red class | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | Delta < 0 renders "−Npts (good hold)" with green class | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | Hold GW renders "Held — no transfer" in User column | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | No snapshot renders "No model snapshot" in Engine column | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | Season summary text matches D-13 copy | unit | `npx vitest run src/components/accuracy/BackTab.test.tsx` | Wave 0 gap |
| BACK-02 | `computeTransferDelta` pure function unit tests | unit | `npx vitest run src/lib/regret.test.ts` (or new file) | Wave 0 gap |
| BACK-02 | `write_transfer_slim_snapshot` no-ops when USE_BLOB unset | unit (Python) | `python -m pytest pipeline/test_transfer_snapshots.py` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/accuracy/BackTab.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] New `describe` block in `src/components/accuracy/BackTab.test.tsx` — toggle + TransferRegretView tests
- [ ] `computeTransferDelta` tests in `src/lib/regret.test.ts` (or new `src/lib/transfer-regret.test.ts`)
- [ ] `pipeline/test_transfer_snapshots.py` — slim snapshot write + no-op behaviour
- [ ] No new framework install needed — Vitest + jsdom already configured

---

## Security Domain

> `security_enforcement` not explicitly set in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — all FPL fetches use public endpoints (teamId only, no auth cookie) | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes — `teamId` parameter in GET request | Existing regex guard `/^\d+$/` in `decision-history/route.ts` — reuse verbatim |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| teamId injection in API URL | Tampering | Existing `!teamIdParam \|\| !/^\d+$/.test(teamIdParam)` guard — already present, must not be removed |
| Malformed slim snapshot JSON | Tampering | `try/catch` in `readTransferSlimSnapshot` collapses to `null` → no snapshot (D-10 pattern) |
| element-summary SSRF | Tampering | `!/^\d+$/.test(String(elementId))` guard already in `season-analytics/route.ts` — replicate |
| Blob URL traversal | Information Disclosure | `blobs[0].pathname !== filename` exact-match check already in `readSnapshot` — replicate verbatim |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bank: 9999` is the correct post-hoc simplification for `suggestTransfers()` budget parameter | Architecture Patterns (Pattern 3), Open Questions | Engine recommendation changes if budget filtering is stricter — may recommend a different player than it would have at decision time. Impact: minor; the tool is for orientation not precision audit |
| A2 | `SlimPlayer` is structurally assignable to `MergedPlayer[]` for fields read by `suggestTransfers()` — no TS cast errors will arise | Architecture Patterns (Pattern 3) | TypeScript error at compile time if suggestTransfers accesses a MergedPlayer field absent from SlimPlayer. Fix: add any missing fields to SlimPlayer definition |
| A3 | `computeTransferDelta` formula for hold GW is `engineIn_pts - engineOut_pts` (counterfactual) | Architecture Patterns (Pattern 6) | User sees confusing delta values if formula interpretation differs. Verify against CONTEXT.md D-06 before shipping |
| A4 | Extending `DecisionHistory` with optional `transferEntries?: TransferRegretEntry[]` is the right coupling strategy | Open Questions Q4 | If separate hook/key is chosen instead, `useDecisionHistory` remains unchanged but a new hook + API call + cache key must be added |

---

## Sources

### Primary (HIGH confidence)

- `src/app/api/decision-history/route.ts` — captain regret route; canonical pattern for readSnapshot, FPL bootstrap fetch, element-summary fan-out, SC-5 partial-failure handling
- `pipeline/captain_snapshots.py` — canonical slim snapshot module to mirror
- `pipeline/upload.py` — `upload_json()` signature confirmed: `pathname: str, data: list | dict`, always `allowOverwrite=True`
- `pipeline/run.py` lines 225–231, 344–351 — exact insertion points for transfer snapshot side-write
- `src/lib/suggest-transfers.ts` — full 260-line engine read; confirmed `SuggestTransfersParams` shape and `sellValueFor` fallback behaviour
- `src/components/accuracy/BackTab.tsx` — full component read; confirmed recharts imports, colour constants, table classes, loading/error/empty guard pattern, SeasonSummaryHeader, RegretChart structure
- `src/components/accuracy/BackTab.test.tsx` — full test suite read; confirmed vi.mock pattern, entry() factory, test structure
- `src/components/gem-table/GwToggle.tsx` — segmented pill toggle; confirmed exact CSS classes for active/inactive, `role="group"`, `aria-pressed`, `min-h-[44px]`
- `src/lib/types.ts` — confirmed `DecisionHistory`, `RegretEntry`, `MergedPlayer`, `TransferSuggestion`, `SquadPick` shapes
- `src/lib/regret.ts` — confirmed `computeRegret`, `computeSeasonSummary`, `ringBufferKey`, `persistHistory`, `loadCachedHistory`
- `src/lib/hooks/useDecisionHistory.ts` — hook structure confirmed; `placeholderData` pattern, `useEffect` for persistence
- `src/app/api/season-analytics/route.ts` — `fetchTransfers()` pattern confirmed; `FPLTransferEntry` shape with `element_in`, `element_out`, `event`
- `src/lib/squad-adapter.ts` — `SquadPick` type confirmed via Zod schema
- `.planning/phases/96-captain-decision-backtester/96-CONTEXT.md` — BACK-01 blueprint decisions D-05 through D-11
- `.planning/phases/113-transfer-regret-backtester-v1-20/113-CONTEXT.md` — locked decisions D-01 through D-14
- `.planning/phases/113-transfer-regret-backtester-v1-20/113-UI-SPEC.md` — full UI design contract; component inventory, copywriting contract, colour semantics

### Secondary (MEDIUM confidence)

- `vitest.config.ts` — test framework configuration confirmed; environment=jsdom, setupFiles path, @/ alias

### Tertiary (LOW confidence)

- None — all critical claims verified against codebase.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages confirmed present in codebase; no new packages required
- Architecture: HIGH — blueprint sourced directly from Phase 96 BACK-01 and existing route.ts; verified against actual source code
- Pitfalls: HIGH — pitfalls 1–5 derived from direct code inspection; pitfalls 6–7 derived from structural analysis of BackTab
- Transfer delta formula: MEDIUM — formula derived from CONTEXT.md D-06/D-07; not verified against an existing implementation (none exists)

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable — FPL season-end; no fast-moving dependencies)
