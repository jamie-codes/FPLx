# TFR-01: Confirmed Transfers Ledger

**Feature ID:** TFR-01
**Date:** 2026-06-13
**Status:** Approved (layout: grouped-by-club + chronological toggle; speculative: cross-link to existing Summer Window)

---

## Goal

A "Confirmed Transfers" tab: a pipeline step scrapes Wikipedia's current per-window English football transfer list, filters to deals involving a Premier League club, and the UI presents them pltransfers.com-style — grouped by PL club (Ins/Outs) with a chronological-ledger toggle. Accurate-but-lagged by design (Wikipedia cadence); provenance shown. Most valuable at window close, useful year-round.

## Architecture

Clone of the established WIN-01 `transfer_news` chain (verified by recon):
`pipeline/confirmed_transfers.py` (scraper) → `transfers_confirmed.json` → `src/app/api/transfers/route.ts` → `src/lib/hooks/useConfirmedTransfers.ts` → `src/components/transfers-confirmed/ConfirmedTransfersTab.tsx`, registered in `src/lib/navigation.ts` **Planning** group next to `window` (tool id `transfers-confirmed` — `transfers` is taken by the My-Squad tool). Non-fatal `try/except` in `run.py` after the `transfer_news` block (~line 213), year-round, outside the `IS_OFF_SEASON` gate, behind a `CONFIRMED_TRANSFERS_ENABLED` env gate (mirrors `TRANSFER_NEWS_ENABLED`).

## Scraper (`pipeline/confirmed_transfers.py`)

- **Entry**: `compute_confirmed_transfers(bootstrap: dict) -> None` — early-returns unless `CONFIRMED_TRANSFERS_ENABLED == 'true'`; builds the team lookup from `bootstrap['teams']`; fetches + parses; applies the empty-guard; `save('transfers_confirmed.json', payload)`.
- **Fetch**: `requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)` + `raise_for_status()` + `BeautifulSoup(resp.text, 'lxml')` — reuse lineup_news's `HEADERS` (Mozilla UA) and `REQUEST_TIMEOUT=10`. Single attempt, no retries; caller's try/except isolates failure.
- **URL derivation** `_current_window_url(now_month: int, now_year: int) -> str`: month 6–8 → `List_of_English_football_transfers_summer_<year>`; month 1 or 9–12 → winter page `..._winter_<seasonStartYear>-<yy>` (Sept–Jan winter-window convention; pick summer for the bulk of the year per the page's own "after winter window close … before end of summer window" inclusion window). Pure function, unit-tested for the month boundaries. (A fetched page that 404s → non-fatal, empty result, prior artifact preserved.)
- **Parse**: iterate `table.wikitable` rows; permanent-transfer tables and the Loans table. Per row read cells Date / Player / Moving-from / Moving-to / Fee via `td.get_text(strip=True)` (anchor text; flag-icon spans collapse out). Tag `kind='loan'` for Loans-section rows, else `'permanent'`. Skip header/sub-header rows (no 5 data cells).
- **PL filter + club mapping**: module-level `WIKI_CLUB_TO_FPL: dict[str,str]` aliasing divergent Wikipedia renderings → FPL `teams[].name` (Wolverhampton Wanderers→Wolves, Tottenham Hotspur→Spurs, Newcastle United→Newcastle, Nottingham Forest→Nott'm Forest if FPL uses that, Manchester United→Man Utd, Manchester City→Man City, Brighton & Hove Albion→Brighton, West Ham United→West Ham, etc. — finalised against the live `teams[]` names at build time). `_resolve(club_text)` → FPL team dict or None, via the alias then a lowercased `{name: team}` map. Keep a row iff `from` OR `to` resolves to a PL team.

### `transfers_confirmed.json` shape
```
{
  "scraped_at": ISO-8601,
  "window": "summer_2026",
  "source_url": "https://en.wikipedia.org/wiki/...",
  "groups": [
    { "team_id": 1, "team_name": "Arsenal", "team_short_name": "ARS",
      "ins":  [ {"date","player","other_club","fee","kind"} ],
      "outs": [ {"date","player","other_club","fee","kind"} ] }
  ],
  "chronological": [ {"date","player","from_club","to_club","from_short","to_short","fee","kind","is_pl_to_pl"} ],
  "counts": { "deals": N, "loans": M }
}
```
A PL↔PL deal appears as an `out` for the seller's group and an `in` for the buyer's group (and once in `chronological` with `is_pl_to_pl=true`). `other_club` is the non-grouped side's display name. Empty-guard: if `chronological` is empty, skip `save()`.

## API + hook

- `src/app/api/transfers/route.ts`: clone `transfer-news/route.ts` — blob-or-local read of `transfers_confirmed.json`; returns `{enabled:true, ...parsed}`; absent/gate-off → 200 `{enabled:false, groups:[], chronological:[], ...}`; `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`.
- `src/lib/hooks/useConfirmedTransfers.ts`: clone `useTransferNews.ts` — `useQuery(['confirmed-transfers'])`, `staleTime: 6h`, `retry:false`, derive `isNotAvailable = data?.enabled === false`.
- `src/lib/types.ts`: `ConfirmedTransfers`, `TransferGroup`, `TransferDeal` types matching the JSON.

## UI (`ConfirmedTransfersTab.tsx` — UIX primitives, token-pure)

- Header: title + "as of {scraped_at} · {window}" provenance (`text-data text-ink-muted`); a `Button variant="ghost"` "Rumours & speculation →" calling `selectTool('window')`.
- `SegmentedToggle` (By club | Most recent), default **By club**.
- **By club**: for each group (sorted by team name), a `Card` with `TeamBadge shortName` + name header, then two columns/sections Ins (↓, positive-soft accent) and Outs (↑); each deal a row: player name, fee `Chip` (neutral; "Free"/"Undisclosed"/value as-is), `Chip intent="violet" variant="outline"` "LOAN" when `kind==='loan'`, `other_club` muted. Empty ins/outs → muted "—".
- **Most recent**: flat list newest-first — date, player, `from_short` → `to_short` (TeamBadges), fee chip, LOAN chip.
- States: `isNotAvailable` (gate off / off-season) → `EmptyState` ("Confirmed transfers appear when the window is active"); loaded-but-empty → `EmptyState` ("No Premier League deals confirmed yet this window"); populated → the views.

## Testing

- **Scraper** (`pipeline/tests/test_confirmed_transfers.py`): fixture HTML snippet with a permanent table + loans table → asserts parse (5-cell rows), PL filter (a non-PL↔non-PL row dropped; a PL↔EFL row kept), alias mapping (a divergent name like "Wolverhampton Wanderers" resolves), loan vs permanent tagging, grouped construction (PL↔PL appears as out+in), chronological sort desc, empty-guard skips save; `_current_window_url` month-boundary tests (Jul→summer, Dec→winter, Jan→winter).
- **UI**: `ConfirmedTransfersTab.test.tsx` — three states render distinctly; toggle switches views; LOAN chip on loan deals; cross-link calls `selectTool('window')`. `navigation.test.ts` + `page.test.tsx` updated for the new tool id.
- **e2e**: `?t=transfers-confirmed` smoke (both viewports) — renders without pageerror in the off-season `enabled:false` state.
- Suites green; tsc stays 0; contrast unaffected (no new tokens).

## Out of scope

- New speculative feed (WIN-01 Summer Window is it; we cross-link)
- Per-deal FPL-player linking / xPts-impact modelling
- Historical windows beyond the current one; multi-window archive
- Auto-refresh faster than the pipeline cadence (accuracy-over-speed is the point)
