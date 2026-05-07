# Phase 77: Pitch Visuals & Mobile Polish - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Three distinct deliverables:
1. **OPT-02** — LineupTab `PlayerCard` displays a real FPL kit image (shirt) alongside the player name with a TEAM_COLOURS coloured div as the fallback when the image is unavailable or fails to load
2. **POL-01** — Captain sections on both the Decision tab (`DecisionSummaryTab` captain card) and the Planner tab (`CaptainPicksPanel` EOModeToggle) no longer overflow their containers on desktop
3. **POL-02 / POL-03** — `AccuracyTab` gets an `overflow-x-auto` wrapper (known missing piece; RivalsTab and ValueGemsTable already have it); full mobile layout audit at 430px viewport verified by Playwright assertions on each major tab

No pipeline changes — all data needed (`team_short_name` → `TEAM_BADGE_CODE` → kit URL) is available client-side.

</domain>

<decisions>
## Implementation Decisions

### Kit Art Source (OPT-02)
- **D-01:** Kit image URL pattern confirmed: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{team_code}-66.png` (verified 200 for Arsenal/3, Liverpool/14, Man City/43). Add a `teamKitUrl(teamCode: number): string` helper to `src/lib/fpl-images.ts` consistent with existing `playerImageUrl` and `teamBadgeUrl` helpers.
- **D-02:** Team code is derived at render time from `TEAM_BADGE_CODE[player.team_short_name]` (already in `src/lib/team-colours.ts`). No pipeline changes, no new fields on `MergedPlayer`.
- **D-03:** Use a plain `<img>` tag with an `onError` handler — consistent with existing `playerImageUrl` / `teamBadgeUrl` patterns in the codebase. Do NOT use Next.js `<Image>` (would require adding `fantasy.premierleague.com` to `next.config` remotePatterns).
- **D-04:** On `onError`, hide the `<img>` and render a coloured `<div>` using `TEAM_COLOURS[player.team_short_name].primary` as the background. This is the "coloured placeholder" in the success criterion.

### Kit Placement in PlayerCard (OPT-02)
- **D-05:** Layout is **flex-row inside the card body**: small kit image (~24–28px wide, scaled from the 66px source) on the left, player name + xPts + start% stacked on the right. Card body remains the same height; the text column narrows slightly.
- **D-06:** Kit image renders in the **card body only**. The Set C / Set VC pill buttons row below is unchanged.

### Captain Card Overflow Fix (POL-01)
- **D-07:** Decision tab captain card (`DecisionSummaryTab.tsx`): add `flex-wrap` to the candidate row that currently uses `sm:flex-row sm:items-center sm:gap-3`. Badges and pts wrap to a second line when the card is narrow — card expands vertically, no clipping.
- **D-08:** Planner tab EOModeToggle (`CaptainPicksPanel.tsx`): add `flex-wrap` to the `inline-flex` button group so the four buttons (Max xPts / Protect Rank / Chase Rank / Differential) can wrap at narrow desktop widths.

### Mobile Audit Approach (POL-02 / POL-03)
- **D-09:** `AccuracyTab.tsx` must get an `overflow-x-auto` wrapper around its table — this is the known missing piece (RivalsTab.tsx line 96 and ValueGemsTable.tsx line 21 already have it; AccuracyTab does not).
- **D-10:** Mobile verification is via **Playwright viewport assertions at 430px** asserting `document.body.scrollWidth <= window.innerWidth` (no horizontal scroll) on each major tab. Tests live alongside existing Playwright tests.

### Claude's Discretion
- Exact pixel size of the kit image within the card (targeting ~24–28px wide); ensure image is `object-contain` and aspect ratio doesn't distort the shirt silhouette
- Whether to use a `state` boolean or CSS-only `hidden`/`block` to toggle between `<img>` and fallback `<div>`
- Exact Playwright test file placement and whether to group the 430px assertions in a single describe block or per-tab files

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 77 — Goal, success criteria, OPT-02/POL-01/POL-02/POL-03 requirement mapping
- `.planning/REQUIREMENTS.md` §OPT-02, §POL-01, §POL-02, §POL-03 — full requirement text

### Kit Art (primary targets)
- `src/lib/fpl-images.ts` — add `teamKitUrl(teamCode: number): string` here; existing helpers `playerImageUrl` and `teamBadgeUrl` are the pattern to follow
- `src/lib/team-colours.ts` — `TEAM_BADGE_CODE` (short_name → team_code lookup) and `TEAM_COLOURS` (primary/secondary hex for fallback div); `getTeamColour(shortName)` is the existing helper
- `src/components/squad/LineupTab.tsx` — `PlayerCard` sub-component (lines 38–116); `PlayerCardProps` interface (lines 23–36); the card body is `flex flex-col` with `min-h-[64px]`, `max-w-[96px]`

### Captain Overflow (primary targets)
- `src/components/squad/DecisionSummaryTab.tsx` — captain card section from line 491; candidate rows at ~line 509 using `sm:flex-row sm:items-center sm:gap-3` → add `flex-wrap`
- `src/components/captaincy/CaptainPicksPanel.tsx` — `EOModeToggle` component (lines 32–60); `inline-flex` button group at line 39 → add `flex-wrap`

### Mobile Overflow (primary targets)
- `src/components/accuracy/AccuracyTab.tsx` — missing `overflow-x-auto` wrapper; `TABLE_CLS = 'w-full text-sm border-collapse'` at line 68; add wrapper around the table render
- `src/components/rivals/RivalsTab.tsx` line 96 — `overflow-x-auto` pattern to replicate
- `src/components/value-gems/ValueGemsTable.tsx` line 21 — same pattern

### Mobile Test Infrastructure
- `src/components/gem-table/GemTable.tsx` line 204 — existing `overflow-x-auto` wrapper on GemTable (POL-02 verifies this holds at 430px)
- Existing Playwright test files (agent: find existing `.spec.ts` or `.test.ts` in `playwright/` or `e2e/` directories to determine correct co-location for new 430px assertions)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TEAM_BADGE_CODE` record in `src/lib/team-colours.ts` — maps `team_short_name` (e.g. "ARS") → FPL team code (e.g. 3); use for kit URL construction
- `TEAM_COLOURS` record in `src/lib/team-colours.ts` — `primary` hex per team; use for `<div>` fallback background colour
- `getTeamColour(shortName)` in `src/lib/team-colours.ts` — already handles unknown teams with a grey fallback (`#71717A`)
- `playerImageUrl(code)` / `teamBadgeUrl(teamCode)` in `src/lib/fpl-images.ts` — pattern for the new `teamKitUrl` helper (same CDN domain structure)

