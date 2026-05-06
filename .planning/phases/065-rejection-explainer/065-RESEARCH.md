# Phase 65: Rejection Explainer - Research

**Researched:** 2026-05-06
**Domain:** Pure TypeScript client-side computation over existing MergedPlayer/ScoredPlayer data; React component extension (GemTable, ExplainPanel, SquadView, TransferPanel)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: `getRowCanExpand: () => true` — expand enabled for all screen sizes (desktop + mobile)
- D-02: Desktop expand row shows rejection panel ONLY — hidden column data not duplicated
- D-03: Mobile expand APPENDS rejection panel below existing action-sheet + hidden columns
- D-04: Adaptive framing — strong players get "No rejection signals" positive framing; weak players get rejection reasons
- D-05: Primary ranking dimension = `xPts_1gw` within position
- D-06: `computeRejection(player: ScoredPlayer, allPlayers: ScoredPlayer[]): RejectionResult` — pure function following `computeFragility()` pattern
- D-07: Rejection signals order: xPts rank, start_prob < 0.70, fixture difficulty, fragility flags, ownership% context
- D-08: Add `rejectionReasons: string[]` prop to ExplainPanel; section renders below positive reasons; header: "Why not recommended:"
- D-09: Captain rejection included — names top candidate explicitly if player is not #1
- D-10: Thread `verdicts: Map<number, Verdict>` and `captaincyCandidates: ScoredPlayer[]` from TransferPanel → SquadView → ExplainPanel via props
- D-11: WHY-02 callout above OpportunityCostTable
- D-12: In-squad vs not-in-squad copy variants
- D-13: Cap at top 3 by `selected_by_percent` descending
- D-14: "Why aren't these players appearing?" header with ℹ️

### Claude's Discretion
- Component name for WHY-02 callout (`HighOwnershipCallout` resolved in UI-SPEC)
- Whether `computeRejection` lives in `src/lib/explain.ts` or new file (resolved: `explain.ts`)
- Adaptive framing threshold (resolved: `gem_score >= positionAverage.gem_score` AND no fragility AND `start_prob >= 0.70`)
- Precise string formatting for rank labels (resolved in UI-SPEC Copywriting Contract)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WHY-01 | User can expand any GemTable row and read a "why not?" explanation covering ownership%, xPts ranking, start probability, fixture difficulty, and any active fragility flag | `computeRejection()` in `explain.ts` + new desktop expand row branch in `GemTable.tsx`; `getRowCanExpand: () => true` change at line 114 |
| WHY-02 | TransferPanel shows a dedicated callout for any player with >20% ownership absent from transfer candidates — naming the player and giving a one-sentence reason | `HighOwnershipCallout` component inserted above `OpportunityCostTable`; derives absent players from `scoredPlayers`, `squadData.picks`, and `suggestTransfers` output already in scope |
| WHY-03 | Squad view row expand explains why an owned player is not recommended to hold or captain — distinguishing "below xPts threshold", "rotation risk", "difficult fixture", "fragile recommendation" | `rejectionReasons?: string[]` prop on `ExplainPanel`; new rejection section below positive reasons; `verdicts` + `captaincyCandidates` threaded from TransferPanel |
</phase_requirements>

---

## Summary

Phase 65 extends three existing surfaces with natural-language "why not?" explanations, all computed client-side from data already in memory. No new API routes, no pipeline changes, no new data fields. The computation model is a pure function `computeRejection()` that mirrors the existing `computeExplanations()` pattern in `src/lib/explain.ts`, calling into the already-shipped `computeFragility()` from `src/lib/sensitivity.ts` rather than re-implementing fragility logic.

The three surfaces have distinct integration points: WHY-01 requires a `getRowCanExpand` change plus a new desktop expand row branch in GemTable (the mobile path already exists at line 214); WHY-02 requires a new `HighOwnershipCallout` component inserted between the Load Squad form and `OpportunityCostTable` in TransferPanel; WHY-03 requires adding a `rejectionReasons?: string[]` prop to `ExplainPanel` plus threading `verdicts` and `captaincyCandidates` as props through SquadView. The captain-rank derivation for WHY-03 uses the already-computed `captaincyCandidates` array sorted by `projected_captain_pts` descending — rank is the 0-based index of the player in that array.

The UI-SPEC is fully resolved and locked. All copy, typography, colour, spacing, and adaptive-framing threshold decisions are in `065-UI-SPEC.md`. The planner can work directly from the UI-SPEC without further design decisions.

