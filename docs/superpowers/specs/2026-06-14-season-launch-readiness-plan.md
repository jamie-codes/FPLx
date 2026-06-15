# FPLx 2026/27 Season-Launch Readiness Plan

**Date:** 2026-06-14
**Purpose:** Be fully ready the moment the 2026/27 FPL bootstrap drops (~early–mid July). Maximise expected rank across the season — top of mini-leagues, realistically chase the global top tier.
**Status:** Planning. Tagged **[NOW]** (buildable today vs the 2025/26 archive), **[LAUNCH]** (do the day the new bootstrap appears), **[GATED]** (unlocks as in-season data accrues).

---

## 0. How rank is actually won (the lens for every decision)

No tool guarantees rank #1 — that needs variance to break your way. What a tool *can* do is maximise expected rank by making consistently +EV decisions and judging when to take variance. The levers, by impact:

1. **Captaincy** — the single biggest weekly swing (you double one player). Variance matters; VAR-01 already moved this to ceiling-ranking. *Keep sharpest.*
2. **Not wasting transfers / hits** — most rank is lost to −4s for +0.3 xPts and panic moves. The Optimiser/OCS + roll-vs-use logic governs this.
3. **Chip timing** — Wildcard/Free Hit/Bench Boost/Triple Captain on the right DGW/BGW are worth tens of points.
4. **Differentials that are *good*, not just different** — EO-01 validated: own<10% + above-p75 xPts. Rank is gained on low-owned haulers, protected by template awareness.
5. **Cold-start GW1–6** — where the table is set; see §2. The biggest *fixable* edge at launch.

FPLx already covers 1–4. This plan keeps them sharp from GW1 and closes the gaps (§2–3) that win the margins.

---

## 1. [LAUNCH] Season-transition mechanics — the day the 2026/27 bootstrap drops

A verification checklist + small fixes so the pipeline flips cleanly from off-season to live. **Build the verification harness NOW (§6.4); run it on launch day.**

- **Understat season bump**: `understat_client._current_season_year` returns the new year once `month >= 8` → the `getPlayersStats` POST uses `season=2026`. Verify the endpoint serves 2026/27 (early season = thin xG; expect small samples). *[LAUNCH verify]*
- **Promoted / relegated teams**: 3 clubs change. Audit for any 2025/26 team assumptions: TFR-01's `WIKI_CLUB_TO_FPL` alias table (add the promoted clubs' divergent names), `TeamBadge` short_name→CDN mapping + `team-colours.ts` (new clubs need entries/fallbacks), and confirm nothing hardcodes the old 20. The exact-match team lookup rebuilds from `bootstrap['teams']` dynamically, so most is automatic — the gaps are alias/colour tables. *[LAUNCH]*
- **SA-02 archive roll**: `season_label(bootstrap)` derives `season_2026_27`; the snapshot writes to the new dir; the `archive_season` GW38 capture of 2025/26 is already committed. Verify the first 2026/27 snapshot lands. *[LAUNCH verify]*
- **Off-season gate flip**: `IS_OFF_SEASON` (no `is_current` event) → false once GW1 is set; the GW-gated pipeline block activates. Verify the transition run doesn't error on the boundary (some artefacts go from absent→present). *[LAUNCH verify]*
- **Confirmed transfers (TFR-01)**: already live and scraping the summer-2026 window; keep flowing through to deadline. The winter-window URL switch is date-derived and already handled.
- **Deliverable**: a one-command **season-transition smoke** (§6.4) that runs the full pipeline against the new bootstrap and asserts every artefact writes + no team resolves to "unknown".

---

## 2. [NOW] The cold-start problem & the Pre-Season Prior model — the headline launch build

**The problem:** at GW1 there is *zero* current-season data. Our xPts model leans on Understat season xG/xA + FPL per-GW history — all empty. The USR-01 fallback (FPL `expected_goals_per_90`) is also season-to-date = 0 at GW1. xMins has no current-season starts. So the model is weakest exactly when the table is set and rank is cheapest to gain. **This is the highest-value thing we can build, and it needs no new-season data — we have the 2025/26 archive as the prior.**

**The solution — a prior-blend cold-start model:**
- Seed each returning player's GW1 expectation from their **2025/26 archived** xG/xA per-90, minutes/start rate, and role (penalties, set-pieces) — the strongest available prior.
- **Blend prior → current** as the season accrues: weight = mostly-prior at GW1, crossing to mostly-current by ~GW6–8 (a tunable decay, e.g. `w_current = min(1, current_minutes / K)`). This is the same shrinkage idea the bonus model already uses.
- **New entrants** (promoted-club players, summer signings with no PL history): proxy from their **previous league's Understat** (the repaired endpoint can fetch other leagues) where available, else position + price priors (price encodes FPL's own expectation).
- **xMins cold-start**: pre-season friendly minutes + last-season starts as the GW1 start-probability prior; tighten as real minutes arrive.
- **Surface**: enhance the existing `NextSeasonPlannerTab` / pre-season squad builder with these prior-based projections so you walk into GW1 with a ranked, reasoned squad.

**Validation [NOW]:** hold out the 2025/26 season's early GWs and test "prior-from-2024/25-equivalent → predict GW1–6" — but we only have one archived season, so the clean test is: does the prior-blend beat a naive "everyone = position average" cold-start on the 2025/26 early GWs reconstructed in BT-02? Run it in the lab; promote the blend that wins. Honest caveat: cold-start is inherently low-data; the win is *relative* (beat the naive baseline), not a calibrated forecast.

**Why now:** entirely archive-buildable; turns GW1 from a guess into a reasoned edge. **Top priority of §6.**

---

