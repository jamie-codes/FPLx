# Phase 111: Fixture Heatmap & Planner Cross-Position Fixes — Research

**Researched:** 2026-05-15
**Domain:** TypeScript club-form computation (FIX-01) + transfer engine data integrity (FIX-02)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FIX-01: Data Layer**
- D-01: Fix lives in the **pipeline layer**: add `current_gw_played: ClubFormFixture[]` as a new field on `ClubForm`. Do NOT extend `upcoming_fixtures` with finished games. Do NOT use a component-only heuristic.
- D-02: `current_gw_played` is populated with **finished fixtures from the active GW only** (bootstrap `current` event id). Not historical GWs.
- D-03 (type): Add `finished: boolean` is NOT needed on `ClubFormFixture` — the new `current_gw_played` field carries the semantic.

**FIX-01: "Played" Cell Visual**
- D-04: Played cell rendering: **difficulty color at ~40% opacity** + opponent short-name label.
- D-05: Played cell tooltip: `"[OPP] (H/A) — Played"` — no difficulty score for played cells.
- D-06: True BGW cells continue to render as blank with title `"No fixture (BGW)"`. Played = dimmed color cell; true BGW = blank cell. Must be visually distinct.

**FIX-02: Cross-Position Suggestions**
- D-07: Research priority: audit **`element_type` data integrity** through the merge pipeline first. If data is clean, then audit all 4 call sites for incorrect `currentPicks`/`players` arguments.
- D-08: Bug is reported across surfaces (not isolated to one tab), supporting the data-integrity hypothesis.
- D-09: Fix should add a **defensive assertion or guard** at the point the root cause is found.

**Test Strategy**
- D-10: FIX-01 tests: extend `src/components/club-form/FixtureHeatMap.test.tsx`. Extend pipeline tests for `current_gw_played` population. No new test files.
- D-11: FIX-02 tests: add a targeted regression test in `src/lib/suggest-transfers.test.ts`. Engine-level coverage is sufficient.
- D-12: TDD RED→GREEN throughout.

### Claude's Discretion
- Exact opacity CSS implementation for the played cell (opacity modifier class vs. inline style vs. RGBA color function)
- Whether `current_gw_played` is populated by a new helper function in `merge.py` or inline in the existing club-form builder
- DGW handling: if a team played both legs of a DGW mid-week, render each played leg in `current_gw_played` (same split-cell pattern as upcoming DGW, dimmed)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | User sees current-GW fixture correctly when a team has already played mid-week — heatmap must not show BGW for a completed fixture | TypeScript `computeClubForm` fix: pass `events` from route, derive `current_gw`, build `current_gw_played` from finished current-GW fixtures |
| FIX-02 | Transfer planner only suggests buy candidates of the same position as the player being transferred out | Engine filter at `suggest-transfers.ts:118` is correct; `element_type` data in `merged_players.json` is clean (832 players, all valid 1–4); root cause likely upstream or in call-site argument construction |
</phase_requirements>

---

## Summary

Phase 111 addresses two isolated bugs. Both have been traced to their root causes via direct code inspection and live data probing.

**FIX-01 Root Cause (VERIFIED):** The `FixtureHeatMap` component reads from `t.upcoming_fixtures` only (populated from `!f.finished` fixtures). Mid-week, after some GW teams have played, their finished fixtures are excluded from `upcoming_fixtures` by the filter in `computeClubForm`. The heatmap's `byTeamGw` map therefore has no entry for those teams at the current GW event_id — falling through to the `fixtures.length === 0` branch and rendering a false BGW cell. The heatmap DOES include that GW in `allEventIds` (because at least one team still has it as upcoming), so the column appears but the played teams show blank. The fix requires `computeClubForm` to separately track finished current-GW fixtures as `current_gw_played` and the component to render them with a dimmed style.

