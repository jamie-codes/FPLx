# Phase 113: Transfer Regret Backtester (v1.20) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 113-transfer-regret-backtester-v1-20
**Areas discussed:** Snapshot strategy, No-transfer GW handling, BackTab layout, Regret visualisation

---

## Snapshot Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript post-hoc | API reads per-GW slim player snapshot, reconstructs pre-transfer squad, runs suggestTransfers() on-demand | ✓ |
| Python pipeline snapshot | Port suggestTransfers to Python; pipeline writes transfer_recommendation_gw{N}.json at run time | |

**User's choice:** TypeScript post-hoc compute

---

| Option | Description | Selected |
|--------|-------------|----------|
| Slim per-GW snapshot | Pipeline side-writes merged_players_slim_gw{N}.json (~50-75KB) with only fields suggestTransfers needs | ✓ |
| Current merged_players.json for all GWs | Use today's data for all historical GWs — approximate, stated in UI | |

**User's choice:** Slim per-GW snapshot — pipeline adds merged_players_slim_gw{N}.json side-write

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reconstruct pre-transfer squad | Swap element_in ↔ element_out from FPL event_transfers to recover squad state at decision time | ✓ |
| Use post-transfer squad | Simpler, no reconstruction — engine runs against post-transfer lineup | |

**User's choice:** Reconstruct pre-transfer squad

---

## No-Transfer GW Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show all settled GWs | Every finished GW gets a row; hold GWs show "Held — no transfer" with engine rec + delta | ✓ |
| Only GWs where user transferred | Rows only when user transferred | |
| Held GWs collapsed | Hold GWs render as muted single row, expandable | |

**User's choice:** Show all settled GWs

---

| Option | Description | Selected |
|--------|-------------|----------|
| Engine's recommended swap gain | delta = engine_IN.actual_pts − engine_OUT.actual_pts for hold GWs | ✓ |
| No delta for hold GWs | Show engine recommendation but no delta | |

**User's choice:** Engine's recommended swap gain (positive = engine was right, user left points on the table)

---

| Option | Description | Selected |
|--------|-------------|----------|
| One row per GW, summed delta | Single row, delta = Σ(engine swap gains) − Σ(user swap gains) | ✓ |
| One row per transfer leg | Expand 2-FT GWs into 2 sub-rows | |

**User's choice:** One row per GW, summed delta

---

## BackTab Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Captain \| Transfer toggle | Segmented pill at top of BackTab; each view has own summary + chart + rows | ✓ |
| Sequential scroll | Captain content at top, TransferRegretSection below with divider | |
| You decide | Claude chooses | |

**User's choice:** Captain | Transfer toggle — reuses GwToggle pill pattern

---

| Option | Description | Selected |
|--------|-------------|----------|
| Captain default | Preserves existing BACK-01 experience; Transfer one click away | ✓ |
| Transfer default | New feature front and centre | |

**User's choice:** Captain default on mount

---

## Regret Visualisation

| Option | Description | Selected |
|--------|-------------|----------|
| Bar chart + rows | Season summary header + recharts bar chart + per-GW rows; matches captain pattern | ✓ |
| Table only | No chart — simpler, quicker to scan | |

**User's choice:** Bar chart + rows (matches BACK-01 captain pattern exactly)

---

| Option | Description | Selected |
|--------|-------------|----------|
| GW / Engine sell→buy / User sell→buy / Delta | 4 columns with player names and actual pts | ✓ |
| GW / Delta only | Minimal — just gameweek and regret delta | |

**User's choice:** Full 4-column layout

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cumulative delta + engine win rate | "Total transfer regret: X pts | Engine better: N | You better: N | Tied: N" | ✓ |
| Just cumulative delta | Simpler single stat | |

**User's choice:** Cumulative delta + engine win rate (matches captain summary header pattern)

---

## Claude's Discretion

- Exact field list for merged_players_slim_gw{N}.json (minimum set for suggestTransfers)
- GW horizon passed to suggestTransfers() for post-hoc compute (defaulting to 1GW)
- Whether computeTransferRegret() lives in src/lib/regret.ts or a new file
- No-snapshot placeholder text for GWs before Phase 113 deployment
- Column widths and responsive behaviour of per-GW rows
- /api/decision-history response shape for transfer entries

## Deferred Ideas

None — discussion stayed within phase scope.