**Primary recommendation:** Implement in three plans across two waves — Wave 0: `computeRejection()` pure function + tests; Wave 1 parallel: GemTable WHY-01 expand + ExplainPanel/SquadView WHY-03 prop threading + TransferPanel WHY-02 callout.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rejection reason computation | Client (lib) | — | Pure TS function over in-memory ScoredPlayer; no server involvement |
| GemTable desktop expand row | Client (component) | — | UI branch in existing tbody Fragment pattern |
| GemTable mobile expand row | Client (component) | — | Existing row preserved; rejection panel appended |
| WHY-02 callout rendering | Client (component) | — | Derived from TransferPanel's existing scoredPlayers + suggestTransfers useMemo |
| WHY-02 absence detection | Client (lib/inline) | — | Set difference: high-ownership players minus suggestTransfers output buy IDs |
| WHY-03 rejection section | Client (component) | — | ExplainPanel prop extension; reasons computed in SquadView |
| Prop threading (verdicts, captaincyCandidates) | Client (component chain) | — | TransferPanel → SquadView → ExplainPanel; no new hooks or API calls |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x (Next.js 16) | Component rendering | Project baseline |
| TypeScript | 5.x | Pure function typing | Project baseline |
| Tailwind CSS v4 | 4.x | Styling | Project baseline; UI-SPEC uses Tailwind classes throughout |
| Vitest | 4.x (inferred from config) | Unit testing | Established test runner; `vitest run` in package.json |
| @tanstack/react-table | 8.x | GemTable expand state | Already used; `getRowCanExpand` is a TanStack Table option |

[VERIFIED: codebase grep — all dependencies confirmed in GemTable.tsx, sensitivity.test.ts, vitest.config.ts]

### No new dependencies required
Phase 65 is purely additive over existing infrastructure. No `npm install` step needed.

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks GemTable row (all sizes)
        │
        ▼
getRowCanExpand: () => true   [change from () => isMobile]
        │
        ├── Desktop: new <tr> (not sm:hidden) → RejectionPanel component
        │         computeRejection(player, scoredPlayers)
        │                │
        │                ├── xPts rank within position (sorted by xPts_1gw)
        │                ├── computeFragility(player, false) → fragility flags
        │                ├── start_prob check (< 0.70)
        │                ├── fixtures[0].difficulty_tier check
        │                └── selected_by_percent (ownership context)
        │
        └── Mobile: existing <tr sm:hidden> preserved
                  action-sheet + hidden columns remain
                  RejectionPanel appended below dl

TransferPanel (squad loaded)
        │
        ├── scoredPlayers (useMemo — existing)
        ├── squadData.picks (existing)
        ├── suggestTransfers output (existing ocsSuggestions useMemo)
        │
        ▼
HighOwnershipCallout [new component]
        │
        Filter: selected_by_percent > 20%
        Exclude: players in suggestTransfers buy IDs
        Cap: top 3 by selected_by_percent desc
        Copy variant: in-squad vs not-in-squad
        │
        Renders ABOVE OpportunityCostTable
        │
        ▼ (also threads props down)
SquadView (receives verdicts + captaincyCandidates as new props)
        │
        Per-player rejection reasons computed inline:
        │   computeFragility(player, false) → fragility reasons
        │   verdicts.get(player.id) → 'sell' / 'hold'
        │   captaincyCandidates index → captain rank
        │
        ▼
ExplainPanel (new rejectionReasons?: string[] prop)
        │
        Renders: positive reasons (existing)
        Renders: "Why not recommended:" section (new, below positive)
        Renders: replacement shortlist (existing, below rejection)
```

### Recommended Project Structure

No new directories required. New/modified files:

```
src/
├── lib/
│   └── explain.ts               # Add computeRejection() + RejectionResult type + export constants
├── components/
│   ├── gem-table/
│   │   └── GemTable.tsx         # getRowCanExpand + desktop expand row + mobile append
│   ├── squad/
│   │   ├── ExplainPanel.tsx     # rejectionReasons?: string[] prop + new section
│   │   └── SquadView.tsx        # verdicts + captaincyCandidates props + per-player rejection compute
│   └── transfers/
│       ├── TransferPanel.tsx    # HighOwnershipCallout insertion + prop threading to SquadView
│       └── HighOwnershipCallout.tsx   # new component (WHY-02)
```

### Pattern 1: computeRejection — pure function following computeFragility() pattern

**What:** Exported pure function + `RejectionResult` type + exported threshold constants in `src/lib/explain.ts`.

**When to use:** Called by GemTable for every expanded row (scoredPlayers useMemo passed in). Called by SquadView per starting-XI player for WHY-03 reasons.

**Example:**
```typescript
// Source: src/lib/sensitivity.ts pattern + 065-CONTEXT.md D-06
export interface RejectionResult {
  reasons: string[]   // empty when no rejection signals (adaptive positive framing)
  xPtsRank: number    // 1-based rank within position by xPts_1gw
}

