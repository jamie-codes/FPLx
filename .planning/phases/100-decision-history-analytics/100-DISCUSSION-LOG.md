# Phase 100: Decision History Analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 100-decision-history-analytics
**Areas discussed:** UI placement, HIST-01 hit rate def, HIST-03 break-even, HIST-02/03 data

---

## UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Back tab | Add HIST-01 to SeasonSummaryHeader; HIST-02/03 as new sections below RegretChart. No new sub-tab. | ✓ |
| New 'History' tab | 4th sub-tab (Summary | Calibration | Back | History). History owns all three HIST features. Back stays purely captain regret. | |
| Split | HIST-01 stays in Back tab; HIST-02/03 in a new History tab. | |

**User's choice:** Extend Back tab
**Notes:** All three HIST features co-locate in the Back tab. Avoids adding a 4th sub-tab.

---

## HIST-01 Hit Rate Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Beat model ceiling | Hit rate = % GWs where regret ≤ 0 (user captain ≥ model ceiling). From existing RegretEntry data, no new API calls. | ✓ |
| Squad's top scorer | Hit rate = % GWs where captain had highest points in user's squad. Requires per-GW picks comparison. | |

**User's choice:** Beat model ceiling
**Notes:** Purely derivable from existing BackTab data. No new pipeline work.

**Follow-up: Display format**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in SeasonSummaryHeader | Additional stat alongside existing "Model better / You won / Tied" counts. | ✓ |
| Separate headline badge | Large percentage badge above the existing summary row. | |

**User's choice:** Inline in SeasonSummaryHeader
**Notes:** Minimal new markup; consistent with existing summary row style.

---

## HIST-03 Break-Even Window

| Option | Description | Selected |
|--------|-------------|----------|
| Rest of season | Cumulative element_in pts from transfer GW onwards vs element_out same window + 4. | ✓ |
| Fixed 5-GW window | Check only the 5 GWs after the transfer. Consistent window but ignores season end. | |
| Skip HIST-03 this phase | Descope due to complexity (multiple /element-summary/ fetches). | |

**User's choice:** Rest of season
**Notes:** "Did the hit pay off by end of season?" is the clearest framing.

**Follow-up: Hit identification**

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-ref with entry history | Use entry_history[].event_transfers_cost > 0 to identify hit GWs; cross-ref with transfers[]. | ✓ |
| Assume multi-transfers are hits | Heuristic — unreliable for wildcard GWs. | |

**User's choice:** Cross-ref with entry history

---

## HIST-02/03 Data Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| New /api/season-analytics route | Server-side: fetches /entry/{id}/history/, /entry/{id}/transfers/, /element-summary/{id}/ per hit player in parallel. One client fetch. | ✓ |
| Extend useChipHistory + new hook | Update hook to return entry_history; add useHitTracking for client-side multi-fetch. More browser requests. | |

**User's choice:** New /api/season-analytics route
**Notes:** Mirrors /api/decision-history pattern. Keeps browser API calls to one.

**Follow-up: Chip scope**

| Option | Description | Selected |
|--------|-------------|----------|
| BB + TC + FH only | bboost, 3xc, freehit. Wildcard excluded (no meaningful single-GW comparison). | ✓ |
| All 4 chips | Include Wildcard (GW score vs season avg). Less meaningful but complete. | |

**User's choice:** BB + TC + FH only

---

## Claude's Discretion

- Exact section ordering within Back tab (HIST-02 vs HIST-03 first, position relative to per-GW table)
- `ChipRoiEntry` and `HitTrackingEntry` type shapes
- Whether `useSeasonAnalytics` caches to localStorage or is fetch-only
- Column layout for HIST-03 hit tracking rows
- Shared loading/error state vs per-section states for HIST-02/03
- `computeSeasonSummary()` extension vs separate helper for HIST-01 hit rate

## Deferred Ideas

None — discussion stayed within phase scope.
