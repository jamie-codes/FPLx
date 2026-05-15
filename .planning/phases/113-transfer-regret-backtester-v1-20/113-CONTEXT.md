# Phase 113: Transfer Regret Backtester (v1.20) - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 113 delivers BACK-02: the Transfer Regret Backtester. It adds:

1. **Pipeline**: per-GW slim player snapshot — `merged_players_slim_gw{N}.json` side-written to Vercel Blob at pipeline run time (mirrors the `captain_picks_gw{N}.json` pattern from Phase 96)
2. **API extension**: `/api/decision-history` extended to return transfer regret entries alongside the existing captain regret data — TypeScript post-hoc compute (no Python port)
3. **BackTab toggle**: "Captain | Transfer" segmented pill toggle added to the top of BackTab; Captain is the default view
4. **TransferRegretView**: season summary header + recharts bar chart + per-GW rows; appears when user selects the Transfer toggle

**Out of scope:** BACK-03 (full transfer ROI tracker requiring multi-GW persistent transfer history store), new sub-tab in AccuracyTab nav, Python port of suggestTransfers, any engine changes.

</domain>

<decisions>
## Implementation Decisions

### Snapshot Strategy (TypeScript post-hoc compute)

- **D-01:** Transfer recommendations are computed **post-hoc in TypeScript** by `/api/decision-history`. No Python pipeline port of `suggestTransfers`. The API reads the per-GW slim player snapshot from Blob, reconstructs the user's pre-transfer squad, and runs `suggestTransfers()` from `src/lib/suggest-transfers.ts`.

- **D-02:** Pipeline side-writes **`merged_players_slim_gw{N}.json`** to Vercel Blob each run (when `USE_BLOB=true`). This is a slim projection of `merged_players.json` containing only the fields `suggestTransfers()` needs: `id`, `element_type`, `web_name`, `now_cost`, `selected_by_percent`, `xPts_1gw`, `xPts_3gw`. Target size ~50–75 KB per GW (~2.5 MB for a full season). Implementation mirrors `captain_snapshots.py` — a new `pipeline/transfer_snapshots.py` module.

- **D-03:** To run `suggestTransfers()` post-hoc, the API **reconstructs the pre-transfer squad** from the user's post-transfer picks + FPL event_transfers. Concretely: fetch `/entry/{teamId}/event/{gw}/picks/` (post-transfer squad) and `/entry/{teamId}/transfers/` (element_in, element_out per GW), then swap element_in → element_out to recover the pre-transfer lineup. This is the squad state the engine would have seen at decision time.

### No-Transfer GW Handling

- **D-04:** **All settled GWs are shown** — every finished GW gets a row in the Transfer Regret table, regardless of whether the user transferred. No rows are hidden.

- **D-05:** When the user held (no transfer that GW), the "User" column shows **"Held — no transfer"**. The Engine column still shows the engine's top recommendation (what it would have suggested). The Delta column shows the counterfactual gain/loss from that recommendation.

- **D-06:** **Hold delta formula**: `delta = engine_IN.actual_pts − engine_OUT.actual_pts`. Positive = engine was right, user left points on the table by holding. Negative = user was correct to hold (the recommended swap would have lost points).

- **D-07:** **Multi-transfer GWs (2-FT)**: one row per GW. `delta = Σ(engine swap gains) − Σ(user swap gains)`. The Engine and User columns show compressed representations (e.g. "Sell X buy Y + Sell A buy B"). No per-leg sub-rows.

### BackTab Layout

- **D-08:** BackTab gains a **"Captain | Transfer" segmented pill toggle** at the top of the component. This is the first control in BackTab (above the summary header). Reuses the segmented pill pattern from `src/components/gem-table/GwToggle.tsx` or `PresetToggle`.

- **D-09:** **Default view on BackTab mount = Captain**. Preserves existing BACK-01 behaviour. The Transfer view is one click away but is not shown first. Toggle state is component-local `useState<'captain' | 'transfer'>('captain')` inside BackTab — resets to Captain on re-mount (consistent with D-04 from Phase 96 CONTEXT.md).

- **D-10:** Each toggle view is **fully self-contained**: own summary header + bar chart + per-GW rows. No shared chrome between Captain and Transfer views (each has its own cumulative stats relevant to its domain).

