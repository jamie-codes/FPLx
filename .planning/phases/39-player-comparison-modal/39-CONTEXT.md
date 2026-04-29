# Phase 39: Player Comparison Modal - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a player comparison modal that a user can open from any GemTable row to view two players side by side across xPts projections, Gem score components, next-5 fixtures, and buy/sell/diff/trap signals. Player A is the row they clicked; Player B is chosen via a search field inside the modal. No new API routes — all data comes from the existing `usePlayers()` hook.

</domain>

<decisions>
## Implementation Decisions

### Compare Icon Trigger
- **D-01:** The compare icon is **hover-revealed** on the Player name cell on desktop — a small ⊞ icon appears on row hover. No extra column. No permanent layout shift.
- **D-02:** On **mobile** (no hover), tapping the player name reveals a **mini action sheet** with a "Compare" option. Consistent with how mobile apps handle row actions; avoids an always-visible icon column.

### Second Player Selection
- **D-03:** Player B is selected via a **search field inside the comparison modal** — the modal opens with Player A's data shown immediately and a search input at the top. User types to find Player B; the modal updates in place. Reuses the name-search pattern from `PlayerPickerModal`.
- **D-04:** The Player B search shows **all players, no position filter**. Transfer decisions sometimes involve cross-position comparisons (e.g., weighing a MID vs FWD positional switch). Keeping it unfiltered maximises flexibility.

### Modal Layout
- **D-05:** Desktop layout: **two columns side by side (A | B)**. Each data section (xPts, Gem, fixtures, signals) spans the full modal width with Player A values on the left and Player B on the right. Enables direct row-by-row comparison.
- **D-06:** Mobile layout: **single scrollable column — Player A block then Player B block stacked vertically**. Simple, works on any width. Loses side-by-side comparison on mobile but avoids horizontal scroll or tab switching.
- **D-07:** Modal uses the **native `<dialog>` element** (same pattern as `PlayerPickerModal`) — `useRef<HTMLDialogElement>`, `showModal()`/`close()`, backdrop click to dismiss, Escape key sync via `close` event listener.

### Section Order & Emphasis
- **D-08:** Sections appear in this order: **xPts Projection → Gem Scores → Fixtures → Signals**. Decision-first: the number the manager is most likely acting on (xPts) appears at top; Gem breakdown adds colour; fixtures and signals are supporting detail.
- **D-09:** **No winner highlighting** — raw numbers only. No bold, no badge, no per-row highlight indicating which player "wins". The manager reads the data and decides. Avoids oversimplifying decisions where "higher" isn't always better (e.g., ownership % for differentials).

### xPts Section Detail
- **D-10:** xPts section shows: `xPts_1gw`, `xPts_3gw`, `xPts_5gw`, and `xPts_90th_1gw` (ceiling) for each player. `VarianceBadge` reused to show ceiling flag where applicable.

### Gem Scores Section Detail
- **D-11:** Gem section shows: composite `gem_score` plus all 7 component scores (`fdr_score`, `form_score`, `xg_score`, `xa_score`, `ownership_score`, `minutes_score`, `set_piece_score`). Scores displayed as 0–100 integers (same `fmtScore` convention as GemTable columns).

### Fixtures Section Detail
- **D-12:** Fixtures section reuses the existing `FixtureBadges` component to render next-5 fixtures with colour-coded difficulty for each player.

### Signals Section Detail
- **D-13:** Signals section reuses `RegressionSignalBadge` (BUY/SELL), `DifferentialBadge` (DIFF/TRAP), and `MinsRiskBadge` (rotation risk) for each player — same badges already in GemTable columns.

### Claude's Discretion
- Modal max width and height constraints — follow `PlayerPickerModal` convention (`max-w-md`, `max-h-[70vh]`) but can be wider given more content (`max-w-2xl` or similar).
- Whether to animate the Player B update (fade/slide) when the user selects a second player, or update instantly.
- Exact heading structure within each section (e.g., section dividers, label alignment).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Modal Pattern (required reading)
- `src/components/planner/PlayerPickerModal.tsx` — Canonical `<dialog>`-based modal: `useRef<HTMLDialogElement>`, `showModal()`/`close()`, backdrop click, Escape key sync, search input with auto-focus, `overflow-y-auto` scrollable list. Mirror this structure.

