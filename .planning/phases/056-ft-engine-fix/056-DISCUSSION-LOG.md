# Phase 56: FT Engine Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 056-ft-engine-fix
**Areas discussed:** FT banking cap (FTX-01 conflict), Post-chip FT state (FTX-02), Scope of the fix

---

## FT Banking Cap (FTX-01 conflict)

| Option | Description | Selected |
|--------|-------------|----------|
| Standard FPL: max 2 available | Bank 1 per GW, max 2 available. 2 consecutive rolls → 2 FTs. Matches ROADMAP success criteria and actual FPL rules. | ✓ |
| Custom: bank up to 4, max 5 available | REQUIREMENTS.md "capped at 5" description. Would allow 3 FTs after 2 consecutive rolls. NOT standard FPL. | |

**User's choice:** Standard FPL: max 2 available
**Notes:** REQUIREMENTS.md "capped at 5 total available" is a documentation error. ROADMAP success criteria is authoritative. The current free-transfer-engine.ts banking formula is already correct — the bug lies elsewhere (chip handling / initial FT state).

---

## Post-Chip FT State (FTX-02)

### Wildcard

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to 1 (real FPL behaviour) | After Wildcard, always get 1 FT next GW — banked amount lost. Standard FPL. | |
| Preserve banked FTs (per REQUIREMENTS.md) | If user had 2 available (1 banked) before WC, next GW still gets 2. Bank carries through chip activation. | ✓ |
| You decide | Let researcher/planner pick consistent with standard FPL. | |

**User's choice:** Preserve banked FTs

### Free Hit

| Option | Description | Selected |
|--------|-------------|----------|
| Same rule: preserve banked FTs | Consistent with Wildcard answer — bank carries through FH activation. | ✓ |
| Reset to 1 (real FPL behaviour) | After FH, return to real squad with 1 FT. Pre-FH bank suspended. | |
| You decide | Let researcher/planner pick. | |

**User's choice:** Same rule: preserve banked FTs
**Notes:** Current FH formula in free-transfer-engine.ts already does bank preservation correctly. Only the Wildcard path needs fixing.

---

## Scope of the Fix

### Initial FT State

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from authenticated state | When logged in, read actual FT count from myTeamData.entry_history.event_transfers. Same logic as TransferPanel's derivedFtCount. | ✓ |
| Keep hardcoded at 1 | Conservative default. Simpler but wrong when user has 2 FTs banked. | |

**User's choice:** Derive from authenticated state

### Null Chip Bug in planning-engine.ts

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fix the null chip bug too | Without fixing null chip, FTX-02 can't work end-to-end. Three fixes together close FTX-01 and FTX-02. | ✓ |
| Engine layer only | Fix just Wildcard bank-reset. Null chip means chip paths never fire but this unlocks a future fix. | |

**User's choice:** Yes — fix the null chip bug too
**Notes:** Researcher to determine whether the null chip in planning-engine.ts is intentional (AI plan never auto-selects chips) or a genuine bug. If AI plan never uses chips, null may be correct there; chip handling flows through PlannerTab's handleChipEdit path instead.

---

## Claude's Discretion

- Researcher to assess whether `planning-engine.ts:203` null chip is intentional or a bug (D-07).

## Deferred Ideas

None.
