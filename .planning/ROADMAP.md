# Roadmap: FPL Analyst

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-29)
- ✅ **v1.1 Decision Engine** — Phases 7-12 (shipped 2026-03-30)
- ✅ **v1.2 Mobile** — Phases 13-18 (shipped 2026-04-01)
- 🚧 **v1.3 Gameweek Planner** — Phases 19-25 (in progress)

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

<details>
<summary>✅ v1.2 Mobile (Phases 13-18) — SHIPPED 2026-04-01</summary>

- [x] Phase 13: Navigation + Layout Foundations (2/2 plans) — completed 2026-04-01
- [x] Phase 14: GemTable Mobile (1/1 plan) — completed 2026-04-01
- [x] Phase 15: Remaining Tables Mobile (2/2 plans) — completed 2026-04-01
- [x] Phase 16: Component-Level Mobile (1/1 plan) — completed 2026-04-01
- [x] Phase 17: Polish + Infrastructure (3/3 plans) — completed 2026-04-01
- [x] Phase 18: Dark Mode (3/3 plans) — completed 2026-04-01

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### 🚧 v1.3 Gameweek Planner (In Progress)

**Milestone Goal:** Let the manager plan 1–5 weeks of transfers ahead with auto-suggested sequences, chip timing, and scored output showing squad state at each gameweek.

- [x] **Phase 19: Data Quality and Value Gems Polish** — Pipeline xG proxy, DefCon threshold fix, historical points columns (completed 2026-04-02)
- [x] **Phase 20: Auth UX** — Modal-based guided token entry with expiry awareness (completed 2026-04-02)
- [x] **Phase 21: Planner Tab Shell and State Model** — Nav entry point, types, and foundational state model (completed 2026-04-02)
- [x] **Phase 22: Planning Engine** — Auto-suggest algorithm with look-ahead scoring (completed 2026-04-02)
- [x] **Phase 23: Transfer Output Table** — Transfer-by-transfer table with chip slots and hit cost (completed 2026-04-02)
- [ ] **Phase 24: Squad Snapshot** — Per-GW 15-player squad view with accordion UI
- [ ] **Phase 25: Manual Edit Mode** — Player picker combobox and per-GW override editing

## Phase Details

### Phase 19: Data Quality and Value Gems Polish
**Goal**: Data gaps no longer silently degrade the Gem score or DefCon table, and Value Gems shows recent form points columns
**Depends on**: Phase 18
**Requirements**: DQ-01, DQ-02, VG-01, VG-02
**Success Criteria** (what must be TRUE):
  1. A player with no Understat xG/xA data still receives a Gem score (FPL goals/assists used as proxy, not excluded)
  2. DefCon table shows computed stats for all players who have enough match data; "Insufficient data" appears only for genuine edge cases (new players, very few appearances)
  3. Value Gems table shows three points columns: Total Pts, Pts (last 5 GW), and Pts (last 3 GW)
  4. Sorting by any of the three points columns produces correct ordering
**Plans**: 2 plans
Plans:
- [x] 19-01-PLAN.md — Pipeline data quality (xG proxy, DefCon threshold, historical points)
- [x] 19-02-PLAN.md — Value Gems points columns UI

### Phase 20: Auth UX
**Goal**: Users can authenticate with FPL via a polished modal-based guided token entry flow, with three-state expiry awareness (normal, warning, expired/reconnect)
**Depends on**: Phase 18
**Requirements**: AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can open a modal with step-by-step Chrome DevTools guide and paste their FPL Bearer token without manual cookie hunting
  2. Token entry includes a clipboard paste button for reduced friction
  3. Authentication state shows three-state expiry: normal (> 1hr), amber warning (15min-1hr), expired with reconnect link (< 15min)
**Plans**: 2 plans
Plans:
- [x] 20-01-PLAN.md — Expiry state function (TDD) and AuthModal component
- [x] 20-02-PLAN.md — TransferPanel integration and human verification
**UI hint**: yes

### Phase 21: Planner Tab Shell and State Model
**Goal**: The Planner tab exists in navigation and the foundational types and state model are in place with correct free transfer threading and squad snapshot isolation
**Depends on**: Phase 20
**Requirements**: PLAN-01, PLAN-08
**Success Criteria** (what must be TRUE):
  1. A "Planner" tab appears in both the desktop tab strip and the mobile bottom nav bar and renders without error
  2. User can select a planning horizon of 1, 2, 3, 4, or 5 gameweeks using a control on the Planner tab
  3. Free transfer accumulation logic is unit-tested and correct: transfers bank correctly up to the cap, hit costs are calculated accurately, and Free Hit/Wildcard preserve banked transfers per 2025/26 rules
  4. Squad snapshot deep-copy pattern is verified: editing one GW step does not corrupt any other step's state
**Plans**: 2 plans
Plans:
- [x] 21-01-PLAN.md — Planner types and free transfer engine (TDD)
- [x] 21-02-PLAN.md — Navigation wiring, PlannerTab shell, and horizon selector UI
**UI hint**: yes