**Critical FIX-01 Architecture Finding (VERIFIED):** The CONTEXT.md canonical references point to `pipeline/merge.py` for the data layer fix. This is INCORRECT. The club-form data is computed entirely at request time by the TypeScript function `computeClubForm` in `src/lib/club-form.ts`, called from `src/app/api/club-form/route.ts`. The pipeline (`pipeline/merge.py`) has ZERO involvement in `ClubForm` generation — no Python code writes `ClubForm` data. The fix must be in `src/lib/club-form.ts` and `src/lib/types.ts`, not `pipeline/merge.py`. The route already reads `fpl_bootstrap.json` (which contains `events`) but currently passes only `{ teams: bootstrap.teams }` to `computeClubForm`, discarding events. Passing `events` through is the key route change.

**FIX-02 Root Cause (PARTIALLY VERIFIED):** The `suggestTransfers` engine position filter (line 118 of `suggest-transfers.ts`) is correct: `players.filter(p => p.element_type === pos ...)`. The `merged_players.json` cache has valid `element_type` for all 832 players (distribution: GK=97, DEF=269, MID=373, FWD=93, zero invalid). The data-integrity hypothesis from CONTEXT.md D-07 is not confirmed by the current cache. The cross-position display is most likely a rendering-layer issue where UI components show all suggestions without re-filtering by the specific sell player's position. The engine returns suggestions for ALL positions simultaneously — the caller or renderer must filter to the position of the selected sell player. This requires auditing how each call site displays results.

**Primary recommendation:** Fix FIX-01 entirely in `src/lib/club-form.ts` + `src/lib/types.ts` + the route (not pipeline/merge.py). For FIX-02, audit the rendering layer at each call site for missing sell-position filtering of the displayed results.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Club form data (fixtures) | API (TypeScript server function) | Client cache via React Query | `computeClubForm` runs server-side at request time; data served as JSON to client |
| Heatmap rendering | Browser / Client | — | `FixtureHeatMap` is a React client component (`'use client'`) |
| Transfer suggestions | Browser / Client (useMemo) | — | `suggestTransfers` is a pure function called in component useMemos |
| `ClubForm` type + interface | TypeScript types layer | — | `src/lib/types.ts`; no Python equivalent |
| Current GW detection | API route + `computeClubForm` | — | `fpl_bootstrap.json` events array; `is_current` flag |

---

## Standard Stack

### Core (no changes needed — existing stack)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.1.2 | Test runner | [VERIFIED: package.json] Project standard; jsdom environment configured |
| @testing-library/react | ^16.3.2 | Component tests | [VERIFIED: package.json] Used by FixtureHeatMap.test.tsx |
| Tailwind CSS | (project standard) | Opacity utility classes | [VERIFIED: codebase] `opacity-40` utility exists; used for played cell dimming |
| React Query (tanstack) | (project standard) | Data fetching cache | [VERIFIED: useClubForm.ts] `staleTime: 6h` means new field flows through without hook changes |

### No new packages needed
Both fixes are pure TypeScript/logic changes. No new dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
FIX-01 Data Flow:
fpl_bootstrap.json ──► route.ts
fpl_fixtures.json  ──► (events currently DROPPED) ──► computeClubForm({ teams }) ──► ClubForm[]
                              │
                              ▼ (FIX: pass events)
                       computeClubForm({ teams, events }) ──► ClubForm[] with current_gw_played
                              │
                    /api/club-form ──► useClubForm() ──► FixtureHeatMap
                                                              │
                                        byTeamGw (upcoming) ─┤
                                        byTeamGwPlayed (new) ─┤──► cell render decision
                                                              │
                                              fixtures.length === 0 AND played.length === 0 → BGW
                                              fixtures.length === 0 AND played.length > 0  → Played cell (dimmed)
                                              fixtures.length > 0                          → Normal cell

FIX-02 Data Flow:
merged_players.json ──► /api/players ──► usePlayers() ──► computeAllGemScores() ──► scoredPlayers
                                                                                         │
