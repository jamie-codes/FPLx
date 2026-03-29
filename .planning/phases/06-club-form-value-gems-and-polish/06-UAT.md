---
status: complete
phase: 06-club-form-value-gems-and-polish
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md]
started: 2026-03-29T16:50:00Z
updated: 2026-03-29T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Club Form and Value Gems tabs exist
expected: Open the app. The tab bar should show at least: Gem Ratings, DefCon, Squad, Club Form, Value Gems. Both "Club Form" and "Value Gems" tabs should be clickable.
result: pass

### 2. Club Form table loads
expected: Click the "Club Form" tab. A table appears showing all 20 Premier League clubs with columns for W, D, L, GS (goals scored), GC (goals conceded), and GD (goal difference) based on their last 5 fixtures. The table is sortable by clicking column headers.
result: issue
reported: "ARsenal playing MCI (man city) AWay is shown as green fixture but I dont think it is an easy fixture. Burnley vs MCI Home is shown as easy but burnley will lose that game"
severity: major

### 3. Fixture badges on Club Form
expected: In the Club Form table, each row's rightmost area shows up to 5 upcoming fixture chips. Each chip displays the opponent short name (e.g. "ARS", "CHE"), is colour-coded green/amber/red by difficulty, and has an "H" or "A" indicator for home/away.
result: pass

### 4. Fixture badges on Gem Ratings table
expected: Go to the Gem Ratings tab. The table now has a "Next 5" column showing the same coloured H/A fixture chips for each player's upcoming fixtures.
result: pass

### 5. LastUpdated banner
expected: On any tab (Gem Ratings, DefCon, Club Form, Value Gems), a "Last updated: [timestamp]" line is visible near the bottom of the data. If data is stale (older than 24h), the text turns amber.
result: pass

### 6. Value Gems tab shows table (not "Coming Soon")
expected: Click the "Value Gems" tab. A table appears — NOT a "Coming soon..." placeholder. The table shows a list of players with columns for Player, Pos, Team, Price, Own%, Pts, Gem Score, Price Trend, and Next 5 fixtures. Default filter is "Cheap".
result: issue
reported: "Trend column shows '— NaNm season'"
severity: major

### 7. Value Gems filter pills
expected: Above the Value Gems table, three filter pills are visible: "Cheap" (£6m-), "Low-owned" (<10% ownership), and "All". Clicking each pill filters the table accordingly. "Cheap" shows only players costing £6.0m or under; "Low-owned" shows players with ownership under 10%; "All" removes the filter. The active pill is visually highlighted.
result: pass

### 8. Price trend column on Gem Ratings table
expected: In the Gem Ratings table, a price trend column shows for each player. A rising price shows a green ↑ arrow with the GW amount (e.g. "+0.1m"). A falling price shows a red ↓ arrow. A stable price shows a grey dash. Where the season total differs from zero, a smaller sub-text shows the season change (e.g. "+0.2m season").
result: issue
reported: "all i see is — NaNm season for this column in each row"
severity: major

### 9. Price trend on Transfer Panel
expected: Open the Transfer Suggestions panel (Squad tab). On each suggested sell/buy pair, a compact price trend indicator appears next to the player's price — showing the GW price direction arrow and, in parentheses, the season change if non-zero.
result: issue
reported: "i see as an example Sell Virgil (0.21)(-NaNm season) → Buy De Cuyper (0.65)(-NaNm season)"
severity: major

## Summary

total: 9
passed: 5
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Fixture difficulty badges correctly reflect opponent strength — Man City fixtures should show as hard (red) not easy (green)"
  status: resolved
  reason: "User reported: Arsenal vs Man City Away and Burnley vs Man City Home both showing as green (easy). Root cause: tier() function in src/lib/club-form.ts lines 71-73 is inverted — returns 'easy' when score >= hardThreshScore (should be 'hard') and 'hard' when score <= easyThreshScore (should be 'easy'). Fix: swap the two return values."
  resolved_in: "06-04"
  severity: major
  test: 2
  artifacts: [src/lib/club-form.ts]
  missing: [correct tier logic]

- truth: "Price trend column shows GW change and season change with correct formatting — no NaN values"
  status: resolved
  reason: "User reported on Value Gems, Gem Ratings, and Transfer Panel: '— NaNm season' or '(-NaNm season)' on every row. Root cause: (1) merged_players.json is missing cost_change_event/cost_change_start fields — pipeline has not been re-run since merge.py was updated. (2) PriceTrendCell and TransferPanel do not guard against undefined — Math.abs(undefined) = NaN, and `undefined !== 0` is true so season sub-text always renders. Fix: add `?? 0` guards in PriceTrendCell props and TransferPanel cost_change reads; re-run pipeline."
  resolved_in: "06-04"
  severity: major
  test: 6
  artifacts: [src/components/value-gems/columns.tsx, src/components/gem-table/columns.tsx, src/components/transfers/TransferPanel.tsx]
  missing: [undefined guards for cost_change fields, pipeline re-run]

- truth: "Transfer Panel price trend shows correct GW arrow and season change — no NaN values"
  status: resolved
  reason: "Same root cause as test 6/8 — covered by the same fix (undefined guards + pipeline re-run)"
  resolved_in: "06-04"
  severity: major
  test: 9
  artifacts: [src/components/transfers/TransferPanel.tsx]
  missing: [undefined guards for cost_change fields]
