# Project Research Summary

**Project:** FPL Analyst v1.21 - Polish, Intelligence & Team News
**Domain:** Sports analytics decision-support tool - incremental UI wiring milestone
**Researched:** 2026-05-16
**Confidence:** HIGH

## Executive Summary

v1.21 is not a feature-build milestone - it is a UI wiring milestone. All three features (SCRAPER-01 team news, NLP-01 weekly prose summary, VER-01 model version comparison) have complete backend implementations already in production. The pipeline extracts FPL news fields, generates prose via Claude Haiku daily, and appends version records on every formula change. The remaining work is exclusively client-side: mounting an existing NewsBanner component in two more call sites, building one new presentational table (VersionHistoryTable), and displaying a staleness timestamp already present in the prose response payload. Zero new npm packages, zero new Python packages, zero new API routes, zero new pipeline steps.

The recommended build order is: (1) SCRAPER-01 staleness suppression and CaptainPicksPanel wiring first - this is a prerequisite before news badges appear on decision-critical surfaces without risking badge fatigue from stale zinc-severity entries; (2) VER-01 schema extension (sample_gws field) and VersionHistoryTable component second - the pipeline data is live and the type is already defined, so this is a pure display task with one schema guard to add before the UI is built; (3) NLP-01 staleness timestamp display in ProseSummaryBlock third - generated_at is already in the response, it just needs rendering. Pipeline prose enrichment is a P2 enhancement that can slot after core wiring if scope allows.

The primary risks are UX-level, not architectural. Zinc-severity news badges for players who played 90 minutes last week will train users to ignore all news if deployed without the 14-day staleness suppression gate. Prose summaries that recommend an injured player with no timestamp visible will erode trust in the AI summary feature. The version comparison table showing a cold-start 0.0% hit rate will look like a catastrophic regression rather than a data-absent artefact. All three risks have defined prevention strategies in research and must be addressed as acceptance criteria, not as later polish.

## Key Findings

### Recommended Stack

No changes to the stack are required for v1.21. All three features operate entirely within existing dependencies: React 19, Next.js 16, TanStack Query v5, Tailwind CSS v4, the @anthropic-ai/sdk, and @vercel/blob. The VersionHistoryTable should be a plain HTML table with Tailwind classes - TanStack Table overhead is not warranted for a 1-5 row static list.

**Core technologies (unchanged, all already in use):**
- Next.js 16 / React 19: App shell, Route Handlers - no new routes needed
- TanStack Query v5: useProseSummary (GET), useProseRefresh (POST mutation), useAccuracy (already returns versions[]) - all hooks exist
- @anthropic-ai/sdk ^0.93.0: Powers /api/prose-summary POST - keep claude-haiku-4-5 dateless alias, do not change to dated alias
- @vercel/blob ^2.3.1: weekly_summary.json, accuracy_backtest.json, merged_players.json all already populated with data these features need
- Tailwind CSS v4: All new UI work uses existing utility classes
- Vitest + @testing-library/react: TDD RED-to-GREEN cycle for NewsBanner in CaptainPicksPanel and for VersionHistoryTable

### Expected Features

**Must have (table stakes):**
- News shown on captain candidates - FPL managers rely on last-minute team news; the captain surface is the highest-stakes decision and currently lacks NewsBanner
- News shown on transfer candidates - already wired in OpportunityCostTable per Phase 88; must verify complete and functional with real squad data
- AI prose summary available on page load - weekly_summary.json already generated daily; gap is staleness display (generated_at not currently shown in ProseSummaryBlock)
- Version history UI - versions[] already live in accuracy_backtest.json; displaying it closes the loop on the VER-01 backend running since Phase 96

**Should have (competitive differentiators):**
- News severity colour-coding (red/amber/zinc) on decision surfaces - computeNewsSeverity is implemented; value is in the surfacing
- Staleness suppression for zinc-tier news (14-day gate) - prevents badge fatigue that would undermine the entire news feature
- generated_at relative timestamp in ProseSummaryBlock - prevents trust erosion when prose recommends a player announced absent post-generation
- sample_gws field in version records and cold-start suppression in VersionHistoryTable - prevents cold-start 0.0% being interpreted as a regression
- Pipeline prose enriched with chip timing and lifecycle risk context - improves prose quality from captains+gems to full decision context

