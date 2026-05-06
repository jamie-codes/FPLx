---
phase: "074"
plan: "04"
subsystem: transfer-engine
tags: [ui, react, bank-balance, ocs-table, wave-3]
dependency_graph:
  requires:
    - "074-01 — TransferSuggestion combo cost: 0|4|8 type extension"
    - "074-02 — always-emit combos and breakEven widen"
    - "074-03 — computeOpportunityCostRows(suggestions, ftCount, bank) 3-arg signature + OCSRow bankAfter/isAffordable/disabledReason"
  provides:
    - "TransferPanel manualBank state + Bank balance input (TFX-05)"
    - "TransferPanel wired to derivedFtCount directly (D-08)"
    - "FtToggle removed from OCS header (D-03); GwToggle retained (D-04)"
    - "Legacy Suggested Transfers section removed (D-02)"
    - "OpportunityCostTable disabled row treatment: opacity-50, aria-disabled, strikethrough, disabledReason label (TFX-04)"
    - "OpportunityCostTable bank sub-line in xPts cell for all non-Roll rows (TFX-04)"
    - "OpportunityCostTable cost > 0 hit label (covers -4pt and -8pt)"
  affects:
    - "src/components/transfers/TransferPanel.tsx — all OCS interactions"
    - "src/components/transfers/OpportunityCostTable.tsx — row rendering"
tech_stack:
  added: []
  patterns:
    - "manualBank useEffect deps: [isAuthenticated, myTeamData] only (Pitfall 5 — no manualBank in deps)"
    - "Math.round(manualBank * 10) conversion — stores float £m, passes tenths to engine"
    - "isDisabled = !row.isAffordable — drives aria-disabled + opacity-50 + strikethrough"
    - "row.cost > 0 pattern — generalised hit-label covering cost:4 and cost:8"
key_files:
  modified:
    - path: src/components/transfers/TransferPanel.tsx
      change: "manualBank state + Bank balance input; derivedFtCount wiring; FtToggle removed; Suggested Transfers section removed; MinsRiskBadge/FragilityNote/computeFragility imports removed"
    - path: src/components/transfers/OpportunityCostTable.tsx
      change: "Disabled row treatment (opacity-50, aria-disabled, strikethrough, disabledReason); bank sub-line in xPts cell; cost===4 → cost>0 hit label"
decisions:
  - "Cleaned comment text to not contain legacy symbol names — ensures grep-based acceptance criteria return 0 for removed symbols"
  - "combo-hit-8 BADGE_BY_KIND entry was already added in Plan 03 Rule 1 fix — no change needed in Task 04-02"
  - "MinsRiskBadge, computeFragility, FragilityNote imports removed as they were only used in the Suggested Transfers section (Rule 1 — unused imports)"
metrics:
  duration: "12 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_changed: 2
---

# Phase 074 Plan 04: Wave 3 — UI Rewiring and OCS Table Updates Summary

Wave 3 UI work: rewired TransferPanel with `manualBank` state and Bank balance input field; removed FtToggle from OCS header and the entire legacy Suggested Transfers section; updated OpportunityCostTable with disabled-row treatment (opacity-50, strikethrough, reason label) and bank sub-line in every non-Roll row.

## Tasks Completed

### Task 04-01: Update TransferPanel — manualBank state, FtToggle removal, Suggested Transfers removal, engine wiring

**Commit:** 4fc6cf8

**Changes in `src/components/transfers/TransferPanel.tsx`:**

- **manualBank state added:** `const [manualBank, setManualBank] = useState<number>(0)` — stores raw £m float
- **useEffect prefill from FPL:** guards on `isAuthenticated && myTeamData`, sets `setManualBank(myTeamData.entry_history.bank / 10)`, deps: `[isAuthenticated, myTeamData]` only (Pitfall 5 — manualBank excluded to prevent loop on user edits)
- **Bank balance input added** as 3rd field in Load Squad form: `type="number"` with `step={0.1}`, `min={0}`, `max={20}`, `£m` suffix, tooltip on `?` span, `From your FPL account — override if needed.` annotation when authenticated
- **ocsFtCount state and useEffect removed** (lines ~45, 104-106): engine now receives `derivedFtCount` directly
- **ocsSuggestions useMemo updated:** `ftCount: derivedFtCount`, `bank: Math.round(manualBank * 10)`, deps updated to include `manualBank`
- **ocsRows useMemo updated:** passes `derivedFtCount` and `Math.round(manualBank * 10)` as 2nd and 3rd args
- **transferResult useMemo removed** entirely (lines ~60-69)
- **computeTransferSuggestions import removed** (along with ChipState, SingleTransfer types)
- **FtToggle import removed** from line 27 (FtToggle.tsx file preserved — OptimiserPanel still uses it at line 543)
- **FtToggle JSX render removed** from OCS section header (GwToggle retained)
- **Chip warning JSX blocks removed** (CHIP_WARNING freehit and wildcard blocks that referenced transferResult)
- **Save recommendation block removed** (transferResult?.type === 'SAVE' block)
- **Suggested Transfers JSX section removed** entirely — all ~130 lines referencing transferResult.suggestions and transferResult.two_transfer_combo
- **MinsRiskBadge, computeFragility, FragilityNote imports removed** — only used in the removed section

