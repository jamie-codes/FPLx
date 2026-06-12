# UIX-02: Home Command Centre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `home` placeholder with the glance-and-route command centre (deadline header, squad strip with verdicts, three action cards) composed entirely from existing engines.

**Architecture:** Pure composition. `HomeTab` orchestrates hooks + `useMemo` engine calls and switches between the three states; `SquadStrip` and `ActionCards` are presentational (plain props). The spec `docs/superpowers/specs/2026-06-12-uix02-home-command-centre-design.md` is BINDING — its Engine-contracts table (exact signatures/files), layout, chip-precedence rule, three states, and anti-goal section govern wherever this plan abbreviates.

**Tech Stack:** React 19 client components, UIX-01 primitives (`src/components/ui/`) + tokens ONLY, Vitest + RTL.

**MANDATORY pre-reading per task:** the spec (whole); `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` (AGENTS.md); `src/components/squad/DecisionSummaryTab.tsx` lines ~195-220 (the captain pool-fallback pattern to copy); the engine files named in the spec's table for any function you call.

---

## File map

| File | Responsibility |
|---|---|
| `src/components/home/home-logic.ts` | Pure helpers: chip precedence, headline extraction (unit-tested without React) |
| `src/components/home/SquadStrip.tsx` + `ActionCards.tsx` | Presentational |
| `src/components/home/HomeTab.tsx` | Hooks + engines + state switch |
| `src/components/home/home.test.tsx` (+ `home-logic.test.ts`) | Tests |
| `src/app/page.tsx` | Swap placeholder for `<HomeTab .../>` (5 props per spec) |

---

## Task 1: `home-logic.ts` — the only real logic, pure

TDD. Create `src/lib`-style pure module `src/components/home/home-logic.ts`:

```ts
import type { LifecycleLabel } from '@/lib/lifecycle-label'   // verify the exported type name — read the file; adapt import if it differs
import type { ChipIntent } from '@/components/ui/Chip'

export interface PlayerBadge { text: string; intent: ChipIntent }

const RISK_BADGE: Partial<Record<LifecycleLabel, PlayerBadge>> = {
  sell:         { text: 'SELL',      intent: 'negative' },
  sell_soon:    { text: 'SELL SOON', intent: 'warning' },
  minutes_trap: { text: 'MINS TRAP', intent: 'warning' },
  fixture_trap: { text: 'FIX TRAP',  intent: 'warning' },
}

/** Spec rule: risk label wins over verdict; verdict sell→negative, buy→positive, hold→neutral. */
export function badgeFor(
  verdict: 'buy' | 'hold' | 'sell' | undefined,
  label: LifecycleLabel | undefined,
): PlayerBadge {
  if (label && RISK_BADGE[label]) return RISK_BADGE[label]!
  if (verdict === 'sell') return { text: 'SELL', intent: 'negative' }
  if (verdict === 'buy') return { text: 'BUY', intent: 'positive' }
  return { text: 'HOLD', intent: 'neutral' }
}

/** Count of risk-subset labels across the squad (spec: sell/sell_soon/minutes_trap/fixture_trap). */
export function riskCount(labels: Map<number, LifecycleLabel>): number {
  let n = 0
  for (const l of labels.values()) if (RISK_BADGE[l]) n++
  return n
}

/** £ formatting: entry_history.bank is tenths of £m. */
export function formatBank(bankTenths: number): string {
  return `£${(bankTenths / 10).toFixed(1)}m`
}
```

Tests (`home-logic.test.ts`): risk-beats-verdict (label sell_soon + verdict hold → SELL SOON warning), verdict-only paths (sell/buy/hold), plain `hold` label falls through to verdict, riskCount counts only the 4 risk labels, formatBank(5)='£0.5m'.

Verify (`npx vitest run src/components/home/`), commit `feat(uix-02): home badge/risk logic`.

## Task 2: presentational components

`SquadStrip.tsx` props: `{ xi: Array<{player: MergedPlayer, badge: PlayerBadge, isCaptain: boolean}>, bench: MergedPlayer[] }` — renders a Card titled "My Squad": XI rows (`PlayerCell` md + badge `Chip` sm + accent `Chip` "C" when captain; 2-col grid `md:grid-cols-2`), bench as a muted row of `PlayerCell` sm. Empty `xi` → render nothing (parent decides states).