squadData.picks ─────────────────────────────────────────────────────────────────────────┤
                                                                                         ▼
                                                                              suggestTransfers()
                                                                            (returns ALL positions)
                                                                                         │
                              ┌─────────────────────────────────────────────────────────┘
                              ▼
               TransferPanel.tsx (call site 1) ──► OpportunityCostTable (no position filter on display)
               OptimiserPanel.tsx (call site 2) ──► transfer suggestions rendered
               DecisionSummaryTab.tsx (call site 3) ──► OCS rows rendered
               RivalsTab.tsx (call site 4) ──► suggestions rendered
```

### Recommended Project Structure (no changes)
```
src/
├── lib/
│   ├── club-form.ts       # FIX-01: add events param, current_gw_played builder
│   ├── types.ts           # FIX-01: add current_gw_played to ClubForm interface
│   │                      # FIX-01: add events to RawBootstrap interface
│   └── suggest-transfers.ts # FIX-02: likely no change; regression test target
├── app/api/club-form/
│   └── route.ts           # FIX-01: pass bootstrap.events to computeClubForm
└── components/club-form/
    └── FixtureHeatMap.tsx  # FIX-01: render played cells from current_gw_played
```

### Pattern 1: Current GW Derivation in computeClubForm

**What:** Derive `current_gw` from `events` array (same logic already used in `pipeline/merge.py` lines 736–747, but ported to TypeScript for `computeClubForm`).

**When to use:** When `computeClubForm` needs to know which GW is active to separate played fixtures.

**Example:**
```typescript
// Source: pipeline/merge.py:736-747 (Python equivalent, verified)
interface RawEvent {
  id: number
  is_current: boolean
  finished: boolean
}

interface RawBootstrap {
  teams: RawTeam[]
  events?: RawEvent[]  // optional for backward compatibility
}

// In computeClubForm:
const currentGw = bootstrap.events?.find(e => e.is_current)?.id
  ?? bootstrap.events?.filter(e => e.finished).slice(-1)[0]?.id
  ?? null
```

### Pattern 2: current_gw_played Builder (mirrors upcoming_fixtures pattern)

**What:** Build `current_gw_played` by iterating finished current-GW fixtures using the same field shape as `upcoming_fixtures`.

**When to use:** In `computeClubForm`, after `teamUpcoming` is built.

**Example:**
```typescript
// Source: VERIFIED by reading src/lib/club-form.ts:99-128 and pipeline/merge.py:860-891
const teamPlayedCurrentGw = new Map<number, ClubFormFixture[]>()
for (const t of teams.keys()) teamPlayedCurrentGw.set(t, [])

