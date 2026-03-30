# Phase 11: Explainability + Replacement Shortlist - Research

**Researched:** 2026-03-30
**Domain:** TypeScript pure functions + React component expansion UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Explainability display — inline expand per row**
Each player row in SquadView gets a click-to-expand panel. Clicking reveals reasons and (for Sell players) the replacement shortlist. The expand is toggled per player independently.

**D-02: Replacement shortlist inside the expanded row**
For Sell-verdicted players, the expanded panel shows reasons first, then the replacement shortlist below.

**D-03: Reasons signal set**
Show all applicable signals as natural-language sentences. No cap on count.

| Signal | Positive phrasing | Negative phrasing |
|--------|-------------------|-------------------|
| `fdr_score` + `fixtures[]` | "Strong fixture run — N easy games next 5 GWs" | "Difficult fixtures — N hard games next 5 GWs" |
| `form_pts_per90` | "In form — X pts/90 last 5 GWs" | "Poor form — X pts/90 last 5 GWs" |
| `proj_pts_1gw` | "Projected X pts next GW" | (implicit in Sell verdict) |
| `start_prob` | "High start probability (X%)" | "Low start probability (X%)" |
| `xg_per90` | "High xG — X/90" | "Low xG — X/90" (when relevant) |
| `xa_per90` | "Creative — X xA/90" | — |
| `penalties_order === 1` | "Primary penalty taker" | — |
| `direct_freekicks_order === 1` | "Direct free-kick taker" | — |
| `corners_and_indirect_freekicks_order === 1` | "Corner/set piece taker" | — |
| `selected_by_percent` (low) | "Differential — X% owned" | — |

Excluded: `mins_risk` (shown via MinsRiskBadge), `cost_change_start` (not surfaced).

**D-04: Risk flags = negative reasons, no separate flag concept**
EXP-02 risk flags (rotation concern, fixture swing, regression risk, poor form) are negative-phrased reasons in the same expand panel. No separate chip/badge concept.

**D-05: Replacement shortlist ranking**
Ranked by `buy.proj_pts_1gw - sell.proj_pts_1gw` descending. Show 3–5 alternatives. Each entry shows: player name, team, projected pts gain ("+3.2 pts"), affordability indicator.

**D-06: Architecture pattern — pure function + component**
- New `computeExplanations(player: ScoredPlayer): string[]` pure function in `src/lib/`
- New `computeReplacementShortlist(sellPlayer, allPlayers, budget): ShortlistEntry[]` pure function
- New `ExplainPanel` component consuming both outputs
- SquadView manages expand state via local useState
- TDD: tests written first for pure functions

### Claude's Discretion

None specified.

### Deferred Ideas (OUT OF SCOPE)

None raised during discussion.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | User can see natural-language "why this player" reasons per recommendation | `computeExplanations` pure function reads `ScoredPlayer` fields defined in D-03; all required fields already present on `ScoredPlayer` |
| EXP-02 | User can see risk flags per player (rotation concern / fixture swing / regression risk / poor form) | Implemented as negatively-phrased reasons per D-04; same `computeExplanations` function handles both positive and negative signals |
| REC-02 | User can see replacement shortlist (3–5 alternatives with projected pts delta) for Sell candidates | `computeReplacementShortlist` pure function mirrors transfer-engine pattern; `proj_pts_1gw` field already on all players |
</phase_requirements>

---

## Summary

Phase 11 is a pure-TypeScript computation + React component phase. No new pipeline data is required — all signals needed for explanation text (`fdr_score`, `form_pts_per90`, `proj_pts_1gw`, `start_prob`, `xg_per90`, `xa_per90`, `penalties_order`, `direct_freekicks_order`, `corners_and_indirect_freekicks_order`, `selected_by_percent`, `fixtures`) are already present on `ScoredPlayer`. The `computeVerdicts` engine from Phase 10 is a dependency — this phase reads its output (the `verdicts` Map) to decide what to show in the expand panel.

The two new pure functions follow an established pattern in this codebase: `computeTransferSuggestions` (transfer-engine.ts) and `computeCaptaincyCandidates` (captaincy-engine.ts) both take `ScoredPlayer[]` and return typed results. `computeExplanations` and `computeReplacementShortlist` follow the same shape. Tests go in `tests/lib/` using the same `makeScoredPlayer` factory pattern already present in `tests/lib/recommend.test.ts`.

