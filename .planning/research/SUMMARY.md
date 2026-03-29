# Project Research Summary

**Project:** FPL Analyst — v1.1 Decision Engine
**Domain:** Personal FPL analytics web app — projected points, minutes risk, recommendations, captaincy, explainability, FPL auth
**Researched:** 2026-03-29
**Confidence:** HIGH

## Executive Summary

FPL Analyst v1.1 is a well-scoped extension to an established personal analytics tool. The v1.0 foundation (Next.js 16 / React 19 / Python pipeline / Vercel Blob) is proven and does not require re-evaluation. The v1.1 work adds a decision engine on top of that foundation: projected points per player, minutes risk classification, buy/hold/sell recommendations, captaincy rankings, an explainability layer, and optional FPL session-cookie login for exact selling prices. All six feature groups are required for milestone completion — none are optional.

The recommended approach is pipeline-first. The Python pipeline must be extended first with two new modules (`projections.py` and `xmins.py`) that emit projected points and expected minutes fields into the existing `merged_players.json`. Every other v1.1 feature is either a direct consumer of those fields (captaincy, explainability, risk badges) or an independent feature that can be built in parallel at the end (FPL auth). The buy/hold/sell recommendation engine belongs in TypeScript (`recommend.ts`) because it is squad-relative and requires runtime user data. The projection formula must use a scenario-weighted model rather than a naive linear minutes multiplier — this is the single most important correctness decision in the milestone.

The primary risks are: (1) the xPts formula using a naive linear xMins multiplier, which is incorrect due to FPL's non-linear scoring cliffs at 60 minutes; (2) rotation risk badges misclassifying injury-returning players as rotation risks because raw historical minutes are indistinguishable from a genuine rotation pattern without `status`/`news` context; (3) the buy/hold/sell classifier conflicting with the existing transfer engine if built independently rather than sharing the same gem_score source of truth; and (4) the FPL login being accidentally added to the automated pipeline cron job, which violates FPL terms of service and risks account bans. All four risks are avoidable with deliberate design at phase start.

---

## Key Findings

### Recommended Stack

The stack requires only two new pip additions: `scikit-learn>=1.8.0` (logistic regression for the xMins start-probability model) and `scipy>=1.15.0` (explicit pin to prevent transitive version drift). No new npm packages are needed — shadcn/ui components (Badge, Collapsible, Tooltip, Card) cover all new UI primitives using Radix UI that is already a transitive dependency. FPL auth requires no new library — the existing `requests.Session()` pattern is the correct implementation; the `fpl` PyPI library is unmaintained (last release August 2023) and must not be used.

**Core technologies:**
- `scikit-learn>=1.8.0` (NEW): xMins logistic regression — calibrated `predict_proba()`, interpretable, ~30 MB pipeline-only dep; version 1.8.0 confirmed on PyPI December 2025
- `scipy>=1.15.0` (NEW): explicit pin for weighted ranking computation — currently an unpinned transitive dep; must be pinned to prevent drift
- `shadcn/ui Collapsible` (add component): per-row explainability panel — independent-expand semantics, correct for comparing multiple players simultaneously
- `requests.Session()` (existing): FPL session-cookie auth — 10-line implementation, no maintenance risk, consistent with existing `fpl_client.py` pattern

**What NOT to add:**
- XGBoost / LightGBM: overkill for ~600-player tabular dataset; logistic regression is the correct model size; adds 200+ MB dep
- `amosbastian/fpl` or `fpl-api`: unmaintained; adds abstraction without benefit
- `tough-cookie` / Node.js cookie jar: unnecessary if auth is delegated to the Python pipeline route

### Expected Features

All 11 feature requirements (PROJ-01/02/03, MINS-01/02, REC-01/02, CAP-01/02, EXP-01/02, AUTH-01/02) must ship in v1.1. There are no optional features in this milestone.