**Defer (v2+):**
- Per-GW accuracy breakdown by formula version - requires retroactive re-computation; out of scope
- External news scraper - FPL bootstrap-static provides official news at zero cost; no external dependency needed
- Auto-regenerate prose on squad load - explicitly ruled out (NLP-02 cost explosion precedent)
- News badges in GemTable for all 600+ players - noise in a data-dense table; badges in GemTable expand-row only

### Architecture Approach

The architecture is a mature, settled stack with all data flows already established. The pipeline writes merged_players.json (with news fields), accuracy_backtest.json (with versions[]), and weekly_summary.json (Claude Haiku prose) to Vercel Blob on every daily run. Route handlers pass these through to the client with no transformation. TanStack Query hooks cache with a 6-hour staleTime. React components consume hooks and render. v1.21 adds no new layers - it wires existing components (NewsBanner) into existing consumers (CaptainPicksPanel) and adds one new pure-presentational component (VersionHistoryTable) that receives already-fetched data as props.

**Major components and their v1.21 changes:**
1. CaptainPicksPanel.tsx (MODIFY) - build Map<id, MergedPlayer> from usePlayers() (hook already imported); render NewsBanner in each CandidateRow
2. AccuracyTab.tsx (MODIFY) - add Versions pill to existing Summary | Calibration | Back pill nav; conditionally render VersionHistoryTable
3. VersionHistoryTable.tsx (NEW) - pure presentational; receives versions: VersionRecord[] as prop; renders sorted table with formula_version, date, hit_rate, gate_flags, sample_gws columns
4. ProseSummaryBlock.tsx (MODIFY) - display generated_at as relative time string alongside existing GW{N} label; add >20h staleness amber note
5. pipeline/accuracy.py (MODIFY) - extend version record schema with sample_gws: int before VER-01 UI is built
6. pipeline/prose_summary.py + run.py (MODIFY, optional P2) - extend generate_weekly_summary() to accept chip and risks params

### Critical Pitfalls

1. **Zinc badge fatigue from stale FPL news** - FPL does not clear the news field between GWs. Prevent by adding a staleness predicate: if severity is zinc AND news_added is older than 14 days, return none. This must land before NewsBanner is wired into captain/transfer surfaces. Red and amber severities are never suppressed regardless of age.

2. **Cold-start 0.0% version entry looks like regression** - _empty_backtest writes hit_rate: 0.0 at season start. The comparison UI must filter or label entries where sample_gws < 3. Extend the version record schema with sample_gws before building VersionHistoryTable.

3. **Prose summary staleness - no temporal indicator** - ProseSummaryBlock currently shows only Updated GW{N}. Display generated_at as relative time using the existing formatRelativeTime utility. If older than 20 hours, add an amber note.

4. **Prose POST cost explosion from reactive trigger** - wrapping refresh.mutate(payload) in a useEffect would fire on every re-render. The NLP-02 key decision documents this risk (approximately 16-32 USD/season from one bug). POST must be triggered only by the explicit refresh button click; add a 60-second cooldown after a successful POST.

5. **Version tag drift - FORMULA_VERSION not bumped after formula changes** - FORMULA_VERSION lives in accuracy.py but formula changes happen in merge.py, simulate.py, xmins.py, and bonus.py. Add a mandatory acceptance criterion in every phase plan modifying those files.

## Implications for Roadmap

Based on combined research, v1.21 warrants 3 focused phases ordered by dependency and risk. All three features are wiring-level work with no infrastructure to build, so phases should be small and ship-ready independently.

### Phase 1: SCRAPER-01 - News Badge Staleness + CaptainPicksPanel Wiring

**Rationale:** Staleness suppression is a prerequisite that must exist before NewsBanner is wired into any new call site. Deploying captain news without the 14-day zinc suppression gate would immediately cause badge fatigue. This phase gates the two most decision-critical surfaces behind a correct staleness rule first.

**Delivers:** NewsBanner correctly displayed on captain candidate rows; staleness suppression preventing zinc badge fatigue; confirmation that OpportunityCostTable wiring (Phase 88) is complete and functional with real data; useNewsFlagEnabled gate verified on both surfaces.