if (currentGw !== null) {
  const currentGwFinished = finished.filter(f => f.event === currentGw)
  for (const fix of currentGwFinished) {
    const hList = teamPlayedCurrentGw.get(fix.team_h)
    if (hList) {
      const opp = teams.get(fix.team_a)
      const attDiff = fplToAttDiff(fix.team_h_difficulty)
      hList.push({
        opponent_team: opp?.short_name ?? String(fix.team_a),
        is_home: true,
        event_id: fix.event!,
        difficulty_score: attDiff,
        difficulty_tier: tier(attDiff),
        attacking_difficulty: attDiff,
        defensive_difficulty: defScore(fix.team_a),
      })
    }
    const aList = teamPlayedCurrentGw.get(fix.team_a)
    if (aList) {
      const opp = teams.get(fix.team_h)
      const attDiff = fplToAttDiff(fix.team_a_difficulty)
      aList.push({
        opponent_team: opp?.short_name ?? String(fix.team_h),
        is_home: false,
        event_id: fix.event!,
        difficulty_score: attDiff,
        difficulty_tier: tier(attDiff),
        attacking_difficulty: attDiff,
        defensive_difficulty: defScore(fix.team_h),
      })
    }
  }
}
```

### Pattern 3: HeatMapRow Played Cell Rendering

**What:** Add a new render branch in `HeatMapRow` for `current_gw_played` fixtures, using `opacity-40` on the `<td>` (or equivalent) to signal "already happened."

**When to use:** When `byTeamGwPlayed.get(team_id)?.get(gw)` returns fixtures (played state) but `byTeamGw` returns nothing.

**Example:**
```typescript
// Source: VERIFIED by reading FixtureHeatMap.tsx:82-134
// Extend the gw map iteration:
{grid.allEventIds.map(gw => {
  const fixtures = grid.byTeamGw.get(t.team_id)?.get(gw) ?? []
  const playedFixtures = grid.byTeamGwPlayed.get(t.team_id)?.get(gw) ?? []

  if (fixtures.length === 0 && playedFixtures.length === 0) {
    return <td key={gw} ... title="No fixture (BGW)" />  // unchanged
  }

  if (fixtures.length === 0 && playedFixtures.length > 0) {
    // Played cell: dimmed difficulty color, opponent label, "Played" tooltip
    // For single played fixture:
    const f = playedFixtures[0]
    return (
      <td
        key={gw}
        className={`... ${TIER_CLASSES[currentTier(f, mode)]} opacity-40`}
        title={`${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — Played`}
      >
        <span className="text-xs font-mono">{f.opponent_team}</span>
      </td>
    )
  }
  // ... existing normal cell code
})}
```

### Pattern 4: HeatMapRow grid useMemo Extension

**What:** Extend the `grid` useMemo to build a second map `byTeamGwPlayed` from `current_gw_played`, independently of `byTeamGw` (upcoming).

**When to use:** In the `FixtureHeatMap` component's `grid` useMemo.

**Key implementation note:** `allEventIds` is derived from `upcoming_fixtures` only — but the current GW's event_id may NOT appear in any team's upcoming_fixtures mid-week (when all games that week have finished). The allEventIds computation must be extended to also include the event_ids from `current_gw_played` so the current GW column always appears.

```typescript
// Source: VERIFIED by reading FixtureHeatMap.tsx:174-193
const allEventIds = Array.from(
  new Set([
    ...data.flatMap(t => t.upcoming_fixtures.map(f => f.event_id)),
    ...data.flatMap(t => (t.current_gw_played ?? []).map(f => f.event_id)),
  ])
).sort((a, b) => a - b).slice(0, horizon)

