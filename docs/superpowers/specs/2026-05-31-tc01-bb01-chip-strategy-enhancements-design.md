# Design: TC-01 + BB-01 — Chip Strategy Enhancements

**Date:** 2026-05-31  
**Status:** Approved  
**Features:** TC-01 (Triple Captain Decision Engine), BB-01 (Bench Boost Readiness Score)

---

## Context

The existing `chip-strategy-engine.ts` and `ChipStrategyPanel` already compute BB/TC/FH scores as **fixture-ease bars** (5 GW ease cells, isBest marker). What's missing:

- **TC-01**: A ranked player comparison table showing *who* to TC and *when*, with TC xPts, ceiling, start risk, and a composite rating. The ease bar tells you *when*; the table tells you *who*.
- **BB-01**: A 0–100 readiness score with component breakdown telling the manager *whether* their bench is good enough to BB right now — bench xPts, start probability, and doublers in squad.

Both enhancements live behind an **expand/collapse interaction** on the existing chip row (tap row → chevron toggles → detail panel appears below). Only one panel open at a time.

---

## Scope

**In scope:**
- `computeTCCandidates()` pure function + `TCCandidate` type
- `computeBBReadiness()` pure function + `BBReadiness` type
- `TCDetailPanel` component
- `BBDetailPanel` component
- Expand/collapse state in `ChipStrategyPanel`

**Out of scope:**
- Post-BB squad damage modelling (speculative multi-week simulation — deferred indefinitely)
- FH enhancements (FH-01 already complete via `computeFHResult`)
- Any pipeline changes

---

## Data Types

### `TCCandidate`

```typescript
interface TCCandidate {
  player: ScoredPlayer
  fixture_label: string    // "ARS (H)" or "ARS (H) + CHE (A)" for DGW
  is_dgw: boolean
  tc_xpts: number          // xPts_1gw × (is_dgw ? 2 : 1)
  ceiling: number          // (xPts_90th_1gw ?? xPts_1gw ?? 0) × (is_dgw ? 2 : 1)
  start_risk: 'low' | 'medium' | 'high'
                           // low: start_prob ≥ 0.85
                           // medium: start_prob ≥ 0.65
                           // high: start_prob < 0.65
  tc_rating: number        // tc_xpts × start_prob × (is_dgw ? DGW_RATING_MULTIPLIER : 1)
                           // DGW_RATING_MULTIPLIER = 1.3
}
```

**`computeTCCandidates(players, clubFormMap, startGw)`:**
- Filters `players` to: `status === 'a'`, `element_type !== 1` (no GKs), `mins_risk !== 'injured'`
- Uses `xPts_1gw` (next GW) — the existing ease bars already handle multi-GW "which window" question; this function answers "which player for that window"
- DGW detection: player has ≥ 2 fixtures in one event_id within `upcoming_fixtures` at `startGw`
- Returns top 5 by `tc_rating` descending
- Always returns results (no DGW filter) — DGW players naturally float to top via multiplier

### `BBReadiness`

```typescript
interface BBReadiness {
  score: number             // 0–100 weighted composite (rounded integer)
  bench_xpts: number        // sum of xPts_1gw for bench 4 (position ≥ 12)
  bench_xpts_score: number  // min(100, bench_xpts / GOOD_BENCH_XPTS_THRESHOLD × 100)
  avg_start_prob: number    // mean start_prob of bench 4 (0.0–1.0)
  start_prob_score: number  // avg_start_prob × 100
  doublers: number          // count of bench players whose team has ≥ 2 fixtures this GW
  doublers_score: number    // (doublers / 4) × 100
}
// score = round(bench_xpts_score × 0.40 + start_prob_score × 0.30 + doublers_score × 0.30)
```

**Constants:**
- `GOOD_BENCH_XPTS_THRESHOLD = 12.0` (bench of 4 averaging 3 pts each = 100/100)
- `DGW_RATING_MULTIPLIER = 1.3`

