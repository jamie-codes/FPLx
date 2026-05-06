# Phase 65: Rejection Explainer - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 65 delivers natural-language "why not?" rejection explanations across three surfaces — GemTable row expand (WHY-01), TransferPanel high-ownership callout (WHY-02), and SquadView row expand (WHY-03) — turning opaque recommendation rankings into auditable, trust-building explanations.

All computation is **client-side only** over existing `MergedPlayer` / `ScoredPlayer` data. No new pipeline fields, no new API routes, no new network requests.

The three surfaces:
1. **WHY-01 (GemTable):** Any row can be expanded to see "why not a transfer target?" — adaptive framing for all players regardless of rank.
2. **WHY-02 (TransferPanel):** A callout above transfer suggestions names top-3 high-ownership (≥20%) players absent from candidates and gives a one-sentence reason each.
3. **WHY-03 (SquadView):** The existing ExplainPanel expand gains a rejection section explaining why the owned player is not recommended to hold or captain.

</domain>

<decisions>
## Implementation Decisions

### GemTable Expand Trigger (WHY-01)

- **D-01:** Change `getRowCanExpand: () => isMobile` → `getRowCanExpand: () => true`. Expand is enabled for **all screen sizes** (desktop + mobile). Same click-row-to-toggle behavior everywhere.
- **D-02:** Desktop expand row shows **only the "why not?" rejection panel**. Hidden column data is already visible on desktop, so it is NOT duplicated in the expand row.
- **D-03:** Mobile expand **adds** the "why not?" rejection panel **below** the existing action-sheet (Compare/Dismiss) + hidden column data. The existing mobile behavior is preserved; rejection panel is appended.

### Rejection Logic — New `computeRejection()` function (WHY-01)

- **D-04:** "Why not?" panel uses **adaptive framing** for all players:
  - Weak/mid-ranked players → rejection reasons (rotation risk, difficult fixture, low xPts rank, fragility flags)
  - Strong players with no rejection signals → "No rejection signals — ranked #X at [position] by xPts"
  - The panel is always visible when a row is expanded; never empty.
- **D-05:** Primary ranking dimension = **`xPts_1gw`**, ranked within position (matching the GemTable default sort column). Rank label: "Ranks #X at [MID/DEF/FWD/GK] by xPts."
- **D-06:** New pure function `computeRejection(player: ScoredPlayer, allPlayers: ScoredPlayer[]): RejectionResult`. Position rank is computed **internally** from `allPlayers` (no pre-computed rank prop). Calling site passes the GemTable's existing `scoredPlayers` useMemo value. Follow the `computeFragility()` pattern in `src/lib/sensitivity.ts` for the exported constants + function signature.
- **D-07:** Rejection signals to cover (in order of presentation): xPts rank within position, start_prob < 0.70 (rotation risk), next-fixture difficulty (medium/hard), any active fragility flags from `computeFragility()`, ownership% as context. Positive framing for the rank signal when no rejections apply.

### SquadView WHY-03 Panel Integration

- **D-08:** Add a new `rejectionReasons: string[]` prop to `ExplainPanel`. The rejection section renders **below** the existing positive reasons and above the replacement shortlist. Section header: "Why not recommended:".
- **D-09:** Captain rejection IS included in the rejection section. If the player is NOT the top captain candidate: "Ranked #X by xPts at [position] — [TopCandidateName] is the captain pick." If the player IS the captain pick: no captain rejection line.
- **D-10:** Thread `verdicts: Map<number, Verdict>` and `captaincyCandidates: ScoredPlayer[]` from TransferPanel → SquadView → ExplainPanel via props. Both already exist as useMemo results in TransferPanel — **no duplicate computation**. SquadView derives the rejection reasons per player from these values plus `computeFragility()`.

### WHY-02 TransferPanel High-Ownership Callout

- **D-11:** Callout renders **above the transfer suggestions**, between the Load Squad form and the OpportunityCostTable. Displayed only when squad is loaded and at least one qualifying player exists.
- **D-12:** For players **already in the user's squad** (most common case): "Already ranked #X at [position] in your squad by xPts — no upgrade needed." For players **not in squad** but absent from candidates: "xPts gain vs your [position] options is negative — not worth transferring in."
- **D-13:** Cap at **top 3 players** by `selected_by_percent` descending. If fewer than 3 qualify, show only those. No "show more" — keep it scannable.
- **D-14:** Callout section header: "Why aren't these players appearing?" with a ℹ️ prefix. Each entry is one line: `[PlayerName] ([X]%): [reason]`.

### Claude's Discretion

- Component name for the WHY-02 callout section (`HighOwnershipCallout`, `AbsentPlayersCallout`, etc.)
- Whether `computeRejection` lives in `src/lib/explain.ts` (alongside `computeExplanations`) or a new `src/lib/rejection.ts`
- Exact threshold for "weak" vs "strong" player framing in adaptive mode (suggest: gem_score < position average → show rejection reasons; gem_score ≥ average → show "no rejection signals + rank")
- Precise string formatting for rank labels (e.g. "Ranks #3 at MID" vs "#3 ranked MID")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 65 — Phase goal, success criteria (5 SCs), and WHY-01/WHY-02/WHY-03 tags
- `.planning/REQUIREMENTS.md` §WHY-01, WHY-02, WHY-03 — requirement definitions (3 requirements)

