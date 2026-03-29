# Feature Research

**Domain:** FPL decision-engine — v1.1 milestone: projected points, minutes risk, buy/hold/sell, captaincy, explainability, FPL login
**Researched:** 2026-03-29
**Confidence:** MEDIUM — methodology well-understood from public FPL tools and open-source papers; exact formula calibration is our own choice

---

## Context: What Is Already Built (v1.0)

The following are complete and not in scope for v1.1 feature research. They are listed here as dependency anchors only.

| Already Built | Relevance to v1.1 |
|---------------|-------------------|
| `merged_players.json` with `xg_per90`, `xa_per90`, `fixtures[]`, `starts`, `minutes`, `form` | Primary inputs to projected-points formula |
| `MergedPlayer` TypeScript type | Must be extended with new fields |
| `computeAllGemScores` → `ScoredPlayer` with `gem_score` | `projected_pts` will replace `gem_score` as primary ranking signal in transfers |
| `computeTransferSuggestions` → `SingleTransfer` with `gem_delta` | Buy/Hold/Sell rule layer sits on top of this existing output |
| `fixtures[]` on each player (next 5 with `difficulty_score`) | Direct input to 3GW/5GW projection aggregation |
| FPL API proxy (`/api/fpl/[...proxy]`) | Auth login handler should follow the same server-side pattern |
| `selected_by_percent` on `MergedPlayer` | Ownership input to captaincy differential split |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that are standard across comparable FPL tools. Missing any of these makes the v1.1 milestone feel unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Projected points — next GW per player | Every major FPL tool (fplreview, FFScout, FPL Form) shows a single-GW projection. Users treat it as their primary buy/sell signal. | MEDIUM | Computed in Python pipeline. Inputs available: `xg_per90`, `xa_per90`, `difficulty_score` (next fixture), `minutes_per90` (proxy for xMins), clean sheet probability (position-based). Multi-component sum — no ML required for a credible v1. |
| Projected points — next 3 GW and 5 GW | "Fixture run" view is standard. Users look ahead before making transfers. 3GW and 5GW are the conventional windows. | LOW (after next-GW formula exists) | Aggregate of per-GW projections. `MergedPlayer.fixtures[]` already holds next 5 entries each with `difficulty_score`. Sum is trivial once per-GW formula is in place. |
| Expected minutes (xMins) per player | fplreview's xMins is the industry reference. A number like "85 xMins" is more useful than vague "nailed" language without a number. | LOW | Derived from `starts` and `minutes` over trailing 5–10 games. `starts / games_played * 90` gives a reliable start-probability-weighted xMins. No new API calls needed — data already in `FPLElement`. |
| Minutes risk badge — 4-tier | Categorical label is universal across FPL tools (fpl.team, Fantasy Football Fix). "Nailed / Likely / Rotation / Cameo" gives the manager an instant read. | LOW | Threshold rule over xMins: Nailed ≥ 80 mins; Likely 60–79; Rotation 30–59; Cameo < 30. One computed field, rendered as a badge in Squad view and Transfer panel. |
| Buy / Hold / Sell label per squad player | Managers expect the tool to give a verdict on each of their own players — not just list replacements. | LOW | Rule-based from existing transfer engine output. SELL when best available replacement has projected-pts delta above threshold AND budget is sufficient; HOLD otherwise. BUY is for unowned candidates only. |
| Replacement shortlist with projected-points delta | "Who to bring in" alongside "who to sell" is expected in any transfer-focused tool. The delta should be in projected points, not an abstract gem score. | MEDIUM | Existing `computeTransferSuggestions` already surfaces replacements. New: add `projected_pts_delta` (projected_pts(buy) − projected_pts(sell) for next GW). Replace `gem_delta` as primary sort signal. |
| Captaincy top-5 for next GW | Every major FPL tool provides a weekly captaincy ranking. Users expect at minimum a short ranked list before the deadline. | LOW (after projected-pts exists) | Sort all players by `projected_pts_next_gw * 2` (captain multiplier). Top 5. Requires projected_pts in pipeline output — no new data. |
| Safe vs differential captain split | Industry-standard framing: "safe" (high ownership, nailed, easy fixture) vs "differential" (low ownership, high ceiling). Explicitly calling this out saves the user a mental step. | LOW | Ownership threshold already in `selected_by_percent`. Rule: safe = ownership > 20% AND xMins tier "Nailed"; differential = ownership < 15% AND projected_pts in top 10. |

