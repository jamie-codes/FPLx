# Phase 102: MC Gate Activation & MCDistributionBar Display - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Activate the already-computed MC simulation data (10k sims per player per GW, fields `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` already in `merged_players.json` but gated off) and surface it in two places:
1. The xPts hover card in GemTable — via a new `MCDistributionBar` component
2. Each captain candidate row in `CaptainPicksPanel` — inline P10/P90 range after the pts display

No new simulation logic. No browser-side MC. Pipeline is authoritative. This phase is purely gate activation + UI wiring.

</domain>

<decisions>
## Implementation Decisions

### MCDistributionBar Component

- **D-01:** `MCDistributionBar` is a new standalone component (not inline JSX). It renders a **visual horizontal range bar** using Tailwind flex — P10 left-label, P90 right-label, with a coloured fill strip between them. Haul% shown as an amber number (e.g. `Haul 42%`) when `haulProb >= 0.40`; silent otherwise. No Recharts.
- **D-02:** `MCDistributionBar` **replaces** the existing inline Blank%/Haul%/Floor/Ceiling text rows in `XPtsCell` (currently lines 141–163 in `src/components/gem-table/columns.tsx`). The text rows are removed entirely; the bar is the sole MC display.
- **D-03:** Guard: bar renders only when `window === 1` and all four MC props (`blankProb`, `haulProb`, `p10Pts`, `p90Pts`) are defined. Gate-off / BGW / 3GW/5GW: `MCDistributionBar` not rendered, no fallback text. Same guard condition as the removed `showMC` block.
- **D-04:** Component lives at `src/components/mc/MCDistributionBar.tsx`. Accepts `{ blankProb, haulProb, p10Pts, p90Pts }` props (all `number`). No optional chaining inside the component — the caller guards before rendering.

### Gate Flip Mechanism

- **D-05:** Turn on `mc_enabled` via a **pipeline code patch** — add `MC_ENABLED = True` as a named constant near the top of `pipeline/run.py` (around line 193) and replace the sticky gate read with it. Old line: `mc_enabled = prev_backtest.get('summary', {}).get('mc_enabled', False)` — replaced by `mc_enabled = MC_ENABLED`.
- **D-06:** The pipeline must still **write `mc_enabled: true` into `accuracy_backtest.json` summary** after the flip, preserving the existing pattern that other gates follow (form_signal_enabled, xmins_v2_enabled, etc.). No change to the write path — just the read constant flips the value.
- **D-07:** GitHub Actions workflow hygiene (`.github/workflows/pipeline.yml`) — three mechanical fixes in the same PR:
  - Align `anthropic` Python pin from `0.40.0` → `0.98.1`
  - Add explicit `numpy==2.2.3` to the pip install line (no longer transitive-only)
  - Add `MC_ITERATIONS: 10000` and `MC_SEED: 42` to the env block so MC fields populate deterministically on every daily pipeline run

### Captain Card P10/P90

- **D-08:** Add P10/P90 range **inline after the pts display** in `CandidateRow`: `"8.2 pts (C) · 4.1–18.1"` format. The `·` separator and range use `text-zinc-400 text-xs` to visually subordinate to the main pts number.
- **D-09:** P10/P90 values are the **raw pipeline values** (base points, not doubled for captain). Consistent with `merged_players.json` and the xPts hover card bar. The `pts (C)` value stays doubled; the range clarifies the base distribution.
- **D-10:** P10/P90 range renders only when `candidate.p10_pts !== undefined && candidate.p90_pts !== undefined`. Gate-off degrades silently — `CandidateRow` shows only `"8.2 pts (C)"` unchanged.

### Claude's Discretion

- Bar colour scheme (teal/violet/zinc fill) — use colours consistent with existing Tailwind tokens in the app. Match the existing amber for Haul% (used in `haulProb >= 0.40` path in the current inline code).
- MCDistributionBar bar height and exact padding — fit within the `w-44` (176px) hover card without overflow.
- Test strategy — cover MCDistributionBar render/no-render guards and the gate-off degradation path. Captain card: cover P10/P90 display and gate-off fallback.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §MC-01, §MC-02 — Full acceptance criteria for MC gate activation and captain card P10/P90 range
- `.planning/ROADMAP.md` §Phase 102 — Success criteria, phase notes, UI hint, pitfalls (especially: do NOT port simulate.py into browser TypeScript)

