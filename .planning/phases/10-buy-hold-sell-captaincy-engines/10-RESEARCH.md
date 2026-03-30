# Phase 10: Buy/Hold/Sell + Captaincy Engines - Research

**Researched:** 2026-03-30
**Domain:** Pure TypeScript logic engines (recommend.ts + captaincy-engine.ts) + React UI components (VerdictBadge, CaptaincyPanel, SquadView column extension) + Vitest tests
**Confidence:** HIGH

---

## Summary

Phase 10 is a pure TypeScript + React phase with no new dependencies and no pipeline changes. All data signals are already computed by Phase 7 — `gem_score` (from gem-score.ts), `proj_pts_1gw`, `mins_risk`, and `start_prob` are present on every `ScoredPlayer`. The work is entirely about two new pure-function engines (`recommend.ts` and `captaincy-engine.ts`) and three new/modified UI components.

The UI-SPEC for this phase was approved before research began and fully specifies component props, Tailwind class contracts, and engine function signatures. The planner must treat the UI-SPEC as the authoritative source for all rendering decisions. Research here fills in the engine logic details (verdict thresholds, captaincy scoring formula, position-average computation) and testing contracts that the UI-SPEC deliberately left to the planner/executor.

**Primary recommendation:** Implement `computeVerdicts` using position-relative gem_score thresholds (not absolute) and `computeCaptaincyCandidates` using `proj_pts_1gw * 2` with `captain_type` derived from `mins_risk === 'nailed' AND gem_score >= position average`. Both functions must be pure and tested with Vitest fixture data covering DGW players, null xG/xA, and injured players.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REC-01 | User can see Buy / Hold / Sell label for each player in their squad | `computeVerdicts` pure function in `src/lib/recommend.ts`; VerdictBadge component in SquadView "Rec" column |
| CAP-01 | User can see top-5 captaincy candidates for next GW with projected captain points | `computeCaptaincyCandidates` pure function in `src/lib/captaincy-engine.ts`; CaptaincyPanel component in TransferPanel |
| CAP-02 | User can distinguish safe captain (nailed, high-floor) from upside captain (differential, high-ceiling) | `captain_type: 'safe' | 'upside'` on each candidate; CaptainTypeBadge (bg-blue-100 / bg-amber-100) |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | project default | Engine logic types | Already in project |
| React 19 | project default | Component rendering | Already in project |
| Tailwind CSS v4 | project default | Badge/panel styling | Already in project — hand-rolled, no shadcn |
| Vitest | project default | Unit tests | Already in project (11 test files, 104 tests passing) |

**No new packages needed.** `src/lib/recommend.ts` and `src/lib/captaincy-engine.ts` are pure TypeScript files with no imports beyond project types.

**Installation:** none required.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── lib/
│   ├── recommend.ts              # NEW: computeVerdicts pure function
│   ├── captaincy-engine.ts       # NEW: computeCaptaincyCandidates pure function
│   ├── gem-score.ts              # EXISTING: no changes needed
│   ├── transfer-engine.ts        # EXISTING: no changes needed
│   └── types.ts                  # EXISTING: no changes needed
├── components/
│   ├── shared/
│   │   ├── VerdictBadge.tsx      # NEW: Buy/Hold/Sell badge
│   │   └── MinsRiskBadge.tsx     # EXISTING: reused in CaptaincyPanel
│   ├── captaincy/
│   │   └── CaptaincyPanel.tsx    # NEW: includes CaptainTypeBadge inline
│   ├── squad/
│   │   └── SquadView.tsx         # MODIFIED: add verdicts prop + Rec column
│   └── transfers/
│       └── TransferPanel.tsx     # MODIFIED: wire verdicts + CaptaincyPanel
tests/
└── lib/
    ├── recommend.test.ts          # NEW: Vitest tests for computeVerdicts
    └── captaincy-engine.test.ts   # NEW: Vitest tests for computeCaptaincyCandidates