export const REJECTION_START_PROB_THRESHOLD = 0.70  // matches computeFragility()
export const REJECTION_OWNERSHIP_THRESHOLD = 20.0   // WHY-02 gate

export function computeRejection(
  player: ScoredPlayer,
  allPlayers: ScoredPlayer[],
): RejectionResult {
  // 1. Rank within position by xPts_1gw (D-05)
  const samePosition = allPlayers
    .filter(p => p.element_type === player.element_type)
    .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
  const xPtsRank = samePosition.findIndex(p => p.id === player.id) + 1

  // 2. Adaptive framing threshold (UI-SPEC §Adaptive Framing Threshold)
  const positionAverages = computePositionAverages(allPlayers)
  const posAvg = positionAverages.get(player.element_type) ?? 0.5
  const fragility = computeFragility(player, false)  // isTransfer=false for ranking context

  if (
    player.gem_score >= posAvg &&
    fragility.reasons.length === 0 &&
    player.start_prob >= REJECTION_START_PROB_THRESHOLD
  ) {
    // Positive framing — no rejection reasons
    return { reasons: [], xPtsRank }
  }

  const reasons: string[] = []
  // D-07 signal order: rank, start_prob, fixture, fragility, ownership
  reasons.push(`Ranked #${xPtsRank} at ${POSITION_CODES[player.element_type]} by xPts`)
  if (player.start_prob < REJECTION_START_PROB_THRESHOLD) {
    reasons.push(`Rotation risk — start probability ${Math.round(player.start_prob * 100)}%`)
  }
  // fixture difficulty via computeFragility (already computed above)
  // ownership context (always last)
  reasons.push(`Owned by ${Math.round(parseFloat(player.selected_by_percent))}% of managers`)

  return { reasons, xPtsRank }
}
```

[VERIFIED: pattern confirmed from src/lib/sensitivity.ts and src/lib/explain.ts read]

### Pattern 2: GemTable expand row — Fragment sibling pattern

**What:** The existing mobile expand row is a `<tr className="bg-blue-50 dark:bg-blue-950 sm:hidden">`. A desktop expand row is a sibling `<tr>` that is NOT `sm:hidden` — it shows on all sizes ≥ sm, while the mobile row shows only on mobile.

**When to use:** Adding the desktop expand row inside the existing `{row.getIsExpanded() && (...)}` block, after the existing mobile row.

**Example:**
```typescript
// Source: GemTable.tsx line 214 (existing mobile row) + D-02/D-03 CONTEXT.md
{row.getIsExpanded() && (
  <>
    {/* EXISTING mobile expand row — preserved unchanged */}
    <tr className="bg-blue-50 dark:bg-blue-950 sm:hidden">
      <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
        {/* action-sheet + hidden columns dl + rejection panel appended (D-03) */}
      </td>
    </tr>
    {/* NEW desktop expand row — rejection panel only (D-02) */}
    <tr className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row">
      <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
        {/* rejection panel only */}
      </td>
    </tr>
  </>
)}
```

[VERIFIED: GemTable.tsx line 214 read; Tailwind `hidden sm:table-row` is the correct pattern for show-on-desktop]

### Pattern 3: Rejection panel markup (shared, from UI-SPEC)

**What:** The rejection panel renders either positive framing or a list of rejection reasons.

**Example:**
```tsx
// Source: 065-UI-SPEC.md §WHY-01 Component Specifications
// Positive framing (no rejection signals):
<p className="text-xs text-green-700 dark:text-green-400">
  No rejection signals — ranked #X at {POS} by xPts ({Y.Y} pts projected)
</p>

// Rejection reasons list:
<div className="mt-2 space-y-1">
  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why not recommended:</p>
  <ul className="space-y-0.5">
    {rejectionLines.map((line, i) => (
      <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">{line}</li>
    ))}
  </ul>
