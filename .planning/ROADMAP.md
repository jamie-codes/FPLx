# Roadmap: FPL Analyst

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-29)
- 🚧 **v1.1 Decision Engine** — Phases 7-12 (in progress)

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

### 🚧 v1.1 Decision Engine (In Progress)

**Milestone Goal:** Turn the v1.0 data dashboard into an active decision assistant — projected points + minutes risk + buy/hold/sell + captaincy recommendations per player.

- [ ] **Phase 7: Pipeline Schema Extension** — Extend the Python pipeline with projected points (1/3/5 GW) and xMins fields; update MergedPlayer TypeScript types
- [ ] **Phase 8: Minutes Risk UI + Transfer Integration** — Surface rotation risk badges in SquadView and GemTable; de-prioritise rotation risks in transfer suggestions
- [ ] **Phase 9: Projected Points Columns** — Add projected points as sortable columns in GemTable and Transfer Panel with absolute FPL point values
- [ ] **Phase 10: Buy/Hold/Sell + Captaincy Engines** — Pure TypeScript recommendation and captaincy engines consuming pipeline data
- [ ] **Phase 11: Explainability + Replacement Shortlist** — Natural-language reasons, structured risk flags, and replacement shortlist with projected points delta
- [ ] **Phase 12: FPL Auth + Exact Selling Price** — Optional FPL session-cookie login for exact bank balance and sell prices

## Phase Details

### Phase 7: Pipeline Schema Extension
**Goal**: The Python pipeline computes and publishes projected points and expected minutes for every player, making that data available to all downstream v1.1 features
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: PROJ-01, PROJ-02, PROJ-03, MINS-01
**Success Criteria** (what must be TRUE):
  1. User can query `/api/players` and receive `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` fields as absolute FPL point values (not normalised 0–1) for every player
  2. User can query `/api/players` and receive `xmins`, `start_prob`, and `mins_risk` fields reflecting injury-aware expected minutes and start probability per player
  3. DGW players show higher projected points than equivalent single-GW players in the same data response
  4. The element-summary fetch is shared between defcon and xmins modules — pipeline run time does not increase proportionally with the addition of xmins
**Plans**: 3 plans
Plans:
- [x] 07-01-PLAN.md — Refactor defcon.py for shared summaries + create xmins.py module
- [ ] 07-02-PLAN.md — Add projected points to merge.py + wire run.py orchestration
- [x] 07-03-PLAN.md — Extend MergedPlayer TypeScript types + add validation tests

### Phase 8: Minutes Risk UI + Transfer Integration
**Goal**: Managers can see rotation risk classification for every player at a glance, and transfer suggestions automatically de-prioritise rotation risks
**Depends on**: Phase 7
**Requirements**: MINS-02, MINS-03
**Success Criteria** (what must be TRUE):
  1. User can see a Nailed / Likely start / Rotation risk / Cameo risk badge on each player row in SquadView and GemTable
  2. Players with `status != 'a'` or injury `news` are not misclassified as rotation risks — their badge reflects availability context
  3. Transfer suggestions rank rotation-risk candidates lower than equivalent gem-score players without rotation risk
**Plans**: TBD
**UI hint**: yes

### Phase 9: Projected Points Columns
**Goal**: Managers can sort and compare players by projected points in the GemTable and Transfer Panel using meaningful absolute FPL point values
**Depends on**: Phase 7
**Requirements**: PROJ-04
**Success Criteria** (what must be TRUE):
  1. User can sort GemTable by projected points next GW and see values in the 2–15 absolute FPL point range for regular starters
  2. User can toggle between 1 GW, 3 GW, and 5 GW projected points columns in GemTable
  3. Projected points columns are visible in the Transfer Panel alongside gem delta
**Plans**: TBD
**UI hint**: yes

### Phase 10: Buy/Hold/Sell + Captaincy Engines
**Goal**: Managers receive a Buy/Hold/Sell verdict for each squad player and a ranked captaincy shortlist derived from the same data signals as the existing transfer engine
**Depends on**: Phase 7, Phase 9
**Requirements**: REC-01, CAP-01, CAP-02
**Success Criteria** (what must be TRUE):
  1. User can see a Buy, Hold, or Sell label for each player in their squad — derived from gem_score consistent with transfer engine signals (no contradictory verdicts)
  2. User can see a top-5 captaincy ranking for the next GW with projected captain points for each candidate
  3. User can distinguish safe captain picks (nailed, high floor) from upside picks (differential, high ceiling) in the captaincy panel
  4. Buy/Hold/Sell labels and captaincy rankings pass Vitest tests with fixture data covering edge cases (DGW players, null xG/xA, injured players)
**Plans**: TBD
**UI hint**: yes

### Phase 11: Explainability + Replacement Shortlist
**Goal**: Managers understand why each recommendation was made, can see structured risk flags per player, and get a concrete replacement shortlist with projected points gain for Sell candidates
**Depends on**: Phase 10
**Requirements**: EXP-01, EXP-02, REC-02
**Success Criteria** (what must be TRUE):
  1. User can expand a panel per player to see natural-language "why this player" reasons (e.g. "Strong fixture run — FDR 2 for next 3 GWs", "High start probability (92%)")
  2. User can see structured risk flags per player: rotation concern, fixture swing, regression risk, injury concern — displayed as labelled indicators
  3. User can see a replacement shortlist of 3–5 alternatives for Sell candidates, ranked by projected points delta, with the gain stated in absolute FPL points
**Plans**: TBD
**UI hint**: yes

### Phase 12: FPL Auth + Exact Selling Price
**Goal**: Managers who choose to log in with their FPL credentials see exact sell prices and true bank balance, enriching the recommendation engine without gating any feature for unauthenticated users
**Depends on**: Phase 10
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User can log in with FPL email/password via a login form in the app and see exact selling prices replace approximate `now_cost` values in SquadView
  2. User can see their exact bank balance (from `entry_history.bank`) when authenticated, not the approximate budget derived from public picks
  3. All features work correctly for unauthenticated users — FPL login enriches but never gates functionality
  4. FPL credentials are never persisted beyond a single request lifecycle and are never passed to or stored in `pipeline/run.py` or any cron-scheduled code
**Plans**: TBD
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
| 7. Pipeline Schema Extension | v1.1 | 2/3 | In Progress|  |
| 8. Minutes Risk UI + Transfer Integration | v1.1 | 0/? | Not started | - |
| 9. Projected Points Columns | v1.1 | 0/? | Not started | - |
| 10. Buy/Hold/Sell + Captaincy Engines | v1.1 | 0/? | Not started | - |
| 11. Explainability + Replacement Shortlist | v1.1 | 0/? | Not started | - |
| 12. FPL Auth + Exact Selling Price | v1.1 | 0/? | Not started | - |