**`computeBBReadiness(benchPicks, players, clubFormMap, startGw)`:**
- `benchPicks`: SquadPick[] filtered to `position ≥ 12` (caller may pass full picks)
- Returns `BBReadiness` with all component fields populated
- When `benchPicks` is empty or players unavailable: returns score 0 with zero components
- Hit cost is **not** part of `BBReadiness` — it requires squad context (sell prices, bank) unavailable to the pure function. `ChipStrategyPanel` derives `hitCostLabel?: string` separately from existing OCS state and passes it as a prop to `BBDetailPanel`.

---

## New Components

### `TCDetailPanel`

**Props:** `{ candidates: TCCandidate[] }`

**Renders:**
- Compact 4-column table: `Player | Fixture | TC xPts | Rating`
- DGW rows: `2×` amber badge in Fixture cell, right of opponent label
- Start risk dot in Player cell: green (low), amber (medium), red (high) — no text label, uses `title` for accessibility
- Rating column: numeric to 1 dp
- Max 5 rows; no scroll — list is fixed length
- Empty state: "No player data available"
- No loading state — data is synchronously derived from `usePlayers` pool

### `BBDetailPanel`

**Props:** `{ readiness: BBReadiness; hitCostLabel?: string }`

**Renders:**
- Large score badge: e.g. **"72 / 100"** — amber `< 50`, green `≥ 50`, dark green `≥ 80`
- Three component bars (inline-style width, not Tailwind dynamic):
  - "Bench xPts" — `bench_xpts_score`% filled, label shows e.g. "9.4 pts"
  - "Start Prob" — `start_prob_score`% filled, label shows e.g. "74% avg"
  - "Doublers" — `doublers_score`% filled, label shows e.g. "1 of 4"
- `hitCostLabel` shown below bars if non-null: amber text, e.g. "−4pt hit needed to improve bench"
- Score 0 when no squad loaded → shows "Load your squad to see BB readiness"

---

## Expand/Collapse State

`ChipStrategyPanel` gains one new piece of state:

```typescript
const [expandedChip, setExpandedChip] = useState<'bboost' | 'triplechip' | null>(null)
```

Each chip row gets:
- A `cursor-pointer` wrapper on the full row
- A `▼` / `▲` chevron icon (right-aligned) that rotates on expand
- `onClick={() => setExpandedChip(prev => prev === chip ? null : chip)}`

Only one panel open at a time — opening one closes the other.

The existing ease-bar rows (`<ChipRow>`) are preserved unchanged. Detail panels render *below* each `<ChipRow>` in the same card, conditional on `expandedChip === chip`.

FH row: no expand panel added (FH-01 already complete; FH detail is in ChipStrategyPanel's existing FH squad view).

---

## Tests

**`chip-strategy-engine.test.ts` additions:**

TC candidates:
- Top candidate is DGW player when DGW exists in horizon
- Non-DGW players still appear in table (no hard DGW filter)
- GKs excluded from candidates
- Injured players excluded
- start_risk thresholds (≥0.85 → low, ≥0.65 → medium, <0.65 → high)
- tc_rating correctly applies DGW_RATING_MULTIPLIER

BB readiness:
- Score components sum correctly (weights 0.40 / 0.30 / 0.30)
- bench_xpts_score capped at 100 (bench > threshold)
- doublers_score 0 when no DGW fixtures on bench
- Empty benchPicks → score 0, all components 0

**RTL tests for panels:**
- `TCDetailPanel`: renders 4 columns, 2× badge on DGW row, start-risk dot present
- `BBDetailPanel`: renders score badge, three bars, hit cost label when non-null, empty state when score 0

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/chip-strategy-engine.ts` | Add `TCCandidate`, `BBReadiness` types + `computeTCCandidates`, `computeBBReadiness` functions |
| `src/lib/chip-strategy-engine.test.ts` | Add TC candidates + BB readiness test cases |
| `src/components/planner/TCDetailPanel.tsx` | New component + co-located tests |
| `src/components/planner/BBDetailPanel.tsx` | New component + co-located tests |
| `src/components/planner/ChipStrategyPanel.tsx` | Add `expandedChip` state, chevron icons, render detail panels |
| `src/components/squad/DecisionSummaryTab.tsx` | Pass `candidates` + `readiness` props through to chip rows if rendered there |

---

## Non-Goals

- No changes to `computeBBScore` or `computeTCScore` (ease bars preserved as-is)
- No pipeline changes
- No new API routes
- No changes to FH chip row