### Phase 22: Planning Engine
**Goal**: The system can auto-suggest an optimal transfer sequence for the chosen horizon, with scoring that accounts for projected points, fixture difficulty, DGW/BGW awareness, and hit costs
**Depends on**: Phase 21
**Requirements**: PLAN-02, PLAN-03
**Success Criteria** (what must be TRUE):
  1. Clicking "Generate Plan" produces a sequence of suggested transfers for each GW in the chosen horizon
  2. Suggested transfers reflect fixture difficulty — players with easier fixtures are preferred over equally-rated players with harder fixtures
  3. DGW targets are surfaced appropriately — a justified -4pt hit for a double-gameweek target can appear in suggestions
  4. BGW and unconfirmed fixture GWs are flagged rather than scored on incomplete data
  5. Net projected gain per transfer accounts for -4pt hit cost when a free transfer is not available
**Plans**: 2 plans
Plans:
- [x] 22-01-PLAN.md — Planning engine TDD (types, tests, generatePlan implementation)
- [x] 22-02-PLAN.md — PlannerTab integration and human verification

### Phase 23: Transfer Output Table
**Goal**: The planner surfaces a readable transfer-by-transfer table showing each GW's suggested move, chip slot, projected gain, and hit cost
**Depends on**: Phase 22
**Requirements**: PLAN-05, PLAN-07
**Success Criteria** (what must be TRUE):
  1. Output table shows one row per GW with columns: GW number, chip slot (if any), player out, player in, hit cost, and projected gain
  2. DGW and BGW GW labels appear on the relevant rows so the user can see scheduling context at a glance
  3. Chip timing (Wildcard, Free Hit, Triple Captain, Bench Boost) is visible per GW row and the user can toggle a chip on or off for any GW in the plan
  4. A "Plan value" headline above the table shows the total net projected gain across all GW steps
**Plans**: 2 plans
Plans:
- [x] 23-01-PLAN.md — Pure helpers (TDD), TransferPlanTable and ChipToggle components
- [x] 23-02-PLAN.md — PlannerTab integration (useImmer migration) and human verification
**UI hint**: yes

### Phase 24: Squad Snapshot
**Goal**: The manager can see the full 15-player squad state after each GW step in the plan
**Depends on**: Phase 23
**Requirements**: PLAN-06
**Success Criteria** (what must be TRUE):
  1. Each GW row in the plan table has an expandable accordion that reveals the full 15-player squad (GK/DEF/MID/FWD grouping, bench included) after that GW's transfers are applied
  2. Players changed by that GW's transfer are visually highlighted so the user can quickly spot what changed
  3. Bench Boost GWs show all 15 players prominently rather than just the starting XI
  4. Squad snapshots are collapsed by default — the table remains compact until the user expands a specific GW
**Plans**: 2 plans
Plans:
- [x] 24-01-PLAN.md — PlanStep type extension and positionsAfter TDD
- [ ] 24-02-PLAN.md — SquadSnapshotRow component and TransferPlanTable accordion wiring
**UI hint**: yes

### Phase 25: Manual Edit Mode
**Goal**: Users can override any auto-suggested transfer in the plan with their own player selection, and the plan re-scores from that point forward
**Depends on**: Phase 24
**Requirements**: PLAN-04
**Success Criteria** (what must be TRUE):
  1. Each transfer row has an edit control that opens a player picker filtered to the correct position
  2. The player picker shows players sorted by projected points for the relevant GW, with a search/filter input
  3. After the user picks a replacement, the plan re-scores from that GW onwards while preserving manual edits to earlier GWs
  4. The user can switch between "Suggested" and "Manual" mode — switching back to Suggested restores the engine's original recommendation for that row
**Plans**: 2 plans
Plans:
- [ ] 25-01-PLAN.md — TBD
- [ ] 25-02-PLAN.md — TBD
**UI hint**: yes

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
| 13. Navigation + Layout Foundations | v1.2 | 2/2 | Complete | 2026-04-01 |
| 14. GemTable Mobile | v1.2 | 1/1 | Complete | 2026-04-01 |
| 15. Remaining Tables Mobile | v1.2 | 2/2 | Complete | 2026-04-01 |
| 16. Component-Level Mobile | v1.2 | 1/1 | Complete | 2026-04-01 |
| 17. Polish + Infrastructure | v1.2 | 3/3 | Complete | 2026-04-01 |
| 18. Dark Mode | v1.2 | 3/3 | Complete | 2026-04-01 |
| 19. Data Quality and Value Gems Polish | v1.3 | 2/2 | Complete    | 2026-04-02 |
| 20. Auth UX | v1.3 | 2/2 | Complete    | 2026-04-02 |
| 21. Planner Tab Shell and State Model | v1.3 | 2/2 | Complete    | 2026-04-02 |
| 22. Planning Engine | v1.3 | 2/2 | Complete   | 2026-04-02 |
| 23. Transfer Output Table | v1.3 | 2/2 | Complete    | 2026-04-02 |
| 24. Squad Snapshot | v1.3 | 1/2 | In Progress|  |
| 25. Manual Edit Mode | v1.3 | 0/TBD | Not started | - |