### Existing MC implementation
- `src/components/gem-table/columns.tsx` lines 26–175 — `XPtsCell` component; the existing inline MC text rows (lines 141–163) are replaced by `MCDistributionBar` in this phase
- `src/components/captaincy/CaptainPicksPanel.tsx` lines 85–158 — `CandidateRow` component where P10/P90 range is added
- `src/lib/types.ts` lines 186–193, 357, 451 — MC fields on `MergedPlayer` (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`, `mc_enabled`)

### Pipeline gate mechanism
- `pipeline/run.py` lines 193–211 — where `mc_enabled` constant is declared and printed; line 203 is the sticky read being replaced
- `pipeline/simulate.py` — existing 10k-sim engine; no changes needed, just reads `MC_ENABLED` from env
- `.github/workflows/pipeline.yml` — workflow file receiving the hygiene fixes (anthropic pin, numpy pin, MC env vars)

### Existing MC gate consumers
- `src/components/accuracy/AccuracyTab.tsx` — reads `mc_enabled` from `accuracy_backtest.json`; no changes needed but must stay in sync with summary write

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `XPtsCell` (`src/components/gem-table/columns.tsx:28`) — accepts `blankProb`, `haulProb`, `p10Pts`, `p90Pts` props already; `showMC` guard already in place; inline text rows (lines 141–163) are the target for replacement with `MCDistributionBar`
- `VarianceBadge`, `MinsRiskBadge` — component extraction precedent for small inline XPtsCell subcomponents
- `FragilityBadge` (`src/components/sensitivity/`) — existing small badge component; MCDistributionBar follows same extraction pattern
- Haul% amber colour already used: `haulProb! >= 0.40 ? 'font-mono text-amber-600 dark:text-amber-400' : 'font-mono'` (columns.tsx line 149–153) — reuse the same threshold and token

### Established Patterns
- `window === 1` guard in XPtsCell: all breakdown content is 1GW-only. MCDistributionBar follows the same rule.
- Gate-off degradation: all MC props are `?` optional on `MergedPlayer`; `undefined` check is the standard guard. No fallback text — silent omission.
- Tailwind CSS-only UI in hover card: no Recharts at row scale (confirmed by ROADMAP and existing hover card patterns).
- Gate constants in `pipeline/run.py`: `form_signal_enabled`, `xmins_v2_enabled`, `bonus_predictor_enabled`, `save_predictor_enabled` all follow the same pattern — `MC_ENABLED = True` constant replaces the sticky read to match.

### Integration Points
- `XPtsCell` hover card: `MCDistributionBar` inserted where the `showMC && (...)` block currently lives (between the component rows and the `<hr>` before Total)
- `CandidateRow`: P10/P90 appended to the `"8.2 pts (C)"` `<span>` at line 149–151
- `accuracy_backtest.json` summary write path: must include `mc_enabled: true` after flip (preserves pattern for AccuracyTab gate check)

</code_context>

<specifics>
## Specific Ideas

- `MCDistributionBar` output format for the bar: `"4.1 [░░░░░░▓▓▓▓▓▓▓███] 18.1"` with Haul% amber number below when `≥ 40%`. Exact fill characters/colours at Claude's discretion — must work in w-44 hover card.
- Captain card range separator: `·` (middle dot) with `text-zinc-400 text-xs` to visually subordinate the range to the main `pts (C)` value.
- Raw P10/P90 in captain card (not doubled) — consistent with hover card and pipeline output. User noted: "the pts (C) value stays doubled; the range clarifies the base distribution."

</specifics>

<deferred>
## Deferred Ideas

- `blank_prob` display — currently not shown in MCDistributionBar (bar-only design with P10/P90 ends + Haul%). Blank% is implied by the P10 floor. If blank% turns out to be confusing by its absence, add it in a future phase.
- MCDistributionBar reuse in CaptainPicksPanel — user chose inline text range (D-08) over embedding the full bar component in each candidate row. If the captain card gets a redesign, revisit.
- `fragile_transfer_pct` monitoring in `data_health.json` (from Phase 104 ROADMAP note) — deferred to v1.19.

</deferred>

---

*Phase: 102-mc-gate-activation-mcdistributionbar-display*
*Context gathered: 2026-05-13*