## 3. Deferred model items — sequenced by when their data unlocks

| Item | Gate | Plan |
|---|---|---|
| **ODDS-01** bookmaker odds (CS / fixture difficulty) | **[NOW]** to validate | Build the odds ingest + a `(team,gw)→CS-prob/goal-exp` lookup; lab-validate against the 2025/26 archive (does odds-derived difficulty beat the rolling-xG proxy?). Promote only on a win. Live value from GW1 — odds exist pre-season. The one new data source with a real thesis. |
| **EUR-01** European-rotation xmins | **[NOW]** validate / **[LAUNCH+]** live | Populate the 2025/26 European calendar (historical, freely available) → lab-validate the `euro_rotation_factor` sweep. If it clears, the live calendar for 2026/27 gets populated once UCL/UEL/UECL draws are known (~late Aug). Low prior — may land rejected; cheap to test. |
| **#3 npxG / penalty split** | **[GATED ~mid-season]** | The repaired Understat endpoint now carries real npxG; SA-02 snapshots it weekly. Once enough per-GW npxG history accrues (~GW10+), the split becomes backtestable. Then test: does deflating pen-takers' open-play xG + a separate penalty-EV term beat the current penalty-inclusive xG? |
| **ML shadow model** (OpenFPL-style) | **[GATED]** ≥2 seasons | 2026/27 + the 2025/26 archive = the first 2-season point. Build the feature/training harness as groundwork [NOW-ish]; run position-specific XGBoost/RF alongside the formula model with a `model_disagreement` flag; promote `ml_xpts`/`ensemble_xpts` **only** if it beats the formula on the leakage-free backtest (top-N hit, haul capture, captaincy, RMSE, rank corr). Highest accuracy ceiling; wants 3+ seasons to really sing. |

---

## 4. [GATED] In-season activation timeline (the machinery comes alive on a schedule)

- **GW1 deadline (~mid-Aug)**: cold-start picks (§2) live; confirmed-transfers, lineup-news scraper, push alerts, the Home command centre, Weekly Picks + pick explanations (PICK-02) all active on real data. *First real test.*
- **GW8**: `honest_metrics` ≥8-GW gate opens → the Forward Skill panel + ACC-06 calibration switch from the 2025/26 baseline to live 2026/27 numbers.
- **GW13**: `MIN_FINISHED_GWS` → the honest tuner activates; first in-season parameter promotion on 2026/27 data (re-tunes blend_alpha, slopes, etc. on the actual season).
- **Throughout**: SA-02 snapshots accrue (building season 2 of the dataset); DGW/BGW detection drives chip timing once the 2026/27 fixture quirks are known.

---

## 5. [GATED] Continuous sharpening — the "be #1" agenda

- **Re-tune on 2026/27**: once GW13+, the honest tuner promotes params fit to the live season; re-check the promoted defaults (blend 0.2 / window 4 / FAS 0.4) hold.
- **Re-validate the rejected table on 2 seasons**: CSF/ATF slopes, ownership-in-gem-score, ceiling ranking — some negatives may flip with double the data. The rejected-ideas table is "don't re-litigate *without new evidence*"; a second season **is** new evidence.
- **Captaincy is the rank engine**: VAR-01 (ceiling) is live; once MC runs in-season, test the MC-`haul_prob` captaincy variant against ceiling (couldn't reach it in the lab; live MC makes it testable).
- **DGW/BGW chip optimisation** for the real 2026/27 calendar (Bench Boost on the biggest DGW, Triple Captain on a nailed double, etc.).

---

## 6. [NOW] Build-now priority list — make launch turnkey (next ~4 weeks)

Ordered by value × readiness. All buildable today against the 2025/26 archive, no new-season data needed:

1. ✅ **Cold-start Pre-Season Prior model (§2)** — SHIPPED 2026-06-14 (COLD-01, exp08 SEED=270). The headline. Turns GW1 from a guess into an edge.
2. ✅ **ODDS-01 odds experiment (§3)** — LAB-VALIDATED 2026-06-14 (exp09 SHIP_BOTH); live-wiring follow-up spec'd 2026-06-15 (shadow-first), build at launch.
3. ❌ **EUR-01 (§3)** — TESTED & REJECTED 2026-06-15 (exp10 NO_SHIP; congestion signal is noise, permutation p=0.04). Added a permutation robustness gate to the lab.
4. ✅ **Season-transition verification harness (§1)** — BUILT 2026-06-15 (STH-01, `pipeline/season_transition_smoke.py`). `python -m season_transition_smoke` proves the off-season→2026/27 flip is clean + prints the alias/asset-table patch checklist. Finding: `SUN` missing from `TEAM_BADGE_CODE`.
5. **ML groundwork (§3)** — stand up the feature-extraction + training/eval harness against the archive so it's ready to validate the moment season 2 accrues. **← the remaining build-now item.**

**Sequencing recommendation:** #1 first (highest value, self-contained), then #2 (real model upside), then #4 (cheap insurance) before July, then #3, with #5 as ongoing groundwork. Each follows the proven discipline: spec → plan → subagent build → review → lab-validate-before-promote.

---

## Honest framing on "#1 in the world"

Top of your mini-leagues is a realistic target a sharp tool + disciplined play makes very achievable. Global #1 out of ~11M is mostly variance on top of a strong process — no tool can promise it. What this plan does is make FPLx maximise *expected* rank: best-available projections (incl. the cold-start edge most managers lack), captaincy tuned for upside, transfers that don't bleed value, chips timed well, and differentials that are genuinely good. Do that every week and a top-10k finish is a credible aim; #1 is then luck breaking your way on a great process — which is the most any tool can honestly offer.