### Reusable Badge Components
- `src/components/gem-table/RegressionSignalBadge.tsx` — BUY/SELL signal badge
- `src/components/gem-table/DifferentialBadge.tsx` — DIFF/TRAP flag badge
- `src/components/gem-table/VarianceBadge.tsx` — High-ceiling badge (used in xPts cells)
- `src/components/shared/MinsRiskBadge.tsx` — Rotation risk / mins risk badge
- `src/components/fixtures/FixtureBadges.tsx` — Colour-coded next-5 fixtures

### Data & Hooks
- `src/lib/hooks/usePlayers.ts` — Source of all player data; `ScoredPlayer` type has all comparison fields
- `src/lib/types.ts` — `ScoredPlayer` interface: `xPts_1gw/3gw/5gw`, `xPts_90th_1gw`, `gem_score`, 7 component scores, `fixtures[]`, `regression_signal`, `differential_flag`, `mins_risk`
- `src/lib/gem-score.ts` — `computeAllGemScores()` — already called in GemTable; the comparison modal receives scored players from the same source

### GemTable Integration Point
- `src/components/gem-table/GemTable.tsx` — Where the compare icon trigger lives (hover on player name cell). Row data is `ScoredPlayer`, already scored.
- `src/components/gem-table/columns.tsx` — Column definitions; the Player name column (`web_name`) is where the hover-reveal icon is added. `fmtScore()` helper for 0–100 display is defined here and should be reused or extracted.

### Requirements
- `.planning/REQUIREMENTS.md` §Player Comparison — CMP-01 through CMP-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PlayerPickerModal.tsx`: Complete native `<dialog>` modal with search, scrollable list, backdrop click, Escape key — mirror this for the comparison modal shell.
- `FixtureBadges`, `RegressionSignalBadge`, `DifferentialBadge`, `VarianceBadge`, `MinsRiskBadge`: All badge components from GemTable are drop-in reusable for the comparison sections.
- `fmtScore()` in `columns.tsx`: Formats 0.0–1.0 score to 0–100 integer string — extract to shared util or import directly for the Gem section.
- `usePlayers()` hook: Returns full player list; `computeAllGemScores()` already runs in GemTable — compare modal receives scored players via prop or calls the hook itself.

### Established Patterns
- Native `<dialog>` (no library modal) — enforced by PlayerPickerModal. Do not introduce Radix Dialog, Headless UI, or any other modal library.
- `'use client'` directive required for components with `useState`/`useEffect`/`useRef`.
- Dark mode via Tailwind `dark:` variants — all UI must work in both modes.
- Tailwind only — no inline styles except where unavoidable (e.g., `fontSize: '16px'` on inputs to prevent iOS zoom).

### Integration Points
- `GemTable.tsx` / `columns.tsx`: Add hover-reveal compare icon to the `web_name` column cell renderer. Pass a callback (`onCompare: (player: ScoredPlayer) => void`) from GemTable down to columns, or use a context.
- `src/app/page.tsx`: The comparison modal state (`comparePlayer`, `open`) should live at `page.tsx` level (same pattern as `gemPreset` state) so the modal overlays the entire app, not just the GemTable.
- `usePlayers()`: The comparison modal needs the full player list for Player B search — pass `scoredPlayers` down from `page.tsx` or call `usePlayers()` inside the modal (TanStack Query deduplicates the request).

</code_context>

<specifics>
## Specific Ideas

- The compare icon on the Player name cell should be lightweight — a small ⊞ or ⇄ icon, visible only on row hover on desktop. Not a button with visible border/padding.
- The mini action sheet on mobile (tap player name) should be minimal — "Compare" as the primary action, dismiss on outside tap.
- Player B search field should auto-focus when the modal opens (same behaviour as `PlayerPickerModal`'s search input).
- When Player B is not yet selected, the right column should show a placeholder prompt ("Search for a player to compare").

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 39-player-comparison-modal*
*Context gathered: 2026-04-29*