</div>
```

[VERIFIED: 065-UI-SPEC.md §Component Specifications]

### Pattern 4: WHY-02 absence detection

**What:** Identify high-ownership players absent from suggestTransfers output. The buy IDs from `ocsSuggestions` form the "present" set. High-ownership players (>20%) not in squad AND not in buy IDs are absent candidates.

**Example:**
```typescript
// Source: 065-CONTEXT.md D-11/D-12/D-13 + TransferPanel.tsx existing useMemos
const highOwnershipAbsent = useMemo(() => {
  if (!squadData || scoredPlayers.length === 0) return []
  const squadIds = new Set(squadData.picks.map(p => p.element))
  const suggestedBuyIds = new Set(
    ocsSuggestions.flatMap(s =>
      s.kind === 'single' ? [s.buy.id] : s.transfers.map(t => t.buy.id)
    )
  )
  return scoredPlayers
    .filter(p => parseFloat(p.selected_by_percent) > 20)
    .filter(p => !suggestedBuyIds.has(p.id))
    .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
    .slice(0, 3)
    .map(p => ({
      player: p,
      inSquad: squadIds.has(p.id),
      // rank within position for in-squad variant
    }))
}, [squadData, scoredPlayers, ocsSuggestions])
```

[VERIFIED: TransferPanel.tsx useMemo pattern + CONTEXT.md D-12/D-13]

### Pattern 5: Prop threading — exactSellPrices precedent

**What:** `exactSellPrices` already flows from TransferPanel → SquadView via props. The same pattern applies to `verdicts` and `captaincyCandidates`.

**Current SquadView props:**
```typescript
interface SquadViewProps {
  picks: SquadPick[]
  allPlayers: ScoredPlayer[]
  entryHistory: EntryHistory
  labels?: Map<number, LifecycleLabel>
  exactSellPrices?: Map<number, number>
  isAuthenticated?: boolean
  // Phase 65 additions:
  verdicts?: Map<number, Verdict>
  captaincyCandidates?: ScoredPlayer[]
}
```

[VERIFIED: SquadView.tsx interface read + TransferPanel.tsx SquadView render call read]

### Anti-Patterns to Avoid

- **Re-implementing fragility logic in computeRejection:** Call `computeFragility(player, false)` directly. The `isTransfer=false` parameter skips the hit-cost check (correct for ranking context — no transfer is involved). [VERIFIED: sensitivity.ts D-09/D-10]
- **Using `selected_by_percent` as a number directly:** It is a `string` field on `MergedPlayer`. Always `parseFloat(player.selected_by_percent)` before comparison. [VERIFIED: types.ts line 15; recommend.ts comment; explain.ts line 67]
- **Blocking desktop row click on the data row itself:** The existing `onClick` on `<tr>` only fires when `isMobile`. For desktop, row click should also toggle expand (D-01 says all screen sizes). The `onClick` condition must change from `if (isMobile) row.toggleExpanded()` to unconditional `row.toggleExpanded()` — but the action-sheet state setter `setActionSheetPlayer` should remain mobile-only. [VERIFIED: GemTable.tsx line 193-199]
- **Threading captaincyCandidates as CaptaincyCandidate[] instead of ScoredPlayer[]:** The WHY-03 needs the player's xPts_1gw for captain rank derivation. `CaptaincyCandidate` already wraps `player: ScoredPlayer`. Extract the `.player` array OR thread `CaptaincyCandidate[]` and access `.player` in SquadView. Either works; using the raw `CaptaincyCandidate[]` avoids an extra map operation and preserves the sort order (already sorted by `projected_captain_pts` desc). [VERIFIED: captaincy-engine.ts line 95-97]
- **Computing position rank from the wrong pool:** WHY-01 calls `computeRejection(player, scoredPlayers)` where `scoredPlayers` is the GemTable's full `useMemo` population. WHY-03 calls it with `allPlayers` from SquadView's props (same population). These must be consistent.
- **`gem_score` not available on MergedPlayer:** It is only on `ScoredPlayer`. The `computeRejection` signature takes `ScoredPlayer` (D-06), so `gem_score` is available. GemTable works with `scoredPlayers` (ScoredPlayer[]). SquadView receives `allPlayers: ScoredPlayer[]`. No cast needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fragility signal detection | Custom start_prob/fixture checks | `computeFragility(player, false)` in `sensitivity.ts` | Already correct, tested with 7 cases; re-implementing creates inconsistency |
| Position averages | Custom average loop | `computePositionAverages(allPlayers)` from `recommend.ts` | Already exported, handles empty positions with 0.5 fallback |
| Positive reasons list | Duplicate computeExplanations | `computeExplanations(player)` already called in SquadView line 221 | Share the call; rejection reasons go to the new prop |
| Captain rank | Sorting captaincyCandidates manually | Thread `captaincyCandidates` array (already sorted by projected_captain_pts desc) | Rank = `candidates.findIndex(c => c.player.id === player.id)` |

**Key insight:** This phase is almost entirely composition of existing pure functions. The only genuinely new logic is `computeRejection()` itself — and even that is ~30 lines delegating to `computeFragility()` and `computePositionAverages()`.

---

## Common Pitfalls

### Pitfall 1: GemTable onClick condition
**What goes wrong:** Changing `getRowCanExpand: () => true` enables expand for all rows, but the `onClick` on `<tr>` (line 193) only calls `row.toggleExpanded()` inside `if (isMobile)`. Desktop rows silently do nothing when clicked.
**Why it happens:** The original code gated expand on mobile only; both `getRowCanExpand` and the click handler must change together.
**How to avoid:** Change the onClick to unconditionally call `row.toggleExpanded()`. Move `setActionSheetPlayer` into a mobile-only branch. The desktop click should toggle expand without populating actionSheetPlayer.
**Warning signs:** Desktop rows don't expand even after getRowCanExpand change.

[VERIFIED: GemTable.tsx line 193-199]

### Pitfall 2: selected_by_percent string comparison
**What goes wrong:** `player.selected_by_percent > 20` evaluates `"12.5" > 20` which coerces to a number comparison in some JS paths but is a string field typed as `string` — using `>` on the raw string could produce wrong results if the string has leading zeros or unusual format.
**Why it happens:** FPL returns `selected_by_percent` as a string decimal like `"12.5"`.
**How to avoid:** Always `parseFloat(player.selected_by_percent) > 20`. Confirmed in `explain.ts` line 67 and `recommend.ts` Pitfall comment.

[VERIFIED: types.ts + explain.ts line 67]

### Pitfall 3: captaincyCandidates in TransferPanel already filtered to squad starters
**What goes wrong:** Attempting to use `captaincyCandidates` for WHY-01 (GemTable) rejection — the candidates only cover the manager's starting XI, not the full 700-player pool.
**Why it happens:** `computeCaptaincyCandidates()` filters to `pick.position < 12` and `xPts_1gw > 0`. It is squad-scoped.
**How to avoid:** WHY-01 caption rejection is NOT needed — GemTable is the full player pool view. Only WHY-03 (SquadView, owned players) includes captain rejection. The captain rank in WHY-03 is relative to the user's own squad candidates.

[VERIFIED: captaincy-engine.ts line 66-78]

### Pitfall 4: computeRejection called with isTransfer=true by accident
**What goes wrong:** Calling `computeFragility(player, true)` for rejection context would trigger the hit-cost check (`xPtsGain < 4.0`), producing spurious "taken as a hit" reasons in contexts where no transfer is happening.
**Why it happens:** The fragility function signature takes `isTransfer` as its second argument. WHY-01 and WHY-03 are ranking/ownership contexts, not transfer decision contexts.
**How to avoid:** Always call `computeFragility(player, false)` inside `computeRejection`. The hit-cost check is meaningless for general ranking.

[VERIFIED: sensitivity.ts line 37]

### Pitfall 5: Desktop expand row visibility class
**What goes wrong:** Using `sm:block` on a `<tr>` element does not work — `display: block` is invalid on table rows. The correct Tailwind pattern is `hidden sm:table-row`.
**Why it happens:** Tailwind's responsive prefix applies `display` — `block` is wrong for `<tr>`, `table-row` is correct.
**How to avoid:** Use `className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row"` on the desktop expand `<tr>`.