**Addresses (FEATURES.md):** News on captain candidates (P1 table stakes), news severity colour-coding (differentiator), staleness suppression (differentiator)

**Avoids (PITFALLS.md):** Pitfall 1 (zinc badge fatigue), Pitfall 2 (doubtful player as unpenalised transfer target - visual advisory in TransferPanel when top candidate has chance < 100)

**Files:** src/lib/newsSeverity.ts (modify - add staleness predicate), src/components/captaincy/CaptainPicksPanel.tsx (modify - add NewsBanner to CandidateRow), src/components/transfers/OpportunityCostTable.tsx (verify existing wiring)

### Phase 2: VER-01 - Schema Extension + VersionHistoryTable

**Rationale:** The pipeline data is live and useAccuracy() already returns versions[]. The sample_gws schema extension must land in the pipeline before the UI is built. Schema extension is a one-field pipeline change; the UI is a new pure-presentational component with no network calls.

**Delivers:** VersionHistoryTable component in AccuracyTab under a Versions pill; cold-start entries filtered or labelled; sample_gws field in all future version records; FORMULA_VERSION bump protocol documented as acceptance criterion for formula-touching phases.

**Addresses (FEATURES.md):** Version comparison shows delta clearly (table stakes), captain hit rate per version (P2 differentiator - optional for v1.21 if scope is tight)

**Avoids (PITFALLS.md):** Pitfall 7 (sample size incomparability - sample_gws guard), Pitfall 6 (version tag drift - bump protocol), Pitfall 8 (storage growth - per-tag-not-per-run constraint documented)

**Files:** pipeline/accuracy.py (modify - add sample_gws to version record schema), src/lib/types.ts (modify - add sample_gws to VersionRecord), src/components/accuracy/VersionHistoryTable.tsx (new), src/components/accuracy/AccuracyTab.tsx (modify - add Versions pill)

### Phase 3: NLP-01 - Prose Staleness Display + Pipeline Enrichment

**Rationale:** The UI is already fully wired (ProseSummaryBlock, useProseSummary, useProseRefresh are all shipped). The v1.21 work is: (a) display generated_at as a relative timestamp - a one-line addition using an existing utility; (b) enrich generate_weekly_summary() to include chip timing and lifecycle risk context - a pipeline-only change with no UI changes needed.

**Delivers:** ProseSummaryBlock shows Updated GW{N} with relative time and amber staleness note after 20 hours; pipeline prose references chip timing and lifecycle risk flags (not just captains + gems); 60-second refresh cooldown on the refresh button.

**Addresses (FEATURES.md):** AI summary available on page load with staleness indication (table stakes), prose synthesising transfer + chip context (differentiator), conditional phrasing for uncertain players (differentiator)

**Avoids (PITFALLS.md):** Pitfall 4 (prose staleness without visual indication), Pitfall 3 (prose POST cost explosion - cooldown guard), Pitfall 5 (hallucination from news names - do NOT add raw news strings to prompt; risks[] structured approach only)

**Files:** src/components/squad/ProseSummaryBlock.tsx (modify - generated_at display, 60s cooldown), pipeline/prose_summary.py (modify - extend generate_weekly_summary() to accept chip and risks), pipeline/run.py (modify - pass chip best-GW and lifecycle risks to call site)

### Phase Ordering Rationale

- SCRAPER-01 first because the staleness gate is a prerequisite for any news display, and CaptainPicksPanel is the highest-value call site currently missing news
- VER-01 second because the schema extension (sample_gws) must precede the UI build - doing them in one phase eliminates the risk of building a UI against an incomplete schema
- NLP-01 third because the UI is already complete; only display polish and pipeline enrichment remain
- All three phases are independent - there are no cross-phase data dependencies; if delivery pressure requires it, phases can be executed in parallel

### Research Flags

All phases use standard patterns - no /gsd-research-phase needed for any phase in v1.21.