const byTeamGwPlayed = new Map<number, Map<number, ClubFormFixture[]>>()
for (const t of data) {
  const m = new Map<number, ClubFormFixture[]>()
  for (const f of (t.current_gw_played ?? [])) {
    const arr = m.get(f.event_id) ?? []
    arr.push(f)
    m.set(f.event_id, arr)
  }
  byTeamGwPlayed.set(t.team_id, m)
}
```

### Anti-Patterns to Avoid

- **Do NOT add `finished: boolean` to `ClubFormFixture`** — D-03 explicitly prohibits this. The field placement (in `current_gw_played` vs `upcoming_fixtures`) carries the semantic.
- **Do NOT filter `upcoming_fixtures` mid-component by checking if fixtures are finished** — this is the heuristic approach rejected in D-01. The data layer owns this distinction.
- **Do NOT fix FIX-01 in `pipeline/merge.py`** — ClubForm is not produced by the Python pipeline. The canonical references in CONTEXT.md are incorrect on this point (see Critical Finding above).
- **Do NOT filter `scoredPlayers` by position before passing to `suggestTransfers`** — the engine needs the full player pool to build top-30 per position correctly. Position filtering happens inside the engine.
- **Do NOT change the `suggestTransfers` engine's position filter** — it is already correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Current GW detection | Custom date logic | `events.find(e => e.is_current)?.id` | FPL bootstrap already exposes `is_current` flag; verified in live data |
| Opacity styling | Custom CSS color mixing | Tailwind `opacity-40` class or `RGBA` inline style | Tailwind approach stays consistent with existing `TIER_CLASSES` pattern |
| DGW played cells | New split-cell component | Reuse existing DGW gradient pattern from `FixtureHeatMap.tsx:93-120`, dimmed via opacity | Pattern already handles 2-3 fixture DGW display |

---

## Common Pitfalls

### Pitfall 1: FIX-01 — allEventIds missing current GW when ALL games have finished

**What goes wrong:** If ALL teams have played the current GW (season end or a completed mid-week round), `upcoming_fixtures` for ALL teams will have no entries at that event_id. The current `allEventIds` computation (`data.flatMap(t => t.upcoming_fixtures.map(f => f.event_id))`) produces no entry for the current GW. The column doesn't appear at all — so the "played" cell is never rendered.

**Why it happens:** `allEventIds` is derived exclusively from `upcoming_fixtures`. Once all current-GW fixtures are finished, that GW disappears from upcoming.

**How to avoid:** Include `current_gw_played` event_ids when computing `allEventIds` (see Pattern 4 above).

**Warning signs:** Test with all current-GW fixtures finished — the current GW column disappears entirely.

### Pitfall 2: FIX-01 — Route passes only `{ teams: bootstrap.teams }` to computeClubForm

**What goes wrong:** `computeClubForm` has no access to `events` and cannot determine `current_gw`. The fix fails silently — `current_gw_played` is always empty.

**Why it happens:** The route currently drops `bootstrap.events` before calling `computeClubForm`.

**How to avoid:** The route must pass `events: bootstrap.events` (or at minimum `currentGwId`) to `computeClubForm`. The `RawBootstrap` interface in `club-form.ts` must be extended.

**Warning signs:** `current_gw_played` is always `[]` in API response even when games have finished.

### Pitfall 3: FIX-01 — Backward compatibility of `current_gw_played` field

**What goes wrong:** Any code that reads `ClubForm` via `useClubForm()` and doesn't expect `current_gw_played` will work fine (TypeScript optional field), but the test helper function `team()` in `FixtureHeatMap.test.tsx` must be updated to include `current_gw_played: []` in the returned `ClubForm` object.

**Why it happens:** TypeScript interface requires the field if non-optional; existing test helper builds a `ClubForm` literal.

**How to avoid:** Declare `current_gw_played` as required in the interface (consistent with all other fields). Update the `team()` helper in `FixtureHeatMap.test.tsx` to include `current_gw_played: []`.

### Pitfall 4: FIX-01 — DGW played cell uses same gradient as upcoming DGW but needs opacity

**What goes wrong:** A team that played both legs of a DGW mid-week has two entries in `current_gw_played`. Applying the same split-cell gradient pattern without opacity makes it look like an upcoming DGW.

**Why it happens:** The gradient pattern (upcoming DGW) and the played pattern share similar structure.

**How to avoid:** Apply `opacity-40` to the entire `<td>` (wrapping the gradient) regardless of whether it's single or DGW played. The opacity is the visual distinguisher.

### Pitfall 5: FIX-02 — Engine is correct; display may show all suggestions without position context

**What goes wrong:** `suggestTransfers` returns suggestions for ALL positions simultaneously (it operates on the full squad). If a UI component renders all suggestions without filtering to "only show buys matching the sell player's position," a GK sell's row can show MID buys from other suggestions in the same result set.

**Why it happens:** The engine returns a flat list of `TransferSuggestion[]`. Each `single` suggestion has `.sell.element_type === .buy.element_type` (guaranteed by engine). But if the UI renders ALL suggestions without a "selected player" filter, unrelated position suggestions appear.

**How to avoid:** During FIX-02 audit, check whether each call site has a mechanism to show only suggestions relevant to the currently selected sell player. If the UI shows a full OCS table without a player-selection context, cross-position suggestions appear naturally (the DEF-to-DEF suggestion and the GK-to-GK suggestion are both present and both valid — but if the user is looking at a "why is my GK being suggested out?" view and sees MID candidates, those are from a different single suggestion's `.buy`).

**Key audit question:** Does each call site filter `ocsSuggestions` / `transferSuggestions` to only the selected player's position before rendering? Or does it show the full ranked list?

### Pitfall 6: FIX-02 — element_type data is clean in current cache but may drift

**What goes wrong:** The current `merged_players.json` cache shows all 832 players with valid `element_type` (1/2/3/4). But the bug is reported as reproducible — either the bug occurs with stale/corrupt cache data, or the rendering hypothesis is more likely.

**Why it happens:** Pipeline can in theory produce a player with wrong `element_type` if `bootstrap.elements[i].element_type` is wrong in the FPL API response.

**How to avoid:** D-09 says add a defensive guard at the point the root cause is found. At minimum, add a runtime assertion in `suggestTransfers` or in the pipeline that validates `element_type in [1,2,3,4]`.

---

## Code Examples

### Adding events to computeClubForm signature

```typescript
// Source: VERIFIED — src/lib/club-form.ts (current interface, lines 24-38)
// Current RawBootstrap:
interface RawBootstrap {
  teams: RawTeam[]
}