[ASSUMED — Tailwind table display class behaviour; standard HTML/CSS knowledge]

### Pitfall 6: WHY-02 callout must check both >20% AND absent from candidates
**What goes wrong:** Showing all >20%-owned players in the callout, including those already appearing in suggestTransfers output.
**Why it happens:** The callout purpose is specifically to explain ABSENT high-ownership players.
**How to avoid:** Build `suggestedBuyIds` Set from `ocsSuggestions` and filter it out. Note: use `ocsSuggestions` (from `suggestTransfers` directly), not `transferResult.suggestions` which is from `computeTransferSuggestions` (a different engine for the "Suggested Transfers" section).

[VERIFIED: TransferPanel.tsx line 100-110 — `ocsSuggestions` is the correct variable]

### Pitfall 7: Prop threading breaks SquadView's conditional colSpan
**What goes wrong:** SquadView renders `<td colSpan={isMobile ? 4 : 9}>` (line 228). Adding new props to SquadViewProps does not affect this — but if new columns are added to the table, the hardcoded `9` breaks the expand panel width.
**Why it happens:** Phase 65 adds no new columns to SquadView's table. The existing `9` column count is correct.
**How to avoid:** No action needed — this is a known pitfall from the existing code that Phase 65 does not disturb. Document that the hardcoded colSpan `9` is intentional.

[VERIFIED: SquadView.tsx line 228]