### Regret Visualisation

- **D-11:** Transfer Regret view layout: **season summary header → recharts bar chart → per-GW detail rows**. Matches the captain regret layout from Phase 96 D-05 exactly. Reuses the existing `BarChart` setup in `BackTab.tsx`.

- **D-12:** Per-GW row columns:
  - **GW** — gameweek number
  - **Engine** — "Sell [PlayerOut] buy [PlayerIn]" with actual GW pts in brackets, e.g. "Sell Isak (3pts) buy Salah (12pts)"
  - **User** — "Sell [PlayerOut] buy [PlayerIn]" or "Held — no transfer"
  - **Delta** — signed value with colour + label: e.g. `+8.0 pts (engine better)` or `−2.0 pts (good hold)`

- **D-13:** Season summary header text: `"Total transfer regret: {X} pts across {N} GWs | Engine better: {N} | You better: {N} | Tied: {N}"`. Matches the captain summary header pattern from Phase 96 D-07. "Tied" = delta of 0.

- **D-14:** Bar chart colour convention matches BACK-01 (reuse existing constants): positive delta (engine was better) → red (`#ef4444`); negative delta (user was better) → green (`#22c55e`); no-data (no snapshot for GW) → grey (`rgba(161,161,170,0.5)`).

### Claude's Discretion

- Exact field selection and ordering in `merged_players_slim_gw{N}.json` (must include at minimum: `id`, `element_type`, `web_name`, `now_cost`, `selected_by_percent`, and all `xPts_*` fields used by `suggestTransfers`)
- How to handle GWs where `merged_players_slim_gw{N}.json` doesn't exist yet (early GWs before Phase 113 is deployed) — empty/null engine column, consistent with D-10 from Phase 96 CONTEXT.md ("No snapshot" placeholder)
- Column widths and responsive behaviour of per-GW rows
- Whether `computeTransferRegret()` lives in `src/lib/regret.ts` (alongside existing `computeRegret`) or a new `src/lib/transfer-regret.ts`
- `/api/decision-history` response shape for transfer entries (beyond what types dictate)
- Horizon passed to `suggestTransfers()` for post-hoc compute — default to 1GW (`xPts_1gw`) for now, matching typical transfer planning horizon

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 113: Transfer Regret Backtester" — full goal, success criteria (SC-1 through SC-4), phase notes (including "do NOT use future GW data for retroactive recommendations")
- `.planning/REQUIREMENTS.md` §BACK-02 — requirement text

### Phase 96 BACK-01 Pattern (MUST READ — this phase mirrors it)
- `.planning/phases/96-captain-decision-backtester/96-CONTEXT.md` — all D-* decisions that Phase 113 extends or mirrors; especially D-05/D-07/D-10/D-11 (BackTab layout, summary header, no-snapshot placeholder, empty state)

### Pipeline — Slim Snapshot (MUST READ)
- `pipeline/captain_snapshots.py` — canonical module pattern; Phase 113 creates `pipeline/transfer_snapshots.py` mirroring this exactly
- `pipeline/upload.py` — `upload_json()` signature and `allowOverwrite` behaviour
- `pipeline/run.py` lines 225–231 — where `merged_players` is produced (Phase 113 slim-snapshot side-write goes immediately after line 231, inside the `USE_BLOB=true` guard)
- `pipeline/run.py` lines 344–351 — Phase 96 captain snapshot side-write; identical structure for Phase 113 transfer snapshot

### API — Decision History Extension (MUST READ)
- `src/app/api/decision-history/route.ts` — existing captain regret route; Phase 113 extends the response to include transfer regret entries
- `src/app/api/gw-review/route.ts` lines 99–119 — FPL authenticated picks fetch pattern

### Transfer Engine (MUST READ)
- `src/lib/suggest-transfers.ts` — 260-line TypeScript suggestTransfers engine; Phase 113 imports and runs this post-hoc in the API route

### BackTab Component (MUST READ)
- `src/components/accuracy/BackTab.tsx` — full component; Phase 113 adds Captain | Transfer toggle and a TransferRegretView section
- `src/components/accuracy/BackTab.test.tsx` — existing test suite; new toggle and transfer view tests extend here