**Must have (table stakes — users of comparable tools expect these):**
- Projected points next GW (PROJ-01) — gates all other features; every major FPL tool shows this
- Projected points 3GW + 5GW (PROJ-02/03) — near-zero cost once PROJ-01 exists; `fixtures[]` already holds next 5 entries
- xMins + 4-tier minutes risk badge (MINS-01/02) — industry-standard signal; Nailed/Likely/Rotation/Cameo tiers from xMins thresholds (75/55/30)
- Buy/Hold/Sell label per squad player (REC-01) — managers expect a verdict on their own players
- Replacement shortlist with projected-pts delta (REC-02) — replaces abstract gem_delta with a directly meaningful points gain
- Captaincy top-5 with safe/differential split (CAP-01/02) — universal weekly feature at zero incremental cost once projected_pts exists

**Should have (differentiators this tool adds that comparable free tools lack):**
- Explainability panel with per-player natural-language reasons (EXP-01) — rare in free tools; builds manager trust
- Structured risk flags (EXP-02) — rotation_risk, regression_risk, fixture_swing, injury_concern — filterable and actionable
- FPL login for exact selling price (AUTH-01/02) — free tools use `now_cost` as proxy; exact price matters for tight budget windows

**Defer to v1.x / v2+:**
- Per-GW fixture breakdown in 3GW/5GW view — add if users find aggregate confusing
- Multi-transfer planner with chip activation — requires constraint solver; out of scope v1
- ML-based projection (LSTM/XGBoost) — only warranted after formula baseline is established

### Architecture Approach

v1.1 follows the established v1.0 pattern (Python pipeline writes to Vercel Blob; Next.js Route Handlers serve JSON; TanStack Query hydrates React) with two new data flows added on top. The first extends `merged_players.json` with projected points and xMins fields computed at pipeline time — the correct location for any computation requiring element-summary history (700 HTTP calls). The second adds a new `/api/my-team` Route Handler for session-scoped FPL auth that never persists credentials or session cookies beyond a single request lifecycle.

**Major components:**
1. `pipeline/projections.py` (NEW) — scenario-weighted xPts for 1/3/5 GW windows; DGW-aware
2. `pipeline/xmins.py` (NEW) — expected minutes and start_prob; injury-aware using `status` + `news`; reuses element-summary cache from defcon.py
3. `pipeline/run.py` (MODIFIED) — shared element-summary cache passed to both defcon.py and xmins.py; prevents doubling 700 HTTP calls
4. `src/lib/recommend.ts` (NEW) — pure TypeScript buy/hold/sell engine consuming `ScoredPlayer[]`; derives from same gem_score source as `transfer-engine.ts`
5. `src/lib/captaincy.ts` (NEW) — pure TypeScript captaincy ranking; DGW-aware; safe/upside split on start_prob + fixture, not ownership
6. `src/app/api/my-team/route.ts` (NEW) — FPL session-cookie login; server-side only; credentials discarded after single request
7. Extended `MergedPlayer` TypeScript type — `proj_pts_1gw | null`, `proj_pts_3gw | null`, `proj_pts_5gw | null`, `xmins | null`, `start_prob | null`, `mins_risk | null`

**Key patterns to follow:**
- Pipeline computes, TypeScript consumes: no projection math in the frontend
- Pure-function decision engines: `recommend.ts` and `captaincy.ts` are `(data) => output` with no side effects — trivially Vitest-testable
- Optional auth enrichment: squad view works without FPL login using approximate bank balance; login enriches but never gates
- Schema-first: all new per-player analytics fields must be in Python pipeline and `MergedPlayer` simultaneously — never analytics logic in a hook or component

### Critical Pitfalls

1. **Non-linear xMins multiplier in xPts formula (Pitfall 14)** — FPL scoring has a 60-minute cliff for clean sheets and appearance points. Model as scenario-weighted EV: `xPts = p_start_full × pts_full + p_start_sub60 × pts_sub60 + p_bench × pts_bench`. Build this correctly from the start — do not prototype with linear and plan to fix.

2. **Injury recovery misclassified as rotation risk (Pitfall 15)** — raw historical minutes cannot distinguish a player returning from injury from a genuine rotation risk. Gate rotation classification on `status == 'a'` with blank `news`; exclude injury-period minutes from the rotation-risk window; show "returning from injury" indicator when recent minutes show a recovery trajectory.