---

## Code Examples

### computeRejection function location and exports

```typescript
// Source: src/lib/explain.ts (alongside computeExplanations — D discretion resolved in UI-SPEC)
// Add BELOW the existing computeExplanations function

import { computeFragility } from '@/lib/sensitivity'
import { computePositionAverages } from '@/lib/recommend'

export interface RejectionResult {
  reasons: string[]
  xPtsRank: number   // 1-based rank within position by xPts_1gw
}

export const REJECTION_START_PROB_THRESHOLD = 0.70
export const REJECTION_OWNERSHIP_THRESHOLD = 20.0

const POSITION_CODES: Record<number, string> = {
  1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD',
}

export function computeRejection(
  player: ScoredPlayer,
  allPlayers: ScoredPlayer[],
): RejectionResult {
  // Rank within position by xPts_1gw descending (D-05)
  const samePosition = allPlayers
    .filter(p => p.element_type === player.element_type)
    .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
  const xPtsRank = samePosition.findIndex(p => p.id === player.id) + 1

  // Adaptive framing (UI-SPEC §Adaptive Framing Threshold)
  const positionAverages = computePositionAverages(allPlayers)
  const posAvg = positionAverages.get(player.element_type) ?? 0.5
  const { reasons: fragilityReasons } = computeFragility(player, false)

  const isStrong =
    player.gem_score >= posAvg &&
    fragilityReasons.length === 0 &&
    player.start_prob >= REJECTION_START_PROB_THRESHOLD

  if (isStrong) {
    return { reasons: [], xPtsRank }
  }

  const reasons: string[] = []
  const posCode = POSITION_CODES[player.element_type] ?? '??'

  // Signal order per D-07: rank, start_prob, fixture, fragility, ownership
  reasons.push(`Ranked #${xPtsRank} at ${posCode} by xPts`)
  if (player.start_prob < REJECTION_START_PROB_THRESHOLD) {
    reasons.push(`Rotation risk — start probability ${Math.round(player.start_prob * 100)}%`)
  }
  if (
    player.fixtures.length > 0 &&
    player.fixtures[0].difficulty_tier === 'medium'
  ) {
    reasons.push(`Difficult fixture (FDR medium)`)
  }
  for (const reason of fragilityReasons) {
    reasons.push(`Fragile: no longer recommended if: ${reason}`)
  }
  // Ownership context — always last
  const owned = Math.round(parseFloat(player.selected_by_percent))
  reasons.push(`Owned by ${owned}% of managers`)

  return { reasons, xPtsRank }
}
```

[VERIFIED: pattern from sensitivity.ts + explain.ts + UI-SPEC copywriting contract]

### ExplainPanel prop extension (WHY-03)

```tsx
// Source: src/components/squad/ExplainPanel.tsx — existing props + new addition
// VERIFIED: ExplainPanel.tsx full file read

interface ExplainPanelProps {
  reasons: string[]
  shortlist: ShortlistEntry[] | null
  rejectionReasons?: string[]   // Phase 65 WHY-03 addition
}

// Render order inside ExplainPanel return:
// 1. Positive reasons <ul> (existing)
// 2. Rejection reasons section (new — below positive, above shortlist)
// 3. Shortlist section (existing)

{rejectionReasons && rejectionReasons.length > 0 && (
  <div className="space-y-1">
    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why not recommended:</p>
    <ul className="space-y-0.5">
      {rejectionReasons.map((reason, i) => (
        <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">{reason}</li>
      ))}
    </ul>
  </div>
)}
```

[VERIFIED: 065-UI-SPEC.md §WHY-03 + ExplainPanel.tsx full read]

### WHY-03 rejection reasons computation (inside SquadView)

```typescript
// Source: SquadView.tsx expand section (line ~221) — extend existing logic
// VERIFIED: SquadView.tsx lines 220-233

// Existing:
const reasons = computeExplanations(player)
const label = labels?.get(pick.element)
const shortlist = ...

