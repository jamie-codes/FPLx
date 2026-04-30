# Phase 45: Transfer-Aware Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 45-transfer-aware-mode
**Areas discussed:** FT count input, Transfer candidate pool, UI layout, Auth dependency

---

## FT Count Input

| Option | Description | Selected |
|--------|-------------|----------|
| Manual toggle (1 FT / 2 FTs) | User sets manually — always accurate, zero API complexity | ✓ |
| Auto-detect from FPL | Infer from entry_history.event_transfers — fragile, public endpoint lacks available-FT field | |
| Always assume 1 FT | No selector, always 1 FT — misses 2-FT rollover case | |

**User's choice:** Manual toggle
**Notes:** None

---

## Transfer Candidate Pool

| Option | Description | Selected |
|--------|-------------|----------|
| Top-N from all players | Top 30 per position from usePlayers() — finds real targets | ✓ |
| Squad-only rearrangement | Within-squad only — misses real transfer opportunities | |
| Top 50 overall | May flood one position | |

**User's choice:** Top-N from all players (top 30 per position)

| Option | Description | Selected |
|--------|-------------|----------|
| Include hit transfers | Show -4pt transfers with TFR-03 break-even indicator | ✓ |
| Free transfers only | Ignores TFR-03 entirely | |

**User's choice:** Include hit transfers
**Notes:** None

---

## UI Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Below the table | Transfer suggestions below comparison table — natural reading flow | ✓ |
| Mode toggle | Lineup / Transfers toggle — can't see both at once | |
| Expandable section | Hidden behind disclosure button | |

**User's choice:** Below the table
**Notes:** None

---

## Auth Dependency / Budget

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback to now_cost | Use now_cost when unauthenticated — transparent degradation | ✓ |
| Require auth | Gate transfer mode behind login | |
| Skip budget checks | Never enforce budget | |

**User's choice:** Fallback to now_cost

| Option | Description | Selected |
|--------|-------------|----------|
| Hard filter | Silently exclude unaffordable suggestions | ✓ |
| Show but flag | Show all with "Over budget" label | |
| No budget filtering | Ignore budget entirely | |

**User's choice:** Hard filter (only show achievable suggestions)
**Notes:** None

---

## Claude's Discretion

- FT toggle placement (inline with horizon or separate row)
- Ranking tie-breaker for equal xPts gain
- 2-FT enumeration: full pair vs greedy (full pair recommended given bounded candidate pool)
- Mobile layout for transfer suggestion rows

## Deferred Ideas

None — discussion stayed within phase scope.
