# Phase 56: FT Engine Fix - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the free-transfer engine so it correctly banks FTs under standard FPL rules (max 2 available) and preserves the banked FT count when Wildcard or Free Hit chips are activated. This is a pre-condition fix — Phase 59 (Manual Planner) and Phase 60 (Transfer Route Tree) both depend on accurate FT state threading.

</domain>

<decisions>
## Implementation Decisions

### FT Banking Cap (FTX-01)

- **D-01:** **Standard FPL rules apply** — max 2 available FTs, bank 1 per GW. REQUIREMENTS.md "capped at 5 total available" is a legacy error; ROADMAP success criteria is authoritative.
- **D-02:** The current `computeNextFTState` banking formula (`banked = Math.min(1, unused)`, `nextAvailable = 1 + banked`) is **already correct** for normal GWs. The FTX-01 bug is NOT in the banking formula — it is in the chip handling and initial FT state (see D-03 to D-06).

### Post-Chip FT State (FTX-02)

- **D-03:** After **Wildcard**, bank must be **preserved** — not reset to 0 (current bug). If the user had `available=2` (bank=1) going into the Wildcard GW, next GW should be `available=2, banked=1`. The fix: Wildcard path in `computeNextFTState` should use the same formula as the Free Hit path (`banked = Math.min(1, currentAvailable - 1)`, `nextAvailable = 1 + banked`).
- **D-04:** After **Free Hit**, bank is **also preserved** (same rule). The current FH formula in `free-transfer-engine.ts` already does this correctly — no change needed for FH.

### Scope of Fix

- **D-05:** `src/lib/free-transfer-engine.ts` — Wildcard path: change `return { available: 1, banked: 0 }` to preserve bank using the FH formula. This is the primary engine fix.
- **D-06:** `src/components/planner/PlannerTab.tsx` `initialFTState` — derive from authenticated state when available, using same logic as `TransferPanel.tsx:87–92` (`event_transfers === 0 ? 2 : 1`). Hardcoded `{ available: 1, banked: 0 }` is a bug when the user has 2 FTs.
- **D-07:** `src/lib/planning-engine.ts` line 203 passes `null` for chip — researcher to determine whether this is intentional (AI plan never auto-selects chips) or whether it needs fixing. If the AI-generated plan never uses chips, null may be correct there; the real chip handling flows through PlannerTab's manual edit path (`handleChipEdit`).

### Regression Testing

- **D-08:** Existing v1.3 planner transfer sequences must be regression-tested to confirm correct FT counts across multi-GW plans (ROADMAP success criteria 3). Tests must cover: rolling 1 FT → 2 available next GW; rolling 2 GWs → still 2 (cap respected); Wildcard mid-plan preserving bank; FH mid-plan preserving bank.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### FT Engine (primary)
- `src/lib/free-transfer-engine.ts` — Current engine: `computeNextFTState`, `computeHitCost`, `snapshotSquad`. Wildcard path (lines 8–11) is the primary bug site.
- `src/lib/planning-engine.ts` — Calls `computeNextFTState` at line 203 with `null` chip; researcher to assess whether this needs fixing.
- `src/components/planner/PlannerTab.tsx` — `initialFTState` hardcoded at line 55; `handleChipEdit` calls `computeNextFTState` for manual chip steps.

### FT State Types
- `src/lib/types.ts` — `FTState` interface (lines 412–415): `available: number`, `banked: number`. `GWStep.freeTransfersAvailable`. `PlannerChip` union.

### TransferPanel FT Derivation (pattern to replicate)
- `src/components/transfers/TransferPanel.tsx:87–92` — `derivedFtCount` logic: `event_transfers === 0 ? 2 : 1` when authenticated; chip-aware (WC/FH → 1). PlannerTab's initial FT state should mirror this pattern.

### Requirements
- `.planning/REQUIREMENTS.md` lines 14–15 — FTX-01 and FTX-02 definitions. **Note:** "capped at 5 total available" in FTX-01 is a documentation error — D-01 is authoritative.
- `.planning/ROADMAP.md` §Phase 56 — Success criteria 1–3 are the acceptance gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/free-transfer-engine.ts` Free Hit path (`chip === 'freehit'`) — already implements the correct bank-preservation formula. Wildcard fix should copy this pattern exactly.
- `src/components/transfers/TransferPanel.tsx:87–92` `derivedFtCount` — authenticated FT count derivation to replicate in PlannerTab initialFTState.

### Established Patterns
- FT state is threaded as `FTState { available, banked }` through `generatePlan` → `computeNextFTState` per step. No global state — purely functional threading.
- `PlannerChip` is the chip union type. `computeNextFTState` already branches on it — the Wildcard branch just has the wrong return value.
- `ftStateAfterStepIndex` in `planning-engine.ts` re-derives FT state for manual edits — any fix to the engine propagates through this helper automatically.

### Integration Points
- `PlannerTab.tsx` is the only consumer of `initialFTState` in the planner; `TransferPanel.tsx` uses `derivedFtCount` separately (OCS table only, not the multi-GW planner).
- The fix does NOT touch `TransferPanel.tsx` — its `derivedFtCount` for the OCS table is already correct.

</code_context>

<specifics>
## Specific Ideas

- Wildcard fix should be a one-liner: copy the Free Hit formula (`banked = Math.min(1, currentAvailable - 1)`, `nextAvailable = 1 + banked`) — keeps both chip paths consistent.
- PlannerTab `initialFTState` should be a `useMemo` (not a const) so it reactively updates when `myTeamData` loads.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 56-FT Engine Fix*
*Context gathered: 2026-05-03*