// Phase 65 additions:
const rejectionReasons: string[] = []
if (verdicts && captaincyCandidates) {
  const verdict = verdicts.get(player.id)
  if (verdict === 'sell' || verdict === 'hold') {
    if (verdict === 'sell') {
      rejectionReasons.push('Below xPts hold threshold — consider rotating')
    }
    // Fragility reasons
    const { reasons: fragReasons } = computeFragility(player, false)
    for (const r of fragReasons) {
      if (r === 'start_prob < 70%') {
        rejectionReasons.push(`Rotation risk — start probability ${Math.round(player.start_prob * 100)}%`)
      } else if (r === 'harder fixture') {
        rejectionReasons.push('Difficult fixture this gameweek')
      }
    }
    // Captain rejection (D-09)
    const capIndex = captaincyCandidates.findIndex(c => c.player.id === player.id)
    if (capIndex === -1 || capIndex > 0) {
      const topCap = captaincyCandidates[0]
      if (topCap && topCap.player.id !== player.id) {
        const rank = capIndex === -1 ? '?' : capIndex + 1
        rejectionReasons.push(
          `Ranked #${rank} at ${POSITION_LABELS[player.element_type]} by xPts — ${topCap.player.web_name} is the captain pick`
        )
      }
    }
  }
}
```

[VERIFIED: SquadView.tsx + captaincy-engine.ts + 065-CONTEXT.md D-09]

### HighOwnershipCallout component structure

```tsx
// Source: 065-UI-SPEC.md §WHY-02 + 065-CONTEXT.md D-11/D-12/D-13/D-14
// File: src/components/transfers/HighOwnershipCallout.tsx

interface HighOwnershipEntry {
  player: ScoredPlayer
  inSquad: boolean
  squadRank?: number   // for in-squad variant copy
  posCode: string
}

interface HighOwnershipCalloutProps {
  entries: HighOwnershipEntry[]
}

export function HighOwnershipCallout({ entries }: HighOwnershipCalloutProps) {
  if (entries.length === 0) return null
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 space-y-1">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        &#8505;&#65039; Why aren&apos;t these players appearing?
      </p>
      {entries.map(entry => (
        <p key={entry.player.id} className="text-xs text-zinc-600 dark:text-zinc-400">
          {entry.player.web_name} ({Math.round(parseFloat(entry.player.selected_by_percent))}%):
          {entry.inSquad
            ? ` Already ranked #${entry.squadRank} at ${entry.posCode} in your squad by xPts — no upgrade needed`
            : ` xPts gain vs your ${entry.posCode} options is negative — not worth transferring in`}
        </p>
      ))}
    </div>
  )
}
```

[VERIFIED: 065-UI-SPEC.md §WHY-02 + 065-CONTEXT.md D-12]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getRowCanExpand: () => isMobile` (expand only on mobile) | `getRowCanExpand: () => true` (all sizes) | Phase 65 D-01 | Desktop rows now expandable; requires desktop expand row branch |
| No rejection context on GemTable rows | Natural-language rejection panel in expand row | Phase 65 WHY-01 | Trust-building; auditable recommendations |
| ExplainPanel shows only positive reasons | ExplainPanel shows positive + rejection sections | Phase 65 D-08 | Owned players get full context |
| TransferPanel shows only candidates | TransferPanel callout for absent high-ownership | Phase 65 WHY-02 | "Why isn't Salah here?" answered inline |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 65 is purely client-side TypeScript/React with no external dependencies beyond what is already installed. No new CLI tools, databases, or runtimes required. `npm install` is not needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/explain.ts src/lib/__tests__/rejection.test.ts` (approximate — path TBD per plan) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WHY-01 | `computeRejection()` returns rank + reasons correctly | unit | `npx vitest run src/lib/__tests__/rejection.test.ts` | ❌ Wave 0 |
| WHY-01 | Positive framing when gem_score >= avg AND no fragility AND start_prob >= 0.70 | unit | same | ❌ Wave 0 |
| WHY-01 | `selected_by_percent` parsed as float (not string comparison) | unit | same | ❌ Wave 0 |
| WHY-02 | `HighOwnershipCallout` renders 0-3 entries, not rendered when empty | unit (RTL) | `npx vitest run src/components/transfers/HighOwnershipCallout.test.tsx` | ❌ Wave 0 |
| WHY-03 | `ExplainPanel` renders rejection section below positive reasons when `rejectionReasons` non-empty | unit (RTL) | `npx vitest run src/components/squad/ExplainPanel.test.tsx` | ❌ Wave 0 |
| WHY-03 | Captain rejection copy correct when player is not top candidate | unit | `npx vitest run src/lib/__tests__/rejection.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/__tests__/rejection.test.ts` (pure function tests, < 5s)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/rejection.test.ts` — covers WHY-01 computeRejection (rank, positive framing, fragility delegation, ownership formatting, BGW guard)
- [ ] `src/components/transfers/HighOwnershipCallout.test.tsx` — covers WHY-02 render/empty/cap-at-3
- [ ] `src/components/squad/ExplainPanel.test.tsx` — covers WHY-03 rejectionReasons prop (section renders when non-empty, omitted when empty, position below positive reasons)

---

## Security Domain

