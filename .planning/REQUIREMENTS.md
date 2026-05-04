# Requirements: FPL Analyst v1.9 Competitive Intelligence

**Milestone:** v1.9 Competitive Intelligence
**Status:** Active
**Created:** 2026-05-03
**Phases:** Continue from Phase 55 (last v1.8 phase)

---

## v1 Requirements

### FT Engine Fix (pre-condition for MTP and TRT)

- [ ] **FTX-01**: System correctly banks unused free transfers up to 4 (rolling 1 unused FT gives 2 available next GW, capped at 5 total available)
- [ ] **FTX-02**: Wildcard and Free Hit chip activations preserve the banked FT count rather than resetting it to zero

### Manual Transfer Planner (MTP)

- [x] **MTP-01**: User can open a "Manual Plan" sub-tab in the Planner section, independent of the existing AI planner tab
- [x] **MTP-02**: User can add, remove, or swap a transfer for any GW step via a player picker (position-filtered, budget-aware)
- [x] **MTP-03**: System shows a running bank balance per GW step calculated as: starting bank + sum of sell prices − sum of buy prices across all steps up to that GW
- [x] **MTP-04**: System tracks FT bank per GW step and marks each transfer as Free or Hit (−4pts) based on the corrected FT engine (FTX-01/02)
- [x] **MTP-05**: System shows total hit count for the full plan and break-even weeks per hit transfer (formula: 4 ÷ xPts delta for that transfer)
- [x] **MTP-06**: System shows the full 15-player squad snapshot per GW step reflecting all transfers applied up to that point
- [x] **MTP-07**: When the user is unauthenticated (no FPL login), system shows a caveat that sell prices are approximate (using now_cost, not exact selling_price from FPL my-team API)
- [x] **MTP-08**: Manual plan state persists to localStorage and survives page navigation within the session

### Mini-League Rival Tracker (ML)

- [ ] **ML-01**: User can enter a mini-league ID to load rival squad data via the existing FPL proxy
- [ ] **ML-02**: System displays a rival summary table showing: rank, gap to user's rank, captain pick (post-deadline only), chips remaining
- [ ] **ML-03**: System identifies shared players owned by both the user and a given rival, displayed per-rival
- [ ] **ML-04**: System flags differential upside: players the user owns that the rival does not (user advantage)
- [ ] **ML-05**: System flags rival threats: players with high xPts that the rival owns but the user does not (rival advantage)
- [ ] **ML-06**: System identifies blocking moves: transfer targets the user is considering that would simultaneously give a differential advantage over rivals
- [ ] **ML-07**: System estimates rank impact of captain differential: expected rank swing if user's captain outperforms rival's captain pick based on xPts_90th_1gw gap
- [ ] **ML-08**: System fetches a maximum of 20 rivals in batches of 3 concurrent requests to stay within undocumented FPL API rate limits; shows a note for leagues larger than 20 rivals

### Effective Ownership (EO)

- [ ] **EO-01**: Each captain candidate in the captain panel displays an EO% figure approximated from selected_by_percent, labelled "~EO" with a tooltip explaining the approximation
- [ ] **EO-02**: Captain panel has a mode toggle with four options (Max xPts / Protect Rank / Chase Rank / Differential Aggressive) that re-ranks candidates by EO-adjusted priority
- [ ] **EO-03**: In Protect Rank mode, players with EO > 30% who are not in the user's current squad display a "Dangerous to fade" warning badge
- [ ] **EO-04**: EO mode selection is scoped to the Squad section captain panel only (does not affect Transfer suggestions or Decision Summary in v1.9)

### Transfer Route Tree (TRT)

- [ ] **TRT-01**: System generates 2–3 branching transfer paths using pure TypeScript: top-3 distinct sell-player roots each with a greedy continuation (no LLM)
- [ ] **TRT-02**: Each path displays a summary row: total hits, total hit cost in points, net projected xPts over the chosen horizon, chips preserved vs consumed
- [ ] **TRT-03**: Each path is expandable to show a GW-by-GW breakdown: transfer out / transfer in, FT bank at that GW, projected xPts contribution
- [ ] **TRT-04**: All paths are presented in a side-by-side summary table with the highest net-xPts path highlighted as recommended
- [ ] **TRT-05**: A "Load into Manual Planner" button on any path pre-populates the MTP-01 plan with that path's GW transfers so the user can refine it manually
- [ ] **TRT-06**: Tree generation respects the active chip mode (Wildcard / Free Hit / Bench Boost) when set in the Planner section header
- [ ] **TRT-07**: Tree recalculates when the GW horizon toggle changes (1 GW / 3 GW / 5 GW)

---

## Future Requirements

- **EO-05**: EO mode affects Transfer suggestions in TransferPanel (deferred — v1.10)
- **EO-06**: EO mode affects Decision Summary card rankings (deferred — v1.10)
- **ML-09**: Pagination for leagues with > 20 rivals (deferred — v1.10)
- **ML-10**: Pre-deadline lineup inference for rival captain prediction (deferred — complex, accuracy unclear)
- **TRT-08**: Branching tree visualisation as a node graph (deferred — no evidence this adds over table view)

---

## Out of Scope

- **LLM-generated transfer tree branches** — TREE-01 is pure TypeScript; LLM use deferred to v1.12 with NLP-01
- **Animated pitch view in Manual Planner** — duplicate of existing v1.3 pitch UI; table-based squad snapshot sufficient
- **Third-party top-10k EO scraping** — privacy and reliability concerns; selected_by_percent approximation is community-standard
- **EO affecting Transfer or Decision surfaces in v1.9** — captain panel only; broader reach is a v1.10 scope item

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FTX-01 | Phase 56 | Pending |
| FTX-02 | Phase 56 | Pending |
| EO-01 | Phase 57 | Pending |
| EO-02 | Phase 57 | Pending |
| EO-03 | Phase 57 | Pending |
| EO-04 | Phase 57 | Pending |
| ML-01 | Phase 58 | Pending |
| ML-02 | Phase 58 | Pending |
| ML-03 | Phase 58 | Pending |
| ML-04 | Phase 58 | Pending |
| ML-05 | Phase 58 | Pending |
| ML-06 | Phase 58 | Pending |
| ML-07 | Phase 58 | Pending |
| ML-08 | Phase 58 | Pending |
| MTP-01 | Phase 59 | Complete |
| MTP-02 | Phase 59 | Complete |
| MTP-03 | Phase 59 | Complete |
| MTP-04 | Phase 59 | Complete |
| MTP-05 | Phase 59 | Complete |
| MTP-06 | Phase 59 | Complete |
| MTP-07 | Phase 59 | Complete |
| MTP-08 | Phase 59 | Complete |
| TRT-01 | Phase 60 | Pending |
| TRT-02 | Phase 60 | Pending |
| TRT-03 | Phase 60 | Pending |
| TRT-04 | Phase 60 | Pending |
| TRT-05 | Phase 60 | Pending |
| TRT-06 | Phase 60 | Pending |
| TRT-07 | Phase 60 | Pending |

---

*Last updated: 2026-05-04 — Phase 59 complete; MTP-01..MTP-08 all verified*