- **Phase 1 (SCRAPER-01):** Pure component wiring; NewsBanner already unit-tested; staleness predicate follows established computeNewsSeverity pattern. Standard.
- **Phase 2 (VER-01):** Pure presentational component + one-field schema extension. Pattern established by existing AccuracyTab pill nav and BackTab table. Standard.
- **Phase 3 (NLP-01):** Display addition using existing formatRelativeTime utility; pipeline function signature extension following existing ProseRefreshPayload shape. Standard.

The entire research surface has been grounded in direct codebase inspection with HIGH confidence findings.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims verified by direct file inspection of package.json, pipeline source, route handlers, and src/lib/types.ts. Net new packages: 0. |
| Features | HIGH | All three features confirmed as wiring tasks by reading actual implementation files. NewsBanner, useProseSummary, useProseRefresh, ProseSummaryBlock, VersionRecord all confirmed shipped. |
| Architecture | HIGH | Data flow verified end-to-end: pipeline to Blob to Route Handler to TanStack Query to React. Every integration point confirmed by reading the relevant source files. |
| Pitfalls | HIGH | All pitfalls grounded in codebase audit. Zinc badge staleness confirmed by reading computeNewsSeverity and GemTable. Cost explosion precedent confirmed in PROJECT.md key decisions. Cold-start schema gap confirmed in live accuracy_backtest.json. |

**Overall confidence:** HIGH

### Gaps to Address

- **NLP-01 generate_weekly_summary() signature verification:** At implementation time, compare pipeline/prose_summary.py definition against ProseRefreshPayload in src/lib/types.ts to confirm the chip/risks extension is a clean additive change. Architecture research flagged this as MEDIUM confidence.

- **CaptainPicksPanel sub-component structure:** Verify whether CandidateRow is a sub-component or inline JSX before writing the Map<id, MergedPlayer> join. The join pattern itself is established and low-risk.

- **FORMULA_VERSION bump decision for v1.21:** If v1.21 delivers only UI wiring and no formula changes to merge.py, simulate.py, xmins.py, or bonus.py, then FORMULA_VERSION should remain v1.12-a. If any formula-touching change lands, bump to v1.21-a.

## Sources

### Primary (HIGH confidence - direct codebase inspection)

- pipeline/merge.py lines 992-995 - news, news_added, chance_of_playing_next_round confirmed in pipeline
- pipeline/accuracy.py lines 37, 85-99, 392-434 - FORMULA_VERSION, D-03 dedup, versions[] append, _empty_backtest path
- pipeline/prose_summary.py - generate_weekly_summary() implementation, two-attempt guardrail, qualitative-only prompt
- pipeline/run.py lines 358-403 - prose generation call site, weekly_summary.json write
- src/app/api/prose-summary/route.ts - GET + POST handlers, Zod schema, claude-haiku-4-5, maxDuration = 30, passesGuardrail, collectAllowedNames
- src/lib/types.ts lines 26-28, 132-134, 402, 455-460 - MergedPlayer.news, VersionRecord, AccuracyBacktest.versions
- src/components/news/NewsBanner.tsx - component interface, useNewsFlagEnabled gate
- src/lib/newsSeverity.ts - severity classification rules, zinc/amber/red thresholds
- src/components/captaincy/CaptainPicksPanel.tsx lines 1-80 - hook imports, current component structure
- src/components/transfers/OpportunityCostTable.tsx lines 1-80 - existing NewsBanner wiring reference
- src/lib/hooks/useProseSummary.ts - query hook, 6h staleTime, 404 to null pattern
- src/lib/hooks/useProseRefresh.ts - mutation hook, 422 to GUARDRAIL_FAILED sentinel
- src/components/squad/ProseSummaryBlock.tsx - refresh button, override state, guardrail error handling
- pipeline/cache/accuracy_backtest.json lines 13452-13462 - live versions[] with one record (v1.12-a, hit_rate: 0.1899) confirmed

### Secondary (MEDIUM confidence)

- src/components/accuracy/AccuracyTab.tsx - pill nav pattern inferred from Phase 96; Summary | Calibration | Back structure consistent with multiple research sources
- FPL API news field staleness behaviour - FPL does not expire news strings between GWs; news_added timestamp is the only staleness signal

---
*Research completed: 2026-05-16*
*Ready for roadmap: yes*

