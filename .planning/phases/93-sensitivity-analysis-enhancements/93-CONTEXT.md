# Phase 93: Sensitivity Analysis Enhancements - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `src/lib/sensitivity.ts` from the v1.10 binary ROBUST/FRAGILE (Phase 64) to a 5-perturbation tristate: ROBUST (0 reversals) / FRAGILE (1 reversal) / KNIFE EDGE (2+ reversals). Each of the 5 named perturbations independently tests whether the recommendation would reverse:
(a) `start_prob -= 0.15`
(b) `mins_60_prob -= 0.10`
(c) fixture difficulty +1 tier
(d) `cost += 0.5m`
(e) news flips to "doubt" (chance_of_playing_next_round = 50)

Add a `FragilityBadge` component extending `FragilityNote` styling, replace all `FragilityNote` callsites, and wire into: GemTable row-expand panel (below news section) and OpportunityCostTable `PlayerMoveCell` (new line below the flex row for each buy candidate).

**Out of scope:** New pipeline changes, new API routes, new MergedPlayer fields, changes to the MC simulation, or modifications to the news severity taxonomy.

</domain>

<decisions>
## Implementation Decisions

### Perturbation Reversal Logic

- **D-01: `start_prob -= 0.15` reversal** — Check if `player.start_prob - 0.15 < 0.70`. Uses the existing Phase 64 threshold (0.70). Applies to both transfer and captain paths.

- **D-02: `mins_60_prob -= 0.10` reversal** — Check if `player.mins_60_prob !== undefined && player.mins_60_prob - 0.10 < 0.60`. Threshold: 0.60. If `mins_60_prob` is undefined (Phase 52 MIN-01 optional field), skip this perturbation — no reversal counted. Applies to both transfer and captain paths.

- **D-03: fixture +1 tier reversal** — Both transitions trigger a reversal:
  - `'easy'` → `'medium'`: triggers (crosses the Phase 64 D-04 medium threshold)
  - `'medium'` → `'hard'`: triggers (fixture is even more hostile)
  - `'hard'`: can't increment past hard — perturbation skipped, no reversal counted
  - BGW guard: if `player.fixtures.length === 0`, skip (no fixture to perturb)
  - Reason string: `'harder fixture'` for both transitions (consistent with Phase 64 D-06 vocabulary)

