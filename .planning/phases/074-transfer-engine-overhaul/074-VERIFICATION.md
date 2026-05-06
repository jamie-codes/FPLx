---
phase: 074-transfer-engine-overhaul
verified: 2026-05-06T20:09:30Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
human_verification:
  - test: "Confirm -8 Hit row appears when ftCount=1 (unauthenticated or 1-FT state)"
    expected: "The -8 Hit row is visible in the OCS table when the user has 1 free transfer — showing the same player pair as the 2FT row with xPtsGainNet = xPtsGain - 8"
    why_human: "CR-01 from the code review identifies this as broken for ftCount=1: the mapper searches for best2FTCombo (cost===0) but the engine only emits cost:4 combos when ftCount=1. The unit tests only cover ftCount=2 for the -8 Hit row. Automated grep confirms the code path: opportunity-cost.ts lines 85-87 find cost===0 combos; suggest-transfers.ts line 211 emits cost:4 when ftCount=1. The -8 Hit row will be absent for the majority of users (1 FT is the default). This needs a human check against the running app to determine severity of impact before a fix is mandated."
  - test: "Confirm the Free transfers field (labelled 'Free transfers') feeds into derivedFtCount for unauthenticated users"
    expected: "An unauthenticated user who sets Free transfers to 2 should see the 2FT row show cost:0 (free) and the -8 Hit row appear. Currently derivedFtCount returns 1 for all unauthenticated users regardless of the field value."
    why_human: "CR-02 from the code review: freeTransfers state (line 40) is rendered in a UI control (lines 213-230) but is NEVER used in derivedFtCount (lines 87-92). The derivedFtCount useMemo ignores freeTransfers entirely. This is a functional gap for the unauthenticated path of TFX-05 — the manual bank field is wired but the manual FT count field is not. Needs human confirmation of desired behaviour: either wire it or remove the UI control."
---

# Phase 74: Transfer Engine Overhaul Verification Report

**Phase Goal:** Transfer suggestions correctly enforce the 3-player-per-team cap, never duplicate player moves across multi-transfer plans, and present all four cost scenarios (1FT, 2FT, −4, −8) with live bank balance and clear affordability indicators
**Verified:** 2026-05-06T20:09:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Transfer panel never suggests a player from a team where user already owns 3 players (TFX-01) | ✓ VERIFIED | `cappedTeams` Set built from `playerById.get(pick.element)?.team` (suggest-transfers.ts lines 92-105); filter applied at inPoolByPosition build (line 112 `!cappedTeams.has(p.team)`); 2 passing unit tests |
| 2 | No player appears as both sell in one step and buy in another within a 2FT combo (TFX-02) | ✓ VERIFIED | `sell2.id === sell1.id` guard at outer loop line 189; buy-side guard at line 198; 2 passing unit tests in describe('Phase 74: Sell-side dedup') |
| 3 | User can view 1FT, 2FT, −4 hit, −8 hit scenarios simultaneously in a single panel (TFX-03) | ? UNCERTAIN | OCSRow types and mapper logic support 5 rows. Tests pass for ftCount=2. However CR-01 (code review) confirms -8 Hit row is absent when ftCount=1 — the engine emits cost:4 combos for ftCount=1, but the mapper only derives -8 Hit from cost:0 combos. Majority-state users (1 FT default) will not see the -8 Hit row. Human verification needed. |
| 4 | Each scenario row shows remaining bank balance; unaffordable moves are visually disabled (TFX-04) | ✓ VERIFIED | `bankAfter`, `isAffordable`, `disabledReason` on every OCSRow; `opacity-50` + `aria-disabled` + `line-through` in OpportunityCostTable; `row.disabledReason` label rendered in red below badge; `row.bankAfter` shown as bank sub-line |
| 5 | When authenticated, bank auto-derived from FPL; when unauthenticated, user can type bank balance (TFX-05) | ? UNCERTAIN | Bank auto-fill VERIFIED: `useEffect` guards `isAuthenticated && myTeamData`, sets `manualBank(myTeamData.entry_history.bank / 10)`. Bank manual entry VERIFIED: `id="bankBalance"` input with £m suffix, `Math.round(manualBank * 10)` passed to engine and mapper. However CR-02 (code review): the "Free transfers" UI field is rendered (freeTransfers state line 40, input lines 213-230) but its value is NEVER passed to `derivedFtCount`. Unauthenticated users who set FT count to 2 will get ftCount=1 from the engine regardless. This affects how "all affordability checks" work for the unauthenticated path. |