```

### Pattern 1: Position-Relative Verdict Thresholds

**What:** Buy/Hold/Sell verdicts compare each squad player's gem_score against the position average of ALL players (not just squad members), consistent with how transfer-engine ranks candidates.

**When to use:** computeVerdicts in recommend.ts

**Logic:**
```typescript
// For each position group (element_type 1/2/3/4):
// 1. Compute average gem_score across ALL scored players at that position
// 2. For each starting-XI squad player:
//    - Buy:  gem_score >= positionAvg * BUY_THRESHOLD  (e.g. 1.05 — above average)
//    - Sell: gem_score <= positionAvg * SELL_THRESHOLD (e.g. 0.85 — meaningfully below average)
//    - Hold: everything else
```

**Rationale:** Using absolute thresholds would be meaningless since gem_score is population-normalised (0.0–1.0). Position-relative thresholds are consistent with the transfer-engine which already compares gem_delta between same-position players.

**Key constraint from decisions log:** "recommend.ts must derive from same gem_score source as transfer-engine.ts — no contradictory signals." A Sell verdict player must score a lower gem_score than a Buy verdict player at the same position.

### Pattern 2: Captaincy Scoring Formula

**What:** `projected_captain_pts = proj_pts_1gw * 2`. This is the projected FPL captain return (captain earns double points).

**When to use:** computeCaptaincyCandidates in captaincy-engine.ts

**Logic:**
```typescript
// 1. Filter to starting-XI only (pick.position 1-11)
// 2. For each starting-XI player, compute projected_captain_pts = proj_pts_1gw * 2
// 3. Classify captain_type:
//    - 'safe'   when mins_risk === 'nailed' AND gem_score >= positionAvg
//    - 'upside' for all other cases
// 4. Sort by projected_captain_pts descending
// 5. Return top N (default 5)
```

**Rationale from UI-SPEC:** `captain_type='safe' when mins_risk='nailed' AND gem_score >= position average`. This is the exact rule the UI-SPEC specifies at the Engine Contracts section.

### Pattern 3: nextGw Derivation

**What:** CaptaincyPanel displays "Captaincy Picks — GW {nextGw}". The `nextGw` value must be passed from TransferPanel.

**How to derive:** `entry_history.event` from SquadPicksResponse holds the current gameweek number. `nextGw = entry_history.event + 1`.

**Note:** `proj_pts_1gw` is already computed for the next GW by the Python pipeline, so this derivation is consistent.

### Pattern 4: Pure Function Test Structure (established project pattern)

The project's existing test files all follow this pattern. New tests must match it exactly:

```typescript
// Source: tests/lib/transfer-engine.test.ts (project pattern)
import { describe, it, expect } from 'vitest'
import { computeVerdicts } from '@/lib/recommend'
import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    // All MergedPlayer base fields with non-null defaults
    // All ScoredPlayer dimension scores
    ...overrides,
  }
}

