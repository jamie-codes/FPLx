# Phase 52: xMins Confidence Engine — Discussion Log

**Date:** 2026-05-02
**Participants:** Jamie + Claude

---

## Area: CS formula change

| Question | Options | Selection |
|----------|---------|-----------|
| Replace mins_factor or add field only? | Replace it / Add field only / You decide | Replace it |
| Gate trigger condition? | xPts hit-rate non-regression / mins_60 MSE metric / Manual inspection | xPts hit-rate non-regression (≥16.7%) |
| Full replace or blend? | Full replacement / max(xmins/60, mins_60_prob) / You decide | Full replacement |
| mins_60_prob written when flag OFF? | Always write, gate formula / Skip computation / You decide | You decide → Claude: always write field, only gate formula |

---

## Area: start_prob sharpening

| Question | Options | Selection |
|----------|---------|-----------|
| Scope of sharpening? | Edge-case only / Per-club rotation priors / Both | Edge-case only |
| Which edge-case fixes? | (multi-select) | All four: new signings fallback, BGW guard, starts field consistency, mins_60_prob window alignment |
| Position-prior values for < 3 starts? | Existing mins_risk thresholds / FPL chance_of_playing / You decide | Existing mins_risk thresholds (GK=0.90, DEF=0.75, MID=0.65, FWD=0.60) |

---

## Area: sub_risk_label scope

| Question | Options | Selection |
|----------|---------|-----------|
| Include sub_risk_label in Phase 52? | Skip it (mins_risk stays) / Add as additive field | Add as additive field |
| Threshold boundaries? | Probability-derived / Match existing thresholds renamed / You decide | Probability-derived (nailed ≥0.90∧0.80; sub_risk ≥0.65; cameo <0.25; injured; else rotation_risk) |

---

## Area: UI surface

| Question | Options | Selection |
|----------|---------|-----------|
| Pipeline only or UI change? | Pipeline only / Tooltip on MinsRiskBadge | Tooltip on MinsRiskBadge |
| Which use sites? | All existing / TransferPanel only | All existing (TransferPanel, CaptaincyPanel, XPtsCell hover) |

---

## Deferred Ideas
- Per-club rotation priors (Pep/Slot/Arteta) — too large for Phase 52 edge-case scope
- Decision Summary rotation card — UI deferred
- `mins_risk` consumer migration to `sub_risk_label` — v1.9