3. **Buy/Hold/Sell conflicts with transfer engine (Pitfall 18)** — if `recommend.ts` and `transfer-engine.ts` are built independently they will produce contradictory signals side-by-side. Recommendations must derive from the same `gem_score` source of truth as `computeTransferSuggestions`. Design the shared signal path before writing any recommendation code.

4. **FPL login in the automated pipeline cron job (Pitfall 20)** — automated logins are known to trigger account flags and bans. Auth must be UI-initiated only (user clicks a button). Never add FPL credentials or session logic to `pipeline/run.py` or any cron-scheduled code.

5. **Projected points normalised to 0–1 instead of absolute FPL points (Pitfall 23)** — the existing `normalise()` function in `gem-score.ts` must not be applied to projected points. Projected point fields must be in actual FPL point values (2–15 range) for captaincy comparison and explainability to be meaningful.

---

## Implications for Roadmap

The feature dependency graph and build-order analysis from ARCHITECTURE.md suggest six phases. The ordering is driven by two hard constraints: (1) `projected_pts_next_gw` gates 80% of v1.1 features and must be in the pipeline before any dependent UI work starts; (2) FPL auth is fully independent of every other feature and has the highest complexity and security surface area — it should be built last on top of a working recommendation engine.

### Phase 1: Pipeline Schema Extension

**Rationale:** `projected_pts_next_gw` is the single dependency that gates captaincy rankings, buy/hold/sell, replacement delta, and the explainability panel. xMins is a required input to the projected points formula itself. Both must land in the pipeline — and in `MergedPlayer` TypeScript types — before any UI work begins. This phase also establishes the correct scenario-weighted formula and injury-aware xMins classification before either can be done incorrectly in subsequent phases.

**Delivers:** Extended `merged_players.json` with `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw`, `xmins`, `start_prob`, `mins_risk` per player. Updated `MergedPlayer` TypeScript interface. Shared element-summary cache in `run.py`.

**Addresses:** PROJ-01, PROJ-02, PROJ-03, MINS-01

**Avoids:** Pitfalls 14 (non-linear xMins), 15 (injury vs rotation conflation), 16 (form_pts_per90 double-counting), 17 (analytics in UI layer), 23 (normalisation to 0–1), 25 (DGW double-fixture handling)

### Phase 2: Minutes Risk UI

**Rationale:** Surface the new pipeline data immediately as a low-complexity UI component. `MinutesBadge` validates that Phase 1 data is correct (correct labels, correct tier thresholds) before it gets used in decision logic. A visible sanity check at low cost.

**Delivers:** `MinutesBadge` component showing Nailed/Likely/Rotation/Cameo in SquadView and GemTable.

**Addresses:** MINS-02

**Avoids:** Pitfall 15 (visual confirmation that injury-aware classification is working before it feeds recommendations)

### Phase 3: Projected Points Columns

**Rationale:** Add `proj_pts_1gw` and `proj_pts_3gw` as sortable columns in GemTable. Validates that projection values are in the correct absolute range (2–15 pts for regular starters) and that DGW players rank correctly. Provides early signal that Phase 1 formula is plausible before it drives recommendation logic.

**Delivers:** Projected points columns in GemTable with correct absolute FPL point values and correct DGW ranking.

**Addresses:** PROJ-01/02/03 surface in UI

**Avoids:** Pitfall 23 (confirms values are absolute, not normalised)

### Phase 4: Buy/Hold/Sell + Captaincy Engines

**Rationale:** Both `recommend.ts` and `captaincy.ts` are pure-function TypeScript engines that consume the Phase 1 pipeline data. They have no dependency on each other and no dependency on FPL auth. Building them before the explainability layer means they are fully functional and Vitest-testable before the UI narrative layer is added.

**Delivers:** `recommend.ts` producing `PlayerRecommendation[]` (BUY/HOLD/SELL per squad player with replacement shortlist). `captaincy.ts` producing top-5 `CaptaincyCandidate[]` with safe/upside labels. `CaptaincyPanel` component.

**Addresses:** REC-01, CAP-01, CAP-02

