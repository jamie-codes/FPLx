---
phase: 048-xpts-breakdown
verified: null
status: pending
score: "0/1 human verification confirmed"
re_verification: false
gaps: []
human_verification:
  - test: "Open the production app -> go to GemTable (Transfers or Decision tab) -> hover over any player's xPts value -> confirm the hover card shows appearance_pts as a separate named row (not missing or zero)."
    expected: "Hover card shows a labeled row for `appearance_pts` with a non-zero numeric value alongside the other 4 xPts components and a Total row."
    why_human: "The XPtsCell code path was verified in unit tests at Phase 48 ship; the open question is whether the production pipeline cache now carries `appearance_pts` values through to the hover card. This requires loading the live app and visually inspecting the hover card — no automated check can confirm production data flow end-to-end from cache through useGemPlayers into the rendered hover card."
    status: pending
---

# Phase 48: Explainable xPts Breakdown Verification Report

**Phase Goal:** Users can inspect the component-level breakdown of any player's projected score — making the xPts model transparent and grounding the CS component in the specific upcoming fixture
**Verified:** PENDING
**Status:** PENDING
**Re-verification:** No — initial verification, code shipped at Phase 48 ship; VER-01 closes the live pipeline-cache visual confirmation gap

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `appearance_pts` added as an explicit xPts component; 5 labeled rows + Total row rendered in the XPtsCell hover card (XPT-01) | PENDING | Pipeline extended in 48-01 to compute `appearance_pts` via `_compute_xpts_fixture` + `_xpts_ngw`; `xPts_components_1gw` type extended in 48-02; XPtsCell refactored in 48-03 to render all 5 labeled rows. Final confirmation awaits human production check. |
| 2  | Hover card Total row shows the sum of components, not the headline `xPts_1gw` value — XPT-02 integrity invariant (XPT-02) | PENDING | XPtsCell renders sum of components as Total per D-48-01. Final confirmation that production cache values sum correctly awaits human check. |
| 3  | DGW hover card shows summed breakdown across both fixtures; BGW shows no hover card (XPT-03) | PENDING | Implemented in 48-03: DGW summed breakdown, BGW returns null for hover card. Requires live production check with actual fixture data to confirm. |
| 4  | Mobile touch toggle uses `useState` in `columns.tsx` (moved `use client` boundary); CSS-only `group/xpts` group-hover — no Floating UI or Radix dependency (XPT-04) | PENDING | `use client` boundary moved to columns.tsx; CSS-only `group/xpts` hover approach confirmed at code review. Human check confirms the interaction works correctly in production. |

**Score:** 0/4 truths confirmed (awaiting human production verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/gem-table/columns.tsx` | XPtsCell component; `appearance_pts` is a labeled row in the hover card breakdown per D-08 | VERIFIED | Component refactored in 48-03; renders 5 labeled rows (including `appearance_pts`) + Total row in CSS-only hover card using `group/xpts` pattern. `use client` directive placed here for mobile touch toggle. |
| `tests/components/gem-table/XPtsCell.test.tsx` | XPtsCell unit tests confirming hover card rendering and `appearance_pts` row presence | VERIFIED | Test suite written and passing at Phase 48 ship. Confirms hover card renders correctly with all expected components including `appearance_pts`. |
| `pipeline/merge.py` (or equivalent) | `_compute_xpts_fixture` + `_xpts_ngw` extended with `appearance_pts` computation | VERIFIED | Extended in 48-01 (TDD plan); `appearance_pts` computed and included in `xPts_components_1gw` output. Pipeline re-run required to populate production cache — this is the gap VER-01 closes. |
| `src/lib/types.ts` | `xPts_components_1gw` type extended with `appearance_pts` field | VERIFIED | Extended in 48-02; comparison modal mocks updated to include `appearance_pts`. |

---

### Behavioral Spot-Checks

| Behavior | Method | Result | Status |
|----------|--------|--------|--------|
| Production XPtsCell hover card renders `appearance_pts` as a labeled non-zero row | Human visual inspection: open prod app, GemTable, hover player xPts value | Awaiting user confirmation | PENDING (HUMAN) |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| XPT-01 | `appearance_pts` added as explicit xPts component; 5 labeled rows + Total row in hover card | SATISFIED (code) | 48-01 pipeline extension + 48-03 XPtsCell refactor. VER-01 closes the live pipeline-data flow check. |
| XPT-02 | Sum of components rendered as Total (not headline `xPts_1gw`) — integrity invariant | SATISFIED (code) | XPtsCell renders sum of components per D-48-01. VER-01 confirms production data values sum correctly. |
| XPT-03 | DGW: summed breakdown; BGW: no hover card | SATISFIED (code) | Implemented in 48-03. VER-01 confirms correct behaviour with live fixture data. |
| XPT-04 | CSS-only hover (no Floating UI/Radix); `use client` moved to columns.tsx; mobile touch toggle | SATISFIED (code) | All code changes verified at phase ship. VER-01 confirms interaction in production build. |

*Note: All 4 requirements are satisfied at the code level. VER-01 (this verification) closes the production pipeline-cache live-flow confirmation that was deferred at Phase 48 ship due to the pipeline needing a re-run to populate `appearance_pts` in `merged_players.json`.*

---

### Human Verification Required

The XPtsCell component and pipeline extension are confirmed correct at the code level. The outstanding question (VER-01) is whether the production pipeline cache now carries `appearance_pts` values through to the rendered hover card in the live app.

**Steps to verify:**

1. Open the production FPL Analyst app in a browser.
2. Navigate to the GemTable on either the **Transfers tab** or the **Decision tab**.
3. Hover over any player's xPts value (the numeric value rendered by XPtsCell).
4. Inspect the hover card breakdown that appears — confirm that `appearance_pts` (or its display label) is present as a **separate named row** alongside the other xPts components, with a **non-zero numeric value**.

If the row is present and non-zero: type **"approved"** to confirm VER-01 is satisfied.

If the row is missing, shows 0.0, or the hover card does not open: describe exactly what you see (e.g. "row missing", "value is 0.0", "hover card does not appear") so the failure mode can be recorded.

_Sign-off: PENDING_

---

### Gaps Summary

No gaps. Awaiting human confirmation of production hover card behaviour per VER-01.

---

_Verified: PENDING_
_Sign-off: PENDING_