### Differentiators (Competitive Advantage)

Features that set this tool apart, aligning with the core value of "clear prioritised view backed by data".

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Projected-pts delta as primary transfer signal | v1.0 uses gem_score delta — an abstract composite. Projected-pts delta is directly meaningful: "this transfer gains you +3.2 points next GW". No other free tool surfaces this from your specific squad. | MEDIUM | Requires `projected_pts_next_gw` in pipeline. Delta = projected(buy) − projected(sell). Replaces `gem_delta` as primary ranking key in `computeTransferSuggestions`. Existing sort structure is unchanged. |
| xMins grounded in FPL API data (not third-party team news) | Commercial tools (fplreview, FFScout) source team news from external feeds. Our xMins derives from the same FPL API data the rest of the app uses. Transparent, consistent, no extra scraping dependency. | LOW | `starts` and `minutes` fields are already in `MergedPlayer`. Trailing window calculation is simple arithmetic. |
| Explainability panel: per-component breakdown | Showing "xG component: +2.1 pts, fixture bonus: +0.8 pts, clean sheet: +0.6 pts, minutes risk: −0.5 pts" is rare in free tools. Builds manager trust in the recommendation and teaches the model's logic. | MEDIUM | Python pipeline must emit `projected_pts_components: { appearance, clean_sheet, attacking, fixture_adj }` alongside the total. UI renders as a collapsible breakdown panel. |
| Risk flags as structured, actionable signals | FPL's `news` field is unstructured text ("Hamstring injury, 50% chance of playing"). Structured flags ("rotation_risk", "regression_risk", "fixture_swing") are higher-signal and filterable. | MEDIUM | Rule-based derivation from existing fields: status field maps to injury/suspension flags; xG vs goals gap → regression_risk; fixture difficulty swing over next 3 GWs → fixture_swing; xMins tier Rotation/Cameo → rotation_risk. No new data needed. |
| "Why this player" reasons list per recommendation | Translates algorithm logic to natural-language bullets: "Strong upcoming fixture (Easy)", "Nailed starter (88 xMins)", "Top-3 captaincy candidate", "Rotation risk — 54 xMins". Rare in free tools, present in premium tools (FPL Assist, Scout AI). | LOW (after all signal components exist) | Template-driven string assembly — deterministic, not LLM-based. One reason string per active signal. Renders as a tooltip or side panel per player row. |
| Projected captain points displayed explicitly | Most tools show base projected pts and let the user mentally double. Showing "projected captain pts: 14.6" removes a cognitive step. Differentiator at zero cost once projected_pts exists. | LOW | Field: `projected_captain_pts = projected_pts_next_gw * 2`. Single addition to captaincy output. |
| FPL login for exact selling price | All free tools use `now_cost` as sell-price proxy. Actual `selling_price` from `/api/my-team` can differ by up to £0.5m for rising players. Exact sell price means exact budget calculation. | MEDIUM | Session-cookie POST to `users.premierleague.com/accounts/login/`. Returns `selling_price` per pick. Server-side only; credentials never persisted; sessions are request-scoped. Existing `/api/fpl/[...proxy]` pattern is the right architectural model. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| ML-based point projection (LSTM, XGBoost) | Sounds more accurate; users see "AI-powered" branding on commercial tools | Training/retraining infrastructure required; model drift mid-season without monitoring; FPL dataset is small (38 GW/season). OpenFPL arXiv paper (2508.09992) shows ensemble ML only *matches* well-calibrated formula tools — it does not beat them on a per-GW basis. Adds opacity with no proven accuracy gain. | Deterministic formula: xG/90 × position_attack_pts + xA/90 × assist_pts + clean_sheet_probability × cs_pts + appearance_pts, scaled by xMins/90. Transparent, reproducible, community-standard accuracy. |
| Projected-points confidence interval / range | "Salah: 7–14 pts" sounds statistically sophisticated | Hard to communicate in UI; managers make the same decision from a point estimate; ceiling adds cognitive load without changing the action. Commercial tools that show ranges (fplreview simulation) require 1,000 simulation runs — overkill for a personal tool. | Show ceiling as a secondary signal only in the captaincy panel (captaincy is the one decision where upside vs safety trade-off matters). Use a single projected_pts value everywhere else. |
| Live in-match projected points | "Update my captain recommendation mid-match" | Data refreshes daily by design (PROJECT.md out-of-scope). Polling the FPL API intra-match risks rate limiting and requires real-time infrastructure. | Show `last_updated` timestamp prominently. Pre-deadline projection covers 100% of the decisions managers need to make. |
| Automated captain pick / lineup submission | "Just tell me who to captain" | FPL terms of service prohibit automated team management via third-party apps. Also, the tool lacks context the manager has (personal risk tolerance, chip plans, double GW strategy). | Top-5 captaincy ranking with safe/differential labels gives the signal; manager makes the call. |
| Persistent FPL session / stored credentials | Convenience — avoid re-entering login each visit | Storing session cookies creates a credential exposure risk. FPL sessions expire regularly regardless. Persistent storage adds a security attack surface this personal tool doesn't need. | Session-scoped login only. Credentials handled server-side per request. Session ends on page reload. Never written to Blob, DB, or localStorage. |
| Multi-step transfer planner (3+ GW chip lookahead) | Elite FPL managers want long-horizon planning | Requires Wildcard/Free Hit/Triple Captain chip logic, double/blank GW detection, and a constraint solver — complexity of its own milestone. v1.0 chip guard warns when chips are active but doesn't plan around them. | Defer to v2. v1.1 focus is actionable single-week signals. |

