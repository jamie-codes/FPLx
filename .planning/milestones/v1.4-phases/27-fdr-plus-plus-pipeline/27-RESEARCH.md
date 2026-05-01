# Phase 27: FDR++ Pipeline - Research

**Researched:** 2026-04-28
**Domain:** Pipeline data enrichment + UI panel for fixture ease ranking
**Confidence:** HIGH (codebase-grounded; minimal external dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### FDR++ Methodology (DATA-01)
- **D-01:** `attacking_difficulty` uses a 6-game rolling goals-conceded average per team — same formula as the existing `difficulty_score`. The `difficulty_score` field is unchanged; `attacking_difficulty` is a new parallel field computed identically.
- **D-02:** `defensive_difficulty` uses a 3-game rolling goals-scored average per team (NOT the existing 6-game window). Shorter window intentional — captures hot-streak teams more reactively.
- **D-03:** Data source is plain goals from FPL fixtures only. No Understat dependency for this metric.
- **D-04:** Both metrics are independently normalized (each 0.0–1.0 on its own scale, with its own min/max across the 20 teams). A 0.8 `attacking_difficulty` means hard to score against relative to all teams; a 0.8 `defensive_difficulty` means hard to keep a CS relative to all teams. They are not comparable to each other numerically.

#### Fixture Ease Ranking UI (FIX-01)
- **D-05:** New "Fixture Ease Ranking" panel placed **above** the existing ClubFormTable on the Form tab. Prospective (fixture ease) and retrospective (W/D/L form) data are visually separate.
- **D-06:** Each row shows: rank number, team short name, and a colored ease bar (green=easy, red=hard) representing the average ease over the selected GW window.
- **D-07:** GW window toggle uses the same pill-toggle style as the existing 1GW/3GW/5GW toggle in Gem Ratings — reuse existing component/pattern.
- **D-08:** Fixture ease ranking data comes from extending `/api/club-form` (not a new route). `computeClubForm()` in `src/lib/club-form.ts` is extended to return per-team `attacking_ease` and `defensive_ease` arrays (one value per GW window: 1, 3, 5).

#### Position Toggle (FIX-02)
- **D-09:** ATT/DEF toggle pill lives in the fixture ease panel header, alongside 1GW/3GW/5GW toggle. Default state: ATT (MID/FWD). ATT uses `attacking_difficulty` for ranking; DEF uses `defensive_difficulty`.
- **D-10:** ATT/DEF toggle scoped to fixture ease panel only — does not affect ClubFormTable or FixtureBadges below.

### Claude's Discretion
- **BGW handling:** when a team has no fixture in the selected GW window, exclude missing fixtures from the average (don't penalize or fill with a neutral value).
- **Tier thresholds** for new metrics use the same percentile-based approach as existing `difficulty_tier` (bottom third = easy, top third = hard).
- **Ease bar color** uses the same `difficulty_tier` color palette already established in `FixtureBadges` (green = easy, amber = medium, red = hard).

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | System stores `attacking_difficulty` and `defensive_difficulty` per team per fixture in pipeline output (additive — existing `difficulty_score` field unchanged) | Section 2 (Pipeline Implementation Plan) — extends `merge.py` `team_fixtures` dict with two parallel fields using `_compute_difficulty_score()` reused for both; existing `difficulty_score` consumers (gem-score, defcon, planning-engine, FixtureBadges) untouched |
| FIX-01 | User can see all 20 Premier League teams ranked by fixture ease on the Form tab with 1GW, 3GW, and 5GW toggle views | Section 5 (FixtureEaseRankingPanel) — new component above ClubFormTable; data via extended `computeClubForm()`; toggle reuses `GwToggle` pattern |
| FIX-02 | Fixture ease ranking uses FDR++ attacking/defensive split where available (attacking FDR for attack players, defensive FDR for defenders/goalkeepers) | Section 5 — ATT/DEF pill toggle in panel header; ATT view ranks by `attacking_ease_NGW`, DEF view ranks by `defensive_ease_NGW` |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js version:** 16.2.1 with React 19.2.4. AGENTS.md flags this as "NOT the Next.js you know" — APIs/conventions may differ from training data. Read `node_modules/next/dist/docs/` before writing route or layout code. For Phase 27 the API route is already established (`src/app/api/club-form/route.ts`) and only its response shape changes — no Next-version-specific concerns expected.
- **No `Co-Authored-By` trailers** in git commits.
- **Test runner:** vitest (`npm test`). No Python test infrastructure exists for `pipeline/`.

## Summary

Phase 27 is **additive and contained**. The existing pipeline already computes per-team difficulty from a 6-game rolling goals-conceded average and emits one `difficulty_score` field per fixture entry in `merged_players.json`. Phase 27 adds two new parallel fields per fixture (`attacking_difficulty`, `defensive_difficulty`) and extends the `/api/club-form` JSON shape with six new arrays (`attacking_ease_1gw/3gw/5gw`, `defensive_ease_1gw/3gw/5gw`). All existing consumers continue to read `difficulty_score` unchanged.

The UI surface area is a new `FixtureEaseRankingPanel` mounted above `ClubFormTable` on the `club-form` tab. It consumes the existing `useClubForm` hook (no new fetcher), and reuses the `GwToggle` pill pattern (`src/components/gem-table/GwToggle.tsx`) and the `FixtureBadges` colour palette (green/amber/red on the `easy/medium/hard` tier).

**Primary recommendation:** Execute as two waves. Wave 1: pipeline (`merge.py`) + types + API response shape + tests. Wave 2: UI (`FixtureEaseRankingPanel` + `GwToggle` reuse + ATT/DEF toggle + page mounting + tests). The split is clean because the UI can mock the new API shape during Wave 2 development, but in practice Wave 2 just consumes Wave 1's real output.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Goals-scored / goals-conceded rolling aggregation | Pipeline (Python) | — | Pre-computation belongs offline; keeps merged_players.json self-describing |
| Per-fixture `attacking_difficulty` / `defensive_difficulty` fields | Pipeline (Python) | Frontend Server (TS mirror) | Pipeline emits canonical values into merged_players.json; `computeClubForm()` re-derives the same logic from raw fixtures because the API route reads `fpl_fixtures.json` + `fpl_bootstrap.json` directly (it does NOT read merged_players.json — see route.ts) |
| `attacking_ease_NGW` / `defensive_ease_NGW` per-team aggregates | Frontend Server (Next API route) | — | Aggregation across a window of fixtures is a view concern; computed in `computeClubForm()` and returned in the `/api/club-form` payload |
| Tier classification (easy/medium/hard) | Both (mirrored) | — | Pipeline emits `difficulty_tier` strings into merged_players.json; client mirrors the same tier function for ease-bar coloring |
| ATT/DEF toggle state | Browser / Client | — | Pure UI state, scoped to the panel — `useState` |
| 1GW/3GW/5GW window selection | Browser / Client | — | Pure UI state — `useState`, mirrors the `GwToggle` pattern from Gem Ratings |
| Fixture ease ranking sort | Browser / Client | — | Sort is computed from the API response on every render — no need to persist |
| Mobile layout (panel width, bar truncation) | Browser / Client | — | Tailwind responsive utility classes; existing `isMobile` pattern from `ClubFormTable` |

## Standard Stack

### Already Present (use as-is)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | Framework / route handlers | Project standard [VERIFIED: package.json] |
| React | 19.2.4 | UI runtime | Project standard [VERIFIED: package.json] |
| @tanstack/react-query | ^5.95.2 | Data fetching for `/api/club-form` | Project standard, already used by `useClubForm` [VERIFIED: package.json] |
| @tanstack/react-table | ^8.21.3 | Table rendering | Used by `ClubFormTable` for the W/D/L table; the ease ranking panel is simpler and likely needs only a `<ul>` or plain rows — no new table needed [VERIFIED: package.json] |
| Tailwind CSS | ^4 | Styling | Project standard, already used by `FixtureBadges` colour palette [VERIFIED: package.json] |
| Vitest | ^4.1.2 | Test runner | Project standard for TS unit tests [VERIFIED: package.json] |
| Zod | ^4.3.6 | Validation | Already used elsewhere; not strictly required for this phase since the API response is internal |

### No New Dependencies
This phase does not require any new npm packages or Python modules. All work uses existing tooling.

**Version verification:** Run `npm outdated` and verify no security advisories before commit. No new installs required.

## Architecture Patterns

### System Architecture Diagram

```
                               PIPELINE (offline / cron)
                               ┌────────────────────────┐
   FPL fixtures.json ──────────▶ merge.py               │
   FPL bootstrap.json ─────────▶  ├─ team_goals_conceded │   (existing)
                                 │  └─ ROLLING_WINDOW=6  │
                                 ├─ team_goals_scored ◀──┤   (NEW)
                                 │  └─ OFFENSIVE_ROLLING=3│
                                 ├─ _compute_difficulty_score()  (REUSED for both)
                                 ├─ team_fixtures dict   │
                                 │   per fixture: { ...,│
                                 │    difficulty_score, │   (existing)
                                 │    attacking_difficulty, │ (NEW — same as difficulty_score)
                                 │    defensive_difficulty} │ (NEW — from goals_scored)
                                 ▼
                          merged_players.json   ──── consumed by /api/players, gem-score, etc.
                                                       (all existing consumers unchanged)


                               FRONTEND (per-request)
   /api/club-form route.ts ──▶ computeClubForm(bootstrap, fixtures)
                                ├─ teamFinished                        (existing)
                                ├─ teamGoalsConceded → diffScoreAtt    (renamed clarity; same as old)
                                ├─ teamGoalsScored   → diffScoreDef    (NEW)
                                ├─ teamUpcoming (5)                    (existing)
                                ├─ For each team & each window N ∈ {1,3,5}:
                                │    attacking_ease_NGW = mean over upcoming.slice(0,N)
                                │                        of attacking_difficulty
                                │    defensive_ease_NGW = mean over upcoming.slice(0,N)
                                │                        of defensive_difficulty
                                │    BGW: if team has fewer than N fixtures, average over what exists
                                ▼
                              ClubForm[] (extended shape) ──▶ JSON response

                               BROWSER
   <FormTab>
     ├─ <FixtureEaseRankingPanel>       (NEW — mounted ABOVE existing table)
     │    ├─ header
     │    │   ├─ <GwToggle 1|3|5>      (REUSED from gem-table/GwToggle.tsx)
     │    │   └─ <AttDefToggle ATT|DEF> (NEW — mirrors GwToggle structure)
     │    ├─ rows: 20 teams sorted by selected metric (asc — easiest first)
     │    │   each row: rank | short_name | <EaseBar value=1-attacking_ease_NGW />
     │    └─ uses useClubForm() (no new hook)
     ├─ <ClubFormTable>                 (UNCHANGED — existing W/D/L table)
```

The two views are visually separated by `<section>` + spacing; the user reads forward (ease ranking) on top, backward (form) below.

### Recommended Project Structure

```
pipeline/
  merge.py                              # MODIFIED: add team_goals_scored, OFFENSIVE_ROLLING, two new fixture fields
  test_merge_fdr_pp.py                  # NEW (optional — see Validation section): pytest if Python tests are added

src/
  lib/
    club-form.ts                        # MODIFIED: add per-team attacking/defensive ease arrays
    types.ts                            # MODIFIED: extend FixtureEntry, ClubForm, ClubFormFixture
  components/
    club-form/
      ClubFormTable.tsx                 # UNCHANGED
      columns.tsx                       # UNCHANGED
      FixtureEaseRankingPanel.tsx       # NEW
      AttDefToggle.tsx                  # NEW (or inline in panel)
      EaseBar.tsx                       # NEW (small presentational component)
    gem-table/
      GwToggle.tsx                      # REUSED as-is (or genericized — see Pattern below)
  app/
    api/club-form/route.ts              # UNCHANGED (response shape extended via computeClubForm)
    page.tsx                            # MODIFIED: wrap club-form tab content with new panel above table
tests/
  lib/club-form.test.ts                 # MODIFIED: add cases for ease arrays + BGW handling
  components/club-form/
    FixtureEaseRankingPanel.test.tsx    # NEW (smoke render + sort + toggle behavior)
```

### Pattern 1: Mirror Pipeline Math in TypeScript

The Python `merge.py` and TypeScript `club-form.ts` already independently re-derive `difficulty_score` from the same FPL fixtures input. This is intentional: `/api/club-form/route.ts` reads `fpl_fixtures.json` + `fpl_bootstrap.json` directly, NOT `merged_players.json`.

**Why:** route.ts (lines 14-31 in src/app/api/club-form/route.ts) loads:
- `fpl_fixtures.json`
- `fpl_bootstrap.json`

It does NOT load `merged_players.json`. So `computeClubForm()` must re-derive any new fixture-difficulty fields from raw fixtures locally; it cannot read pipeline-computed values.

**Implication:** the TS implementation and Python implementation must stay in sync. Both files define `ROLLING_WINDOW = 6` independently. Add `OFFENSIVE_ROLLING = 3` as a named constant in BOTH files.

```typescript
// src/lib/club-form.ts — NEW pattern
const ROLLING_WINDOW = 6  // existing
const OFFENSIVE_ROLLING = 3  // NEW — for goals-scored window

// teamGoalsScored (mirror of existing teamGoalsConceded loop)
const teamGoalsScored = new Map<number, number>()
for (const [tId, fxs] of teamFinished) {
  const scored = fxs.map(f =>
    f.team_h === tId ? (f.team_h_score ?? 0) : (f.team_a_score ?? 0)
  )
  const lastN = scored.slice(-OFFENSIVE_ROLLING)
  teamGoalsScored.set(tId, lastN.length > 0 ? lastN.reduce((a, b) => a + b, 0) / lastN.length : 0)
}
// Then independently normalize teamGoalsScored → defensive_difficulty per team
```

### Pattern 2: Independent Normalization

Both metrics use the same `_compute_difficulty_score(team_value, min_value, max_value)` helper but with **different inputs**:
- `attacking_difficulty` per team = `_compute_difficulty_score(team_xga[t], min_xga, max_xga)` ← unchanged from existing `difficulty_score`
- `defensive_difficulty` per team = `_compute_difficulty_score(team_xgs[t], min_xgs, max_xgs)` ← NEW, where `team_xgs` is the 3-game rolling goals-scored avg

Each metric has its own min/max, computed independently across the 20 teams.

**Convention:** 0.0 = easiest fixture, 1.0 = hardest fixture. Both metrics follow this convention so the ease bar in UI is `1 - difficulty` (high ease = low difficulty).

### Pattern 3: Reuse `GwToggle.tsx`

`src/components/gem-table/GwToggle.tsx` is the canonical 1GW/3GW/5GW pill toggle. Two viable approaches:

**Option A (pragmatic — recommended):** Import `GwToggle` directly from `@/components/gem-table/GwToggle`. The component is generic enough (it just emits values 1, 3, or 5 via `onChange`); the `getColumnVisibility` helper exported from the same file is unused outside of GemTable contexts. No refactor needed.

**Option B (cleaner — optional):** Move `GwToggle` to `src/components/ui/GwToggle.tsx` (or `src/components/shared/`) since it's now used in two places. The `MOBILE_HIDDEN_COLUMNS` constant stays in gem-table. This is a tidy refactor but not required for the phase.

For the ATT/DEF toggle, **mirror the structure** of `GwToggle` exactly — same wrapper div classes, same button styling, same `aria-pressed` and `min-h-[44px]` (mobile tap target) pattern. This keeps the two pills visually consistent in the panel header.

### Pattern 4: Tier Color Reuse

`FixtureBadges.tsx` defines:
```typescript
const TIER_COLOURS: Record<string, string> = {
  easy:   'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  hard:   'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
}
```

For the ease bar, reuse this palette but apply it to a horizontal bar (e.g., `<div className={"h-2 rounded " + TIER_BG[tier]} style={{ width: `${ease * 100}%` }} />`). Extract `TIER_COLOURS` (or a stripped-down `TIER_BG`) into `src/lib/difficulty-colors.ts` so both components import it. **Do not** duplicate the colour strings.

### Anti-Patterns to Avoid

- **Don't** rename or remove the existing `difficulty_score` field. Six+ consumers (gem-score, defcon, planning-engine, captaincy-engine, FixtureBadges, ClubFormTable) read it [VERIFIED via grep]. The phase is additive only.
- **Don't** invent new colour classes. Reuse the green/amber/red palette from `FixtureBadges`.
- **Don't** create a new API route or hook. Extend `/api/club-form` and `useClubForm`.
- **Don't** make ATT/DEF a global setting. The toggle is panel-scoped (D-10) — keep state local in the panel component.
- **Don't** store ease arrays per-fixture. They are per-team aggregates over a window — store on the `ClubForm` row, not on each `ClubFormFixture`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Difficulty normalisation | Custom min-max scaler in JS or Python | `_compute_difficulty_score()` (Python) and the inline `diffScore` lambda (TS) | Already battle-tested, consistent with existing `difficulty_score` |
| Tier classification | Custom percentile bucketing | `_difficulty_tier()` (Python) and the inline `tier` lambda (TS) | Same percentile-based approach as existing tier; reuse the function |
| GW pill toggle | New toggle component | `GwToggle.tsx` from gem-table | Already has correct mobile tap target (`min-h-[44px]`), aria-pressed, dark mode |
| Pill toggle styling for ATT/DEF | Custom pill | Mirror `GwToggle` structure verbatim (same wrapper, same button classes) | Visual consistency in the header |
| Difficulty colours | New colour scheme | Extract `TIER_COLOURS` from `FixtureBadges.tsx` into a shared module | Single source of truth |
| Data fetching | New `useFixtureEase` hook + new route | Extend `useClubForm` (already cached 6h via React Query) | Cache key already in place; backend already loads needed JSON |
| `isMobile` detection | New media query hook | Pattern from `ClubFormTable.tsx` (lines 19-25): `useState` + `window.innerWidth < 640` + resize listener | Already proven in this exact tab |

**Key insight:** Phase 27 is almost entirely additive plumbing on top of code that already exists. The most valuable work is identifying patterns to reuse and being disciplined about not introducing parallel implementations.

## Runtime State Inventory

This phase is **additive**, not a rename/refactor. No state-renaming actions are required. For completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by grep for `difficulty_score`/`difficulty_tier` (only emitted by the pipeline; never used as a key) | None |
| Live service config | None — pipeline runs locally or via cron, no UI-managed config | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars; `USE_BLOB` already handles local/blob routing | None |
| Build artifacts | None — no package rename | None |

**Forward-compatibility note:** `merged_players.json` is consumed by other code paths (e.g., the `/api/players` route, gem-score). Adding two new optional fields to fixture entries is **backwards-compatible** as long as TypeScript types mark them optional during the rollout (and required after pipeline regenerates). The pipeline writes to a Blob (production) or local cache; clients always read the latest version, so a one-shot pipeline rerun upgrades all consumers atomically.

## Common Pitfalls

### Pitfall 1: Forgetting to mirror the pipeline change in `club-form.ts`

**What goes wrong:** Pipeline correctly emits `attacking_difficulty`/`defensive_difficulty` to `merged_players.json`, but the `/api/club-form` API still returns only the old `difficulty_score`. UI panel shows wrong/missing data.

**Why it happens:** The two files (`pipeline/merge.py` and `src/lib/club-form.ts`) have parallel implementations of the same math. They are separate code paths, not a shared module. A developer who edits only one will silently break consistency.

**How to avoid:**
1. Make BOTH file edits in the same task in the plan.
2. Add a unit test in `tests/lib/club-form.test.ts` that asserts the new fields are present on each `ClubFormFixture` AND that `attacking_ease_NGW` / `defensive_ease_NGW` are present on each `ClubForm` row.
3. In the plan, list `pipeline/merge.py` and `src/lib/club-form.ts` together in a "must-edit-as-pair" task.

**Warning signs:** TypeScript compile passes (because new fields are optional), but the panel renders zeros or NaN.

### Pitfall 2: BGW window underflow

**What goes wrong:** A team has only 2 finished or upcoming fixtures in the next 5 GWs (e.g., during a BGW run). Computing `mean(empty)` returns NaN.

**Why it happens:** Naive `array.reduce((a,b)=>a+b, 0) / array.length` divides by zero when the slice is empty.

**How to avoid:**
- Always guard: `lastN.length > 0 ? sum/length : null`.
- For ease arrays in `ClubForm`, return `null` when no fixtures exist in the window, not 0 or NaN. UI must handle `null` (e.g., render "—" or skip the row).
- Decision D-Discretion: "exclude missing fixtures from the average" → take the mean over `min(N, available)` fixtures; if `available === 0`, return `null`.

**Warning signs:** UI shows full red bars or NaN labels for teams during a BGW.

### Pitfall 3: Comparing `attacking_difficulty` to `defensive_difficulty` numerically

**What goes wrong:** Code or UI assumes `attacking_difficulty=0.5` and `defensive_difficulty=0.5` are equivalent. They are NOT — each is normalized on its own scale.

**Why it happens:** Both fields share the 0–1 range and the "0=easy, 1=hard" convention, so it's tempting to mix or average them.

**How to avoid:**
- Never combine the two metrics into a composite without explicit thought.
- The ATT/DEF toggle is an EITHER/OR view, not an average.
- Document the independence clearly in JSDoc on the type.

**Warning signs:** Suspicious composite ratings; teams that look "average" on both metrics ranking strangely.

### Pitfall 4: Forgetting to preserve existing `difficulty_score` field

**What goes wrong:** Developer "tidies up" by replacing `difficulty_score` with `attacking_difficulty`. Six+ consumers break.

**Why it happens:** It's tempting to think the new field replaces the old.

**How to avoid:**
- The phase is **additive only** [from CONTEXT.md D-01]. Treat `difficulty_score` as immutable.
- Add the new fields, don't remove the old.
- A grep for `difficulty_score` should show it still present in `merged_players.json` after pipeline run.

**Warning signs:** Test failures in `tests/lib/gem-score.test.ts`, `tests/lib/explain.test.ts`, `tests/lib/captaincy-engine.test.ts`, `tests/lib/planning-engine.test.ts`, `tests/lib/recommend.test.ts`, `tests/lib/replacement-shortlist.test.ts`.

### Pitfall 5: ATT/DEF state leaking into ClubFormTable

**What goes wrong:** The ATT/DEF toggle changes state at a parent level (page or tab), unintentionally affecting `FixtureBadges` rendering inside `ClubFormTable`.

**Why it happens:** State is hoisted higher than necessary.

**How to avoid:**
- Keep ATT/DEF and 1/3/5 state inside `FixtureEaseRankingPanel` only (`useState`).
- `ClubFormTable` does NOT receive these props.
- Decision D-10 explicitly scopes the ATT/DEF toggle to the panel.

**Warning signs:** Existing `FixtureBadges` colours change when toggling ATT/DEF.

### Pitfall 6: Ease bar visualisation contradicting tier color

**What goes wrong:** The bar uses a continuous green-to-red gradient, but the tier colour comes from a discrete classifier. The bar may appear amber while the tier label says "easy."

**Why it happens:** Two independent visual encodings of the same value.

**How to avoid:**
- Choose ONE encoding per row: tier-coloured bar (discrete) OR a continuous gradient.
- Recommended: tier-coloured background with width proportional to ease (continuous within tier).
- If both are used, derive both from the same value and the same tier function.

### Pitfall 7: Mobile breakpoint inconsistency

**What goes wrong:** New panel uses a different mobile breakpoint than `ClubFormTable`, causing one to wrap awkwardly while the other doesn't.

**Why it happens:** `ClubFormTable.tsx` uses `window.innerWidth < 640` (line 21) for `isMobile`, while Tailwind's `sm:` prefix is `>= 640px`. Using `md:` (`>= 768px`) instead would break alignment.

**How to avoid:**
- Match the existing `ClubFormTable` pattern: `< 640px` is mobile.
- Use Tailwind's `sm:` classes for the panel.

## Code Examples

### Pipeline modification (Python)

```python
# pipeline/merge.py — additions inside merge_players()

ROLLING_WINDOW = 6        # existing — for goals-conceded (defensive xGA proxy)
OFFENSIVE_ROLLING = 3     # NEW — for goals-scored (offensive proxy)

# Existing: team_goals_conceded → team_xga (already present, unchanged)

# NEW: parallel team_goals_scored loop
team_goals_scored: dict[int, list[int]] = {t_id: [] for t_id in teams}
for fix in finished:
    h_id = fix['team_h']
    a_id = fix['team_a']
    h_score = fix.get('team_h_score') or 0
    a_score = fix.get('team_a_score') or 0
    if h_id in team_goals_scored:
        team_goals_scored[h_id].append(h_score)   # home team scored own goals
    if a_id in team_goals_scored:
        team_goals_scored[a_id].append(a_score)   # away team scored own goals

# 3-game rolling avg goals scored per team — "offensive proxy"
team_xgs: dict[int, float] = {}
for t_id, scored_list in team_goals_scored.items():
    last_n = scored_list[-OFFENSIVE_ROLLING:]
    team_xgs[t_id] = sum(last_n) / len(last_n) if last_n else 0.0

# Independent normalization for defensive_difficulty
xgs_values = sorted(team_xgs.values())
min_xgs = min(xgs_values) if xgs_values else 0.0
max_xgs = max(xgs_values) if xgs_values else 1.0

# defensive_difficulty per team:
# 0.0 = easiest (opponent scores fewest goals → easy to keep CS)
# 1.0 = hardest (opponent scores most goals → hard to keep CS)
defensive_difficulty_scores: dict[int, float] = {}
for t_id in teams:
    xgs = team_xgs.get(t_id, 0.0)
    # NOTE: invert convention so high goals scored → high difficulty (hard fixture for opp DEF)
    if max_xgs == min_xgs:
        defensive_difficulty_scores[t_id] = 0.5
    else:
        defensive_difficulty_scores[t_id] = (xgs - min_xgs) / (max_xgs - min_xgs)
        # NB: NOT inverted with `1 -`. Why? team_xga uses `1 - (xga - min) / (max - min)`
        # because high xGA = easy to attack = LOW difficulty. For team_xgs we want
        # high xgs = hard to keep CS = HIGH difficulty, so no inversion.
        # Verify direction in tests.

# Build a parallel tier classifier on defensive_difficulty
# (use the same _difficulty_tier helper, with percentile thresholds derived from xgs_values)

# In the team_fixtures.append() blocks, add the two new fields:
team_fixtures[h_id].append({
    'opponent_team': teams[opp_id]['short_name'] if opp_id in teams else str(opp_id),
    'is_home': True,
    'event_id': event_id,
    'difficulty_score': difficulty_scores.get(opp_id, 0.5),         # existing
    'difficulty_tier': difficulty_tiers.get(opp_id, 'medium'),       # existing
    'attacking_difficulty': difficulty_scores.get(opp_id, 0.5),      # NEW — same as difficulty_score
    'defensive_difficulty': defensive_difficulty_scores.get(opp_id, 0.5),  # NEW
})
```

**Note on the inversion subtlety:** Existing `_compute_difficulty_score(team_xga, min, max)` returns `1.0 - (xga - min)/(max - min)` because xGA-of-OPPONENT is what's stored, and high xGA means easy fixture. For `defensive_difficulty`, we want the opposite direction — high goals-scored-by-opponent means hard to keep a CS. The cleanest path is either (a) write a small `_compute_offensive_difficulty()` that doesn't invert, or (b) reuse `_compute_difficulty_score()` but pass `(team_xgs, max_xgs, min_xgs)` swapped (mathematically equivalent inversion). Pick one in the plan and document it.

### TypeScript types

```typescript
// src/lib/types.ts — extensions

// Existing FixtureEntry (unchanged fields) + 2 new optional fields
export interface FixtureEntry {
  opponent_team: string
  is_home: boolean
  event_id: number
  difficulty_score: number              // existing
  difficulty_tier: DifficultyTier       // existing
  attacking_difficulty?: number         // NEW (optional during rollout, required after pipeline rerun)
  defensive_difficulty?: number         // NEW
}

// Same additions for ClubFormFixture (used by computeClubForm output)
export interface ClubFormFixture {
  opponent_team: string
  is_home: boolean
  event_id: number
  difficulty_score: number
  difficulty_tier: DifficultyTier
  attacking_difficulty: number          // populated by computeClubForm — required
  defensive_difficulty: number
}

// Extended ClubForm with per-window aggregates
export interface ClubForm {
  team_id: number
  team_name: string
  team_short_name: string
  wins: number
  draws: number
  losses: number
  goals_scored: number
  goals_conceded: number
  upcoming_fixtures: ClubFormFixture[]
  // NEW — per-team ease aggregates (null when team has no fixtures in the window)
  attacking_ease_1gw: number | null      // 1.0 = easiest, 0.0 = hardest
  attacking_ease_3gw: number | null
  attacking_ease_5gw: number | null
  defensive_ease_1gw: number | null
  defensive_ease_3gw: number | null
  defensive_ease_5gw: number | null
}
```

**On naming `_difficulty` vs `_ease`:** The pipeline emits `*_difficulty` (0=easy, 1=hard). The aggregate exposed in `ClubForm` is `*_ease` (1=easy, 0=hard) so that "higher = easier" is intuitive in UI sorting/colouring. Convert at the aggregation step: `ease = 1 - difficulty`. Document this clearly in JSDoc.

### TypeScript aggregation

```typescript
// src/lib/club-form.ts — sketch of the new aggregation block

// After teamUpcoming is populated with ClubFormFixture[] (each entry now has
// attacking_difficulty and defensive_difficulty), aggregate per team per window:

function meanEase(fixtures: ClubFormFixture[], n: number, key: 'attacking_difficulty' | 'defensive_difficulty'): number | null {
  const slice = fixtures.slice(0, n)
  const present = slice.filter(f => typeof f[key] === 'number')
  if (present.length === 0) return null
  const meanDifficulty = present.reduce((acc, f) => acc + (f[key] as number), 0) / present.length
  return 1 - meanDifficulty   // convert to ease
}

// In the result-building loop:
result.push({
  team_id: tId,
  team_name: t.name,
  team_short_name: t.short_name,
  wins, draws, losses,
  goals_scored: gs,
  goals_conceded: gc,
  upcoming_fixtures: teamUpcoming.get(tId) ?? [],
  attacking_ease_1gw: meanEase(teamUpcoming.get(tId) ?? [], 1, 'attacking_difficulty'),
  attacking_ease_3gw: meanEase(teamUpcoming.get(tId) ?? [], 3, 'attacking_difficulty'),
  attacking_ease_5gw: meanEase(teamUpcoming.get(tId) ?? [], 5, 'attacking_difficulty'),
  defensive_ease_1gw: meanEase(teamUpcoming.get(tId) ?? [], 1, 'defensive_difficulty'),
  defensive_ease_3gw: meanEase(teamUpcoming.get(tId) ?? [], 3, 'defensive_difficulty'),
  defensive_ease_5gw: meanEase(teamUpcoming.get(tId) ?? [], 5, 'defensive_difficulty'),
})
```

### FixtureEaseRankingPanel sketch

```typescript
// src/components/club-form/FixtureEaseRankingPanel.tsx (NEW)
'use client'
import { useState } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { GwToggle } from '@/components/gem-table/GwToggle'  // reused
import { AttDefToggle } from './AttDefToggle'                // new

type Window = 1 | 3 | 5
type Mode = 'ATT' | 'DEF'

function tierFromEase(ease: number): 'easy' | 'medium' | 'hard' {
  if (ease >= 0.66) return 'easy'
  if (ease <= 0.33) return 'hard'
  return 'medium'
}

const TIER_BG = {
  easy:   'bg-green-500',
  medium: 'bg-amber-500',
  hard:   'bg-red-500',
}

export function FixtureEaseRankingPanel() {
  const { data, isLoading, error } = useClubForm()
  const [window, setWindow] = useState<Window>(3)
  const [mode, setMode] = useState<Mode>('ATT')

  if (isLoading) return <p className="text-zinc-500">Loading fixture ease...</p>
  if (error || !data) return null

  const key = `${mode === 'ATT' ? 'attacking' : 'defensive'}_ease_${window}gw` as const
  const ranked = [...data]
    .filter(t => t[key] != null)
    .sort((a, b) => (b[key] as number) - (a[key] as number))   // easiest first

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-xl font-bold">Fixture Ease Ranking</h2>
        <div className="flex gap-2 items-center">
          <AttDefToggle value={mode} onChange={setMode} />
          <GwToggle value={window} onChange={setWindow} />
        </div>
      </div>
      <ul className="space-y-1">
        {ranked.map((team, i) => {
          const ease = team[key] as number
          const tier = tierFromEase(ease)
          return (
            <li key={team.team_id} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right text-zinc-500">{i + 1}</span>
              <span className="w-12 font-mono">{team.team_short_name}</span>
              <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                <div
                  className={`h-full ${TIER_BG[tier]}`}
                  style={{ width: `${ease * 100}%` }}
                  aria-label={`Ease ${(ease * 100).toFixed(0)}%`}
                />
              </div>
              <span className="w-10 text-right text-xs text-zinc-500">{(ease * 100).toFixed(0)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

### Mounting in the page

```typescript
// src/app/page.tsx — modify the club-form tab content
{activeTab === 'club-form' && (
  <>
    <FixtureEaseRankingPanel />
    <ClubFormTable />
  </>
)}
```

## State of the Art

This phase uses well-established patterns in the codebase. No external "state of the art" applies — the design is internal consistency, not novel technology.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `difficulty_score` (xGA-only) | Adds `attacking_difficulty` (= existing) and new `defensive_difficulty` (3-game goals-scored) | Phase 27 | UI can split fixture difficulty by player position |
| Single FDR badge in ClubFormTable | Adds a Fixture Ease Ranking panel above with ATT/DEF + 1/3/5GW toggles | Phase 27 | Manager can quickly see who has the best run |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `defensive_difficulty` should NOT be inverted with `1 -` (high goals scored → high difficulty), unlike `attacking_difficulty` which IS inverted | Code Examples / Pipeline | Tier colours could be reversed (easy fixtures show red). Verifiable via test on a known low-scoring team. **Resolve by:** writing the test BEFORE the implementation. |
| A2 | The pipeline already runs daily and `merged_players.json` will be regenerated within hours of deploy, so optional-typed fields will be required-shaped before any user sees the new UI | Architecture Patterns / Forward-compatibility | If pipeline rerun is delayed, UI shows blanks. **Resolve by:** Plan should sequence pipeline + UI together, or UI should gracefully handle missing fields. |
| A3 | `GwToggle` from gem-table can be imported and reused in FixtureEaseRankingPanel without refactor | Pattern 3 | If there's a hidden coupling (e.g., it expects to live inside a TanStack table context), reuse will fail. **Verified:** GwToggle.tsx is purely presentational with `value`/`onChange` props (lines 35-63). [VERIFIED: read of GwToggle.tsx] |
| A4 | The ease bar should sort easiest-first (descending ease, ascending difficulty) because users want to see "who has the best run" at the top | Code Examples / Panel sketch | If users expect hardest-first sort, panel feels backwards. **Defaults are reversible:** the panel uses local state and could expose a sort direction later. |
| A5 | BGW handling: returning `null` for an ease-window with no fixtures (and the UI filtering those teams out of the ranked list) is preferable to a "—" placeholder row | Pitfall 2 | Some users may want to see all 20 teams always. **Alternative:** keep the row but show "BGW" instead of a bar. |

## Open Questions (RESOLVED)

1. **Should `defensive_difficulty` use the same `_difficulty_tier()` percentile thresholds (bottom third easy / top third hard), or different thresholds?**
   - What we know: CONTEXT.md says "tier thresholds use the same percentile-based approach"
   - What's unclear: whether the same `easy_idx`/`hard_idx` integers (n*1/3 and n*2/3) apply to both metrics, or whether each metric has its own set of indices computed from its own `xgs_values` sorted list
   - Recommendation: Each metric is independently normalized, so each metric should compute its own thresholds from its own sorted values. This is consistent with D-04 ("each on its own scale").
   - RESOLVED: Independent percentile thresholds per metric — each of `attacking_difficulty` and `defensive_difficulty` computes its own `easy_idx`/`hard_idx` from its own sorted values list (consistent with D-04). Plans 27-01/27-02 reflect this.

2. **Where should the `OFFENSIVE_ROLLING` constant live in TS?**
   - What we know: `ROLLING_WINDOW = 6` is currently inline in `club-form.ts` (line 45) and also in `merge.py` (line 174).
   - What's unclear: whether the new constant should be inline too or hoisted to a shared module
   - Recommendation: Stay consistent — keep both constants inline in `club-form.ts` for symmetry with the existing ROLLING constant. Document the shared semantics in JSDoc above.
   - RESOLVED: Inline constant in `club-form.ts` — `OFFENSIVE_ROLLING = 3` declared inline alongside the existing `ROLLING = 6`, with JSDoc documenting shared semantics. Plan 27-01 Task 2 reflects this.

3. **Should the panel show a header row with "Rank | Team | Ease %" labels?**
   - What we know: D-06 says "rank number, team short name, and a colored ease bar"
   - What's unclear: whether to show numeric ease values too (e.g., "78%") or just the bar
   - Recommendation: Include a small numeric label for accessibility (screen readers, colour-blind users). Show as percentage right-aligned. The plan can decide the exact format.
   - RESOLVED: Include numeric ease percentage label — each row renders rank + team short name + EaseBar + right-aligned percentage value (e.g. "78"). Plan 27-02 Task 2 reflects this in the row rendering.

## Environment Availability

This phase has no external dependencies. All work is in existing files using existing tooling.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next.js dev | ✓ | (per package.json — Node 20+ implied) | — |
| Python 3 | `pipeline/merge.py` | ✓ | Pipeline already runs in this project | — |
| FPL fixtures.json | `_compute_difficulty_score`, `computeClubForm` | ✓ | Already in `pipeline/cache/fpl_fixtures.json` | — |
| FPL bootstrap.json | Team metadata | ✓ | Already in `pipeline/cache/fpl_bootstrap.json` | — |
| Understat | NOT REQUIRED for this phase | — | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- club-form.test.ts` |
| Full suite command | `npm test` |
| Python tests | None — `pipeline/` has no test suite. Pipeline correctness is verified indirectly through the TS mirror in `club-form.test.ts` and via end-to-end execution. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DATA-01 | `merged_players.json` fixture entries contain `attacking_difficulty` and `defensive_difficulty` | unit (TS, mirrored math) — assert `computeClubForm` upcoming_fixtures contain both new fields | `npm test -- club-form.test.ts -t "FDR\+\+"` | Wave 0 — extend tests/lib/club-form.test.ts |
| DATA-01 | Existing `difficulty_score` field unchanged | unit | Existing tests in tests/lib/{gem-score,explain,captaincy-engine,planning-engine,recommend,replacement-shortlist}.test.ts pass unchanged | Existing |
| DATA-01 (pipeline) | `merge_players()` Python emits new fields | smoke / manual: run `python pipeline/run.py` and grep for `attacking_difficulty` in `pipeline/cache/merged_players.json` | manual — `python pipeline/run.py && python -c "import json; d=json.load(open('pipeline/cache/merged_players.json'))[0]; assert 'attacking_difficulty' in d['fixtures'][0]"` | Wave 0 — manual smoke step in plan |
| FIX-01 | `ClubForm` rows include `attacking_ease_1gw`, `attacking_ease_3gw`, `attacking_ease_5gw`, `defensive_ease_1gw`, `defensive_ease_3gw`, `defensive_ease_5gw` | unit | `npm test -- club-form.test.ts -t "ease arrays"` | Wave 0 — new test cases |
| FIX-01 | BGW handling — team with fewer than N fixtures returns ease over available, not zero | unit | `npm test -- club-form.test.ts -t "BGW"` | Wave 0 — new test case |
| FIX-01 | Panel renders 20 teams sorted easiest-first by selected metric | component | `npm test -- FixtureEaseRankingPanel.test.tsx` | Wave 0 — new file `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` |
| FIX-01 | 1GW/3GW/5GW toggle switches metric and re-sorts | component | same as above | Wave 0 |
| FIX-02 | ATT/DEF toggle switches between attacking and defensive ease | component | same as above | Wave 0 |
| FIX-02 | ATT is the default state | component | same as above | Wave 0 |
| FIX-02 (regression) | Existing `FixtureBadges` colours in ClubFormTable do NOT change when ATT/DEF toggle is flipped (state scoping) | manual / e2e — visual smoke | manual visual check | Wave 0 — note in plan |

### Sampling Rate

- **Per task commit:** `npm test -- club-form.test.ts FixtureEaseRankingPanel` (~5s)
- **Per wave merge:** `npm test` (full suite, ~30s)
- **Phase gate:** `npm test` green + manual visual check on the Form tab in dev server (`npm run dev` → http://localhost:3000 → click Club Form tab → toggle ATT/DEF and 1/3/5GW)

### Wave 0 Gaps

- [ ] Extend `tests/lib/club-form.test.ts` — add 4-5 cases:
  - "FDR++ — emits attacking_difficulty and defensive_difficulty per fixture entry"
  - "FDR++ — defensive_difficulty uses 3-game goals-scored window (not 6)"
  - "FDR++ — ease arrays present for 1GW/3GW/5GW windows on each ClubForm row"
  - "FDR++ — BGW: team with no upcoming fixture in window returns null ease"
  - "FDR++ — high-scoring opponent yields low defensive_ease (hard to keep CS)"
- [ ] New file `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` — smoke render + toggle interaction (uses React Testing Library; check what's already used in tests/components/planner/ for the pattern). Confirm @testing-library/react is/isn't installed; if not, install in Wave 0 task.
- [ ] No Python pytest infrastructure — keep pipeline validation as a manual smoke step, run from the plan's verify task.

**Tooling check needed in Wave 0:** verify whether @testing-library/react is already a devDependency. (`npm ls @testing-library/react` — if missing, add it. Currently package.json shows only `vitest` and `@vitest/ui`; component tests may need RTL.)

## Sources

### Primary (HIGH confidence — codebase verified)

- `pipeline/merge.py` lines 1-428 — full file read, confirms `_compute_difficulty_score`, `_difficulty_tier`, `ROLLING_WINDOW=6`, `team_fixtures` shape including `difficulty_score`/`difficulty_tier` keys at lines 256-275
- `pipeline/run.py` lines 91-194 — pipeline entry; confirms `merge_players` is called with `xmins_stats` and `summaries`, output saved to `merged_players.json`
- `src/lib/club-form.ts` lines 1-138 — full file; confirms parallel TS implementation, `WINDOW=5`, `LOOKAHEAD=5`, `ROLLING=6`, `diffScore`/`tier` helpers
- `src/lib/types.ts` lines 72-194 — `DifficultyTier`, `FixtureEntry`, `ClubFormFixture`, `ClubForm` interfaces verbatim
- `src/components/club-form/ClubFormTable.tsx` — full file; confirms the existing tab structure, `isMobile` pattern, `LastUpdated` placement
- `src/components/club-form/columns.tsx` — full file; confirms `FixtureBadges` is mounted inside the upcoming column
- `src/components/fixtures/FixtureBadges.tsx` — full file; confirms TIER_COLOURS palette
- `src/components/gem-table/GwToggle.tsx` — full file; confirms reusable pill structure with `value: 1 | 3 | 5`, `onChange`, `aria-pressed`, `min-h-[44px]`
- `src/app/api/club-form/route.ts` — full file; confirms route loads `fpl_fixtures.json` + `fpl_bootstrap.json` (NOT merged_players.json)
- `src/app/page.tsx` — confirms `'club-form'` tab key, mounting of `<ClubFormTable />` at line 109; new panel mounts here
- `src/lib/hooks/useClubForm.ts` — confirms React Query hook with 6h staleTime
- `tests/lib/club-form.test.ts` — confirms vitest pattern and existing fixture-difficulty assertions to mirror
- `pipeline/cache/merged_players.json` — confirms current emitted structure of fixture entries (sample inspected)
- `package.json` — confirms vitest 4.1.2, react 19.2.4, next 16.2.1
- `vitest.config.ts` — confirms test environment is `node` (component tests will need jsdom or happy-dom; verify in Wave 0)
- `.planning/phases/27-fdr-plus-plus-pipeline/27-CONTEXT.md` — locked decisions D-01 through D-10
- `.planning/REQUIREMENTS.md` — DATA-01, FIX-01, FIX-02 verbatim text

### Secondary (MEDIUM confidence)

- Cross-check via grep: `difficulty_score` consumers in `tests/lib/*.test.ts` and `pipeline/defcon.py` — confirms 6+ consumers depend on the field staying present and unchanged

### Tertiary (LOW confidence)

- None. All claims in this research are codebase-grounded; no WebSearch was needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — fully verified from package.json + grep
- Architecture: HIGH — both pipeline and TS implementation read directly
- Pitfalls: MEDIUM-HIGH — derived from observed parallel implementations and locked decisions; one pitfall (A1 — inversion direction) is the highest-risk and explicitly flagged
- Validation: MEDIUM — vitest is present and used, but component-test tooling (@testing-library/react, jsdom/happy-dom) needs Wave 0 verification

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable codebase research; revisit if pipeline structure changes or if Phase 26 introduced any unforeseen migration)