// Extended for FIX-01:
interface RawEvent {
  id: number
  is_current: boolean
  finished: boolean
}

interface RawBootstrap {
  teams: RawTeam[]
  events?: RawEvent[]
}
```

### Route change (route.ts line 36)

```typescript
// Source: VERIFIED — src/app/api/club-form/route.ts:35-37
// Current:
const data = computeClubForm({ teams: bootstrap.teams }, fixtures)

// Fixed:
const data = computeClubForm({ teams: bootstrap.teams, events: bootstrap.events }, fixtures)
```

### Test for FIX-01 played cell (extend FixtureHeatMap.test.tsx)

```typescript
// Source: VERIFIED — src/components/club-form/FixtureHeatMap.test.tsx (team() helper pattern)
// Update team() helper to include current_gw_played:
function team(id: number, short: string, fixtures: ClubFormFixture[], playedFixtures: ClubFormFixture[] = []): ClubForm {
  return {
    // ... existing fields ...
    upcoming_fixtures: fixtures,
    current_gw_played: playedFixtures,
    // ... ease fields ...
  } as ClubForm
}

// FIX-01 test case:
it('FIX-01: played cell renders dimmed difficulty color and "Played" tooltip, distinct from BGW', () => {
  const playedFix = fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' })
  const data: ClubForm[] = [
    team(1, 'ARS', [], [playedFix]),  // ARS played GW35, no upcoming GW35
    team(2, 'CHE', [fix({ opp: 'BHA', home: true, gw: 35, tier: 'medium' })]),  // CHE upcoming
  ]
  mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
  const { container } = render(<FixtureHeatMap />)
  // ARS row: played cell should be dimmed (opacity) and show "Played" tooltip
  const arsRow = container.querySelector('tbody tr:nth-child(1)')!
  const arsCell = arsRow.querySelectorAll('td')[0]  // GW35 = first column
  expect(arsCell.getAttribute('title')).toBe('MCI (H) — Played')
  expect(arsCell.className).toMatch(/opacity-40|opacity/)  // dimmed
  expect(arsCell.className).toMatch(/bg-green-100|bg-green-900/)  // difficulty color preserved
  // BGW cell would have bg-zinc-50 and "No fixture (BGW)" — verify ARS cell is NOT BGW
  expect(arsCell.className).not.toMatch(/bg-zinc-50/)
  expect(arsCell.getAttribute('title')).not.toBe('No fixture (BGW)')
})
```

### Test for FIX-02 regression (extend suggest-transfers.test.ts)

```typescript
// Source: VERIFIED — src/lib/suggest-transfers.test.ts (makeValidSquad pattern)
// Add to existing describe block:
it('FIX-02 regression: single suggestions never produce a buy of different position than the sell', () => {
  const { picks, players } = makeValidSquad()
  // Add strong candidates across all positions
  const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, team: 10 })
  const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.5, team: 11 })
  const strongMid = makePlayer({ id: 22, element_type: 3, xPts_1gw: 8.0, team: 12 })
  const strongFwd = makePlayer({ id: 23, element_type: 4, xPts_1gw: 7.5, team: 13 })
  const result = suggestTransfers({
    currentPicks: picks,
    players: [...players, strongGk, strongDef, strongMid, strongFwd],
    horizon: 1, ftCount: 1, bank: 1000,
  })
  const singles = result.filter(s => s.kind === 'single')
  expect(singles.length).toBeGreaterThan(0)
  for (const sug of singles) {
    if (sug.kind === 'single') {
      // Position lock invariant: sell and buy must be same element_type
      expect(sug.sell.element_type).toBe(sug.buy.element_type)
    }
  }
})
```

---

## Runtime State Inventory

> Not applicable — this is a bug-fix phase with no renames, rebrands, or migrations.

None — verified by phase description.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner | Yes | v25.8.1 | — |
| Vitest | Test execution | Yes | ^4.1.2 | — |
| fpl_bootstrap.json | FIX-01 current GW detection | Yes | pipeline/cache/ | Blob storage (production) |
| fpl_fixtures.json | FIX-01 fixture data | Yes | pipeline/cache/ | Blob storage (production) |
| merged_players.json | FIX-02 element_type audit | Yes | pipeline/cache/ | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx src/lib/suggest-transfers.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | Played cell renders with dimmed color + "Played" tooltip | unit (jsdom) | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` | Extend existing |
| FIX-01 | Played cell is visually distinct from BGW cell | unit (jsdom) | same | Extend existing |
| FIX-01 | True BGW cell unchanged (blank, "No fixture (BGW)") | unit (jsdom) | same | Existing: HEAT-02 |
| FIX-01 | DGW played cell uses split-cell with opacity | unit (jsdom) | same | Extend existing |
| FIX-01 | `current_gw_played` builder produces correct fixtures | unit (node) | `npx vitest run src/lib/club-form.test.ts` | Check/create |
| FIX-02 | Engine never returns single suggestion with mismatched positions | unit (node) | `npx vitest run src/lib/suggest-transfers.test.ts` | Extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx src/lib/suggest-transfers.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- Extend `src/components/club-form/FixtureHeatMap.test.tsx` — add FIX-01 played-cell cases (new test cases in existing file, no new file)
- Extend `src/lib/suggest-transfers.test.ts` — add FIX-02 position-lock regression (new test case in existing file, no new file)
- Check if `src/lib/club-form.test.ts` exists — if not, create to test `computeClubForm` with events/current_gw_played

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable (no auth changes) |
| V3 Session Management | No | Not applicable |
| V4 Access Control | No | Not applicable |
| V5 Input Validation | Yes (low risk) | `events` array from trusted local JSON cache; no user input involved |
| V6 Cryptography | No | Not applicable |