**Score:** 3/5 truths fully verified (2 uncertain, require human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | TransferSuggestion combo cost: 0\|4\|8 | ✓ VERIFIED | Line 240: `cost: 0 \| 4 \| 8` in combo variant; single variant line 229 unchanged at `cost: 0 \| 4` |
| `src/lib/opportunity-cost.test.ts` | Wave 0 scaffold + all todos converted | ✓ VERIFIED | 0 it.todo() remaining; 16 passing tests; `expect(rows.length).toBe(5)` at line 91 |
| `src/lib/suggest-transfers.ts` | Team cap filter, sell-side dedup, always-emit combos, breakEven:0\|4\|8 | ✓ VERIFIED | cappedTeams (2 uses); sell2.id guard (line 189); outer `if (ftCount === 2)` guard removed; breakEven accepts cost:0\|4\|8 (line 77) |
| `src/lib/suggest-transfers.test.ts` | 4 new describe blocks for TFX-01/TFX-02/D-06/TFX-05 | ✓ VERIFIED | All 4 describe blocks present; 20 tests passing |
| `src/lib/opportunity-cost.ts` | 5-row output, bankAfter/isAffordable/disabledReason, combo-hit-8, 3-arg signature | ✓ VERIFIED | OCSRowKind includes 'combo-hit-8'; bankAfter on all rows; formatDisabledReason helper; signature `(suggestions, ftCount, bank)` |
| `src/components/transfers/TransferPanel.tsx` | manualBank state, bank input, FtToggle removed, legacy section removed | ✓ VERIFIED | 7 manualBank references; 0 ocsFtCount; 0 FtToggle; 0 computeTransferSuggestions; 0 transferResult |
| `src/components/transfers/OpportunityCostTable.tsx` | combo-hit-8 badge, disabled row treatment, bank sub-line | ✓ VERIFIED | combo-hit-8 in BADGE_BY_KIND; aria-disabled; opacity-50; row.disabledReason; row.bankAfter (3 refs); row.isAffordable |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| TransferPanel.tsx | engine | `Math.round(manualBank * 10)` | ✓ WIRED | Lines 109 and 115 both pass tenths |
| TransferPanel.tsx | FPL prefill | `myTeamData.entry_history.bank / 10` | ✓ WIRED | Line 98 in useEffect |
| OpportunityCostTable.tsx | OCSRow affordability | `row.isAffordable` / `row.disabledReason` / `row.bankAfter` | ✓ WIRED | All three consumed in render |
| opportunity-cost.ts | best cost:0 combo | `-8 Hit row derived from best2FTCombo` | ⚠️ PARTIAL | Works for ftCount=2 (cost:0 combos exist); FAILS for ftCount=1 (engine only emits cost:4 combos, `best2FTCombo` is undefined, -8 Hit row silently omitted) |
| freeTransfers state | derivedFtCount | `derivedFtCount` useMemo uses freeTransfers | ✗ NOT_WIRED | `freeTransfers` state (line 40) is rendered in a UI control (lines 213-230) but not used anywhere in derivedFtCount (lines 87-92). Unauthenticated users always get ftCount=1. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| OpportunityCostTable.tsx | `rows` prop | `ocsRows` useMemo in TransferPanel → computeOpportunityCostRows | Yes — engine produces real suggestions from scoredPlayers | ✓ FLOWING |
| TransferPanel.tsx | `manualBank` | FPL `entry_history.bank / 10` (auth) or user input (unauth) | Yes — wired | ✓ FLOWING |
| TransferPanel.tsx | `derivedFtCount` | `myTeamData.entry_history.event_transfers` (auth only) | Yes for auth; hardcoded 1 for unauth regardless of UI field | ⚠️ STATIC (unauthenticated path) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tsc compilation clean | `npx tsc --noEmit` | 0 errors | ✓ PASS |
| opportunity-cost unit tests | `npx vitest run src/lib/opportunity-cost.test.ts` | 16 passed | ✓ PASS |
| suggest-transfers unit tests | `npx vitest run src/lib/suggest-transfers.test.ts` | 20 passed | ✓ PASS |
| -8 Hit row with ftCount=1 | Code path: ftCount=1 → engine emits cost:4 combos; mapper line 85-87 finds cost===0 → undefined; -8 Hit block (line 159) skipped | Row absent for majority user state | ✗ FAIL (code analysis) |
| freeTransfers feeds engine | grep: derivedFtCount useMemo (lines 87-92) does not read freeTransfers | freeTransfers never consumed by engine | ✗ FAIL (code analysis) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| TFX-01 | 074-02 | 3-player-per-team cap on buy candidates | ✓ SATISFIED | cappedTeams filter in suggest-transfers.ts; 2 unit tests |
| TFX-02 | 074-02 | No duplicate player across multi-transfer legs | ✓ SATISFIED | sell2.id === sell1.id guard + buy2.id === buy1.id guard; 2 unit tests |
| TFX-03 | 074-01, 074-03, 074-04 | All 4 scenarios (1FT/2FT/−4/−8) visible simultaneously | ? NEEDS HUMAN | 5-row infrastructure exists and tested for ftCount=2; -8 Hit absent for ftCount=1 (CR-01) |
| TFX-04 | 074-03, 074-04 | Bank balance remaining shown; unaffordable moves disabled | ✓ SATISFIED | bankAfter/isAffordable/disabledReason wired through mapper to table; opacity-50/strikethrough/reason label rendered |
| TFX-05 | 074-04 | Bank auto-populated when auth; manual entry when unauth | ? NEEDS HUMAN | Bank field is wired; but freeTransfers field shown to unauthenticated users is ignored by engine (CR-02) — affects completeness of affordability checks |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/transfers/TransferPanel.tsx | 40, 213-230 | `freeTransfers` state declared and rendered in UI but never passed to engine (`derivedFtCount` ignores it) | ⚠️ Warning | Unauthenticated users setting FT count to 2 get wrong engine results; UI gives false confidence |
| src/lib/opportunity-cost.ts | 85-87, 159 | `-8 Hit` row derived only from `best2FTCombo` (cost===0); absent when ftCount=1 | ⚠️ Warning | -8 Hit row silently omitted for the most common user state (1 free transfer) |
| src/lib/suggest-transfers.ts | 199 | Redundant inner `sell2.id === sell1.id` guard inside O(n²) buy loop (unreachable, wastes ~900 iterations) | ℹ️ Info | Performance nit; no correctness impact |

### Human Verification Required

#### 1. -8 Hit Row Visibility for 1-FT Users (CR-01)

**Test:** Load the app unauthenticated. Enter a valid Team ID and load the squad. With the default "Free transfers" = 1, navigate to the Transfer Opportunity Cost section.
**Expected:** The OCS table should show Roll, 1 FT, 2 FT (Hit), −4 Hit, and −8 Hit rows.
**Why human:** Code analysis confirms -8 Hit is absent for ftCount=1: `opportunity-cost.ts` line 85 finds `best2FTCombo` by searching `cost === 0`, but `suggest-transfers.ts` line 211 only emits `cost: 0` combos when `ftCount === 2`. With ftCount=1 (default for unauthenticated), `best2FTCombo` is always `undefined` and the -8 Hit block (line 159) is skipped. Unit tests in `opportunity-cost.test.ts` only test with ftCount=2 for the combo-hit-8 assertions. This is a functional gap for TFX-03 (all four scenarios visible simultaneously). The REVIEW.md documents this as CR-01 with a concrete fix (`const comboForHit8 = best2FTCombo ?? best2FTHit`).

#### 2. Free Transfers Field Wiring for Unauthenticated Path (CR-02)

**Test:** Without logging in, set "Free transfers" to 2 in the Load Your Squad form, enter a Team ID, and load the squad.
**Expected:** The engine should use ftCount=2 — the 2FT row should show as free (cost:0) and the OCS header should reflect 2 free transfers.
**Why human:** `freeTransfers` state (line 40) is rendered in a UI control labelled "Free transfers" (lines 213-230) with an `onChange` handler (`setFreeTransfers`). However `derivedFtCount` useMemo (lines 87-92) never reads `freeTransfers` — it returns 1 unconditionally for unauthenticated users. This means the visible field is cosmetically interactive but has no effect on transfer calculations. The REVIEW.md documents this as CR-02 with a fix. This affects TFX-05: "when unauthenticated, the user can manually enter their bank balance and it is used for all affordability checks" — the bank is used but the FT count is not, making affordability calculations partially incorrect.

### Gaps Summary

No hard FAILED truths — both uncertain items require human confirmation rather than automated determination. The two critical issues identified in the REVIEW.md (CR-01 and CR-02) are correctness gaps in the implementation that the SUMMARY.md did not acknowledge:

- **CR-01 (-8 Hit absent for ftCount=1):** The -8 Hit row infrastructure is fully built (types, mapper, UI), but the data-flow is broken for the most common user state (1 free transfer). The mapper finds `best2FTCombo` by `cost === 0` but the engine only produces `cost === 4` combos when ftCount=1. The -8 Hit row is silently absent. This directly threatens TFX-03's goal of showing all four scenarios simultaneously.

- **CR-02 (freeTransfers field disconnected):** The "Free transfers" input field in the Load Squad form is displayed and editable but its value never reaches the engine. `derivedFtCount` always returns 1 for unauthenticated users regardless of what the field shows. This affects the accuracy of transfer suggestions and affordability calculations for the unauthenticated path, partially undermining TFX-05.

Both issues were flagged in the code review (`074-REVIEW.md`) as Critical. Human verification is needed to confirm whether these gaps block sign-off or are accepted with a fix plan for the next phase.

---

_Verified: 2026-05-06T20:09:30Z_
_Verifier: Claude (gsd-verifier)_