`ActionCards.tsx` props: `{ captain?: {name, team, projectedPts, captainType}, transfer?: {sellName, buyName, gain, costLabel}, lineup?: {formation, xiXpts}, onGo: (tool: 'decision'|'transfers'|'lineup') => void }` — three `Card`s in `md:grid-cols-3`; each: SectionHeader-less title (`text-data uppercase ink-muted`), one `text-h4` headline, one `text-data ink-muted` support line, ghost `Button` "→ Decision/Transfers/Lineup" calling `onGo`. Cards with undefined data don't render.

Tests: captain card shows name + 2× points; transfer headline "X ➜ Y" + gain; lineup formation; onGo fires with right id; undefined card absent; SquadStrip badge/captain chips render; bench renders sm cells.

Commit `feat(uix-02): SquadStrip + ActionCards presentational components`.

## Task 3: `HomeTab.tsx` orchestration + page wiring

Props (from page.tsx render site, all in scope there): `{ submittedId: string, teamIdDraft: string, onTeamIdChange: (v: string) => void, onTeamIdSubmit: (e: React.FormEvent) => void, selectTool: (t: ToolId) => void }` — read page.tsx for the real handler names/shapes and adapt prop names to what exists (the spec allows passing existing handlers through; do NOT re-implement localStorage logic).

Hook/engine orchestration (all per the spec's engine-contracts table — exact files/signatures there):
- `usePlayers` → `useMemo` `computeAllGemScores`; `useNextDeadline`; `useClubForm`; `useSquad(submittedId || null)`
- squad-derived memos (guard each on squad+players present): verdicts, lifecycle labels, `optimiseLineup(picks, scored, 1)` (null-guard), `suggestTransfers({currentPicks, players: scored, horizon: 1, ftCount: 1, bank: entry_history.bank})` → `computeOpportunityCostRows` → first non-roll row
- captain: squad ? `computeCaptaincyCandidates(picks, scored, 5)[0]` : pool fallback copied from DecisionSummaryTab's pattern
- States per spec §States: off-season (deadline null OR `isOffSeason(players)`) → hero Card + Picks/Research buttons (+ squad strip only if squad data present); no-ID → header (GW/deadline Stats) + connect form Card (uses the passed handlers; input styled with tokens, `min-h-[44px]`) + captain card (pool) + Picks link; squad-loaded → full layout per spec §Layout incl. third Stat (bank + `event_transfers` FT label) and risk-count Chip (from `riskCount`) routing to Decision
- Loading: `usePlayers` loading → 3 `Skeleton` blocks; squad query loading with ID → `Skeleton` strip. `useSquad` error → omit strip silently (spec).
- Header Stats: "GW {deadline.id}" + countdown via the exported `formatCountdown`/`computeUrgency` from `DeadlineBanner.tsx` (import them — verify export names by reading the file).

page.tsx: replace the placeholder block `{activeTool === 'home' && <Card …placeholder…>}` with `<HomeTab submittedId={submittedId} … selectTool={selectTool} />` (exact props per what page.tsx has). Remove now-unused placeholder imports if any.

Tests (`home.test.tsx`, mocked hooks per the repo's `vi.mock` house style — see `WeeklyPicksTab.test.tsx`): the three states' distinctive content (connect form present when no ID; hero when deadline null; squad strip + 3 cards + bank Stat when loaded); risk chip shows count and routes on click; suggestTransfers wiring pinned (mock `@/lib/suggest-transfers`, assert called with `horizon: 1, ftCount: 1, bank`); captain fallback used when no squad (pool player name appears).

Full gauntlet: `npx vitest run src/components/home/` then full `npm test` (baseline 1926/160 — expect +~18), `npx tsc --noEmit` (4 known pre-existing error files only), `npx playwright test` (63 — the `?t=home` smoke now exercises the off-season hero). `npm run dev` + curl `/` → "season" hero text present (off-season). Kill server.

Commit `feat(uix-02): Home command centre — deadline header, squad strip, action cards`.

---

## Self-review

- Spec coverage: header Stats ✓T3, squad strip + precedence ✓T1/T2, 3 action cards + deep links ✓T2/T3, risk chip ✓T1/T3, 3 states + loading + squad-404-silent ✓T3, anti-goal respected (one headline per card, no tables) ✓T2, primitives/tokens only ✓ all, e2e continuity ✓T3.
- Type consistency: `PlayerBadge`/`badgeFor`/`riskCount` (T1) consumed by T2/T3 with matching shapes; `onGo` ids are ToolIds.
- The LifecycleLabel import name + DeadlineBanner helper export names are verify-on-read instructions (real names may differ slightly) — explicit, not placeholders.