function makeSquadPick(overrides: Partial<SquadPick> = {}): SquadPick {
  return {
    element: 1, position: 1, multiplier: 1,
    is_captain: false, is_vice_captain: false,
    ...overrides,
  }
}
```

### Anti-Patterns to Avoid

- **Applying normalise() to proj_pts fields:** Locked decision — "projected_pts fields must be absolute FPL points (2-15 range) — normalise() from gem-score.ts must NOT be applied."
- **Using absolute gem_score thresholds for verdicts:** gem_score is population-normalised — the absolute value is meaningless without comparison to position peers.
- **Bench players receiving verdicts:** UI-SPEC: only starting-XI players (pick.position < 12) get VerdictBadge — bench cells are empty.
- **Re-running computeAllGemScores inside the engines:** TransferPanel already computes `scoredPlayers = computeAllGemScores(playersData)` — both engines receive `ScoredPlayer[]`, not `MergedPlayer[]`.
- **Contradictory signals:** A Sell verdict player must have lower gem_score than a Buy verdict player at the same position. Test explicitly for this invariant.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Badge rendering | Custom styled span logic | Follow MinsRiskBadge.tsx pattern exactly | Already established, consistent colour semantics |
| Player data fetching | New fetch hook | `usePlayers()` + `useSquad()` already in TransferPanel | Single query key `['players']` prevents duplicate fetches |
| Gem score computation | Second scoring pass | `scoredPlayers` already in TransferPanel `useMemo` | gem_score already on every ScoredPlayer |
| Position average computation | Complex class | Simple `Array.reduce` over `allPlayers.filter(p => p.element_type === et)` | 4 position groups, straightforward average |

**Key insight:** All data is already available in TransferPanel's existing `scoredPlayers` and `squadData` — the engines are pure computational layers over data that already exists.

---

## Common Pitfalls

### Pitfall 1: Null xG/xA affecting gem_score reliability for verdict thresholds

**What goes wrong:** Players with null `xg_per90` / `xa_per90` have gem_score computed from fewer dimensions. Their gem_score is still valid (the engine excludes null dimensions from the average) but their score is less comparable to players with full dimension coverage.

**Why it happens:** 43 players have null Understat entries (promoted-team players). Locked decision: "xG/xA excluded from gem composite when null (not zero-filled)."

**How to avoid:** The verdict engine uses gem_score as-is — this is the correct approach since it's consistent with the transfer-engine. No special null handling needed. Test coverage: include a fixture player with null xG/xA and verify they receive a valid verdict (not null or error).

**Warning signs:** TypeScript errors trying to access `xg_per90` inside recommend.ts — the engines should only use `gem_score`, not raw dimension values.

### Pitfall 2: Injured players in captain candidates

**What goes wrong:** Players with `mins_risk === 'injured'` (or `status !== 'a'`) could appear as captain candidates if not filtered.

**Why it happens:** `proj_pts_1gw` is non-null for all players (locked decision: "Python pipeline writes 0.0 for missing data, never null"). An injured player has `proj_pts_1gw = 0.0`, which would sort to last — but if the squad has fewer than 5 starting-XI players with `proj_pts_1gw > 0`, injured players could still appear.

**How to avoid:** In `computeCaptaincyCandidates`, filter out players where `proj_pts_1gw <= 0` OR `mins_risk === 'injured'` before taking top N. Test: fixture with an injured squad player — they must not appear in the top 5.

**Warning signs:** A captaincy candidate displaying 0.0 pts (C).

### Pitfall 3: DGW players inflating projections

**What goes wrong:** A player in a Double Gameweek has a much higher `proj_pts_1gw` — they appear as a dominant captain pick, which is correct! But the test suite needs to explicitly cover this to confirm DGW handling is not accidentally broken.

**Why it happens:** `proj_pts_1gw` is computed by the Python pipeline to be DGW-aware (it sums expected points across all matches in the GW). The captain engine uses it directly — no adjustment needed.

**How to avoid:** Include a DGW fixture player (proj_pts_1gw set to e.g. 12.0 to simulate a double) in tests and verify they rank first. This is a success case, not an error — just needs explicit test coverage.

### Pitfall 4: Position average computed from wrong population

**What goes wrong:** Computing position average only from squad players (11 players) instead of all scored players (825 players). The squad average would be much less stable and would produce contradictory verdicts — a squad of 11 mediocre midfielders would have all of them labelled "Hold".

**Why it happens:** It's tempting to filter `allPlayers` to squad members. But the transfer-engine already uses the full player population for comparison.

**How to avoid:** Always compute `positionAvg` from `allPlayers.filter(p => p.element_type === et)`, not from squad picks. Test: a squad player with high gem_score vs full population should be "Buy"; one with low gem_score vs full population should be "Sell".

### Pitfall 5: TransferPanel useMemo dependency arrays

**What goes wrong:** Adding `computeVerdicts` and `computeCaptaincyCandidates` calls outside `useMemo`, causing them to re-run on every render.

**Why it happens:** TransferPanel already uses `useMemo` for `scoredPlayers` and `transferResult`. The new computations must be wrapped in `useMemo` with `[squadData, scoredPlayers]` as dependencies.

**How to avoid:** Follow the existing TransferPanel pattern — wrap all derived computations in `useMemo`.

### Pitfall 6: SquadView props change requires updating all call sites

**What goes wrong:** SquadView receives a new optional `verdicts` prop — if TypeScript strict mode flags the missing prop at existing call sites, the build breaks.

**Why it happens:** SquadView is used in TransferPanel. The prop must be optional (`verdicts?: Map<number, Verdict>`) so existing usage without the prop still compiles.

**How to avoid:** Type as `verdicts?: Map<number, Verdict>` (optional). Cells where `verdicts` is undefined or player not in map render empty.

---

## Code Examples

Verified patterns from existing codebase:

### MinsRiskBadge pattern (badge rendering contract to follow)
```tsx
// Source: src/components/shared/MinsRiskBadge.tsx
<span
  className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
  title={config.title}
>
  {config.label}
</span>
```

VerdictBadge and CaptainTypeBadge must follow this exact span structure.

### Position average computation pattern
```typescript
// Compute position averages from ALL scored players
const positionAverages = new Map<number, number>()
for (const et of [1, 2, 3, 4]) {
  const posPlayers = allPlayers.filter(p => p.element_type === et)
  if (posPlayers.length === 0) {
    positionAverages.set(et, 0.5)
  } else {
    const avg = posPlayers.reduce((s, p) => s + p.gem_score, 0) / posPlayers.length
    positionAverages.set(et, avg)
  }
}
```

### TransferPanel useMemo pattern (for new computations)
```typescript
// Source: src/components/transfers/TransferPanel.tsx (existing pattern)
const verdicts = useMemo(() => {
  if (!squadData || scoredPlayers.length === 0) return new Map()
  return computeVerdicts(squadData.picks, scoredPlayers)
}, [squadData, scoredPlayers])

