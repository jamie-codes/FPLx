# Roadmap: FPL Analyst

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-29)
- ✅ **v1.1 Decision Engine** — Phases 7-12 (shipped 2026-03-30)
- 🚧 **v1.2 Mobile** — Phases 13-17 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-29</summary>

- [x] Phase 1: Data Foundation (3/3 plans) — completed 2026-03-27
- [x] Phase 2: Understat Pipeline + Merged Data API (3/3 plans) — completed 2026-03-28
- [x] Phase 3: Gem Rating Table (3/3 plans) — completed 2026-03-28
- [x] Phase 4: DefCon Analysis (3/3 plans) — completed 2026-03-28
- [x] Phase 5: Squad View + Transfer Suggestions (3/3 plans) — completed 2026-03-29
- [x] Phase 6: Club Form, Value Gems and Polish (4/4 plans) — completed 2026-03-29

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Decision Engine (Phases 7-12) — SHIPPED 2026-03-30</summary>

- [x] Phase 7: Pipeline Schema Extension (3/3 plans) — completed 2026-03-30
- [x] Phase 8: Minutes Risk UI + Transfer Integration (2/2 plans) — completed 2026-03-30
- [x] Phase 9: Projected Points Columns (2/2 plans) — completed 2026-03-30
- [x] Phase 10: Buy/Hold/Sell + Captaincy Engines (3/3 plans) — completed 2026-03-30
- [x] Phase 11: Explainability + Replacement Shortlist (3/3 plans) — completed 2026-03-30
- [x] Phase 12: FPL Auth + Exact Selling Price (2/2 plans) — completed 2026-03-30

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v1.2 Mobile (In Progress)

**Milestone Goal:** Make the full app usable on a phone with a touch-friendly responsive layout — same URL, desktop unchanged.

- [ ] **Phase 13: Navigation + Layout Foundations** - Bottom tab bar, viewport contract, touch targets, and single-column layout across all tabs
- [ ] **Phase 14: GemTable Mobile** - Column prioritisation, sticky Player column, and expandable row detail for GemTable
- [ ] **Phase 15: Remaining Tables Mobile** - Column prioritisation for SquadView, DefConTables, ClubFormTable, and ValueGemsTable; sticky Player column in SquadView
- [ ] **Phase 16: Component-Level Mobile** - Transfer suggestion card layout, login form, and captaincy panel grid for mobile
- [ ] **Phase 17: Polish + Infrastructure** - Sticky filter bar, back-to-top button, and verified GitHub Actions cron

## Phase Details

### Phase 13: Navigation + Layout Foundations
**Goal**: The app has a working mobile navigation system and a verified single-column layout at 375px — establishing the viewport contract all subsequent phases depend on
**Depends on**: Phase 12
**Requirements**: MOB-NAV-01, MOB-NAV-02, MOB-NAV-03, MOB-LAY-01, MOB-LAY-02, MOB-TOUCH-01, MOB-TOUCH-02, MOB-TOUCH-03
**Success Criteria** (what must be TRUE):
  1. On a real phone at 375px, a fixed bottom tab bar with 5 labelled tabs is visible and the top horizontal tab strip is not visible
  2. Tapping any bottom tab navigates to the correct content without the iOS home indicator obscuring the tab bar
  3. All interactive elements across all tabs (filter pills, sort headers, buttons, tab items) have a tap target of at least 44x44px — none require precise tapping
  4. All `<input>` fields display at 16px font size and do not trigger iOS Safari viewport zoom on focus
  5. Every tab's content fits within a 375px screen width with no horizontal overflow — no panel breaks or clips outside the viewport
**Plans**: TBD
**UI hint**: yes

### Phase 14: GemTable Mobile
**Goal**: GemTable is readable and navigable on a phone — showing only the most decision-relevant columns by default, with a sticky Player column and an expandable row for full data access
**Depends on**: Phase 13
**Requirements**: MOB-TBL-01, MOB-TBL-05, MOB-TBL-06
**Success Criteria** (what must be TRUE):
  1. On mobile, GemTable shows exactly: Player, Position, Gem score, active Proj Pts column, and Risk badge — all other columns are hidden by default
  2. When scrolling GemTable horizontally on mobile, the Player column remains fixed to the left edge so the player name is always visible
  3. Tapping a GemTable row on mobile expands an inline detail panel showing all columns hidden by MOB-TBL-01 as labelled key-value pairs
  4. Desktop GemTable behaviour is unchanged — all columns visible per the existing GW toggle logic