---

## Feature Dependencies

```
[Pipeline: projected_pts_next_gw + components]
    └──required by──> [Projected Points 3GW/5GW]
    └──required by──> [Projected-pts delta in transfer suggestions]
    └──required by──> [Captaincy top-5]
    └──required by──> [Captaincy: projected captain pts 2x]
    └──required by──> [Explainability: contributor breakdown]

[Pipeline: xMins + start_probability]
    └──required by──> [Minutes risk badge]
    └──feeds into──>  [projected_pts (gates minutes component)]
    └──required by──> [Safe vs differential captain split]
    └──required by──> [Risk flag: rotation_risk]

[Risk flags]
    └──required by──> [Explainability: "Why this player" reasons]
    └──enhances──>    [Buy/Hold/Sell confidence] (SELL more confident when rotation_risk present)

[FPL Login — session cookie]
    └──required by──> [Exact selling_price from my-team]
    └──enhances──>    [Transfer suggestions: accurate budget]
    └──independent of all other v1.1 features]

[Existing: MergedPlayer.fixtures[] with difficulty_score]
    └──already supports──> [Projected Points per-GW fixture weighting]
    └──already supports──> [3GW/5GW aggregation]

[Existing: MergedPlayer.xg_per90, xa_per90]
    └──already supports──> [Projected Points attacking component]

[Existing: MergedPlayer.starts, minutes, minutes_per90]
    └──already supports──> [xMins calculation]

[Existing: computeTransferSuggestions output]
    └──extended by──>     [projected_pts_delta replaces gem_delta as sort key]
    └──drives──>          [Buy/Hold/Sell label derivation]

[Existing: selected_by_percent]
    └──already supports──> [Captaincy differential split]
```

### Dependency Notes

- **Build pipeline first**: `projected_pts_next_gw` gates 80% of v1.1 features. New Python module (`projections.py`) must run inside `pipeline/run.py` before any UI work starts.
- **xMins is an input to projected points**: compute xMins and start_probability in the same pipeline pass as projected_pts (or in a prerequisite step). They share the same trailing-window data.
- **3GW/5GW projection is near-free**: once per-GW formula exists, summing across `fixtures[]` entries is three lines of Python.
- **Auth is fully independent**: AUTH-01/02 can be built at any point without blocking or being blocked by other v1.1 features. Build last — it's a standalone Route Handler.
- **Explainability is a consumer, not a producer**: the panel reads already-computed values (projected_pts components, risk flags, xMins tier). Build after all other pipeline fields are present.
- **Risk flags need no new data**: all inputs (status, xG vs goals gap, fixture difficulty swing, xMins) are already in `MergedPlayer`. Pure derivation logic, can be computed in TypeScript or Python.

---

## MVP Definition

This is a subsequent milestone (v1.1), not a greenfield MVP. All 6 feature groups from PROJECT.md v1.1 requirements are in scope. The question is build order, not whether to include.

