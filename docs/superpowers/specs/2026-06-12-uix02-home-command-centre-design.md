# UIX-02: Home Command Centre

**Feature ID:** UIX-02 (UI overhaul phase 2/5)
**Date:** 2026-06-12
**Status:** Approved
**Depends on:** UIX-01 (tokens, primitives, shell — shipped). Companion: `2026-06-12-uix01-foundation-shell-design.md`.

---

## Goal

Replace the `home` placeholder with a glance-and-route command centre: deadline header, the user's squad with verdict badges, and three one-headline action cards. **Home is a thin composition layer over existing pure engines — no new computation, no new API routes.** Depth lives in Decision/Transfers/Lineup; Home surfaces the top single result of each and deep-links.

## Anti-goal (the one design hazard)

`DecisionSummaryTab` is already a deep weekly worksheet (captain top-3, full OCS table, chip timing, risk flags, prose). Home must NOT duplicate it: one headline per concern, then route. No chip card, no prose, no tables, no team-news feed on Home.

## Engine contracts (verified by code inspection 2026-06-12)

| Need | Source | Signature / shape | Gating |
|---|---|---|---|
| Players | `usePlayers()` + `computeAllGemScores(players)` | `MergedPlayer[]` → `ScoredPlayer[]` | public; off-season via `isOffSeason(players)` (`src/lib/picks.ts`) |
| Squad | `useSquad(teamId)` (`src/lib/hooks/useSquad.ts`) | `{active_chip, picks: SquadPick[], entry_history:{event, bank, event_transfers}}`; picks position 1-11 = XI, 12-15 bench | public FPL ID (page.tsx `submittedId`, localStorage `fpl_team_id`); NO JWT needed |
| Verdicts | `computeVerdicts(squadPicks, scored)` (`src/lib/recommend.ts`) | `Map<playerId,'buy'\|'hold'\|'sell'>` — XI only | squad |
| Risk labels | `computeLifecycleLabels(squadPicks, scored, clubFormMap)` (`src/lib/lifecycle-label.ts`) + `useClubForm()` | `Map<playerId, LifecycleLabel>`; risk subset = `sell, sell_soon, minutes_trap, fixture_trap` | squad |
| Transfer headline | `suggestTransfers({currentPicks, players: scored, horizon: 1, ftCount: 1, bank})` (`src/lib/suggest-transfers.ts`) → `computeOpportunityCostRows(...)` (`src/lib/opportunity-cost.ts`) | take the top non-roll row: sell/buy names + `xPtsGain` | squad |
| Captain | `computeCaptaincyCandidates(squadPicks, scored, 5)[0]` (`src/lib/captaincy-engine.ts`); no squad → pool fallback exactly as DecisionSummaryTab lines ~201-216 (top outfield by `xPts_1gw`) | `{player, projected_captain_pts, captain_type}` | squad optional |
| Lineup | `optimiseLineup(squadData.picks, scored, 1)` (`src/lib/optimise-lineup.ts`) | `{starters[11], bench[4], captainId, vcId, formation} \| null` (null if <11 eligible — guard) | squad |
| Deadline/GW | `useNextDeadline()` (`src/lib/hooks/useNextDeadline.ts`) → `{id, deadline_time}\|null`; countdown helpers exported from `DeadlineBanner.tsx` (`computeUrgency`, `formatCountdown`) | null = off-season | public |

All engines pure/sync (suggestTransfers <10ms — `useMemo`). All hooks cache-warm (TopBar/other tabs share queryKeys).

## Layout (UIX-01 primitives only; tokens only)

```
[ Stat: GW N ] [ Stat: deadline countdown ] [ Stat: bank £X.X · N FT ]   ← header row
[ Card: MY SQUAD ───────────────────────────────────────────────── ]
[  XI as rows: PlayerCell + verdict/risk Chip + ⓒ on optimiseLineup captain ]
[  bench mini-row (PlayerCell sm, muted)                              ]
[ Card: Captain ][ Card: Transfer ][ Card: Lineup ]                   ← do-this-week
[ Chip: "N players flagged → Decision" when risk count > 0 ]
```

- Desktop: header Stats inline; squad card full-width (XI in 2 columns ≥768px); three action cards in a row. Mobile: everything stacks; one-viewport target.
- Squad rows: `PlayerCell` (code/team_code now in MergedPlayer) + ONE Chip per player — risk label wins over verdict when both exist (`sell`→negative, `sell_soon`/`minutes_trap`/`fixture_trap`→warning, verdict `sell`→negative, `hold`→neutral, `buy`→positive). Captain row gets an accent ⓒ Chip.
- Action cards: title + one `text-h4` headline + one `text-data` support line + a ghost Button deep-link via `selectTool` (`→ Decision` / `→ Transfers` / `→ Lineup`). Transfer card support line: cost + break-even (`OCSRow` fields).

## States (all three MUST be designed, tested)

1. **No FPL ID**: header row (GW/deadline only) + connect card (small form reusing page.tsx's existing `teamId`/`setTeamId`/`handleTeamIdSubmit` — passed as props or the form JSX relocated/duplicated minimally) + captain card with pool fallback + a Picks link. No squad/transfer/lineup cards.
2. **Squad loaded**: full layout. `useMyTeam` NOT used (auth is a Transfers-tab depth feature; bank from public `entry_history.bank`).
3. **Off-season** (`useNextDeadline()` null OR `isOffSeason(players)`): quiet hero Card — "The 2026/27 season hasn't started" + Buttons to Picks and Research; squad strip still renders if the squad API returns data, otherwise omitted silently (the squad endpoint may 404 off-season — `useSquad` error → omit, no error banner on Home).

## Component structure

```
src/components/home/HomeTab.tsx        — data orchestration (hooks + useMemo engines) + state switch
src/components/home/SquadStrip.tsx     — pure presentational: picks+verdicts+labels+captainId → rows
src/components/home/ActionCards.tsx    — pure presentational: captain/transfer/lineup headline props
```

`HomeTab` receives `{ submittedId, teamId, setTeamId, onTeamIdSubmit, selectTool }` from page.tsx (all already in scope at the render site). Presentational components take plain data props (unit-testable without hooks).

## Testing

- Vitest (mocked hooks, real engines where cheap): the three states render their distinctive content; verdict/risk Chip mapping (risk wins over verdict); captain ⓒ on the right player; transfer headline shows top OCS row; lineup card guards `null` optimise result; deep-link buttons call `selectTool` with the right ToolId; bench row renders 4 players.
- Engine wiring pinned: `suggestTransfers` called with `horizon: 1, ftCount: 1` and squad bank.
- e2e: existing `?t=home` smoke continues to pass (off-season state in CI).
- Contrast: no new tokens; `scripts/contrast-check.mjs` unchanged.

## Out of scope

- Chip timing, prose summaries, OCS tables, team news (Decision's depth)
- Auth/`selling_price` precision (Transfers-tab feature)
- FT count detection beyond default 1 (Decision pins the same)
- Any pipeline change