**Plans**: TBD
**UI hint**: yes

### Phase 15: Remaining Tables Mobile
**Goal**: SquadView, DefConTables, ClubFormTable, and ValueGemsTable all show priority column sets on mobile — only the most essential data is visible by default, with the Player column sticky in SquadView
**Depends on**: Phase 13
**Requirements**: MOB-TBL-02, MOB-TBL-03, MOB-TBL-04, MOB-TBL-05 (SquadView portion)
**Success Criteria** (what must be TRUE):
  1. On mobile, SquadView shows exactly: Player (with captain/vice indicator), Price, Risk badge, and Rec verdict — all other columns are hidden
  2. When scrolling SquadView horizontally on mobile, the Player column remains fixed to the left edge
  3. On mobile, DefConTables show exactly: Player, Team, Hit Rate, and Avg DC/90 — all other columns are hidden
  4. On mobile, ClubFormTable and ValueGemsTable show only key player identity and primary stat columns — each table fits comfortably within a 375px screen
**Plans**: TBD
**UI hint**: yes

### Phase 16: Component-Level Mobile
**Goal**: Transfer suggestion cards, the login form, and the captaincy panel are all usable and readable on a phone without text overflow or cramped inputs
**Depends on**: Phase 13
**Requirements**: MOB-COMP-01, MOB-COMP-02, MOB-COMP-03
**Success Criteria** (what must be TRUE):
  1. On mobile, each transfer suggestion card shows sell/buy player names and verdict/risk badges on the first row, and gem delta, cost, and projected pts change on the second row — no text wraps awkwardly or overflows the card
  2. The login form inputs stack vertically on mobile with full-width inputs; the email field triggers the email keyboard (@ symbol prominent) on iOS and Android
  3. The captaincy panel renders as a 2-column card grid on mobile — each candidate occupies one card with rank, player name, safe/upside badge, and projected captain pts visible without truncation
**Plans**: TBD
**UI hint**: yes

### Phase 17: Polish + Infrastructure
**Goal**: The app is fully polished on mobile with a sticky filter bar, a back-to-top affordance on long tables, and the automated daily pipeline refresh is confirmed operational
**Depends on**: Phase 16
**Requirements**: MOB-POL-01, MOB-POL-02, DAT-01
**Success Criteria** (what must be TRUE):
  1. On mobile, the GW toggle and position filter row remains visible at the top of the screen while scrolling GemTable — the user can change filters without scrolling back to the top
  2. After scrolling past the first screen of GemTable rows on mobile, a "back to top" button appears and tapping it scrolls the user back to the top
  3. The GitHub Actions cron job has run at least once and produced an updated `merged_players.json` in Vercel Blob — the LastUpdated component shows a fresh timestamp confirming automated refresh is live

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 3/3 | Complete | 2026-03-27 |
| 2. Understat Pipeline + Merged Data API | v1.0 | 3/3 | Complete | 2026-03-28 |
| 3. Gem Rating Table | v1.0 | 3/3 | Complete | 2026-03-28 |
| 4. DefCon Analysis | v1.0 | 3/3 | Complete | 2026-03-28 |
| 5. Squad View + Transfer Suggestions | v1.0 | 3/3 | Complete | 2026-03-29 |
| 6. Club Form, Value Gems and Polish | v1.0 | 4/4 | Complete | 2026-03-29 |
| 7. Pipeline Schema Extension | v1.1 | 3/3 | Complete | 2026-03-30 |
| 8. Minutes Risk UI + Transfer Integration | v1.1 | 2/2 | Complete | 2026-03-30 |
| 9. Projected Points Columns | v1.1 | 2/2 | Complete | 2026-03-30 |
| 10. Buy/Hold/Sell + Captaincy Engines | v1.1 | 3/3 | Complete | 2026-03-30 |
| 11. Explainability + Replacement Shortlist | v1.1 | 3/3 | Complete | 2026-03-30 |
| 12. FPL Auth + Exact Selling Price | v1.1 | 2/2 | Complete | 2026-03-30 |
| 13. Navigation + Layout Foundations | v1.2 | 0/? | Not started | - |
| 14. GemTable Mobile | v1.2 | 0/? | Not started | - |
| 15. Remaining Tables Mobile | v1.2 | 0/? | Not started | - |
| 16. Component-Level Mobile | v1.2 | 0/? | Not started | - |
| 17. Polish + Infrastructure | v1.2 | 0/? | Not started | - |
