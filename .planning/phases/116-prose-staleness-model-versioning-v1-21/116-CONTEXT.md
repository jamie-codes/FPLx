# Phase 116: Prose Staleness & Model Versioning (v1.21) - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 116 closes two trust-signal gaps:

1. **PROSE-01** — `ProseSummaryBlock` displays `generated_at` as relative time ("Updated 3 hours ago · GW38") in the footer, turning amber when the summary is ≥ 20 hours old
2. **PROSE-02** — `generate_weekly_summary()` prompt is enriched with: (a) DGW/BGW context for the current GW, and (b) injury/availability flags on captain and gem candidates
3. **VER-01** — `accuracy.py` version records gain a `sample_gws: int` field (count of finished GWs contributing to the hit_rate at write time); `VersionRecord` TypeScript type gains `sample_gws?: number` (optional for backward compat)
4. **VER-02** — "Versions" is added as a 4th pill to `AccuracyTab`'s sub-tab nav; `VersionHistoryTable` moves from the Calibration sub-tab into the new Versions sub-tab; the table gains a "Sample GWs" column with cold-start labeling for entries with `sample_gws < 3`

No new routes. No new hooks. No pipeline data sources beyond what already exists (`merged` players, `_detect_dgw_bgw()` in `gw_intel.py`).

</domain>

<decisions>
## Implementation Decisions

### PROSE-01: Prose Staleness Footer

- **D-01:** Footer format is **"Updated X ago · GW{N}"** — relative time derived from `generated_at` (ISO 8601 UTC), GW number from `displayed.gw`. Replaces the current static "Updated GW{N}" line.
- **D-02:** When fresh (< 20 hours): footer renders in `text-zinc-400 dark:text-zinc-500` (existing colour class — unchanged).
- **D-03:** When stale (≥ 20 hours): same footer line switches to amber: `text-amber-600 dark:text-amber-400`. No separate note, no banner — inline colour change only.
- **D-04:** Threshold is exactly 20 hours per ROADMAP success criterion. Use `Date.now()` directly (not an injectable `now` param). Tests use `jest.useFakeTimers()` per Phase 115 pattern.

### PROSE-02: Prompt Enrichment

- **D-05:** Function signature extends with one keyword arg: `dgw_teams: list[str] | None = None`. Default `None` preserves backward compat with existing tests.
- **D-06:** Lifecycle flags: in `run.py`, add `chance_of_playing_next_round` and `news` to each captain/gem dict before calling `generate_weekly_summary()`. `_build_user_prompt()` includes an availability note for players with `chance_of_playing_next_round < 100` or non-empty `news`.
- **D-07:** DGW context: in `run.py`, call `_detect_dgw_bgw(merged, current_gw)` from `gw_intel.py` after the captains/gems are built; collect team names for `'dgw'` entries; pass as `dgw_teams` kwarg. `_build_user_prompt()` prepends a DGW note when `dgw_teams` is non-empty: e.g., `"Note: This GW has double fixtures for: {teams}."`.
- **D-08:** Guardrail is unaffected — DGW team names (e.g., "Manchester City") are not player web_names; the existing `_passes_guardrail()` logic does not reject them.

### VER-01: sample_gws Field

- **D-09:** In `accuracy.py`, `new_version_record` gains `'sample_gws': len(target_gws_desc)` at the point where the version record is appended. This is the count of finished GWs that contributed to `hit_rate`.
- **D-10:** `_empty_backtest()` version record gets `'sample_gws': 0` (cold start by definition).
- **D-11:** `VersionRecord` TypeScript interface gains `sample_gws?: number` (optional). UI defaults `sample_gws ?? 0` when absent — treats old records as cold start.

### VER-02: Versions Sub-Tab

- **D-12:** Add `{ value: 'versions', label: 'Versions' }` to `ACCURACY_SUB_TABS` array in `AccuracyTab.tsx`. Nav now reads: Summary | Calibration | Back | Versions.
- **D-13:** `VersionHistoryTable` **moves** to the new Versions sub-tab — remove it from the Calibration sub-tab render block (current line ~1106).
- **D-14:** `VersionHistoryTable` gains a **"Sample GWs"** column (new `<th>` + `<td>`). Displayed value: the integer count (e.g., `12`).
- **D-15:** Cold-start rows (`(v.sample_gws ?? 0) < 3`): Hit Rate cell shows an amber-coloured `'cold start'` label instead of `<HitRateBadge>`; Sample GWs cell shows `'< 3 GWs'` in amber (`text-amber-600 dark:text-amber-400`). Row otherwise renders normally (not greyed out, not filtered).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 116 Requirements
- `.planning/REQUIREMENTS.md` §Weekly Prose Summary (NLP-01) + §Model Versioning (VER-01) — PROSE-01, PROSE-02, VER-01, VER-02 requirement definitions
- `.planning/ROADMAP.md` Phase 116 — Goal, success criteria, dependencies

