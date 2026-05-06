# Phase 74: Transfer Engine Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 074-transfer-engine-overhaul
**Areas discussed:** Scope of fixes, Four-scenario layout, -8 hit modeling, Bank balance UX

---

## Scope of fixes

| Option | Description | Selected |
|--------|-------------|----------|
| OCS only | Fix suggestTransfers() + OpportunityCostTable only. Remove older "Suggested Transfers" section. | ✓ |
| Both sections | Apply fixes to both engines (suggestTransfers and computeTransferSuggestions). | |
| Consolidate into one | Replace computeTransferSuggestions with suggestTransfers as single source of truth. | |

**User's choice:** OCS only (recommended)
**Notes:** Followed up — older "Suggested Transfers" section should be removed entirely, not just left as-is, to avoid two parallel transfer views confusing the user.

---

## Four-scenario layout

| Option | Description | Selected |
|--------|-------------|----------|
| Always compute all 4 rows | Remove FtToggle. Engine always emits all four scenario rows. | ✓ |
| Keep toggle, add rows | Keep FtToggle but make both positions show all rows. | |
| Scenario tabs | Four named tabs (1FT / 2FT / -4 / -8) at the top. | |

**User's choice:** Always compute all 4 rows (recommended)
**Notes:** GwToggle stays in section header. Unaffordable rows shown-but-disabled (greyed out with "Over budget by £Xm" reason), not hidden.

---

## -8 hit modeling

| Option | Description | Selected |
|--------|-------------|----------|
| Always compute it | Engine always generates cost:8 combos regardless of FT count. | ✓ |
| Only when FTs < 2 | Show -8 row only when user has 0 or 1 FTs. | |
| You decide | Let planner figure out emission logic. | |

**User's choice:** Always compute it (recommended)
**Notes:** FT count derived from auth/myTeam (derivedFtCount) for correct row labeling. -8 Hit row reuses same 2-transfer combo enumeration as 2FT row — same player pair, different cost label.

---

## Bank balance UX

| Option | Description | Selected |
|--------|-------------|----------|
| In 'Load Your Squad' form | Bank input alongside FT count, same form zone. | ✓ |
| Above the OCS table | Compact inline field just above the four-scenario table. | |
| You decide | Let planner choose placement. | |

**User's choice:** In 'Load Your Squad' form (recommended)
**Notes:** When authenticated, field is pre-populated from FPL sell prices but remains editable (override mode). Input accepts £m decimal (e.g. 2.5), labelled with £m suffix, internally ×10 for tenths conversion.

---

## Claude's Discretion

- Row ordering in OCS table (Roll / 1FT / 2FT / -4 Hit / -8 Hit)
- Visual treatment for disabled rows (opacity, strikethrough, badge colour)
- Break-even display on hit rows when net gain is negative
- State management for bank balance override field
- Whether `ocsFtCount` state is retained after FtToggle removal

## Deferred Ideas

None — discussion stayed within phase scope.