No security concerns for this phase. Both fixes operate on trusted pipeline data (local JSON cache or Vercel Blob) with no user-supplied inputs entering the computations.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Component-only BGW heuristic | Data-layer field `current_gw_played` | Phase 111 (this phase) | Reliable distinction between played and true BGW |
| `computeClubForm({ teams })` | `computeClubForm({ teams, events })` | Phase 111 (this phase) | Current GW detection available in TypeScript club-form builder |

---

## Open Questions (RESOLVED)

1. **Does `src/lib/club-form.test.ts` exist?**
   - What we know: `FixtureHeatMap.test.tsx` is the component test (confirmed). `suggest-transfers.test.ts` is the engine test (confirmed).
   - What's unclear: Whether a unit test file for `computeClubForm` itself exists.
   - Recommendation: Check existence before Wave 0. If absent, create it to test the `current_gw_played` builder logic in isolation (node environment, no jsdom needed).

2. **FIX-02 root cause — rendering layer vs. data layer**
   - What we know: Engine position filter is correct (verified). Data is clean in current cache. Bug reported across surfaces (D-08).
   - What's unclear: Whether the cross-position display occurs because the OCS table renders all suggestions simultaneously (and the user sees MID-vs-MID suggestions appearing next to their GK, misinterpreting them as cross-position), or whether there's a call-site argument error.
   - Recommendation: Planner should schedule a code audit of all 4 call sites' rendering layers as Wave 1 Task 1 before writing any fix. The FIX-02 regression test (engine-level) should still be written as Wave 0.

