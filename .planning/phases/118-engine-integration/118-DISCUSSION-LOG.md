# Phase 118: Engine Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 118-Engine Integration
**Areas discussed:** Penalty multiplier design, optimiseLineup() absent depth, Staleness gate placement

---

## Penalty Multiplier Design

| Option | Description | Selected |
|--------|-------------|----------|
| Use availability_factor directly | Multiply buy score by availability_factor (0.75/0.50/0.25 for doubted, 0.01 floor for absent, 1.0 for null). More nuanced — 25%-chance player penalized harder than 75%-chance. | ✓ |
| Flat status_label multipliers | doubted=×0.70 (all doubted treated equally), confirmed_absent=×0.01, unknown/confirmed_start=×1.0. Matches spec literally but ignores within-doubted granularity. | |

**User's choice:** Use availability_factor directly

**Follow-up: Floor behaviour for availability_factor=0.0**

| Option | Description | Selected |
|--------|-------------|----------|
| Apply 0.01 floor for 0.0 | Absent players score near-zero, appear at bottom of position buckets rather than being filtered out. Matches spec's 'near-zero' intent. | ✓ |
| Let 0.0 filter them out | Multiply by 0.0 exactly — player gets xPtsGain=0, filtered from suggestions. Cleaner math but absent players become invisible. | |

**User's choice:** Apply 0.01 floor for 0.0

**Follow-up: Where penalty is applied in scoring chain**

| Option | Description | Selected |
|--------|-------------|----------|
| Both pool sort and xPtsGain | Apply inside scorePlayer() for buys — penalized score drives in-pool top-30 sort AND xPtsGain calculation. Absent players don't make in-pool. | ✓ |
| xPtsGain only, pool sort unaffected | Keep top-30 sort by raw xPts; apply penalty only when computing xPtsGain per pair. Absent players surface but sink naturally. | |

**User's choice:** Both pool sort and xPtsGain

---

## optimiseLineup() Absent Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude from starters + zero bench EV | Exclude confirmed_absent from C(15,11) eligible set (like BGW). They fall to bench; benchOrder EV=0 sinks them to last slot. Consistent and correct. | ✓ |
| Bench EV zeroing only | Only modify benchOrder() EV. Starter enumeration untouched — absent high-xPts player could still be picked as starter. Less invasive but logically inconsistent. | |

**User's choice:** Exclude from starters + zero bench EV

**Follow-up: Edge case when <11 eligible after absent exclusion**

| Option | Description | Selected |
|--------|-------------|----------|
| Return null (same as BGW behaviour) | Fewer than 11 after excluding absent → return null. Consistent; UI already handles null via empty-state. | ✓ |
| Degrade gracefully — ignore absence | If would drop below 11, run full C(15,11) without absence exclusion. Avoids null at cost of potentially recommending absent starters. | |

**User's choice:** Return null (same as BGW behaviour)

**Follow-up: Doubted players in optimiser**

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmed-absent only | Only confirmed_absent gets starter-exclusion and bench EV=0. Doubted players unaffected in optimiser — still worth trying to start a 75%-chance player. | ✓ |
| Doubted too — apply availability_factor to bench EV | benchOrder multiplies evScore by availability_factor for all players. 25%-chance player's EV cut by 75%, naturally sinking below healthy bench options. | |

**User's choice:** Confirmed-absent only

---

## Staleness Gate Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Hook select transform | useLineupNews returns undefined when scraped_at >48h old. Engines receive undefined lineupNewsMap, produce unpenalized output naturally. Engines stay pure. | ✓ (as Phase 117 work) |
| Component level before Map construction | Each component checks scraped_at before building Map. Same logic required in every consumer. | |

**User's choice:** Hook select transform

**Follow-up: Ownership — Phase 117 or Phase 118?**

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 118 owns it | Hook already created in Phase 117 (117-02 commits). Phase 118 adds select transform with 48h gate. | |
| Should have been Phase 117 | INFRA-02 is Phase 117's requirement. Fix there before Phase 118. | ✓ |

**User's choice:** Should have been Phase 117 — planner must verify the select transform exists before planning engine changes

---

## Claude's Discretion

None — all areas had clear user direction.

## Deferred Ideas

None — discussion stayed within phase scope.
