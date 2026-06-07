# Pre-Season Squad Builder Design

**Feature ID:** PSB-01  
**Date:** 2026-06-07  
**Status:** Approved

---

## Goal

Give managers a side-by-side comparison of three auto-generated squad templates optimised for the first N gameweeks of the 2026/27 FPL season, unlocking only once FPL publishes official 2026/27 prices and confirmed squads.

---

## Architecture

The feature lives entirely client-side. No new pipeline work is needed — it consumes the same Blob data (`players.json`, `fixtures.json`) already read by the rest of the optimiser.

```
OptimiserPanel
  └── tabs: Transfer | WC | FH | Pre-Season   ← new tab
                                  │
                         PreSeasonTab.tsx
                           ├── gate check (bootstrap events → next season present?)
                           │     └── if not ready: banner ("Available once FPL 2026/27 prices go live")
                           └── if ready:
                                 ├── GW horizon selector (GW1–3 / GW1–5 / GW1–8, default GW1–5)
                                 ├── buildPreSeasonSquad(players, fixtures, gwHorizon) → SquadTemplate[]
                                 └── TemplateComparisonGrid (reuse or replicate WC-01 squad card rendering pattern)
```

**Gate logic:** If `bootstrap-static` `events[]` contains any event with `id > currentSeasonMaxGw && !finished` (i.e. next-season gameweeks are present), the gate is open. Exact condition confirmed against live API shape when 2026/27 data drops. The tab body is replaced wholesale with the gate banner until then — no partial renders, no spinner.

**New files:**
- `src/lib/pre-season.ts` — `buildPreSeasonSquad()` and archetype builders
- `src/components/optimiser/PreSeasonTab.tsx` — tab shell, gate check, wires into `TemplateComparisonGrid`

**Modified files:**
- `src/components/optimiser/OptimiserPanel.tsx` — add Pre-Season tab entry

---

## Squad Generation

`buildPreSeasonSquad(players, fixtures, gwHorizon)` runs three archetype builders in sequence, each returning a valid 15-man squad within the 100m budget (read from `bootstrap-static.game_settings.starting_budget`).

| Archetype | Strategy | Anchor logic |
|---|---|---|
| **Premium Spine** | Lock in the 2 highest-xPts players, fill remainder with best value | Top 2 players by 1GW xPts regardless of price |
| **Template** | Picks the highest-ownership player at each position slot | Top player by `selected_by_percent` per position |
| **Value Spread** | Best xPts-per-£ across the full pool, no premiums required | No anchors; greedy xPts/£ with club cap |

Each archetype delegates to a variant of the existing `buildAnchoredSquad()` / `buildOptimalSquad()` from `src/lib/chip-modes.ts`, with different seed anchors and a `preferValueSpread` flag.

**Constraints (all archetypes):**
- 15 players: 2 GK, 5 DEF, 5 MID, 3 FWD
- 3-per-club cap
- Total cost ≤ `starting_budget`

**Scoring per template:**
- Sum xPts for the best 11 starters (highest xPts per position, valid formation) over GW1–N using per-fixture xPts from `players.json`
- Flag DGW (2 fixtures) and BGW (0 fixtures) per GW for teams in the squad
- Identify strongest captain candidate per GW (highest single-GW xPts in XI)

**Output type:**

```ts
interface SquadTemplate {
  label: 'Premium Spine' | 'Template' | 'Value Spread'
  players: Player[]                    // 15 players, ordered GK / DEF / MID / FWD
  totalXpts: number                    // sum over GW1–N for starting XI
  captainsByGw: Record<number, Player> // best captain per GW in horizon
  dgwGws: number[]                     // GW numbers with a DGW fixture in the squad
  bgwGws: number[]                     // GW numbers with a BGW in the squad
  teamValueUsed: number
  bankRemaining: number
}
```

---

## UI & Rendering

Three squad cards displayed side-by-side on desktop, stacked on mobile. Follows the same visual pattern as `WildcardBuilderTab`.

```
[ Pre-Season tab ]

  GW horizon: [GW1–3]  [GW1–5 ✓]  [GW1–8]    ← segmented control, default GW1–5

  ┌─ Premium Spine ──┐  ┌─ Template ──────┐  ┌─ Value Spread ──┐
  │ xPts: 47.2       │  │ xPts: 44.8      │  │ xPts: 43.1      │
  │ Bank: £0.5m      │  │ Bank: £1.2m     │  │ Bank: £3.0m     │
  │                  │  │                 │  │                  │
  │ [squad grid]     │  │ [squad grid]    │  │ [squad grid]     │
  │                  │  │                 │  │                  │
  │ Captain picks:   │  │ Captain picks:  │  │ Captain picks:   │
  │ GW1 Haaland      │  │ GW1 Haaland     │  │ GW1 Watkins      │
  │ GW2 Salah ★DGW   │  │ GW2 Salah ★DGW  │  │ GW2 Mbeumo       │
  │ GW3 …            │  │ GW3 …           │  │ GW3 …            │
  └──────────────────┘  └─────────────────┘  └──────────────────┘
```

- **Squad grid**: position-grouped pitch layout (same as WC-01 and PerfectGW)
- **DGW/BGW badges**: `★DGW` chip on captain row; grey `—BGW` on blank weeks
- **Gate banner**: replaces entire tab body when 2026/27 data not yet live — *"Pre-season squad builder unlocks once FPL publishes 2026/27 prices — usually mid-July"*
- **No edit mode**: YAGNI — ManualPlanTab handles manual tweaks

---

## Error Handling

- If `buildPreSeasonSquad()` cannot find a valid 15-man squad within budget for one archetype (e.g. sparse data at season launch), that card renders an inline error; the other two still render.
- If fixture data is missing for a GW in the horizon, those GWs are excluded from the xPts sum with a `⚠ GW N fixtures not yet available` note under the captain list.
- Gate check is synchronous off existing bootstrap data — no extra fetch, no loading state.

---

## Testing

### `src/lib/pre-season.test.ts`

| Test | Assertion |
|---|---|
| Each archetype returns 15 players | `squad.players.length === 15` |
| Budget never exceeded | `teamValueUsed <= startingBudget` |
| 3-per-club cap | No club appears > 3 times in any squad |
| Formation valid | Squad contains exactly 2 GK, 5 DEF, 5 MID, 3 FWD |
| Premium Spine anchors | Top-2 xPts players always in Premium Spine squad |
| Template anchors | Highest `selected_by_percent` player per position in Template squad |
| Value Spread cost | `valueSpread.teamValueUsed <= premiumSpine.teamValueUsed` |
| Gate flag — no next season | Returns `false` when all events belong to current season |
| Gate flag — next season present | Returns `true` when at least one future-season event present |

### `src/components/optimiser/PreSeasonTab.test.tsx`

| Test | Assertion |
|---|---|
| Gate banner renders | Banner text shown when no next-season events in mock bootstrap |
| 3 cards render | Three `TemplateCard` components present when mock next-season data provided |
| Horizon selector changes xPts | Switching GW1–3 → GW1–8 updates `totalXpts` values |
