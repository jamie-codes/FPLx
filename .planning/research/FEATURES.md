# Feature Landscape - v1.21 Polish, Intelligence & Team News

**Domain:** Sports analytics decision-support tool - FPL news integration, LLM prose synthesis, model versioning
**Researched:** 2026-05-16
**Confidence:** HIGH (full codebase inspection of existing implementations)

---

## Existing Implementation Baseline

Before classifying features, what each item actually is given what is already in the codebase:

**SCRAPER-01**: The data pipeline is complete. `news` and `chance_of_playing_next_round` are in `MergedPlayer` and `FPLElement`. `computeNewsSeverity()` classifier is complete (`newsSeverity.ts`). `NewsBanner` component is complete and gated by `useNewsFlagEnabled`. The v1.21 work is **wiring NewsBanner into transfer suggestions and captain picks** — two specific surfaces where it is currently absent.

**NLP-01**: The pipeline prose generation (`prose_summary.py`) and all UI plumbing (`ProseSummaryBlock`, `useProseSummary`, `useProseRefresh`, `POST /api/prose-summary`) are complete. The pipeline currently generates from `captains + gems` only (top-3 by xPts, top-3 differentials). The v1.21 work is **extending the pipeline summary to incorporate transfer and chip context** — bridging the pipeline-generated path and the on-demand squad-aware path, which already accepts transfer/chip/risk data via the POST handler.

**VER-01**: The version tracking pipeline (`FORMULA_VERSION`, `versions[]` array in `accuracy_backtest.json`), the TypeScript type (`VersionRecord`), and the `VersionHistoryTable` component are all complete. The v1.21 work is **adding captain pick quality (captain hit rate by version) to the version record** so comparisons across formula changes include decision quality, not just haul detection.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| News shown on transfer candidates | Any FPL tool showing transfers without injury status is incomplete — the first question when targeting a player is "is he fit?" | LOW | `NewsBanner` component and all data fields already exist; this is a wiring task into `TransferPanel` buy-candidate rows |
| News shown on captain candidates | FPL managers rely on last-minute team news before the deadline; the captain pick surface is the highest-stakes decision | LOW | Same `NewsBanner` wiring task into `CaptainPicksPanel` candidate rows |
| AI summary reads from pre-generated cache | Users expect the AI summary to be available immediately when they open the app, not requiring a manual refresh | MEDIUM | Pipeline already writes `weekly_summary.json`; the gap is the pipeline data scope (captains+gems only) vs. what the full decision summary knows |
| Version comparison shows delta clearly | In any accuracy tracking UI, the most valuable signal is whether the new formula is better or worse than the last | LOW | `VersionHistoryTable` already renders a delta column; adding captain hit rate requires extending `VersionRecord` type and pipeline output |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| News severity classification (red/amber/zinc) | FPL tools typically show raw news strings; colour-coding by severity (chance_of_playing thresholds) makes the danger status scannable at a glance | LOW | Already implemented in `computeNewsSeverity`; the value is in the surfacing, not the computation |
| Prose summary synthesises transfer AND chip context | Generic AI summaries just describe captain options; a summary that says "captain Salah, transfer in Mbeumo before the DGW, and hold your bench boost" mimics a knowledgeable friend's advice | MEDIUM | Requires extending `generate_weekly_summary()` to accept transfer/chip/risk payloads matching what the POST handler already understands |
| Captain hit rate tracked per formula version | Most accuracy tools track prediction hit rate; tracking captain pick quality separately reveals whether formula changes improve the most important single decision | MEDIUM | Requires pipeline to write a captain backtest comparison alongside the existing haulter backtest |
| Conditional prose phrasing for uncertain players | Prose that says "if Salah plays — and he is 75% to — captain him" communicates uncertainty honestly rather than hiding it | MEDIUM | Requires news severity data to be passed into the prose generation context so Claude can hedge appropriately |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Show news for every player in GemTable | Users want to see injury status at a glance anywhere | GemTable has 700+ rows; cluttering every row with news banners destroys scannability; most players have no news | Show `NewsBanner` only on expanded rows and on the specific decision surfaces (transfers, captains) where news is decision-relevant |
| Auto-regenerate prose summary on squad load | Users expect fresh AI content after loading their team | Cost explosion risk already documented in PROJECT.md decision log — `useEffect` trigger on squad load could generate 4+ API calls per session across many sessions | Keep prose pre-generated from pipeline + on-demand refresh button; pipeline path zero Claude spend at read time |
| Version history with every GW's per-version breakdown | Full per-GW accuracy breakdown by version would be informative | Version records are snapshots at the time of formula change; retroactive per-GW re-computation would require re-running the backtest under each historical formula, which is expensive and complex | Show overall hit rate delta between versions; per-GW breakdown only for the current formula |
| Prose with numeric predictions | "Captain Salah — projected 9.2 xPts" sounds authoritative | Projection numbers change as lineups confirm; stale numbers in cached prose mislead; the guardrail design already excludes numeric values for this reason | Keep prose qualitative; numeric data is already surfaced in the structured captain/transfer cards |