### Launch With (v1.1 — all requirements must ship)

- [ ] PROJ-01: Projected points next GW (gates all other features)
- [ ] PROJ-02/03: Projected points 3GW / 5GW (near-zero incremental cost after PROJ-01)
- [ ] MINS-01: xMins + start probability (input to projected pts; surface independently in squad view)
- [ ] MINS-02: Minutes risk badge (trivial derivation from xMins; high-visibility UX signal)
- [ ] REC-01: Buy/Hold/Sell label per squad player (rule layer over existing transfer engine)
- [ ] REC-02: Replacement shortlist with projected-pts delta (upgrade gem_delta signal)
- [ ] CAP-01: Captaincy top-5 (direct sort on projected_pts, already in pipeline by this point)
- [ ] CAP-02: Safe vs differential captain split (rule on top of CAP-01)
- [ ] EXP-01: Explainability panel with reasons (template-driven; all data already computed)
- [ ] EXP-02: Risk flags (rule-based from existing fields)
- [ ] AUTH-01/02: FPL login + exact selling price (isolated; build last)

### Add After Validation (v1.x)

- [ ] Per-GW breakdown in 3GW/5GW view — show fixture-by-fixture table, not just sum. Add if users find the aggregate confusing.
- [ ] Projected captain pts ceiling display — add if captaincy panel gets heavy use and users want upside context.

### Future Consideration (v2+)

- [ ] Multi-transfer planner with chip activation — requires constraint solver; out of scope v1 (PROJECT.md)
- [ ] ML-based projection model — only useful once formula baseline is established and its limitations known

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Projected pts next GW — PROJ-01 | HIGH | MEDIUM | P1 — gates everything |
| xMins / start probability — MINS-01 | HIGH | LOW | P1 — input to PROJ-01 |
| Minutes risk badge — MINS-02 | HIGH | LOW | P1 — high-visibility, near-free |
| Projected pts 3GW/5GW — PROJ-02/03 | HIGH | LOW (after PROJ-01) | P1 |
| Buy/Hold/Sell labels — REC-01 | HIGH | LOW | P1 |
| Replacement shortlist w/ pts delta — REC-02 | HIGH | MEDIUM | P1 |
| Captaincy top-5 — CAP-01 | HIGH | LOW (after PROJ-01) | P1 |
| Safe vs differential split — CAP-02 | MEDIUM | LOW | P1 |
| Risk flags — EXP-02 | MEDIUM | LOW | P2 |
| Explainability panel — EXP-01 | MEDIUM | LOW (after all pipeline fields) | P2 |
| FPL login / exact sell price — AUTH-01/02 | MEDIUM | MEDIUM | P2 |
| Projected captain pts 2x display | LOW | LOW | P3 |

**Priority key:**
- P1: Core decision-engine — v1.1 is not done without these
- P2: Trust and polish — adds meaningfully but launch is viable without
- P3: Cosmetic enhancement — low cost, low urgency

---

## Competitor Feature Analysis

| Feature | fplreview (premium) | Fantasy Football Scout | FPL Form (free) | Our Approach |
|---------|---------------------|----------------------|-----------------|--------------|
| Projected points | xPts with 1,000-simulation distribution; editable xMins | Season projections (editorial + algo hybrid) | Single GW projection, next-GW only | Formula: xG/90 × attack_pts + xA/90 × assist_pts + CS_prob × cs_pts + appearance_pts, scaled by xMins. Transparent, reproducible. |
| xMins model | Detailed probabilistic model; editable per fixture; uses external team news | Not offered | Not offered | Trailing window: `starts_last_n / games_played_last_n × 90`. No external feed dependency. |
| Minutes risk labels | Implicit in xMins value only — no badge | Injury flags from FPL status only | None | 4-tier badge: Nailed / Likely / Rotation / Cameo. Derived from xMins thresholds. Displayed in squad view and transfer panel. |
| Buy/Hold/Sell | Solver output — complex, premium feature | Human editorial picks | None | Rule-based from projected-pts delta and budget check. Built on top of existing transfer engine. |
| Captaincy ranking | Full captaincy planner with EO stats | Weekly editorial "Top 3" with stats overlay | None | Top-5 by projected captain pts (2×), safe/differential split. No editorial layer. |
| Explainability | No — black-box solver output | No | No | Structured reasons list per player. Template-driven from computed signals. Rare in free tools. |
| FPL login / exact sell price | First-class — central to solver accuracy | Not offered | Not offered | Optional, request-scoped, server-side. Returns `selling_price` for exact budget in transfer calculations. |