### Existing Explain Infrastructure (extend, do not replace)
- `src/lib/explain.ts` — `computeExplanations(player)` generates POSITIVE reasons; `computeRejection` should follow the same exported-constants + pure-function pattern
- `src/components/squad/ExplainPanel.tsx` — receives `reasons[]` + `shortlist`; Phase 65 adds `rejectionReasons[]` prop; the new section renders below existing content

### Fragility Engine (Phase 64 — feed into rejection)
- `src/lib/sensitivity.ts` — `computeFragility(player, isTransfer, xPtsGain?)` already implements 3 rejection signals (start_prob < 0.70, harder fixture, hit cost < 4.0); rejection function should call this rather than re-implement
- `.planning/phases/064-sensitivity-analysis/064-CONTEXT.md` — D-04 through D-12 define fragility thresholds

### GemTable (WHY-01 entry point)
- `src/components/gem-table/GemTable.tsx` — `getRowCanExpand: () => isMobile` is the line to change (D-01); mobile expand row at line ~214; desktop expand row needs new branch
- `src/components/gem-table/columns.tsx` — column definitions; check if cell renderer needs any changes for desktop expand

### SquadView (WHY-03 entry point)
- `src/components/squad/SquadView.tsx` — `expandedIds` + `toggleExpand` already in place; ExplainPanel called at line ~229; prop threading for `verdicts` and `captaincyCandidates` lands here
- `src/components/squad/ExplainPanel.tsx` — file to modify: add `rejectionReasons` prop and new section

### TransferPanel (WHY-02 callout + WHY-03 prop source)
- `src/components/transfers/TransferPanel.tsx` — `computeTransferSuggestions`, `suggestTransfers`, `captaincyCandidates`, and `scoredPlayers` all available as useMemo; WHY-02 callout inserts above OpportunityCostTable render
- `src/lib/suggest-transfers.ts` — `suggestTransfers()` is the transfer candidates source; absence from its output = "not recommended"

### Recommendation Engine (verdict thresholds)
- `src/lib/recommend.ts` — `computeVerdicts()`, `BUY_THRESHOLD = 1.0`, `SELL_THRESHOLD = 0.90`, `computePositionAverages()`; verdict determines hold/sell rejection signal in WHY-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeFragility()` (`src/lib/sensitivity.ts`) → call directly from `computeRejection()`; already covers start_prob, fixture difficulty, hit cost
- `computeExplanations()` (`src/lib/explain.ts`) → positive reasons already rendered; rejection function is the negative counterpart; share the threshold constants (START_PROB_LOW = 0.65, EASY_FIXTURE_MIN, etc.)
- `ExplainPanel` (`src/components/squad/ExplainPanel.tsx`) → add `rejectionReasons?: string[]` prop; render below existing `<ul>` of reasons; use same `text-xs text-zinc-600` styling
- `computeVerdicts()` + `computePositionAverages()` (`src/lib/recommend.ts`) → verdict already computed in TransferPanel; thread to SquadView; position averages needed inside `computeRejection()`
- `captaincyCandidates` (`src/lib/captaincy-engine.ts`) → already computed as useMemo in TransferPanel; thread to SquadView for captain rank derivation

### Established Patterns
- Mobile expand row: `{row.getIsExpanded() && (<tr className="bg-blue-50 dark:bg-blue-950 sm:hidden">...` — add a DESKTOP counterpart without `sm:hidden`
- `Fragment` per row in GemTable tbody — already in place; new desktop expand row slots in as a second sibling `<tr>`
- Prop threading pattern: see how `exactSellPrices` flows TransferPanel → SquadView; follow same pattern for `verdicts` and `captaincyCandidates`
- `selected_by_percent` is a **string** in `MergedPlayer` (parseFloat needed — see recommend.ts Pitfall comment)

### Integration Points
- `GemTable.tsx`: `getRowCanExpand` change + new desktop expand row in tbody (after existing mobile expand row)
- `TransferPanel.tsx`: render `<HighOwnershipCallout>` (or equivalent) above `<OpportunityCostTable>`; derive absent high-ownership players from `scoredPlayers`, `squadData.picks`, and `suggestTransfers` output
- `SquadView.tsx`: receive `verdicts` + `captaincyCandidates` props → pass to ExplainPanel per player row; compute per-player rejectionReasons inline (or via helper) using verdict + fragility + captain rank
- `ExplainPanel.tsx`: add `rejectionReasons?: string[]` prop → render `<div>` block with header "Why not recommended:" if array is non-empty

</code_context>

<specifics>
## Specific Ideas

- WHY-02 callout copy: "Why aren't these players appearing?" with ℹ️ icon — keep the tone informational not alarming
- Example rejection copy (from ROADMAP.md): "Salah: already ranked #1 in your squad by xPts — no upgrade available at position" — use this phrasing as the template
- For the "No rejection signals" adaptive framing: "No rejection signals — ranked #3 at MID by xPts (7.2 pts projected)" gives the user a positive anchor even on a strong player
- Captain rejection copy: "Ranked #2 at MID by xPts — Salah is the captain pick" (name the top candidate explicitly)
- Use `parseFloat(player.selected_by_percent)` not direct comparison — `selected_by_percent` is a string field

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 65-Rejection Explainer*
*Context gathered: 2026-05-06*