---

## Feature Dependencies

```
SCRAPER-01 (news in transfer surface)
    └──requires──> newsSeverity.ts (DONE)
    └──requires──> NewsBanner.tsx (DONE)
    └──requires──> news field in MergedPlayer (DONE)
    └──requires──> wiring into TransferPanel candidate rows (v1.21 work)

SCRAPER-01 (news in captain surface)
    └──requires──> same as above
    └──requires──> wiring into CaptainPicksPanel candidate rows (v1.21 work)

NLP-01 (full-context prose)
    └──requires──> prose_summary.py generate_weekly_summary() (DONE)
    └──requires──> weekly_summary.json pipeline write (DONE)
    └──requires──> ProseSummaryBlock + useProseSummary (DONE)
    └──requires──> transfer/chip context passed to pipeline generate call (v1.21 work)
    └──requires──> captain_picks.json (DONE — run.py already computes cap_payload from merged)

NLP-01 conditional phrasing for news
    └──enhances──> SCRAPER-01 (news severity data feeds prose context)
    └──requires──> news severity passed into generate_weekly_summary() args (v1.21 work)

VER-01 (captain hit rate by version)
    └──requires──> VersionRecord type (DONE)
    └──requires──> versions[] in accuracy_backtest.json (DONE)
    └──requires──> VersionHistoryTable component (DONE)
    └──requires──> captain_picks backtest in accuracy.py (v1.21 work)
    └──requires──> captain_hit_rate field in VersionRecord (v1.21 type extension)
```

### Dependency Notes

- **SCRAPER-01 wiring is independent of NLP-01**: news display in transfer/captain surfaces can be built and deployed before any prose changes.
- **NLP-01 requires deciding scope**: the pipeline's `generate_weekly_summary()` accepts `captains` and `gems`. Adding transfer/chip context means either (a) extending the function signature, or (b) calling the existing POST endpoint from within the pipeline. Option (a) is cleaner — keep all LLM generation in `prose_summary.py`.
- **NLP-01 and SCRAPER-01 are loosely coupled for conditional phrasing**: the prose can mention injury doubt without the `NewsBanner` being present on the same surface, but passing `chance_of_playing_next_round` data into the prose context requires the same pipeline data already in `MergedPlayer`.
- **VER-01 captain tracking is additive**: it extends `VersionRecord` and the pipeline's captain comparison logic without touching the existing hit rate computation. No risk of breaking the existing `VersionHistoryTable` if `captain_hit_rate` is optional.

---

## MVP Definition

### The Three Features Are All Incremental Additions (Not Greenfield)

Because all three features extend existing fully-working systems, the v1.21 scope is wiring and extension, not new feature construction. The right framing is:

**SCRAPER-01 — Wire news into decision surfaces (P1)**
- `NewsBanner` into `TransferPanel` buy-candidate rows
- `NewsBanner` into `CaptainPicksPanel` candidate rows
- Verify the `news_flag_enabled` gate propagates correctly to both surfaces

**NLP-01 — Extend pipeline prose to full decision context (P1)**
- Extend `generate_weekly_summary()` to accept `transfer` and `chip` args
- Pass the transfer suggestion and chip timing data from `run.py` into the call
- Add conditional phrasing for players with `chance_of_playing_next_round < 100` (optional enhancement)
- Keep the on-demand POST handler unchanged (it already accepts full context)

**VER-01 — Add captain hit rate to version records (P2)**
- Extend `VersionRecord` with optional `captain_hit_rate: number`
- Compute captain hit rate in `accuracy.py` (compare top-N captain picks against actual captain scores)
- Render the new column in `VersionHistoryTable`

### Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SCRAPER-01 news in transfers | HIGH — prevents targeting injured players | LOW — wiring only | P1 |
| SCRAPER-01 news in captains | HIGH — last-minute captain news is critical | LOW — wiring only | P1 |
| NLP-01 full-context prose pipeline | MEDIUM — prose currently lacks transfer/chip context | MEDIUM — extend pipeline function signature + run.py plumbing | P1 |
| NLP-01 conditional phrasing for news | MEDIUM — honest uncertainty communication | MEDIUM — requires news data in prose context | P2 |
| VER-01 captain hit rate by version | LOW-MEDIUM — useful for tracking formula quality over time | MEDIUM — new backtest computation in accuracy.py | P2 |