### ProseSummaryBlock (PROSE-01)
- `src/components/squad/ProseSummaryBlock.tsx` — Component to modify; current footer at line 63–65 renders `"Updated GW{displayed.gw}"`; `generated_at` arrives via `ProseSummary` type (already in blob)
- `src/lib/types.ts` line ~937–940 — `ProseSummary` interface: `prose`, `gw`, `generated_at` (ISO 8601 UTC)

### Prose Pipeline (PROSE-02)
- `pipeline/prose_summary.py` — `generate_weekly_summary()` (signature + `_build_user_prompt()` to extend); guardrail logic (unchanged)
- `pipeline/run.py` lines ~362–405 — Call site for `generate_weekly_summary()`; captain/gem payload construction (add lifecycle fields + dgw_teams kwarg)
- `pipeline/gw_intel.py` line ~108 — `_detect_dgw_bgw(merged, next_gw)` — returns `{team_id: 'dgw' | 'bgw'}` for next GW; import and call after captains/gems are built

### VersionRecord + AccuracyTab (VER-01/VER-02)
- `src/lib/types.ts` line ~455–460 — `VersionRecord` interface (add `sample_gws?: number`)
- `src/components/accuracy/AccuracyTab.tsx` — `ACCURACY_SUB_TABS` array (lines 43–47), `AccuracySubTabNav` component (lines 49–79), `VersionHistoryTable` component (lines 186–240), render block in `AccuracyTab` (lines 1093–1113)
- `pipeline/accuracy.py` lines ~395–415 — `new_version_record` dict construction (add `sample_gws`); `_empty_backtest()` version record (add `sample_gws: 0`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProseSummaryBlock.tsx` footer (line 63–65): single `<p>` — extend in-place with conditional amber class and relative time helper
- `AccuracySubTabNav`: already handles N pills generically — adding a 4th entry to `ACCURACY_SUB_TABS` is the only change needed to the nav component itself
- `VersionHistoryTable`: already complete; extend by adding `sample_gws` column + conditional cold-start render
- `HitRateBadge`: already used in the table; cold-start rows replace it with an inline amber label (no new component needed)
- `_detect_dgw_bgw()` in `gw_intel.py`: already imported from `gw_intel.py`; the `pipeline/run.py` caller just needs to add the import and call

### Established Patterns
- **Staleness threshold**: Phase 115 used `Date.now()` directly in component; `jest.useFakeTimers()` for tests — identical pattern applies here
- **Amber colour class**: `text-amber-600 dark:text-amber-400` — consistent with amber use elsewhere in the codebase (NewsBanner amber tier)
- **Sub-tab type pattern**: `AccuracySubTab = 'summary' | 'calibration' | 'back'` — extend to add `'versions'`; all conditional render blocks already follow `{subTab === 'X' && <.../>}` pattern
- **Optional type fields**: `sample_gws?: number` with `?? 0` defaulting — follows same pattern as `predicted_mean?` in `CalibrationBucket`

### Integration Points
- `ProseSummaryBlock.tsx` line 63–65: swap static `"Updated GW{displayed.gw}"` for relative time + amber conditional
- `AccuracyTab.tsx` `ACCURACY_SUB_TABS` array: add `{ value: 'versions', label: 'Versions' }` as 4th entry
- `AccuracyTab.tsx` render block: add `{subTab === 'versions' && <VersionHistoryTable data={data} />}`; remove `VersionHistoryTable` from the calibration render block
- `pipeline/run.py` prose call site: enrich cap_payload/gem_payload dicts + add `dgw_teams` kwarg
- `pipeline/accuracy.py` `new_version_record`: add `'sample_gws': len(target_gws_desc)` entry

</code_context>

<specifics>
## Specific Ideas

- Relative time helper for `ProseSummaryBlock`: inline function or module-level utility — `const minutesAgo = Math.floor((Date.now() - new Date(displayed.generated_at).getTime()) / 60000)`; build the label from hours/minutes; `const isStale = minutesAgo >= 20 * 60`.
- Cold-start render in `VersionHistoryTable`: `{(v.sample_gws ?? 0) < 3 ? <span className="text-amber-600 dark:text-amber-400 text-xs">cold start</span> : <HitRateBadge rate={v.hit_rate} />}` for the Hit Rate cell.
- DGW note in `_build_user_prompt()`: prepend when `dgw_teams` is not empty: `f"Note: Gameweek {gameweek} is a double gameweek for: {', '.join(dgw_teams)}.\n\n"` before the `<input>` block.
- Availability note for low-chance players: if `chance_of_playing_next_round` is not None and < 100, include `(fitness doubt: {chance_of_playing_next_round}%)` in the player's XML attribute.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 116-prose-staleness-model-versioning-v1-21*
*Context gathered: 2026-05-17*
