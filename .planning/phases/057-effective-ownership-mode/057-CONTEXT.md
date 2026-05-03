# Phase 57: Effective Ownership Mode - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing 2-card CaptainPicksPanel (Ceiling + EO-Adjusted) with a ranked top-5 candidate list featuring a 4-mode toggle. Each candidate row shows EO% inline. Protect Rank mode adds a "Dangerous to fade" badge for high-EO players not in the user's squad. Mode state is scoped locally to the captain panel component (EO-04 — no global state lift).

</domain>

<decisions>
## Implementation Decisions

### Panel Layout
- **D-01:** The existing 2-card layout (Ceiling + EO-Adjusted) is **replaced entirely** — not extended, not tab-separated. The panel becomes a ranked candidate list with the mode toggle at the top.
- **D-02:** Show **top 5 candidates** in the ranked list regardless of mode. No pagination, no "show more" — 5 is the fixed cap.

### Mode Ranking Logic
- **D-03:** Four modes with concrete sort keys:
  - **Max xPts** — sort by `xPts_1gw` descending (plain expected points; existing default behaviour)
  - **Protect Rank** — sort by `selected_by_percent` descending (highest EO first; surfaces the template captain)
  - **Chase Rank** — sort by `xPts_90th_1gw` descending (ceiling play; already computed on `CaptainPick`)
  - **Differential Aggressive** — sort by `selected_by_percent` ascending, filtered to players whose `xPts_1gw >= median xPts_1gw` of the candidate pool (low ownership + genuinely good player; median floor prevents surfacing bad differentials)
- **D-04:** Max xPts is the default mode on first render.

### EO% Display
- **D-05:** EO% appears **inline next to the player name** as `~X%` (e.g. "Salah ~34%"). Tilde signals approximation. No separate column or badge chip.
- **D-06:** Tooltip on the `~X%` figure itself (using `title` attribute consistent with existing `TOOLTIPS` pattern in `CaptainPicksPanel`). Tooltip text: "Approximate effective ownership based on FPL selected_by_percent data."
- **D-07:** EO% sourced from `selected_by_percent` on `CaptainPick` — already available, no pipeline changes.

### "Dangerous to Fade" Badge (EO-03)
- **D-08:** Badge is **inline on the candidate row** — a small chip/label next to the player name, visible only in **Protect Rank mode**.
- **D-09:** Trigger conditions: `parseFloat(selected_by_percent) > 30` AND player is **not** in the authenticated user's squad.
- **D-10:** When the user is **unauthenticated**, the badge is **hidden entirely** — no login nudge, no false-positive fallback. Consistent with how `TransferPanel` handles auth-gated features. The ranked list still functions; only the squad-awareness layer is omitted.
- **D-11:** Badge disappears automatically when mode switches away from Protect Rank.

### Claude's Discretion
- Toggle UI component choice (pill group / segmented control / tab strip) — Claude picks the pattern that fits existing Tailwind design system.
- Row layout within the candidate list (exact spacing, icon usage, mobile stacking order) — Claude follows established squad component patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Captain Panel
- `src/components/captaincy/CaptainPicksPanel.tsx` — Component being replaced; read to understand TOOLTIPS pattern, dark-mode classes, and hook usage (`useCaptainPicks`)
- `src/lib/hooks/useCaptainPicks.ts` — Hook that fetches and scores captain candidates; understand `CaptainPick` shape before modifying

### Types
- `src/lib/types.ts` — `CaptainPick` type (lines ~500–530); `selected_by_percent: string`, `xPts_1gw: number`, `xPts_90th_1gw: number` all confirmed present

### Requirements
- `.planning/REQUIREMENTS.md` §EO-01–EO-04 — Four locked requirements; EO-04 explicitly forbids global state lift

### Squad auth pattern reference
- `src/components/transfers/TransferPanel.tsx` lines 87–92 — `derivedFtCount` useMemo pattern for auth-gated squad data; mirror this for the "Dangerous to fade" squad check

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useCaptainPicks` hook — already fetches and ranks candidates; may need a mode parameter or client-side re-sort rather than server-side recomputation
- `selected_by_percent` on `CaptainPick` — string type ("12.5"), `parseFloat()` before numeric comparison
- `xPts_90th_1gw` on `CaptainPick` — already computed; Chase Rank mode uses it directly
- `useAuthStatus()` + `useSquad()` hooks — available for Protect Rank badge squad check (same pattern as `TransferPanel.tsx:87–92`)

### Established Patterns
- Dark-mode: `bg-white dark:bg-zinc-900`, `border-zinc-200 dark:border-zinc-700`, `text-zinc-500 dark:text-zinc-400`
- Tooltips: `title` attribute on the element itself (not a custom tooltip component)
- Auth-gated features: compute in `useMemo` with `[isAuthenticated, myTeamData, squadData]` dep array; return safe default when unauthenticated

### Integration Points
- The new component replaces `CaptainPicksPanel` — update the import site in `SquadView.tsx` (or wherever it's mounted)
- Mode state: `useState<EOMode>('max_xpts')` inside the component (or nearest Squad-section parent if sibling components need it — but EO-04 says local)

</code_context>

<specifics>
## Specific Ideas

- The tilde prefix (`~`) on EO% is intentional and significant — it communicates approximation to the user without a footnote. Keep it in all modes, not just EO-heavy modes.
- "Dangerous to fade" is the exact badge label (from EO-03 success criteria) — don't soften it to "High ownership" or similar.

</specifics>

<deferred>
## Deferred Ideas

- EO-05 / EO-06: EO mode affecting Transfer suggestions and Decision Summary card rankings — explicitly deferred to v1.10 per REQUIREMENTS.md.

</deferred>

---

*Phase: 57-Effective Ownership Mode*
*Context gathered: 2026-05-03*