- **D-04: `cost += 0.5m` reversal** — Transfer-only (same `isTransfer` guard as Phase 64 D-09). Check if `xPtsGain < 5.0` (tightened from Phase 64's 4.0 threshold — the 0.5m premium is worth ~1 expected pt). Captain path always skips this perturbation.

- **D-05: news "doubt" reversal** — Check if `player.chance_of_playing_next_round` is not already ≤ 50 (the player isn't already doubtful). If they're healthy (null or 100) or only lightly flagged (75), simulating doubt (= 50) constitutes a reversal. Reuses the Phase 88 news-flag taxonomy — the check is `computeNewsSeverity(50, player.news) === 'red'` (or direct `chance <= 50` comparison — builder decides which is cleaner). Applies to both paths.

### Tristate Tier Mapping

- **D-06:** Count the perturbations that triggered a reversal (`reversalCount`). Tier mapping:
  - `reversalCount === 0` → `'robust'`
  - `reversalCount === 1` → `'fragile'`
  - `reversalCount >= 2` → `'knife_edge'`

### FragilityBadge Visual

- **D-07:** ROBUST → no badge rendered (same as Phase 64 non-fragile = nothing shown). FRAGILE → amber tone (same as existing `FragilityNote`: `text-amber-600 dark:text-amber-400`). KNIFE EDGE → stronger amber/red tone (builder chooses, e.g. `text-orange-600 dark:text-orange-400` or `text-red-600 dark:text-red-400`).

- **D-08:** The badge lists the specific reason strings for triggering perturbations: "no longer recommended if: [reason1], [reason2]". Same copy pattern as Phase 64 D-12. Non-triggering perturbations are not listed.

- **D-09:** `FragilityBadge` extends `FragilityNote` styling (no filled pill — distinct from `DangerousToFadeBadge`, `McLabel`, `SeverityBadge MEDIUM`). `data-testid="fragility-badge"` for RTL tests.

### GemTable Row-Expand Placement

- **D-10:** `FragilityBadge` renders **after** `RowExpandNewsSection` in the row-expand panel. Reading order: rejection panel → news section → fragility. Fragility is a forward-looking "what if" — it reads naturally after the "why not now" rejection context.

### OCS `PlayerMoveCell` Placement

- **D-11:** `FragilityBadge` renders on a **new line below** the flex row (`Sell X → Buy Y + RotationRiskBadge + NewsBanner`). Matches Phase 64 D-02 spirit (own row for fragility). `computeFragility` is called with `t.buy` as the player, `isTransfer: true`, and `row.xPtsGainNet` as `xPtsGain`. The badge only renders when `tier !== 'robust'`.

### CaptainPicksPanel Migration

- **D-12:** Replace `const { fragile, reasons } = computeFragility(candidate, false)` with `const { tier, reasons } = computeFragility(candidate, false)` and swap `<FragilityNote reasons={reasons} />` for `<FragilityBadge tier={tier} reasons={reasons} />`. Render when `tier !== 'robust'` (not just when `fragile`).

### Return Type Migration

- **D-13:** `FragilityResult` changes from `{ fragile: boolean; reasons: string[] }` to `{ tier: 'robust' | 'fragile' | 'knife_edge'; reasons: string[] }`. The `fragile` boolean is dropped. All callsites updated in 093-04-PLAN.md wire-up.

### Claude's Discretion

- Exact Tailwind class for KNIFE EDGE amber/red tone (e.g., `text-orange-600` vs `text-red-600`)
- Whether `FragilityBadge` is a thin wrapper around `FragilityNote` internals or a separate component
- Whether `data-testid` distinguishes `fragility-badge` from `fragility-note` or reuses same testid
- Whether news doubt reversal uses `computeNewsSeverity(50, player.news) === 'red'` or direct `(player.chance_of_playing_next_round ?? 100) > 50` comparison

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 93 — full success criteria (SC-1 through SC-5), plan breakdown (093-01 through 093-04), cross-cutting constraints (named constants, Pitfall 2 from Phase 64)
- `.planning/REQUIREMENTS.md` §SENS-01 — base sensitivity requirement

### Prior Phase Context (MUST READ)
- `.planning/phases/064-sensitivity-analysis/064-CONTEXT.md` — original fragility decisions (D-01 through D-12): visual style, fixture threshold (medium), start_prob threshold (0.70), hit cost (xPtsGain < 4.0), reason vocabulary — all preserved in Phase 93

### Engine Code
- `src/lib/sensitivity.ts` — `computeFragility` to extend; existing `FRAGILITY_START_PROB` and `FRAGILITY_HARDER_FIXTURE` constants to preserve and extend
- `src/lib/__tests__/sensitivity.test.ts` — existing Phase 64 test suite (7 cases) to extend with ≥12 new cases per 093-01-PLAN
- `src/lib/newsSeverity.ts` — `computeNewsSeverity` + `NewsSeverity` type (Phase 88 taxonomy); the news "doubt" perturbation reuses this — no duplicated constants

### UI Code
- `src/components/shared/FragilityNote.tsx` — source component to extend into `FragilityBadge`; existing `data-testid="fragility-note"`, amber styling, ⚠ icon pattern
- `src/components/shared/FragilityNote.test.tsx` — existing RTL tests for `FragilityNote`

### Wire-up Surfaces
- `src/components/captaincy/CaptainPicksPanel.tsx` lines 154–155 — existing `computeFragility` + `FragilityNote` callsite (captain path, `isTransfer=false`)
- `src/components/gem-table/GemTable.tsx` lines 296–379 — row-expand panel; `FragilityBadge` goes after `RowExpandNewsSection` (line ~352–357)
- `src/components/transfers/OpportunityCostTable.tsx` `PlayerMoveCell` (lines 88–112) — new line below flex row; `t.buy` is the player, `row.xPtsGainNet` is `xPtsGain`

### Types
- `src/lib/types.ts` line 142: `start_prob` on `MergedPlayer`
- `src/lib/types.ts` line 150: `mins_60_prob?: number` (Phase 52 MIN-01 — optional)
- `src/lib/types.ts` lines 28/133: `chance_of_playing_next_round?: number | null`
- `src/lib/club-form.ts` `tier()` function — `DifficultyTier` values: `'easy' | 'medium' | 'hard'`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FragilityNote` (`src/components/shared/FragilityNote.tsx`): amber `text-amber-600 dark:text-amber-400`, ⚠ aria-hidden icon, reason-list join — extend for tristate badge
- `computeNewsSeverity` (`src/lib/newsSeverity.ts`): Phase 88 taxonomy; `'red'` = chance ≤ 50 — reuse for news perturbation check, no duplication
- `FRAGILITY_START_PROB` and `FRAGILITY_HARDER_FIXTURE` constants in `sensitivity.ts` — extend with 3 new constants for new perturbation reason strings
- `@vitest-environment node` pragma already on `sensitivity.test.ts` — required for node-runnable engine tests (Phase 64 pattern, SC-5)

### Established Patterns
- **Named constants for perturbation deltas**: per ROADMAP cross-cutting constraint — `PERTURB_START_PROB = -0.15`, `PERTURB_MINS60 = -0.10`, `PERTURB_COST = 5` (0.5m in internal tenths), `PERTURB_NEWS_DOUBT = 50` — extract as constants, never inline
- **BGW guard**: `player.fixtures.length > 0` check before fixture access — already present in Phase 64, preserve in Phase 93
- **isTransfer guard**: hit-cost check (D-09, D-10 Phase 64) and cost perturbation (D-04 Phase 93) both gated on `isTransfer === true`
- **Optional field guard**: `mins_60_prob` is optional — skip perturbation (b) entirely when undefined

### Integration Points
- `GemTable.tsx` row-expand: insert `<FragilityBadge>` after existing `<RowExpandNewsSection>` (line ~357); requires importing `computeFragility` and `FragilityBadge`
- `OpportunityCostTable.tsx` `PlayerMoveCell`: add new `<div>` after the flex row; needs access to `row.xPtsGainNet` (already on `OCSRow`) and `t.buy` (already in scope)
- `CaptainPicksPanel.tsx` line 154: swap `fragile` for `tier` in destructure; swap `<FragilityNote>` for `<FragilityBadge>`; update render condition to `tier !== 'robust'`

</code_context>

<specifics>
## Specific Ideas

- `mins_60_prob` threshold set at 0.60 — symmetric with the 0.70 start_prob threshold from Phase 64, consistent with "60% chance of 60 mins" as the meaningful boundary
- Cost perturbation tightens hit threshold by 1pt (4.0 → 5.0) rather than using value-per-£m; rationale: stays within the pure-function xPtsGain signature already used in Phase 64
- Both easy→medium and medium→hard fixture transitions share the same 'harder fixture' reason string — vocabulary consistency with Phase 64 D-06
- FragilityBadge placement: GemTable row-expand after news (forward-looking "what if" after "why not now"), OCS row as new line below flex row (avoiding inline crowding on narrow screens)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 93-sensitivity-analysis-enhancements*
*Context gathered: 2026-05-10*