---

## Implementation Notes: New Fields Required

### Python Pipeline (`projections.py` — new module)

Fields to add to each player record in `merged_players.json`:

| Field | Type | Notes |
|-------|------|-------|
| `projected_pts_next_gw` | `float` | Core formula output |
| `projected_pts_3gw` | `float` | Sum of next 3 per-GW projections using `fixtures[]` |
| `projected_pts_5gw` | `float` | Sum of next 5 per-GW projections |
| `projected_pts_components` | `object` | `{ appearance, clean_sheet, attacking, fixture_adj }` — for explainability |
| `xmins` | `float` | Expected minutes 0–90, trailing window |
| `start_probability` | `float` | 0.0–1.0 |
| `minutes_risk` | `string` | `'nailed' \| 'likely' \| 'rotation' \| 'cameo'` |
| `risk_flags` | `string[]` | e.g. `['rotation_risk', 'regression_risk', 'fixture_swing']` |

### TypeScript Extensions

- Extend `MergedPlayer` in `src/lib/types.ts` with above fields
- Extend `ScoredPlayer` with `projected_pts_next_gw` (for use as transfer sort key)
- New lib: `src/lib/captaincy.ts` — `computeCaptaincyRankings(players, squadIds)`
- New lib: `src/lib/explainability.ts` — `buildReasons(player): string[]`
- Extend `computeTransferSuggestions` to use `projected_pts_delta` alongside/replacing `gem_delta`
- New Route Handler: `/api/fpl-login` — POST handler, session-scoped, server-side only

### Component Extensions

- Squad view: add xMins column + risk badge per player
- Transfer panel: show BUY/HOLD/SELL badge + top reason per squad player
- New component: `CaptaincyPanel` — top-5 with projected captain pts, safe/differential label
- New component: `ExplainabilityPanel` — "Why this player" drawer or tooltip

---

## Sources

- [fplreview xMins documentation](https://docs.fplreview.com/the-model/projections/xmins/) — xMins as probability-weighted average across 1,000 simulations; rotation risk implicit in value (HIGH confidence — official tool docs)
- [OpenFPL open-source forecasting paper (arXiv 2508.09992)](https://arxiv.org/html/2508.09992v1) — position-specific ensembles, feature architecture (player/team/opponent/match-status), categorical availability from FPL API, performance categories (Zeros/Blanks/Tickers/Haulers) (HIGH confidence — peer-reviewed arXiv preprint)
- [Marcus Leadboot — Modelling xPts in FPL v1](https://medium.com/@marcusleadboot/modelling-xpts-in-fpl-gameweek-1-01fd2179eac6) — four-component formula: xMinDisc, xPtDef, xPtNoAdj, fixture adjustment via FPL strength ratings (MEDIUM confidence — community methodology article)
- [Fantasy Football Fix — xFPL explainer](https://support.fantasyfootballfix.com/support/solutions/articles/202000055995-what-is-expected-fpl-points-xfpl-) — xFPL = xG + xA + xCS + appearance/bonus (MEDIUM confidence — commercial tool documentation)
- [FPL Gameweek — Effective Ownership explained](https://www.fplgameweek.com/articles/fpl-effective-ownership/) — EO formula (selected + captained + triple captained / total teams) and differential captaincy strategy (MEDIUM confidence — community article)
- [Oliver Looney — FPL APIs Explained](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) — my-team endpoint structure, cookie authentication pattern (MEDIUM confidence — community guide, 2024)
- [FPL API authentication guide (Bram Vanherle)](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4) — login endpoint, required cookie names (LOW confidence — 2019 article; API may have evolved, but endpoint structure appears stable per 2024 community usage)
- Existing codebase: `src/lib/types.ts`, `src/lib/transfer-engine.ts`, `pipeline/merge.py`, `pipeline/run.py` — authoritative ground truth for available data fields and architecture patterns (HIGH confidence)

---

*Feature research for: FPL Analyst v1.1 Decision Engine*
*Researched: 2026-03-29*
