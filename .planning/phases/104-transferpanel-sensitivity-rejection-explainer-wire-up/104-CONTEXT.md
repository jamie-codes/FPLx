# Phase 104: TransferPanel Sensitivity & Rejection Explainer Wire-Up - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire rejection reasons (WHY-01) onto the sell side of every OCS row in TransferPanel — always-visible inline below each sell player name, computed by the existing `computeRejection` engine with `lifecycleLabels` threaded into `OpportunityCostTable` as two new props.

SENS-01 is already satisfied by Phase 93's `FragilityBadge` on OCS buy candidates. Phase 104 delivers WHY-01 only: no new fragility work, no visual changes to buy-side indicators.

**Out of scope:** Adding fragility indicators in any new location beyond the OCS table; changing FragilityBadge visual (text badge satisfies SENS-01); showing rejection reasons on squad members outside OCS rows; any new pipeline or API work.

</domain>

<decisions>
## Implementation Decisions

### SENS-01 completeness

- **D-01:** The OCS table's existing `FragilityBadge` (text variant, Phase 93) satisfies SENS-01 in full. Phase 104 does NOT change the visual, does NOT add a new dot/pill component, and does NOT add fragility in any additional location. Phase 104 scope = WHY-01 only.

### WHY-01 — Sell-side rejection reasons display

- **D-02:** Always-visible inline rendering — top rejection reasons render directly below the sell player name in each OCS row. No click, expand, accordion, or toggle required.
- **D-03:** Visual style: `text-xs text-zinc-500 dark:text-zinc-400` — muted, small, matching the general de-emphasised text style used for supplementary info in the table. Distinct from the amber FragilityBadge on the buy side.
- **D-04:** Reason cap: show all reasons returned by `computeRejection`, capped at 4. Use `reasons.slice(0, 4)`. Reasons are already in computeRejection's fixed order (rank → rotation risk → form → fixture → price → fragility → lifecycle → ownership) — slice preserves priority order.
- **D-05:** When `computeRejection` returns `reasons: []` (player is "strong" — above-average gem_score, no fragility, high start_prob, good form), render nothing below the sell name. No positive framing text.

### WHY-01 — Sell candidate scope

- **D-06:** Scope is strictly the OCS suggested sell players — the `t.sell` player in each transfer leg of each OCS row. Do NOT show rejection reasons on squad members outside OCS rows. This preserves ROADMAP SC-3 (recommendation-set-only rendering).
- **D-07:** Multi-leg (combo FT) OCS rows: each sell leg renders its rejection reasons independently, symmetric with how `FragilityBadge` renders per-buy-leg fragility today.

### computeRejection call site

- **D-08:** `computeRejection` is called inside `OpportunityCostTable`'s `PlayerMoveCell`, co-located with the existing `computeFragility` call. Two new props on `<OpportunityCostTable>`:
  ```tsx
  allPlayers: ScoredPlayer[]       // scoredPlayers from TransferPanel
  lifecycleLabels: Map<number, LifecycleLabel>  // lifecycleLabels from TransferPanel
  ```
  TransferPanel passes `{scoredPlayers}` and `{lifecycleLabels}` to `<OpportunityCostTable>` alongside the existing `rows`, `horizon`, `targetGw` props.
- **D-09:** No guard when `lifecycleLabels` is empty (`new Map()` before squad loads). `computeRejection` degrades gracefully — lifecycle reasons simply don't fire. OCS rows with squadData already implicitly guard presence.

### Claude's Discretion

- Exact JSX structure within PlayerMoveCell for the sell-side reason list (e.g., `<ul>` vs stacked `<div>`s, gap spacing)
- Whether to use `data-testid="sell-rejection-reasons"` or a more specific testid per-reason
- Whether to import `computeRejection` directly in OpportunityCostTable or re-export from a shared barrel

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 104 — full success criteria (SC-1 through SC-4), phase notes (pitfall: recommendation-set-only guard), and dependency context
- `.planning/REQUIREMENTS.md` §SENS-01 and §WHY-01 — base requirements