**Avoids:** Pitfall 18 (recommend.ts derives from gem_score shared with transfer engine), Pitfall 21 (captaincy uses DGW-aware formula), Pitfall 26 (percentile-based thresholds within squad), Pitfall 27 (safe = start_prob + fixture, not ownership percentage)

### Phase 5: Explainability + Risk Flags + Replacement Shortlist

**Rationale:** The explainability panel and risk flags are pure consumers of already-computed fields. They require no new pipeline work — only a text-generation layer (`buildReasons()`) and new UI components. REC-02 (replacement shortlist with `proj_pts_delta`) also belongs here since it requires both Phase 1 data and Phase 4 recommendation engine output.

**Delivers:** `ExplainPanel` component with natural-language reasons per player. Risk flags (rotation_risk, regression_risk, fixture_swing, injury_concern). `RecommendationBadge` in TransferPanel. Replacement shortlist ranked by `proj_pts_delta`.

**Addresses:** EXP-01, EXP-02, REC-02

**Avoids:** Pitfall 22 (reasons are natural-language text from templates, not normalised component scores 0–1)

### Phase 6: FPL Auth + Exact Selling Price

**Rationale:** Auth is fully independent of every other feature and is the most complex phase (network, security, session lifecycle). Building it last means it adds exact sell prices to an already-working recommendation engine. The existing approximate bank balance from the public picks endpoint is sufficient to validate all other phases. Building it last also prevents auth logic leaking into pipeline code.

**Delivers:** `/api/my-team` Route Handler. `useMyTeam` hook. Optional login form in TransferPanel. Exact `selling_price` per player and `entry_history.bank` in budget calculations.

**Addresses:** AUTH-01, AUTH-02

**Avoids:** Pitfall 19 (session expiry handled with explicit re-prompt, not silent failure), Pitfall 20 (auth is UI-initiated only, never in pipeline), Pitfall 24 (both `selling_price` and `entry_history.bank` extracted from single `my-team` call)

### Phase Ordering Rationale

- Phase 1 before everything: `proj_pts_1gw` is the single most depended-upon field in the milestone. 80% of v1.1 features are blocked without it.
- Phases 2 and 3 are validation gates: surface data early as simple read-only UI to catch formula errors before they propagate into recommendation logic.
- Phase 4 before Phase 5: recommendation engine must exist before explainability reasons can be generated from it.
- Phase 6 last: auth is independent, highest-complexity, and its absence does not block any other feature.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Projection formula):** The scenario-weighted xPts formula requires deliberate design of FPL scoring bin weights (1pt for <60 min, 2pt for 60+ min, clean sheet thresholds by position, bonus proxy). Research the Marcus Leadboot v2 methodology and OpenFPL arXiv 2508.09992 before writing `projections.py`. The exact weight values are not prescribed by research — they are design decisions.
- **Phase 6 (FPL auth endpoint):** The `users.premierleague.com/accounts/login/` endpoint is MEDIUM confidence — stable since 2019 but officially undocumented. Manual verification at build time is required. Plan a graceful fallback to public-data-only mode if auth fails.

Phases with standard patterns (skip research-phase):
- **Phase 2 (MinutesBadge):** Pure UI component using documented shadcn/ui Badge primitive. No research needed.
- **Phase 3 (Projected points columns):** Adding TanStack Table columns to existing GemTable follows established v1.0 pattern. No research needed.
- **Phase 4 (Pure TypeScript engines):** `recommend.ts` and `captaincy.ts` are pure functions; contracts fully specified in ARCHITECTURE.md. No research needed.
- **Phase 5 (Explainability panel):** Template-driven string assembly consuming already-computed fields. shadcn/ui Collapsible is well-documented. No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 new pip deps (scikit-learn 1.8.0, scipy 1.15.0); versions confirmed on PyPI Dec 2025; no new npm packages; all rationale verified against official docs |
| Features | MEDIUM | Methodology well-understood from public FPL tools and arXiv paper; exact formula calibration weights are our design choice, not externally prescribed |
| Architecture | HIGH | Derived from direct codebase inspection + verified external sources; all integration points cross-referenced against existing code patterns |
| Pitfalls | HIGH | v1.0 pitfalls verified; v1.1 pitfalls derived from community post-mortems, FPL Review docs, and first-principles analysis of existing codebase |