**Net diff:** 201 lines removed, 49 lines added (−152 net — file shrunk significantly).

**Acceptance criteria verified:**
- `grep -c "manualBank"` → 7 (>=6 required)
- `grep -c "ocsFtCount"` → 0
- `grep -c "FtToggle"` → 0
- `grep -c "computeTransferSuggestions"` → 0
- `grep -c "transferResult"` → 0
- `grep -c "Math.round(manualBank * 10)"` → 2
- `grep "myTeamData.entry_history.bank / 10"` → found
- `grep 'id="bankBalance"'` → found
- `grep "From your FPL account"` → found
- `grep -c "FtToggle" src/components/optimiser/FtToggle.tsx` → 1 (file exists)
- `grep -c "FtToggle" src/components/optimiser/OptimiserPanel.tsx` → 2

### Task 04-02: Update OpportunityCostTable — disabled row treatment, bank sub-line, cost > 0 hit label

**Commit:** 90b68f0

**Changes in `src/components/transfers/OpportunityCostTable.tsx`:**

1. **Disabled row treatment** — `const isDisabled = !row.isAffordable` drives:
   - `aria-disabled={isDisabled || undefined}` on `<tr>`
   - `opacity-50` appended to `<tr>` className when disabled
   - `line-through text-zinc-400 dark:text-zinc-600` wrapping `formatXPts(row)` when disabled

2. **cost > 0 hit label** — replaced `{row.cost === 4 && ...}` with `{row.cost > 0 && <div>−{row.cost}pt hit</div>}` — renders "−4pt hit" for cost:4 and "−8pt hit" for cost:8 automatically

3. **Bank sub-line** — added for all `row.kind !== 'roll'` rows: `Bank: £X.Xm` (positive) or `Bank: −£X.Xm` (negative when bankAfter < 0)

4. **disabledReason label** — `{row.disabledReason && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{row.disabledReason}</div>}` in Label column

5. **combo-hit-8 BADGE_BY_KIND entry** — already present from Plan 03 Rule 1 fix; no additional change needed

**Net diff:** 18 lines added, 4 lines removed (+14 net).

**Acceptance criteria verified:**
- `grep -c "'combo-hit-8'"` → 1
- `grep "two simultaneous hits"` → found
- `grep -c "aria-disabled"` → 1
- `grep -c "opacity-50"` → 1
- `grep -c "row.disabledReason"` → 2
- `grep -c "row.bankAfter"` → 3
- `grep -c "row.isAffordable"` → 1
- `grep "data-testid={\`ocs-row-\${row.kind}\`}"` → found
- `grep "row.cost > 0"` → found

## Checkpoint Status

Task 04-03 is a `checkpoint:human-verify (blocking)` — stopped and returned to orchestrator for human verification. The two automated tasks are committed and verified (tsc clean, no new test failures).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports after Suggested Transfers section deletion**
- **Found during:** Task 04-01 (post-edit tsc/lint check)
- **Issue:** MinsRiskBadge, computeFragility, FragilityNote were only used in the Suggested Transfers section; removing that section left them as unused imports
- **Fix:** Removed all three import lines
- **Files modified:** src/components/transfers/TransferPanel.tsx
- **Commit:** 4fc6cf8

**2. [No action required] combo-hit-8 BADGE_BY_KIND already present**
- **Found during:** Task 04-02 (reading OpportunityCostTable.tsx)
- **Issue:** Plan 03 Rule 1 fix had already added the combo-hit-8 entry to satisfy Record<OCSRowKind, BadgeConfig> exhaustiveness
- **Action:** No change needed; noted only

## Threat Flags

T-074-06 (manualBank input — tampering): mitigated as specified. `min={0}` on input and `Math.max(0, Number(e.target.value))` in onChange clamp prevents negative banks.

## Known Stubs

None — all functionality is fully wired. The bank balance input pre-fills from FPL data when authenticated; the OCS table renders with real bankAfter/isAffordable values from the mapper.

## Self-Check: PASSED

- FOUND: src/components/transfers/TransferPanel.tsx
- FOUND: src/components/transfers/OpportunityCostTable.tsx
- FOUND: src/components/optimiser/FtToggle.tsx (preserved — not deleted)
- FOUND: commit 4fc6cf8 (feat(074-04): rewire TransferPanel)
- FOUND: commit 90b68f0 (feat(074-04): update OpportunityCostTable)
- FOUND: .planning/phases/074-transfer-engine-overhaul/074-04-SUMMARY.md
