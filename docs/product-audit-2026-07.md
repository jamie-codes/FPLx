# FPLx product & design audit — July 2026

Written overnight 2–3 Jul 2026 alongside the decision-layer work (exp13–exp15,
decision ledger, transfer advisor, chip advisor). Purpose: focus the app on the
one mission — **pick great picks and score maximum points** — and identify what
to consolidate, what to modernise, and what to leave alone.

## The headline

The design system is NOT the problem. Slate Pro (globals.css `@theme` tokens,
Inter/Geist Mono, dual WCAG-checked themes, Card/Chip/Table primitives, the
mobile bottom-bar + sheet) is disciplined and modern. What makes the app feel
cluttered is **28 tools in 6 groups** — the decision surfaces compete with
research, retrospectives and seasonal tools for the same navigation weight.

## 1. Consolidation proposal (28 → ~17 tools) — NEEDS SIGN-OFF

Nothing deleted below loses a capability; everything folds into an existing
surface as a preset, section, or seasonal mode.

**Merge (same data, same job):**
- `value-gems` → a preset of `gems` (both read /api/players and render the same
  gem scores; gems already has PresetToggle). −1 tab, −227 lines of near-dupe.
- `price-reset` + `price-changes` → one **Prices** tab with a seasonal section.
- `window` + `transfers-confirmed` + `next-season` → one **Pre-season** tab
  (rumours / confirmed / squad-build as sections). It's one seasonal job:
  "get ready for GW1". −2 tabs.
- `perfect-gw` → a section inside `review` (both are retrospectives of a
  settled GW). −1 tab.

**Unify the decision core (the big one):**
`decision` (751 lines), `transfers`, `lineup`, `optimiser` and the two embedded
captaincy panels all answer fragments of one question — *what should I do this
week?* Proposal: **one "This Week" cockpit** with four cards in decision order:
  1. Transfers (from /api/transfer-advice — pipeline-validated, exp14 SHIP)
  2. Captain (unified panel; today captaincy is split across planner+transfers)
  3. Chip (from /api/chip-advice — new, currently has NO consumer in the UI)
  4. Lineup + deadline
with the optimiser and manual tools one click deeper as "power tools".
This is where the app stops feeling like 28 tabs and starts feeling like an
advisor. −2-3 tabs and the fragmentation ends.

**Keep as-is (earning their place):**
home, picks, live, review, gems, insights, defcon, set-pieces, club-form,
planner, manual-plan, route-tree, wildcard, rank-sim, rivals, watchlist,
accuracy, season.

**Drop candidates (only if you agree they're not used):**
- None are broken or orphaned — the honest audit found no dead tabs. The cuts
  above are consolidations, not deletions. If anything is a pure-entertainment
  candidate it's `perfect-gw` (retrospective, no forward decision value), hence
  the fold into `review` rather than deletion.

## 2. Design modernisation (sharpening, not rebuilding)

- **Chart theming**: Recharts appears in 4 tabs (accuracy ×2, season, rank-sim)
  with ad-hoc styling outside the token system — the single biggest visual
  inconsistency. Add one `ChartTheme` wrapper (axis/grid/tooltip styled from
  the CSS variables) and route all four through it.
- **Monolith decomposition**: AccuracyTab (1192), DecisionSummaryTab (751),
  OptimiserPanel (714), ManualPlanTab (692). Split along their visual sections;
  this is what makes the cockpit refactor safe.
- **Primitive adoption pass**: InsightsTab and older tabs hardcode intent
  classes (`bg-positive/10`) instead of `Chip` — a mechanical sweep.
- **Micro-sharpness** (cheap, high-perceived-quality): consistent 4px-grid
  section rhythm on the older tabs; `text-data` + `.tabular` everywhere numbers
  align in columns; one hover/active elevation treatment for Cards (several
  subtle variants exist today); stale "27 tabs" comment in page.tsx says the
  shell migration note is aging — finish or remove.
- **What NOT to do**: no font change (Inter+Geist Mono is right for a data
  product), no palette change (it's AA-verified), no route rewrite (the
  state-based tab switch with ?t= mirror works and is fast).

## 3. Remaining backlog (both repos)

**fplx** (evidence-linked):
- Wire /api/chip-advice + /api/transfer-advice into the UI (no consumers yet)
  — natural first brick of the This Week cockpit.
- exp16: transfer advisor with banked FTs (1–5) + multi-GW value (xPts_5gw as
  the replay metric instead of myopic 1gw) — exp14 validated the mechanism;
  this tunes it.
- Attacker-first captain: stays ledger-shadow (exp15 NO_SHIP, P=0.76); revisit
  after ~10 live GWs of 2026/27 ledger evidence.
- At FPL launch (~mid-July): confirm 2026/27 rules/chips, fill promoted-club
  tables (TEAM_BADGE_CODE, TEAM_COLOURS, FOOTBALL_DATA_TO_FPL, WIKI_CLUB_TO_FPL),
  re-run season_transition_smoke.
- Wildcard timing advisor v2 (fixture-swing detection) once fixtures exist.

**wcfx** (World Cup ends 19 Jul — shrinking backlog by design):
- R16 auto-builds when R32 completes; personal transfer plan (4 FTs) appears
  automatically. Sync my_squad after making transfers.
- Chips: Clean Sheet Shield in QF, Maximum Captain in the Final (plan is set).
- Manual ops that only you can do: rotate the API keys pasted in chat earlier;
  finish the GitHub/Render env items in the pending-setup list.