const captaincyCandidates = useMemo(() => {
  if (!squadData || scoredPlayers.length === 0) return []
  return computeCaptaincyCandidates(squadData.picks, scoredPlayers)
}, [squadData, scoredPlayers])
```

### nextGw derivation
```typescript
// entry_history.event is the current GW number
const nextGw = squadData.entry_history.event + 1
```

### Test factory helper (established project pattern)
```typescript
// Source: tests/lib/transfer-engine.test.ts (pattern to replicate)
function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id: 1, web_name: 'Test', team: 1, team_short_name: 'TST',
    element_type: 3, now_cost: 70, selected_by_percent: '10.0',
    form: '5.0', status: 'a', minutes: 900, starts: 10, total_points: 50,
    defensive_contribution: null, clearances_blocks_interceptions: null,
    direct_freekicks_order: null, penalties_order: null,
    corners_and_indirect_freekicks_order: null, news: '',
    cost_change_event: 0, cost_change_start: 0,
    understat_id: 100, xg_per90: 0.3, xa_per90: 0.15,
    minutes_per90: 85, form_pts_per90: 5.0,
    fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 10, difficulty_score: 0.6, difficulty_tier: 'medium' }],
    proj_pts_1gw: 4.5, proj_pts_3gw: 12.0, proj_pts_5gw: 18.5,
    xmins: 78.0, start_prob: 0.87, mins_risk: 'nailed',
    gem_score: 0.5, fdr_score: 0.5, form_score: 0.5,
    xg_score: 0.5, xa_score: 0.5, ownership_score: 0.5,
    minutes_score: 0.5, set_piece_score: 0.5,
    ...overrides,
  }
}
```

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts are affected.

---

## Environment Availability

Step 2.6: No new external dependencies. All tools already confirmed operational:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Vitest + Next.js | Already in use | project default | — |
| Vitest | Test suite | Already installed | project default (104 tests passing) | — |
| TypeScript | Engine files | Already configured | project default | — |

No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/lib/recommend.test.ts tests/lib/captaincy-engine.test.ts` |
| Full suite command | `npx vitest run` |