3. **`allEventIds` extension — horizon slicing interaction**
   - What we know: `allEventIds` is sliced to `horizon` (8/12/16). If `current_gw_played` event_id is earlier than all upcoming events (e.g., GW35 played, upcoming starts GW36), adding it extends the column set.
   - What's unclear: Whether the current GW's column should always appear first (it predates all upcoming GWs), and whether the slice-to-horizon count should still be the same.
   - Recommendation: Current GW played fixtures will always have a smaller event_id than upcoming GWs. Sort + slice to `horizon` will naturally place the played column first. The horizon count remains the same — no user-visible change to column count.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `suggestTransfers` engine is correctly position-filtered and the cross-position display is a rendering-layer issue | FIX-02 root cause | If wrong: the engine itself has a bug and needs changing — but the regression test will catch this regardless |
| A2 | CONTEXT.md canonical reference to `pipeline/merge.py` for FIX-01 data layer is incorrect; the fix belongs in `src/lib/club-form.ts` | Architecture | HIGH CONFIDENCE this is correct — verified by tracing the entire call chain from route to component. No Python code produces ClubForm data. |
| A3 | `ClubFormFixture` has no `finished` field and none is needed (D-03) — the array placement carries the semantic | Types | Consistent with CONTEXT.md D-03; no risk |

**Note on A2:** This is marked ASSUMED only because it contradicts CONTEXT.md. The codebase evidence is unambiguous: `pipeline/merge.py` has zero references to `ClubForm`, `club_form`, or `computeClubForm`. The `club-form` API route calls the TypeScript function exclusively. The planner must target `src/lib/club-form.ts` and NOT `pipeline/merge.py` for FIX-01's data layer change.

---

## Sources

### Primary (HIGH confidence — VERIFIED by direct code inspection)
- `src/lib/club-form.ts` — Full read; confirmed `computeClubForm` is TypeScript-only, reads `RawFixture.finished`, has no current_gw awareness
- `src/app/api/club-form/route.ts` — Full read; confirmed route passes `{ teams: bootstrap.teams }` only (drops events)
- `src/components/club-form/FixtureHeatMap.tsx` — Full read; confirmed `byTeamGw` built from `upcoming_fixtures` only; `fixtures.length === 0` → BGW
- `src/components/club-form/FixtureHeatMap.test.tsx` — Full read; confirmed 46 tests passing, `team()` helper structure
- `src/lib/suggest-transfers.ts` — Full read; position filter at line 118 confirmed correct
- `src/lib/suggest-transfers.test.ts` — Full read; 46 tests passing, no FIX-02 regression test exists
- `src/lib/types.ts` — Read lines 1-200 + 480-540; `ClubForm` interface confirmed, `MergedPlayer.element_type: PositionCode`
- `pipeline/merge.py` — Read lines 720-1030; confirmed zero ClubForm involvement
- `pipeline/cache/merged_players.json` — Live data audit: 832 players, all element_type 1–4, zero invalid
- `pipeline/cache/fpl_bootstrap.json` — Live data: current GW = 35, is_current: true
- `pipeline/cache/fpl_fixtures.json` — Live data: GW35 all 10 fixtures finished; GW36 has 11 upcoming

### Secondary (MEDIUM confidence)
- `src/components/transfers/TransferPanel.tsx` — Partial read (lines 1-290); call site 1 passes `scoredPlayers` (full pool, all positions) to `suggestTransfers`
- `src/components/optimiser/OptimiserPanel.tsx` — Lines 255-298; call site 2 passes `playersData` (full pool)
- `src/components/squad/DecisionSummaryTab.tsx` — Lines 215-260; call site 3 passes `scoredPlayers` (full pool)
- `src/components/rivals/RivalsTab.tsx` — Lines 70-92; call site 4 passes `playersData` (full pool)

---

## Metadata

**Confidence breakdown:**
- FIX-01 root cause: HIGH — verified by reading full data pipeline from cache through route to component
- FIX-01 fix location: HIGH — unambiguous; TypeScript only
- FIX-02 root cause: MEDIUM — engine is correct (HIGH confidence); rendering-layer hypothesis is MEDIUM (not directly observed in a failing user session)
- Architecture patterns: HIGH — derived from actual code, not assumptions
- Test coverage plan: HIGH — verified existing test structure

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable codebase; no fast-moving dependencies)
