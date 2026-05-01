# Discussion Log — Phase 41: Accuracy UI & Model Rationalisation

**Date:** 2026-04-30
**Areas discussed:** Accuracy tab location, Model rationalisation, GemTable actuals column, Accuracy UI layout

---

## Area 1: Accuracy Tab Location

**Q: Where should the accuracy views live?**
Options: New 'Accuracy' sub-tab / Inside Insights tab / You decide
→ **New 'Accuracy' sub-tab** in Analyse section

**Q: Label and mobile label?**
Options: Accuracy / Acc / Backtest / Test / Model / Model
→ **Accuracy / Acc**

---

## Area 2: Model Rationalisation

**Q: Is the model winner already decided?**
Options: Decided: xPts wins / Decided: proj_pts wins / See the data first
→ **See the data first** — decision gate is a human checkpoint at execution time

**Q: What does 'removal' mean?**
Options: Remove column + pipeline code / Hide column, keep pipeline code / You decide
→ **Remove column + pipeline code** — full cut, no dead code

**Q: Human checkpoint before removal?**
Options: Yes — checkpoint before removal / No — automate the decision
→ **Yes** — executor shows hit rates, user confirms, then deletion proceeds

---

## Area 3: GemTable Actuals Column

**Q: Where does the actuals column sit, and in which presets?**
Options: Next to xPts, Default + Analysis / Analysis preset only / Replace proj_pts column
→ **Next to xPts, visible in Default and Analysis presets** (not Compact)

**Q: How should the column header communicate the GW?**
Options: Dynamic 'GW32 Pts' / Static 'Last GW Pts' / You decide
→ **Dynamic 'GW{N} Pts'** — GW number from accuracy_backtest.json gws_covered[0]

---

## Area 4: Accuracy UI Layout

**Q: How are the three accuracy views arranged?**
Options: Single scrollable page / Three sub-tabs / Two sections
→ **Single scrollable page** — GW table → haulter list → player delta table

**Q: Player delta table default sort and columns?**
Options: Sort xPts delta desc, both models / Sort absolute delta, winner only / You decide
→ **Sort by xPts delta ascending (worst misses first), show both models side-by-side**

---

## Claude's Discretion Items

- Section ordering within Accuracy tab (GW summary → haulters → player deltas)
- Loading/empty state when accuracy_backtest.json not available
- Pagination vs full-list for player delta table
- API route structure (/api/accuracy vs extending existing route)