Current baseline: 11 test files, 104 tests passing, 8 skipped. Phase 10 adds 2 new test files.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REC-01 | computeVerdicts: Buy/Hold/Sell from gem_score vs position average | unit | `npx vitest run tests/lib/recommend.test.ts` | Wave 0 |
| REC-01 | computeVerdicts: only starting-XI (position 1-11) receive verdicts | unit | `npx vitest run tests/lib/recommend.test.ts` | Wave 0 |
| REC-01 | computeVerdicts: no contradictory verdicts (Sell gem < Buy gem at same position) | unit | `npx vitest run tests/lib/recommend.test.ts` | Wave 0 |
| REC-01 | computeVerdicts: player with null xG/xA still receives a valid verdict | unit | `npx vitest run tests/lib/recommend.test.ts` | Wave 0 |
| CAP-01 | computeCaptaincyCandidates: returns top-5 sorted by proj_pts_1gw * 2 desc | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | Wave 0 |
| CAP-01 | computeCaptaincyCandidates: only starting-XI picks considered | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | Wave 0 |
| CAP-01 | computeCaptaincyCandidates: DGW player (high proj_pts_1gw) ranks first | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | Wave 0 |
| CAP-01 | computeCaptaincyCandidates: injured player (proj_pts_1gw=0) not in top 5 | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | Wave 0 |
| CAP-02 | captain_type='safe' when mins_risk='nailed' AND gem_score >= position avg | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | Wave 0 |
| CAP-02 | captain_type='upside' for rotation_risk player regardless of gem_score | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | Wave 0 |
| CAP-02 | captain_type='upside' for likely_start player even with high gem_score | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/recommend.test.ts tests/lib/captaincy-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (all 104 + new tests) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/recommend.test.ts` — covers REC-01 engine logic
- [ ] `tests/lib/captaincy-engine.test.ts` — covers CAP-01 + CAP-02 engine logic

*(UI components — VerdictBadge, CaptaincyPanel, CaptainTypeBadge, SquadView modification — are not unit tested via Vitest per project pattern: no existing component tests in `tests/`. Testing is via engine tests + manual verification.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| n/a (no verdict engine) | Position-relative gem_score thresholds | Phase 10 new | Consistent with transfer-engine signals |
| n/a (no captaincy panel) | proj_pts_1gw * 2 ranked list | Phase 10 new | Uses existing pipeline data, no extra computation |

---

## Open Questions

1. **Exact verdict threshold values (BUY_THRESHOLD / SELL_THRESHOLD)**
   - What we know: The UI-SPEC specifies the algorithm ("gem_score relative to position average") but not the exact multipliers.
   - What's unclear: Should Buy require gem_score > positionAvg * 1.05 (5% above average)? Or > positionAvg alone (any above-average)?
   - Recommendation: Use `gem_score > positionAvg` for Buy, `gem_score < positionAvg * 0.90` for Sell (10% below average = Hold is the default). This gives a wide Hold band for average-performing squad players and reserves Buy/Sell for clear signals. The exact values are Claude's discretion — document in comments in `recommend.ts` and include in test assertions so they are visible.

2. **Fewer than 5 viable captain candidates**
   - What we know: UI-SPEC says "render all available candidates" if fewer than 5 — no placeholder rows.
   - What's unclear: At the very start of a season or with a small squad, there might be 0 candidates.
   - Recommendation: Return empty array when no viable candidates — CaptaincyPanel not rendered (same gate as `captaincyCandidates.length > 0` per UI-SPEC).

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md contains: `@AGENTS.md`

AGENTS.md states:
> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Directives for Phase 10:**
- Before writing any Next.js route or API code, read `node_modules/next/dist/docs/` for current API conventions. Phase 10 adds no new routes (engines are pure TypeScript, UI is client components) — this constraint does not block Phase 10 work, but applies to any route.ts modification.
- The existing Route Handler pattern in `src/app/api/squad/[teamId]/route.ts` uses `params: Promise<{ teamId: string }>` with `await params` — this is the current Next.js 16 convention. Do not revert to synchronous params if modifying route files.

**Additional observed constraints (from decisions log and existing code):**
- No shadcn — hand-rolled Tailwind v4 components only (confirmed in UI-SPEC).
- `'use client'` directive required on all interactive components (SquadView, TransferPanel are already client components).
- `useMemo` required for all derived computations in TransferPanel.
- Engine functions must be pure — no side effects, no fetch calls.
- `normalise()` from gem-score.ts must NOT be called on `proj_pts` fields.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection:
  - `src/lib/gem-score.ts` — gem_score computation, normalise() function, dimension scoring
  - `src/lib/transfer-engine.ts` — established engine pattern, position filtering, pure function contract
  - `src/lib/types.ts` — ScoredPlayer, MergedPlayer, MinsRisk types
  - `src/lib/squad-adapter.ts` — SquadPick, EntryHistory types
  - `src/components/transfers/TransferPanel.tsx` — useMemo patterns, scoredPlayers derivation, component wiring
  - `src/components/squad/SquadView.tsx` — current props interface, bench detection (position >= 12)
  - `src/components/shared/MinsRiskBadge.tsx` — badge rendering contract to replicate
  - `tests/lib/transfer-engine.test.ts` — test factory pattern, makeScoredPlayer helper
  - `.planning/phases/10-buy-hold-sell-captaincy-engines/10-UI-SPEC.md` — approved UI contract, engine signatures

- `.planning/STATE.md` decisions log — locked decisions including "recommend.ts must derive from same gem_score source as transfer-engine.ts", "proj_pts must be absolute FPL points", "rotation_risk classification gated on status='a' + blank news"

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — REC-01, CAP-01, CAP-02 requirement text
- `.planning/PROJECT.md` — current state summary, tech stack confirmation

### Tertiary (LOW confidence)

- None. All research is from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already in use
- Architecture patterns: HIGH — derived directly from existing code (transfer-engine.ts, TransferPanel.tsx, MinsRiskBadge.tsx)
- Engine logic (thresholds): MEDIUM — position-relative approach is well-grounded but exact multipliers are discretionary
- Pitfalls: HIGH — derived from existing decisions log and observed code patterns
- Test requirements: HIGH — test framework confirmed working (104 passing), test patterns from existing files

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable internal codebase — no external API dependency)
