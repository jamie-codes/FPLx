# Phase 57: Effective Ownership Mode - Discussion Log

**Date:** 2026-05-03
**Areas discussed:** Panel layout, Mode ranking logic, Dangerous to fade, EO% display format

---

## Area 1: Panel layout

**Q: Does the 4-mode toggle replace the existing 2-card layout, or extend it?**
Options: Replace entirely / Keep cards + add list below / Tabs
**Selected:** Replace entirely
**Notes:** Cleaner single source of truth; existing Ceiling + EO-Adjusted cards go away.

**Q: How many candidates in the ranked list?**
Options: Top 5 / Top 3 / All squad captaincy candidates
**Selected:** Top 5

---

## Area 2: Mode ranking logic

**Q: How should Protect Rank mode rank candidates?**
Options: Highest EO% first / xPts × EO weight / You decide
**Selected:** Highest EO% first (sort by `selected_by_percent` descending)

**Q: How should Differential Aggressive rank candidates?**
Options: Lowest EO% with xPts floor / Pure lowest EO% / You decide
**Selected:** Lowest EO% with xPts floor (ascending EO, filtered to xPts_1gw >= median)

**Q: How should Chase Rank mode rank candidates?**
Options: Highest xPts_90th / Lowest EO% AND high xPts
**Selected:** Highest xPts_90th (ceiling) first

Max xPts: plain xPts_1gw descending (default, unambiguous).

---

## Area 3: Dangerous to fade

**Q: Where does the badge appear?**
Options: Inline on candidate row / Separate warning banner above list
**Selected:** Inline on the candidate row (small chip, Protect Rank mode only)

**Q: What shows when unauthenticated?**
Options: Hide badge entirely / Show for all EO > 30% / Login prompt
**Selected:** Hide badge entirely (consistent with TransferPanel auth-gated pattern)

---

## Area 4: EO% display format

**Q: How does EO% appear per candidate row?**
Options: ~X% inline next to name / Separate column / Small badge chip
**Selected:** ~X% inline next to name (tilde signals approximation)

**Q: Where does the tooltip live?**
Options: On the % figure itself / On the mode toggle label / Both
**Selected:** On the % figure itself (title attribute, consistent with existing CaptainPicksPanel TOOLTIPS pattern)

---

## Claude's Discretion

- Toggle UI component (pill/segmented control/tabs) — Claude picks best-fit Tailwind pattern
- Row layout details, mobile stacking — Claude follows squad component conventions