### Existing Patterns
- `src/components/gem-table/GwToggle.tsx` — segmented pill toggle pattern for "Captain | Transfer" nav
- `src/lib/hooks/useDecisionHistory.ts` — existing hook; extend for transfer data
- `src/lib/types.ts` — add `TransferRegretEntry`, `TransferDecisionHistory` types here
- `src/lib/regret.ts` — existing `computeRegret` utility; Phase 113 adds `computeTransferRegret` (or new file)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `suggestTransfers()` in `src/lib/suggest-transfers.ts` (260 lines) — Phase 113 runs this directly from the API route. Import as a server-side module (no `'use client'` directive — already safe for Node).
- `upload_json(filename, data)` in `pipeline/upload.py` — the one-call side-write pattern; Phase 113 reuses for `merged_players_slim_gw{N}.json`.
- `BarChart`, `Cell`, `XAxis`, `YAxis`, `ReferenceLine`, `Tooltip`, `ResponsiveContainer` — already imported in `BackTab.tsx`; transfer regret bar chart reuses these without new imports.
- `REGRET_RED` / `REGRET_GREEN` / `REGRET_GREY` constants in `BackTab.tsx` — reuse verbatim for transfer regret colour coding.
- `computeSeasonSummary()` in `src/lib/regret.ts` — review whether it can be generalised for transfer regret or whether a separate `computeTransferSeasonSummary()` is cleaner.
- `useDecisionHistory()` hook in `src/lib/hooks/useDecisionHistory.ts` — extend the hook (or its response type) to carry transfer regret entries alongside captain regret entries.

### Established Patterns
- **Blob read for per-GW files**: `list({ prefix: filename, limit: 1 })` + `fetch(blobs[0].url)` — used by `readSnapshot()` in decision-history route; identical pattern for `readTransferSlimSnapshot(gw)`.
- **No-snapshot placeholder**: Phase 96 D-10 — row still renders with "No model snapshot" per GW; Phase 113 follows same pattern when `merged_players_slim_gw{N}.json` doesn't exist.
- **Empty state (zero data)**: Phase 96 D-11 — single message, no loading skeleton; reuse for Transfer view when no slim snapshots exist yet.
- **Dark mode**: all new Tailwind classes need `.dark:` variants.
- **localStorage ring buffer**: `decisionHistory:teamId:{id}` — already managed by `useDecisionHistory`; transfer data can share the same cache key if included in the response shape, or use `transferHistory:teamId:{id}` if kept separate.

### Integration Points
- `pipeline/run.py` — add `write_transfer_slim_snapshot(merged, current_gw)` call after line 231 (inside USE_BLOB guard), mirroring Phase 96's `write_captain_snapshot` call at line 350
- `src/app/api/decision-history/route.ts` — add `readTransferSlimSnapshot(gw)` + post-hoc `suggestTransfers()` call + `computeTransferRegret()` per GW; return alongside existing captain entries
- `src/components/accuracy/BackTab.tsx` — add `useState<'captain' | 'transfer'>('captain')` toggle, pill nav, and conditional rendering of TransferRegretView
- `src/lib/types.ts` — add `TransferRegretEntry` (gw, engineSell, engineBuy, enginePts, userSell, userBuy, userPts, delta, isHold) and `SlimPlayer` (fields needed by suggestTransfers post-hoc)

</code_context>

<specifics>
## Specific Ideas

- The "Captain | Transfer" pill nav sits at the top of BackTab — the very first visual element before the summary header. When on Captain view, the user sees exactly what they see today. When on Transfer, they see the transfer regret summary/chart/rows.
- For the hold delta, positive means "engine was right — you left X pts on the table by not transferring." Negative means "good hold — the engine's pick would have cost you X pts." This is the key insight managers care about most.
- Multi-transfer GWs (2-FT): compress to one row, show net delta. The engine may have recommended a different 2-FT pair than the user made — the net comparison is what matters, not per-leg alignment.
- The slim snapshot approach means Phase 113 won't have historical data for GWs before the pipeline is redeployed. This is fine and expected — matches the Phase 96 captain snapshot pattern exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 113-transfer-regret-backtester-v1-20*
*Context gathered: 2026-05-15*