### Established Patterns
- `<img>` + `onError` pattern: used in the codebase for FPL player/badge images; kit image must follow same pattern
- `min-h-[44px]` on interactive elements: already enforced on Set C / Set VC pills (line 51 of `LineupTab.tsx`); maintain this on any new tap targets in the kit layout
- `overflow-x-auto` table wrapper: established in `RivalsTab.tsx` (line 96) and `ValueGemsTable.tsx` (line 21) — replicate for `AccuracyTab.tsx`

### Integration Points
- `PlayerCard` receives `player: MergedPlayer` which has `team_short_name` — sufficient for both `TEAM_BADGE_CODE` lookup and `getTeamColour()` fallback; no prop changes needed
- `DecisionSummaryTab` candidate rows already have `data-testid="captain-card"` on the outer card (line 496) — useful for Playwright selectors in mobile tests
- `GemTable.tsx` already has `overflow-x-auto` at line 204 — verify at 430px but likely already correct; AccuracyTab is the fix target

</code_context>

<specifics>
## Specific Ideas

- Kit URL format confirmed by developer during discussion: `shirt_{team_code}-66.png` suffix (`-66` appears to be a size/variant code). The URL resolves on `fantasy.premierleague.com/dist/img/shirts/standard/` path.
- Fallback colour is the team's `primary` hex from `TEAM_COLOURS` — the user explicitly confirmed this over a generic grey.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 77-Pitch-Visuals-Mobile-Polish*
*Context gathered: 2026-05-07*