Phase 65 performs no authentication, no network requests, no user-supplied input processing, and no data persistence. All computation is over in-memory static JSON data already fetched by existing hooks. No ASVS controls are applicable.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `hidden sm:table-row` is the correct Tailwind class to show a `<tr>` only on desktop | Pitfall 5 | Desktop expand row invisible; use `sm:table-row` without `hidden` as baseline alternative |
| A2 | `computePositionAverages` from `recommend.ts` is importable in `explain.ts` without circular dependency | Pattern 1 | Circular import — move `computePositionAverages` to a shared utility or inline the loop |

**A1 verification note:** Standard HTML `display: table-row` for `<tr>` elements; `hidden` sets `display: none`; `sm:table-row` sets `display: table-row` at sm breakpoint. This is correct Tailwind v4 behaviour. [ASSUMED — not grep-verified in this session, but standard CSS/Tailwind knowledge]

**A2 verification note:** `explain.ts` currently imports from `@/lib/types` only. `recommend.ts` imports from `@/lib/types` and `@/lib/squad-adapter`. Neither imports from the other — no circular risk. [VERIFIED: explain.ts line 1; recommend.ts lines 1-2]

---

## Open Questions (RESOLVED)

1. **`computeRejection` fixture check — medium only or medium+hard?**
   - What we know: `computeFragility()` only flags `difficulty_tier === 'medium'` (not 'hard') because 'hard' fixtures are already the expected norm for top players and don't represent a reversing condition. The rejection context is different — a hard fixture is also rejection-relevant.
   - What's unclear: Should the fixture rejection reason trigger on 'medium' (matching computeFragility) or on 'medium' OR 'hard'?
   - Recommendation: Match the UI-SPEC copywriting: "Difficult fixture (FDR [tier])" — trigger on BOTH medium and hard for WHY-01/WHY-03. For fragility specifically (delegated to computeFragility), medium-only is correct. Implement the fixture check directly in computeRejection for the broader rejection-reason context rather than purely delegating to computeFragility.
   - **RESOLVED:** Trigger on BOTH medium and hard for the rejection context. computeFragility delegation covers fragility signals only.

2. **WHY-02 in-squad rank derivation**
   - What we know: The copy template is "Already ranked #X at [POS] in your squad by xPts — no upgrade needed". The rank is within the user's squad at that position, not the global population.
   - What's unclear: Does "rank within your squad" mean rank among all squad players at that position (starters + bench), or starters only?
   - Recommendation: Rank among starting-XI players at that position (position < 12), matching how verdicts work. A bench player with higher xPts would still be displayed but is less relevant.
   - **RESOLVED:** Rank among starting-XI players only (position < 12).

---

## Sources

### Primary (HIGH confidence)
- `src/lib/explain.ts` — computeExplanations pattern, exported constants, ScoredPlayer import
- `src/lib/sensitivity.ts` — computeFragility signature, FragilityResult type, threshold (0.70)
- `src/lib/recommend.ts` — computeVerdicts, computePositionAverages, BUY_THRESHOLD, SELL_THRESHOLD
- `src/components/gem-table/GemTable.tsx` — getRowCanExpand line 114, onClick line 193, mobile expand row line 214, Fragment pattern
- `src/components/squad/ExplainPanel.tsx` — props, render order, existing styling classes
- `src/components/squad/SquadView.tsx` — expandedIds/toggleExpand, ExplainPanel call at line 229, colSpan line 228
- `src/components/transfers/TransferPanel.tsx` — scoredPlayers/captaincyCandidates/ocsSuggestions useMemos, SquadView render call
- `src/lib/captaincy-engine.ts` — CaptaincyCandidate type, sort order (projected_captain_pts desc)
- `src/lib/types.ts` — MergedPlayer/ScoredPlayer shapes, selected_by_percent as string
- `src/lib/suggest-transfers.ts` — suggestTransfers output shape (buy.id accessible)
- `.planning/phases/065-rejection-explainer/065-CONTEXT.md` — all locked decisions D-01..D-14
- `.planning/phases/065-rejection-explainer/065-UI-SPEC.md` — copywriting contract, markup, styling

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` §WHY-01/WHY-02/WHY-03 — requirement definitions
- `.planning/ROADMAP.md` §Phase 65 — success criteria (5 SCs)
- `vitest.config.ts` — test environment (jsdom global), `vitest run` command

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in codebase
- Architecture patterns: HIGH — verified against actual source files
- Pitfalls: HIGH for items verified in source; ASSUMED for Tailwind table-row display
- Copywriting/UI: HIGH — locked in UI-SPEC

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable codebase; no external dependencies)