---

## Detailed Behaviour Specification

### SCRAPER-01: News Display Behaviour

**What constitutes useful news vs noise:**

The FPL `elements[].news` field contains four categories of content:

1. **Actionable injury news** — "Hamstring injury - doubt for GW34", "50% chance of playing". `chance_of_playing_next_round <= 50`. Red severity. Always surface — this changes the transfer/captain decision.

2. **Partial doubt** — "Knock - 75% chance of playing", "Monitored ahead of weekend". `chance_of_playing_next_round == 75`. Amber severity. Surface — this informs the risk profile of the pick.

3. **Informational/resolved** — "Returned to training", "Returned from international duty", "Available for selection". `chance_of_playing_next_round == 100` with non-empty news. Zinc severity. Optional to surface — contextual information but not decision-changing.

4. **No news** — Empty `news` field or `chance_of_playing_next_round == null`. `NewsSeverity == 'none'`. Do not render — adds nothing.

The severity classifier (`computeNewsSeverity`) already encodes this exactly. The "useful vs noise" question is answered by: anything that causes a non-`'none'` severity is worth surfacing on a decision surface.

**Transfer surface behaviour**: `NewsBanner` renders below the buy-candidate player name in `OpportunityCostTable` (the PlayerMoveCell buy row). This is the same position where `FragilityNote` renders (the fragility reasons). News appears between the player name and the fragility/rejection reasons.

**Captain surface behaviour**: `NewsBanner` renders below the player name in `CaptainPicksPanel` candidate rows. Since captains are sorted by xPts ceiling, a 50%-chance player appearing in the top 3 with a red news banner communicates the risk clearly without requiring the user to cross-reference another surface.

**What not to do**: Do not show a tooltip with the full news text on hover — the news strings are already short (FPL limits them). Do not add a separate "News" tab — news is contextual to the decision it affects. Do not show `news_added` timestamp in the primary UI — it clutters the display for marginal value.

### NLP-01: Weekly Prose Summary Behaviour

**What the summary should read like:**

A knowledgeable friend who has already processed the data and is telling you what matters, in plain English, before the deadline. Not a stats report. Not a list of projections.

Good: "Salah looks nailed and has a home fixture against a leaky defence — he is the clear captain this week. Mbeumo is a decent differential if you can fit him in, though he faces a trickier away trip. The Bench Boost scores well across GW36's double, so hold it for now."

Bad: "The model projects Salah at 9.2 xPts. Mbeumo has a 6.8 xPts projection. Bench Boost EV is 12.3 in GW36."

**What information belongs in the prompt vs excluded:**

Include:
- Top 1-2 captain candidates (names + fixture context, no numbers)
- The recommended transfer if one is flagged (sell name, buy name, directional rationale)
- Chip timing recommendation if one is near (chip name, which GW, qualitative rationale)
- Risk flags: players on the team with injury doubt (name + label, no chance percentages in the prose)

Exclude:
- Projected points values — they change as lineups confirm and stale numbers mislead
- Any player not in the structured decision output — guardrail already enforces this
- More than 2-3 captain options — the prose should be opinionated, not a ranked list
- Historical performance data beyond what the structured cards surface

**Handling uncertainty:**