The UI change is a row-expand pattern in SquadView: clicking a player row (or a toggle button in the row) expands an inline panel below it. React `useState` tracking a `Set<number>` (or `number | null`) of expanded player IDs is standard for this pattern. The `ExplainPanel` component outputs a list of reason strings plus an optional shortlist table — modelled after `CaptaincyPanel.tsx`'s flex-row card pattern.

**Primary recommendation:** Implement in three plans — (1) TDD `computeExplanations`, (2) TDD `computeReplacementShortlist`, (3) UI wiring (ExplainPanel + SquadView expand state). This matches the Phase 10 three-plan structure exactly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (project-wide) | Pure function types | All lib code is TypeScript |
| React 19 | 19.2.4 | useState for expand toggle | Already in use |
| Vitest | ^4.1.2 | TDD for pure functions | Project test framework |
| Next.js | 16.2.1 | App Router, 'use client' directive | Project framework |
| Tailwind CSS | (project-wide) | Styling, zinc palette | All components use it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/types` | internal | ScoredPlayer, MinsRisk types | Always for data types |
| `@/lib/recommend` | internal | Verdict type, BUY/SELL thresholds | ExplainPanel needs Verdict |
| `@/lib/transfer-engine` | internal | SingleTransfer, budget logic reference | Pattern source for shortlist |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| inline expand (D-01) | tooltip / always-visible sub-row | Tooltip hides content; sub-row is too dense — locked per D-01 |
| negative reasons (D-04) | separate flag chips | Duplicate information, more UI surface — locked per D-04 |

**Installation:** No new packages required. All needed libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:

```
src/
├── lib/
│   ├── explain.ts              # computeExplanations(player): string[]
│   └── replacement-shortlist.ts  # computeReplacementShortlist(...): ShortlistEntry[]
├── components/
│   └── squad/
│       └── ExplainPanel.tsx    # Expand panel: reasons + optional shortlist
tests/
└── lib/
    ├── explain.test.ts
    └── replacement-shortlist.test.ts
```

Existing files modified:
- `src/components/squad/SquadView.tsx` — add expandedIds state, click toggle, render ExplainPanel
- `src/components/transfers/TransferPanel.tsx` — pass `allPlayers` + `entryHistory.bank` down if needed by ExplainPanel

### Pattern 1: computeExplanations — Signal-to-String mapping

**What:** Pure function `(player: ScoredPlayer) => string[]` that maps signal values to natural-language sentences. Returns all applicable strings (positive and negative), no cap.

**When to use:** Called in ExplainPanel when a player row is expanded.

**Key implementation logic:**

```typescript
// Source: established project pattern, src/lib/recommend.ts + CONTEXT.md D-03
export function computeExplanations(player: ScoredPlayer): string[] {
  const reasons: string[] = []

  // FDR: count easy/hard games from player.fixtures (difficulty_tier)
  const easyCount = player.fixtures.filter(f => f.difficulty_tier === 'easy').length
  const hardCount = player.fixtures.filter(f => f.difficulty_tier === 'hard').length
  if (easyCount >= 2) reasons.push(`Strong fixture run — ${easyCount} easy games next 5 GWs`)
  else if (hardCount >= 3) reasons.push(`Difficult fixtures — ${hardCount} hard games next 5 GWs`)

  // form_pts_per90 threshold (project uses same 5 GW window)
  // Positive/negative threshold needs research: ~5.0 pts/90 is strong for MIDs
  // Use relative comparison: project uses form_score (normalised); safe to use raw form_pts_per90
  if (player.form_pts_per90 >= 5.0) reasons.push(`In form — ${player.form_pts_per90.toFixed(1)} pts/90 last 5 GWs`)
  else if (player.form_pts_per90 < 3.0) reasons.push(`Poor form — ${player.form_pts_per90.toFixed(1)} pts/90 last 5 GWs`)

  // proj_pts_1gw — always show
  reasons.push(`Projected ${player.proj_pts_1gw.toFixed(1)} pts next GW`)

  // start_prob
  const startPct = Math.round(player.start_prob * 100)
  if (player.start_prob >= 0.85) reasons.push(`High start probability (${startPct}%)`)
  else if (player.start_prob < 0.65) reasons.push(`Low start probability (${startPct}%)`)

  // xG — only when non-null and relevant
  if (player.xg_per90 !== null && player.xg_per90 >= 0.3) {
    reasons.push(`High xG — ${player.xg_per90.toFixed(2)}/90`)
  } else if (player.xg_per90 !== null && player.element_type !== 1 && player.xg_per90 < 0.05) {
    reasons.push(`Low xG — ${player.xg_per90.toFixed(2)}/90`)
  }

  // xA
  if (player.xa_per90 !== null && player.xa_per90 >= 0.15) {
    reasons.push(`Creative — ${player.xa_per90.toFixed(2)} xA/90`)
  }

  // Set piece roles
  if (player.penalties_order === 1) reasons.push('Primary penalty taker')
  if (player.direct_freekicks_order === 1) reasons.push('Direct free-kick taker')
  if (player.corners_and_indirect_freekicks_order === 1) reasons.push('Corner/set piece taker')

  // Differential ownership
  const owned = parseFloat(player.selected_by_percent)
  if (owned < 10.0) reasons.push(`Differential — ${owned.toFixed(1)}% owned`)

  return reasons
}
```

The exact thresholds for form_pts_per90, xg_per90, xa_per90 are **implementation decisions for the executor** (planner should specify them explicitly as constants). The patterns above are starting points.

### Pattern 2: computeReplacementShortlist — proj_pts_1gw delta ranking

**What:** Pure function that filters same-position non-squad players, ranks by `proj_pts_1gw` delta descending, returns top 3–5 with affordability.

**When to use:** Called in ExplainPanel for Sell-verdicted players only.

**Interface shape (mirrors transfer-engine.ts):**

```typescript
// Source: src/lib/transfer-engine.ts SingleTransfer pattern
export interface ShortlistEntry {
  player: ScoredPlayer
  pts_delta: number          // player.proj_pts_1gw - sellPlayer.proj_pts_1gw
  budget_sufficient: boolean // player.now_cost/10 <= (bankBalance/10 + sellPlayer.now_cost/10)
}

