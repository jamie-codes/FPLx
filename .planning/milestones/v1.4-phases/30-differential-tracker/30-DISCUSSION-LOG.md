# Phase 30: Differential Tracker — Discussion Log

**Date:** 2026-04-28
**Participants:** User + Claude

---

## Areas Discussed

All 3 areas selected for discussion.

---

### Area 1: Threshold Logic

**Q: How to define the xPts threshold?**
Options: Position-relative median / Global median / Fixed cutoffs
**Selected:** Position-relative median
Notes: Avoids systematic bias where all defenders appear below a global median.

**Q: How to define low/high ownership?**
Options: Fixed <5%/<15% / Relative quartiles / Position-relative median
**Selected:** Fixed: <5% = low, >15% = high
Notes: Standard FPL community convention, stable and familiar to managers.

**Q: Where to compute the position median?**
Options: Pipeline / Client-side API route
**Selected:** Pipeline
Notes: Zero client-side math; UI reads pre-classified field like regression_signal.

---

### Area 2: Flag Display

**Q: How should flags appear in the UI?**
Options: Single 'Diff' column / Inline on Owned % column
**Selected:** Single 'Diff' column — DIFF/TRAP/dash

**Q: Should Diff column be sortable?**
Options: Sortable DIFF-first ascending / Not sortable
**Selected:** Sortable: DIFF first ascending
Notes: Matches Signal column convention (BUY=0, null=1, SELL=2) → DIFF=0, neutral=1, TRAP=2.

---

### Area 3: Ownership Data Source

**Q: Should injured/suspended players be eligible for DIFFERENTIAL?**
Options: Exclude unavailable / Include all
**Selected:** Exclude unavailable players
Notes: Asymmetric rule — injury excludes from DIFF only, not TRAP (an injured template player is still a trap).

**Q: Tooltip style?**
Options: Quantitative + actionable / Brief
**Selected:** Quantitative + actionable
Notes: Render actual ownership % in tooltip for transparency.

---

## Claude's Discretion Items

- Badge colors: green DIFF (matches BUY), amber TRAP (matches SELL)
- Column position: after Signal, before Trend
- Field name: `differential_flag: 'diff' | 'trap' | None`
- Ownership prop threading: badge receives `selected_by_percent` via `row.original` to render actual % in tooltip

## Deferred Ideas

None — discussion stayed within phase scope.