The prompt should instruct Claude to use conditional phrasing when a player has `chance_of_playing_next_round < 100`. The pipeline can pass a `risks` array (already supported by the POST handler's Zod schema) where each entry is `{name, label}`. The label for a 75%-chance player is "75% chance" or the news string. Claude should then write "if Salah plays — and he is expected to — captain him" rather than a flat assertion.

This requires the pipeline's `generate_weekly_summary()` function to:
1. Accept a `risks` parameter (matching what `run.py` constructs for the POST handler)
2. Pass risk context into the user prompt XML block

**Prompt structure (current POST handler format, which already works):**

```xml
<input>
<captains>
  <player name="Salah" team="LIV" />
  <player name="Mbeumo" team="BRE" />
</captains>
<transfer sell="Watkins" buy="Mbeumo" />
<chip code="bboost" bestGw="36" />
<risks>
  <player name="Salah" label="75% chance of playing" />
</risks>
</input>

Write a concise 3-5 sentence summary of this manager's top decisions this gameweek.
Reference only players inside <input>. Quote their names verbatim.
Refer to players qualitatively — do not include statistics, projected points, or numeric values.
```

**LLM cost implications:**

The pipeline runs once daily via GitHub Actions. The prose call uses `claude-haiku-4-5`. At the current prompt size (~300-400 tokens input, ~200 tokens output) this costs approximately USD 0.00008 per call (Haiku pricing: $0.25/MTok input, $1.25/MTok output). At 38 GWs/season: USD 0.003 per season — negligible even at 10x overestimate.

The on-demand refresh POST handler fires only on explicit user button press. The two-tier cache means once the pipeline writes `weekly_summary.json`, the GET endpoint serves it with zero Claude spend. The refresh button is an escape hatch for users who loaded their squad and want a squad-specific summary — it fires at most once per session per user given the on-demand trigger.

**Total NLP-01 LLM cost estimate (season):** ~USD 0.01 all-in. Well within the Anthropic Console monthly cap already in place.

### VER-01: Model Versioning Behaviour

**What a useful version tag includes:**

The existing `FORMULA_VERSION = 'v1.12-a'` pattern (milestone-letter) is correct. Users do not need semantic versioning — the label should communicate which milestone introduced the change. The existing `VersionRecord` already captures:
- `formula_version` (human-readable tag)
- `recorded_at` (ISO timestamp)
- `hit_rate` (haul detection: did we flag the right players?)
- `gate_flags` (which sub-models were active)

**What comparisons across versions matter:**

1. **Hit rate delta**: Already computed — `delta = (v.hit_rate - prev.hit_rate) * 100` shown in `VersionHistoryTable`. This answers "is the overall haul prediction better?"

2. **Captain hit rate by version**: The captain pick is the single most important weekly decision. A formula change that improves haul detection but degrades captain recommendation quality is net-negative. This requires computing: "was the captain pick (top recommendation) correct?" across the GWs covered by each version. Correctness means the recommended captain was the highest actual scorer in the squad for that GW.

   The pipeline already has `captain_picks.json` (top-N candidates by xPts ceiling). The backtest in `accuracy.py` already groups predictions by GW. Computing captain hit rate means: for each GW in the backtest window, was the top captain pick (position 1 in `captain_picks.json`) the player with the highest actual points in the top-N?

3. **Calibration stability**: The calibration chart (existing in AccuracyTab) shows how well predicted probabilities match actual haul rates. Version changes should not significantly shift calibration unless the change was intended to improve it.

**What to show in `VersionHistoryTable` for VER-01:**

Add an optional `captain_hit_rate` column to `VersionHistoryTable`. For versions where this data is absent (legacy records), render a dash. For current and future versions, render as a percentage with colour tier (green >= 40%, amber 25-39%, zinc < 25%).

The 40% threshold for "good" captain hit rate comes from the base rate: in a 15-player squad, there is a 1/15 = 6.7% random chance of picking the best scorer. The model aiming for the top captain pick and achieving it 40%+ of the time (across all GWs, not just haulter GWs) is meaningfully better than random.

**Implementation note**: `captain_hit_rate` should be optional in `VersionRecord` (backward compatible — legacy records lack it). The computation requires the `captain_picks.json` blob per GW (written by pipeline already). It does NOT require storing historical captain picks per version — it computes across the current backtest window (last 5 GWs) just as the haul hit rate does.

---

## Sources

- Full codebase inspection: `src/lib/newsSeverity.ts`, `src/components/news/NewsBanner.tsx`, `src/lib/hooks/useAccuracy.ts`, `pipeline/prose_summary.py`, `pipeline/run.py` (lines 358-403), `pipeline/accuracy.py` (lines 37, 85-100, 392-434), `src/components/squad/ProseSummaryBlock.tsx`, `src/app/api/prose-summary/route.ts`, `src/components/accuracy/AccuracyTab.tsx` (VersionHistoryTable), `src/lib/types.ts` (VersionRecord, MergedPlayer, AccuracyBacktest)
- FPL API field mapping: `elements[].news`, `elements[].chance_of_playing_next_round`, `elements[].news_added` confirmed in `FPLElement` interface
- Existing severity thresholds: D-09 in Phase 88 context (`chance == null or 100 → none/zinc`, `75 → amber`, `<= 50 → red`)
- Anthropic Haiku pricing: $0.25/MTok input, $1.25/MTok output (as of model `claude-haiku-4-5`)

---
*Feature research for: FPL Analyst v1.21 - Polish, Intelligence & Team News*
*Researched: 2026-05-16*