export function computeReplacementShortlist(
  sellPlayer: ScoredPlayer,
  allPlayers: ScoredPlayer[],
  squadIds: Set<number>,
  bankBalance: number,      // raw tenths (e.g. 15 = £1.5m), same as transfer-engine
  count = 5,
): ShortlistEntry[]
```

**Algorithm:**
1. Filter: same `element_type`, not in `squadIds`, `proj_pts_1gw > 0`
2. Sort: by `pts_delta` descending
3. Slice: top `count` (3–5)
4. Each entry includes `budget_sufficient` for affordability indicator

### Pattern 3: ExplainPanel component — inline expand

**What:** A client component rendered below a player row when that row is expanded. Takes pre-computed `reasons: string[]` and `shortlist: ShortlistEntry[] | null`.

**Styling:** zinc palette, compact. Reasons as a `<ul>` with `text-xs text-zinc-600`. Shortlist as compact rows similar to CaptaincyPanel.tsx cards.

**Example structure:**

```tsx
// Source: CaptaincyPanel.tsx pattern
export function ExplainPanel({
  reasons,
  shortlist,
}: {
  reasons: string[]
  shortlist: ShortlistEntry[] | null
}) {
  return (
    <div className="bg-zinc-50 border-t border-zinc-100 px-3 py-2 space-y-2">
      <ul className="space-y-0.5">
        {reasons.map((r, i) => (
          <li key={i} className="text-xs text-zinc-600">{r}</li>
        ))}
      </ul>
      {shortlist && shortlist.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-500">Replacement options</p>
          {shortlist.map((entry, i) => (
            <div key={entry.player.id} className="flex items-center gap-2 text-xs text-zinc-700">
              <span className="w-4 text-zinc-400">{i + 1}</span>
              <span className="font-medium">{entry.player.web_name}</span>
              <span className="text-zinc-500">{entry.player.team_short_name}</span>
              <span className="text-green-700">+{entry.pts_delta.toFixed(1)} pts</span>
              {entry.budget_sufficient
                ? <span className="text-green-600 bg-green-50 rounded px-1">Affordable</span>
                : <span className="text-red-600 bg-red-50 rounded px-1">Over budget</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Pattern 4: SquadView expand state

**What:** `useState<Set<number>>` tracking which player IDs are expanded. Toggle on row click or a dedicated chevron button.

**Implementation:**

```tsx
// Source: React useState pattern
const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

function toggleExpand(playerId: number) {
  setExpandedIds(prev => {
    const next = new Set(prev)
    if (next.has(playerId)) next.delete(playerId)
    else next.add(playerId)
    return next
  })
}
```

The table structure in SquadView uses `<tbody>` rows. To render the ExplainPanel below a row, add a second `<tr>` with `colSpan={9}` (matching the 9 `<th>` columns) that is conditionally rendered when the player's ID is in `expandedIds`.

**Props needed from TransferPanel:** `allPlayers` is already passed to SquadView. `entryHistory.bank` is already in SquadView via `entryHistory` prop. `verdicts` Map is already passed. The `squadIds` Set can be derived from `picks` inside SquadView itself. No new props needed on SquadView.

### Anti-Patterns to Avoid

- **Computing shortlist in SquadView render:** Shortlist must come from the pure function in `src/lib/`, not computed inline in the component.
- **Hard-coding affordability in ExplainPanel:** Budget logic belongs in `computeReplacementShortlist`, not in the component.
- **Using useMemo in SquadView for explanations:** Explanations are cheap to compute per render; no useMemo needed unless performance profiling indicates otherwise.
- **Sorting shortlist by gem_delta:** Locked per D-05 — sort by `proj_pts_1gw` delta, NOT gem_delta.
- **Showing mins_risk as a reason:** Excluded per D-03 — already shown via MinsRiskBadge.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Affordability budget calculation | Custom math | Mirror `available_budget` from `transfer-engine.ts` line 66 | Identical formula: `bankBalance/10 + sellPlayer.now_cost/10` |
| Player exclusion from shortlist | Custom filter | `!squadIds.has(candidate.id)` pattern from transfer-engine.ts | Already handles position + squad membership |
| State immutability for Set | `prev.add(id)` mutating prev | `new Set(prev)` copy-then-modify | React state requires new reference |

**Key insight:** The shortlist function is a subset of `computeTransferSuggestions` — it reuses the same budget arithmetic and position filtering, just ranked by proj_pts delta instead of gem_delta.

---

## Common Pitfalls

### Pitfall 1: form_pts_per90 threshold choice
**What goes wrong:** Using an arbitrary threshold (e.g. 5.0 pts/90 for "in form") that misclassifies all defenders as "poor form" since defenders rarely score 5.0 pts/90.
**Why it happens:** `form_pts_per90` is position-agnostic raw points per 90. A GK scoring 2.5 pts/90 may be "in form" while a FWD at 2.5 pts/90 is underperforming.
**How to avoid:** Either use position-relative thresholds, OR use the normalised `form_score` (0.0-1.0) as a proxy. If using raw `form_pts_per90`, document the chosen thresholds explicitly in the function and expose them as named constants (like `BUY_THRESHOLD` / `SELL_THRESHOLD` in recommend.ts).
**Warning signs:** All GKs getting "Poor form" reason; all outfield players getting "In form".

### Pitfall 2: `selected_by_percent` is a string, not a number
**What goes wrong:** Comparing `player.selected_by_percent < 10.0` silently returns `false` or coerces incorrectly.
**Why it happens:** FPL API returns ownership as `"12.5"` (string) — this is documented in `types.ts` with the comment "FPL returns as string". `parseFloat()` is required.
**How to avoid:** `const owned = parseFloat(player.selected_by_percent)` before comparison. Same pattern used in gem-score.ts line 53.
**Warning signs:** All players getting "Differential" label, or no players getting it.

### Pitfall 3: shortlist including squad members
**What goes wrong:** Replacement shortlist contains players already in the manager's squad.
**Why it happens:** `computeReplacementShortlist` needs the `squadIds: Set<number>` passed from SquadView, which derives it from `picks`.
**How to avoid:** Build `squadIds` from `picks.map(p => p.element)` inside SquadView and pass it to the shortlist function. Mirrors pattern in transfer-engine.ts line 51.

### Pitfall 4: `<tbody>` expand row and colSpan
**What goes wrong:** ExplainPanel row breaks table layout or appears at wrong position.
**Why it happens:** Standard `<table>` rendering — a row nested inside a loop needs `colSpan` matching the exact column count.
**How to avoid:** Count the `<th>` elements in SquadView's `<thead>` (currently 9 columns: Player, Team, Price, Own%, Mins, Gem, Status, Risk, Rec) and use `colSpan={9}` on the expand row's `<td>`.
**Warning signs:** ExplainPanel content appears misaligned or overflows table bounds.

### Pitfall 5: `proj_pts_1gw` being zero/undefined on some players
**What goes wrong:** Shortlist delta calculation returns NaN or 0 for players without projected points.
**Why it happens:** Phase 7 decision states "all 6 projected fields always non-null" but Phase 7 plan 2 is not yet complete per ROADMAP (07-03 complete, 07-02 complete). Runtime values may be 0.0 (Python writes 0.0 for missing data, not null — per STATE.md Phase 07-03 decision).
**How to avoid:** Filter `candidate.proj_pts_1gw > 0` in shortlist function (same guard as captaincy-engine.ts line 77). Zero-projection players are not meaningful replacements.

### Pitfall 6: Clicking anywhere on the row for expand
**What goes wrong:** Attaching `onClick` to the entire `<tr>` conflicts with any future interactive elements inside the row (e.g. a link, a badge with tooltip).
**Why it happens:** Event bubbling — clicking a child fires the parent handler too.
**How to avoid:** Use a dedicated expand toggle button (e.g. a chevron `▼`/`▶` in the Player name cell or a dedicated column) rather than the whole row. This is safer for future-proofing.

---

## Code Examples

Verified patterns from existing codebase:

### Budget arithmetic (from transfer-engine.ts:65-66)
```typescript
// Source: src/lib/transfer-engine.ts
const available_budget = bankBalance / 10 + sellPlayer.now_cost / 10
const budget_sufficient = buyPlayer.now_cost / 10 <= available_budget
```

### Player exclusion from squad (from transfer-engine.ts:68-73)
```typescript
// Source: src/lib/transfer-engine.ts
const squadIds = new Set(picks.map(p => p.element))
// ...
allPlayers.filter(
  candidate =>
    candidate.element_type === sellPlayer.element_type &&
    !squadIds.has(candidate.id)
)
```

### Expand state with Set (React idiomatic)
```typescript
// Source: React docs pattern — immutable Set update
const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
function toggleExpand(id: number) {
  setExpandedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}
```

### Table expand row (colSpan pattern)
```tsx
// Render AFTER the data row inside the same tbody
{expandedIds.has(pick.element) && (
  <tr key={`expand-${pick.element}`}>
    <td colSpan={9} className="px-0 py-0">
      <ExplainPanel reasons={reasons} shortlist={shortlist} />
    </td>
  </tr>
)}
```

### Test factory pattern (from tests/lib/recommend.test.ts:10-56)
```typescript
// Source: tests/lib/recommend.test.ts — copy this exact pattern
function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id: 1,
    web_name: 'Test',
    // ... all fields with defaults ...
    ...overrides,
  }
}
```

### selected_by_percent string coercion (from src/lib/gem-score.ts:53)
```typescript
// Source: src/lib/gem-score.ts
const rawOwnership = players.map(p => 1.0 - parseFloat(p.selected_by_percent) / 100)
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is pure code/config changes within the existing Next.js + Vitest + TypeScript project).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/lib/explain.test.ts tests/lib/replacement-shortlist.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | computeExplanations returns "Strong fixture run" for player with 3+ easy fixtures | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| EXP-01 | computeExplanations returns "In form" for high form_pts_per90 player | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| EXP-01 | computeExplanations returns "Primary penalty taker" when penalties_order === 1 | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| EXP-01 | computeExplanations returns "High start probability" for start_prob >= 0.85 | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| EXP-01 | computeExplanations parses selected_by_percent as float before comparison | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| EXP-02 | computeExplanations returns "Poor form" for low form_pts_per90 | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| EXP-02 | computeExplanations returns "Low start probability" for start_prob < 0.65 | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| EXP-02 | computeExplanations returns "Difficult fixtures" for player with 3+ hard fixtures | unit | `npx vitest run tests/lib/explain.test.ts` | ❌ Wave 0 |
| REC-02 | computeReplacementShortlist returns 3–5 alternatives sorted by pts_delta desc | unit | `npx vitest run tests/lib/replacement-shortlist.test.ts` | ❌ Wave 0 |
| REC-02 | computeReplacementShortlist excludes squad members | unit | `npx vitest run tests/lib/replacement-shortlist.test.ts` | ❌ Wave 0 |
| REC-02 | computeReplacementShortlist excludes players with proj_pts_1gw <= 0 | unit | `npx vitest run tests/lib/replacement-shortlist.test.ts` | ❌ Wave 0 |
| REC-02 | computeReplacementShortlist computes budget_sufficient correctly | unit | `npx vitest run tests/lib/replacement-shortlist.test.ts` | ❌ Wave 0 |
| REC-02 | computeReplacementShortlist only returns same-position players | unit | `npx vitest run tests/lib/replacement-shortlist.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/explain.test.ts tests/lib/replacement-shortlist.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/explain.test.ts` — covers EXP-01, EXP-02
- [ ] `tests/lib/replacement-shortlist.test.ts` — covers REC-02

*(Framework already installed; no install step needed.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reasons hidden in tooltip | Click-to-expand inline panel | D-01 (Phase 11) | More scannable row, full signal set visible |
| No replacement context | Shortlist in expand panel | D-02 (Phase 11) | Sell verdict + alternatives co-located |
| Separate risk flags | Negative reasons in same list | D-04 (Phase 11) | No duplication of information |

---

## Open Questions

1. **form_pts_per90 positive/negative thresholds**
   - What we know: GK/DEF/MID/FWD have different score distributions. "In form" at 5.0 pts/90 may miss many defenders.
   - What's unclear: Whether to use position-relative thresholds or a single cross-position threshold.
   - Recommendation: Planner should specify explicit named constants (e.g. `FORM_POSITIVE_THRESHOLD = 5.0`, `FORM_NEGATIVE_THRESHOLD = 3.0`) and TDD tests will validate the exact boundary behaviour. Using `form_score` (the already-normalised 0-1 dimension) as an alternative is simpler and position-agnostic — planner should choose one approach.

2. **xg_per90 "low xG" relevance**
   - What we know: CONTEXT.md D-03 says "when relevant" for negative xG signal. No numeric threshold specified.
   - What's unclear: What constitutes "relevant" — should it only apply to FWD (element_type 4)? Or MID + FWD?
   - Recommendation: Default to showing low xG only for FWD (element_type 4) or MID (3), never GK (1) or DEF (2). Planner should specify this explicitly.

3. **Number of shortlist entries: 3 or 5**
   - What we know: D-05 says "3–5 alternatives", `count = 5` default.
   - What's unclear: Fixed 5, or variable based on availability?
   - Recommendation: Default to 5, show however many are available if fewer than 5 qualify. Minimum is 1 if any qualify; show nothing if none qualify (not an error state).

---

## Sources

### Primary (HIGH confidence)

- `src/lib/types.ts` — ScoredPlayer interface, all signal fields confirmed present
- `src/lib/recommend.ts` — Verdict type, BUY/SELL_THRESHOLD pattern
- `src/lib/transfer-engine.ts` — budget arithmetic, position filter, squad exclusion pattern
- `src/lib/captaincy-engine.ts` — pure function + typed result interface pattern
- `src/lib/gem-score.ts` — `parseFloat(selected_by_percent)` pattern, fdr_score computation
- `src/components/squad/SquadView.tsx` — current table structure (9 columns), verdicts prop
- `src/components/captaincy/CaptaincyPanel.tsx` — component styling and card pattern
- `src/components/shared/MinsRiskBadge.tsx` — badge component co-location pattern
- `tests/lib/recommend.test.ts` — makeScoredPlayer factory pattern, test structure
- `.planning/phases/11-explainability-replacement-shortlist/11-CONTEXT.md` — all locked decisions
- `vitest.config.ts` — test framework configuration
- `package.json` — confirmed versions: Next.js 16.2.1, React 19.2.4, Vitest ^4.1.2

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — Phase 07-03 decision: all projected fields non-null (0.0 not null)
- `.planning/STATE.md` — Phase 08 decision: rotation_risk and cameo both deprioritised

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from package.json
- Architecture: HIGH — directly derived from existing patterns in codebase
- Pitfalls: HIGH — derived from confirmed codebase behaviour (types.ts, gem-score.ts)
- Open questions: MEDIUM — thresholds are implementation choices, not research gaps

**Research date:** 2026-03-30
**Valid until:** 2026-05-30 (stable codebase, no external dependencies)