**Overall confidence:** HIGH

### Gaps to Address

- **xPts formula component weights:** Research identifies the correct structure (scenario-weighted, 4 components) but the exact weights (FDR adjustment magnitude, clean sheet probability model for DEF/GK) are not prescribed. Use community-standard values from Marcus Leadboot v2 as starting point; document assumptions explicitly for post-season review.
- **FPL auth endpoint stability:** MEDIUM confidence. The `users.premierleague.com/accounts/login/` endpoint is undocumented by FPL and has changed paths before. Verify manually at v1.1 build time; build explicit fallback to public-data-only mode.
- **`minutes_per90` field semantics:** This field in `MergedPlayer` is `minutes / starts` — not minutes-per-90-minutes as the name implies. The xMins module must use `total_minutes / total_appearances` for average minutes per match, not the existing `minutes_per90` field directly.
- **DGW detection in fixtures array:** DGW detection requires checking for multiple fixtures with the same `event_id` in `MergedPlayer.fixtures[]`. Verify this field is populated correctly in the current fixtures schema before Phase 1 coding begins.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/types.ts`, `src/lib/transfer-engine.ts`, `pipeline/merge.py`, `pipeline/run.py` — authoritative ground truth for available data fields and architecture patterns
- scikit-learn 1.8.0 — [PyPI](https://pypi.org/project/scikit-learn/) — version and Python 3.11 / pandas 2.x compatibility confirmed
- [scikit-learn install docs](https://scikit-learn.org/stable/install.html) — support matrix verified
- shadcn/ui [Collapsible](https://ui.shadcn.com/docs/components/radix/collapsible) / [Badge](https://ui.shadcn.com/docs/components/radix/badge) — component behaviour confirmed
- scipy v1.17.0 manual — `scipy.stats.weightedtau` confirmed

### Secondary (MEDIUM confidence)
- [OpenFPL arXiv 2508.09992](https://arxiv.org/html/2508.09992v1) — position-specific feature architecture; performance categories; ensemble ML vs formula comparison
- [Marcus Leadboot — Modelling xPts in FPL v2.0](https://medium.com/@marcusleadboot/modelling-xpts-in-fpl-version-2-0-e7d8cd738e75) — four-component xPts formula; xMinDisc, xPtDef, xPtNoAdj, fixture adjustment
- [Fantasy Football Fix xFPL explainer](https://support.fantasyfootballfix.com/support/solutions/articles/202000055995-what-is-expected-fpl-points-xfpl-) — xFPL = xG + xA + xCS + appearance/bonus
- [FPL Review xMins documentation](https://docs.fplreview.com/the-model/projections/xmins/) — probability-weighted average across simulations; rotation risk classification
- [FPL Gameweek — Effective Ownership explained](https://www.fplgameweek.com/articles/fpl-effective-ownership/) — differential captaincy strategy
- [FPL API Endpoints Cheat Sheet (sertalpbilal)](https://cheatography.com/sertalpbilal/cheat-sheets/fpl-api-endpoints/) — my-team endpoint structure
- [FPL API Endpoints Detailed Guide (Frenzel Timothy)](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — `selling_price` and `entry_history.bank` field structure

### Tertiary (LOW confidence — verify at build time)
- [FPL auth guide (Bram Vanherle, 2019)](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4) — login endpoint, cookie names; endpoint stable per 2024 community usage but officially undocumented
- [FPL auth Node.js variant (Eyasu Kibru)](https://medium.com/@eyasukibru13/fantasy-premier-league-api-authentication-guide-using-node-js-ca25e693594e) — Node.js fetch cookie extraction pattern
- [FPL-Expected-Points (daniel-mehta, GitHub)](https://github.com/daniel-mehta/FPL-Expected-Points) — community projected points implementation reference

---

*Research completed: 2026-03-29*
*Ready for roadmap: yes*