### Engine Code
- `src/lib/explain.ts` — `computeRejection(player, allPlayers, lifecycleLabels)` returning `{ reasons: string[], xPtsRank: number }`; threshold constants; `computeHeadToHead` (not used in Phase 104)
- `src/lib/sensitivity.ts` — `computeFragility` (Phase 93 implementation, already wired into OCS; read-only reference for Phase 104)
- `src/lib/lifecycle-label.ts` — `LifecycleLabel` type and `computeLifecycleLabels` (already called in TransferPanel)

### UI Code
- `src/components/transfers/OpportunityCostTable.tsx` — the primary modification target; `PlayerMoveCell` is where both `computeFragility` (buy side) and new `computeRejection` (sell side) calls live
- `src/components/transfers/TransferPanel.tsx` — prop-threading site; `scoredPlayers` and `lifecycleLabels` useMemos already present; `<OpportunityCostTable>` rendered at line 430
- `src/components/shared/FragilityBadge.tsx` — read-only reference; satisfies SENS-01 already; no changes in Phase 104

### Prior Phase Context
- `.planning/phases/93-sensitivity-analysis-enhancements/93-CONTEXT.md` — FragilityBadge design decisions (D-07 through D-09), OCS call-site pattern (D-11), computeFragility tristate (D-06)
- `.planning/phases/065-rejection-explainer/065-CONTEXT.md` — computeRejection design decisions (D-04 through D-07): fixed reason order, adaptive framing threshold, copywriting contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeRejection` (`src/lib/explain.ts`): already unit-tested, returns `{ reasons: string[], xPtsRank }` with up-to-8 reason strings in fixed priority order. Slice `reasons.slice(0, 4)` for Phase 104 cap.
- `FragilityBadge` (`src/components/shared/FragilityBadge.tsx`): satisfies SENS-01 already; no modification needed.
- `lifecycleLabels` useMemo in `TransferPanel.tsx` (line 82–85): already computed from `squadData`, `scoredPlayers`, `clubFormMap`. Returns `new Map()` when no squad loaded — safe to thread directly.
- `scoredPlayers` useMemo in `TransferPanel.tsx` (line 57–60): the `allPlayers` population for `computeRejection`.

### Established Patterns
- `PlayerMoveCell` in `OpportunityCostTable.tsx` (line 91–122): existing co-location pattern — per-leg `computeFragility` call on `t.buy`, conditional `<FragilityBadge>` render. Phase 104 adds a parallel `computeRejection` call on `t.sell` with conditional reason list below the sell name.
- OCS row iteration: `row.transfers.map((t, i) => ...)` — each transfer leg exposes `t.sell` (ScoredPlayer) and `t.buy` (ScoredPlayer). Both engines operate on these directly.
- `data-testid` conventions: OCS table uses `data-testid="opportunity-cost-table"` and `data-testid="ocs-row-{kind}"`. New sell-side reason element should follow: `data-testid="sell-rejection-reasons"`.

### Integration Points
- `TransferPanel.tsx` line 430: `<OpportunityCostTable rows={ocsRows} horizon={ocsHorizon} targetGw={targetGw ?? undefined} />` — add `allPlayers={scoredPlayers}` and `lifecycleLabels={lifecycleLabels}` here.
- `OpportunityCostTable` props interface: add `allPlayers: ScoredPlayer[]` and `lifecycleLabels: Map<number, LifecycleLabel>` — both imported from `@/lib/types` and `@/lib/lifecycle-label` respectively (already imported by TransferPanel).
- `computeRejection` import in OpportunityCostTable: add `import { computeRejection } from '@/lib/explain'`; `LifecycleLabel` type from `@/lib/lifecycle-label`.

</code_context>

<specifics>
## Specific Ideas

- Reason cap at 4 (not the REQUIREMENTS' "top-2"): user explicitly chose "all reasons up to 4" to give more diagnostic context in the sell cell.
- No "Why?" button, no accordion: always-visible inline. The reasons are supplementary context, not a primary action — showing them inline keeps the table scannable without interaction overhead.
- Each sell leg in a combo row gets independent reason rendering (symmetric with per-leg buy fragility).
- Empty reasons (strong player) → render nothing. No positive framing copy ("No rejection signals...") — the xPts gain column already communicates the rationale.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 104-transferpanel-sensitivity-rejection-explainer-wire-up*
*Context gathered: 2026-05-13*
