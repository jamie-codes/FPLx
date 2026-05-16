# Pitfalls Research

**Domain:** FPL Analyst v1.21 — Adding SCRAPER-01 (news field integration), NLP-01 (weekly prose summary wiring), and VER-01 (model versioning UI) to a mature app (~30k LOC)
**Researched:** 2026-05-16
**Confidence:** HIGH — all pitfalls grounded in direct codebase audit of `pipeline/accuracy.py`, `pipeline/prose_summary.py`, `src/app/api/prose-summary/route.ts`, `src/lib/newsSeverity.ts`, `src/components/news/NewsBanner.tsx`, `src/lib/hooks/useProseSummary.ts`, `src/lib/prose-guardrail.ts`, and `src/lib/types.ts`. No speculative claims.

**Critical context from codebase inspection:**
- SCRAPER-01 partially shipped in Phase 88: `computeNewsSeverity`, `NewsBanner`, `news_added` field in `MergedPlayer`, `useNewsFlagEnabled` gate hook. What remains is wiring into TransferPanel and captain surfaces, and adding staleness suppression logic.
- NLP-01 prose summary pipeline module (`pipeline/prose_summary.py`) and UI route (`/api/prose-summary`) are both fully implemented. The GET path (pipeline-generated) and POST path (user-triggered squad-aware refresh) both exist. `ProseSummaryBlock` with refresh button is in `DecisionSummaryTab`. The v1.21 task is validation + any staleness UX improvements.
- VER-01: `FORMULA_VERSION = 'v1.12-a'` constant exists in `pipeline/accuracy.py`. D-03 dedup (set-membership check) prevents duplicate records per formula version. `versions[]` array is written to `accuracy_backtest.json`. No UI comparison view exists yet.
- The two-attempt guardrail (loose attempt 0 + strict attempt 1 with name allowlist) exists in both Python and TypeScript implementations and must be kept byte-equivalent.

---

## Critical Pitfalls

### Pitfall 1: News Badge Fatigue — Zinc-Tier News That Is Multiple GWs Old

**What goes wrong:**
The FPL bootstrap `news` field is a free-text string that FPL does not consistently clear between gameweeks. A player who had a knock in GW30, played 90 minutes in GW31, played 90 minutes in GW32, and is fully fit in GW33 may still carry `news: "Recovering from knock — 75% chance of playing"` with `news_added` set 3 weeks ago and `chance_of_playing_next_round: 100`. The `computeNewsSeverity` function already handles this correctly — `chance === 100` + non-empty news returns `'zinc'` — but zinc badges still render for every such player. In a squad of 15, this means 4-6 stale zinc badges permanently visible, training users to ignore all news badges.

**Why it happens:**
FPL's API does not expire or clear news strings. The `news_added` timestamp is available in the response and already stored in `MergedPlayer.news_added`. However, the current `NewsBanner` does not use `news_added` to suppress stale zinc-severity items. `GemTable.tsx` already computes `relTime = news_added ? formatRelativeTime(news_added) : null` and passes it through to `PlayerRowDetail` — but this is display metadata, not a suppression gate.

**How to avoid:**
Add a staleness suppression rule to `computeNewsSeverity` or a new `isStaleNews(news_added: string | undefined, threshold_days: number): boolean` predicate. The rule: if `severity === 'zinc'` (i.e. `chance === 100` with non-empty news) AND `news_added` is more than 14 days old, return `'none'`. Red and amber severities (`chance < 100`) should never be suppressed regardless of age — an injured player with `chance = 50` is always actionable. The 14-day threshold constant should be a named export so it can be tested and adjusted.

**Warning signs:**
- Every player in SquadView shows a zinc badge
- Players who scored 10+ points last GW still have news badges
- `news_added` timestamps in the rendered row are more than 2 GWs old

**Phase to address:** SCRAPER-01 finalisation — specifically before wiring `NewsBanner` into TransferPanel buy candidates.

---

### Pitfall 2: Doubtful Players as Unpenalised Transfer Targets

**What goes wrong:**
`suggestTransfers` scores buy candidates by xPts delta. The `xmins` pipeline feeds `start_prob` into xPts, which does partially penalise uncertain starters. However, `chance_of_playing_next_round` is FPL's assessment from press conferences and medical staff — it reflects information more current than the historical `start_prob` signal. A player can have `start_prob = 0.87` (5-GW historical) but `chance_of_playing_next_round = 50` (just announced doubtful for this GW). The model scores him near the top; the news badge shows red; the user sees a top-ranked transfer suggestion with a red warning. Without additional context this reads as "system recommends this player despite the flag" when the correct action is "do not buy until fitness confirmed."

**Why it happens:**
`suggestTransfers` in TypeScript has no access to `chance_of_playing_next_round` at scoring time — the field is in `MergedPlayer` but the scoring logic uses `xPts_1gw` which was computed from `start_prob` in the Python pipeline. The live `chance` field is not fed back into the scoring engine.

**How to avoid:**
Two options, in order of preference:
1. In `pipeline/merge.py`, when `chance_of_playing_next_round` is defined and < 75, apply a multiplier to `xPts_1gw` before writing to `merged_players.json` (e.g. `xPts_1gw *= chance / 100`). This is pipeline-side and ensures consistent scoring across all surfaces.
2. If option 1 is too invasive for v1.21 scope: add a visual callout in TransferPanel when the top-N buy candidate has `chance < 100`: a banner above the OCS table reading "Top transfer target has an injury flag — wait for fitness news" with the amber/red colour of the news severity.
Do NOT silently re-rank; make the intervention visible to the user.

**Warning signs:**
- A player with `chance_of_playing_next_round = 25` appears as the #1 transfer recommendation
- TransferPanel shows a red news badge on the buy candidate with no other visual change to ranking or prominence

**Phase to address:** SCRAPER-01 TransferPanel integration step.

---

### Pitfall 3: LLM Cost Explosion — Prose Summary POST Triggered Automatically

**What goes wrong:**
The `/api/prose-summary` POST route generates a Claude Haiku prose summary on demand. The GET route serves the pipeline-generated `weekly_summary.json`. The risk for v1.21 is that any future code change wires the POST trigger to a reactive hook (e.g. `useEffect` that fires when captain picks change, when a transfer is selected, or when the Decision Summary tab mounts). A single `useEffect(() => { refresh.mutate(payload) }, [payload])` in `DecisionSummaryTab` would fire on every transfer interaction, potentially dozens of times per session.

At ~900 tokens/call × 4 sessions/day × 180 GW days = 648K tokens/season, cost is negligible. But a bug that triggers the POST on every re-render of a component that re-renders 50 times per session multiplies this by 50: 32M tokens/season ≈ $16-32/season from a single oversight. This exact risk is already documented in the PROJECT.md Key Decisions table ("NLP-02 on-demand trigger only, never useEffect").

**Why it happens:**
`useProseRefresh` returns a `useMutation` hook, which is safe by design — mutations do not auto-fire. The pitfall is if a developer wraps `refresh.mutate(payload)` in a `useEffect` or calls it from a function that runs reactively. The existing `ProseSummaryBlock` correctly places the call behind the `↻` button click handler — the risk is regression when other developers touch this component.

**How to avoid:**
- The `↻` button + `onClick={handleRefresh}` pattern in `ProseSummaryBlock` is correct; preserve it.
- Never add the prose refresh to `useEffect`, `useMemo`, or any subscription/reactive chain.
- Add a cooldown: disable the refresh button for 60 seconds after a successful POST (beyond the `isPending` guard already in place). This prevents rapid re-clicking from generating multiple summaries in a session.
- The Anthropic monthly spend cap in the Anthropic Console is the backstop — keep it set.

**Warning signs:**
- More than 2 `POST /api/prose-summary` log entries per session in Vercel function logs
- Prose summary refreshes without user clicking `↻`
- Monthly Anthropic spend jumps during a week with no schema changes

**Phase to address:** NLP-01 validation / any phase that modifies `DecisionSummaryTab` or `ProseSummaryBlock`.

---

### Pitfall 4: Prose Summary Staleness Without Visual Indication

**What goes wrong:**
`ProseSummaryBlock` shows `Updated GW{N}` — a gameweek number, not a timestamp. The pipeline generates `weekly_summary.json` once per daily run. Between pipeline runs, the Blob response is served with `stale-while-revalidate=86400` (24h revalidation). If the pipeline runs at 03:00 and recommends captaining Player A, but at 14:00 Player A is announced out injured, the prose summary continues recommending him until the next pipeline run at 03:00 the next day. The user sees `Updated GW38` with no indication the summary is 11 hours old and potentially wrong.

The `generated_at` field is already in the response schema (`{ prose, gw, generated_at }`). It is not currently displayed in `ProseSummaryBlock`.

**Why it happens:**
`Updated GW{N}` was the initial design (intuitive for FPL managers who think in GW terms). Timestamp staleness was a secondary concern when NLP-01 shipped. With SCRAPER-01 bringing live news into other parts of the UI, the mismatch between "news says player is injured" and "AI summary says captain him" becomes jarring.

**How to avoid:**
Display `generated_at` as a relative time string in `ProseSummaryBlock` alongside the GW number: `Updated GW38 · 6 hours ago`. Use `formatRelativeTime(displayed.generated_at)` — this utility already exists in `src/lib/formatRelativeTime.ts`. If `generated_at` is more than 20 hours old (approaching next pipeline run), add a subtle amber note: "Summary may be outdated — click ↻ to refresh."

**Warning signs:**
- `ProseSummaryBlock` renders without any timestamp
- Users report the summary recommends a player who is confirmed absent
- `generated_at` in the response payload is > 20 hours before current time

**Phase to address:** NLP-01 — add staleness display as part of the implementation, not as later polish.

---

### Pitfall 5: Hallucination Risk When News Context Is Added to LLM Prompt

**What goes wrong:**
If v1.21 extends the prose summary POST payload to include team news strings (from SCRAPER-01), the LLM prompt grows and the guardrail surface area increases. The current guardrail (`passesGuardrail`) checks that no player from the full FPL corpus appears in the prose unless they are in the `allowed` name set (captains + transfer pair + risks). Adding news context like `"Salah: Fit after training — expected to start"` to the user prompt introduces player names that are prominent in the context but may not be in the `allowed` set if Salah is not the user's captain or transfer target. The LLM, seeing the name in context, mentions it. Guardrail rejects. Both attempts fail. 422 returned. No prose shown.

**Why it happens:**
The `collectAllowedNames` function in `route.ts` only accepts names from `captains[]`, `transfer.sell/buy`, and `risks[]`. News player names are not added to `allowed`. If news text contains player names from outside the squad/recommendation context, guardrail failure is near-certain.

**How to avoid:**
Do NOT add raw news strings from the FPL bootstrap to the prose prompt. If injury context is needed, either:
1. Include only news for players already in the `allowed` set (filter before building prompt).
2. Express news as structured status data (e.g. `<availability name="Salah" status="fit"/>`) and add `Salah` to `allowed` only when he appears in that block.
3. Keep the current prompt scope (captains + gems + risks) and handle news separately in the UI rather than the prose.
Approach 3 is safest for v1.21 scope.

**Warning signs:**
- Guardrail rejection rate rises above 10% after adding news to prompt context
- 422 responses in logs for squads that previously generated prose successfully
- Strict-mode retry always failing (both attempts fail with different players mentioned)

**Phase to address:** NLP-01 — if extending the prompt payload beyond its current schema.

---

### Pitfall 6: Version Tag Drift — `FORMULA_VERSION` Not Bumped After Formula Changes in Other Files

**What goes wrong:**
`FORMULA_VERSION = 'v1.12-a'` lives in `pipeline/accuracy.py`. The D-03 dedup mechanism (set-membership check on `versions[]`) means that if `FORMULA_VERSION` is not bumped after a formula change, the next pipeline run finds the existing record and does NOT append a new one. The hit rate associated with the old tag continues to accumulate from new GWs' data, but the tag never signals that the formula changed. The AccuracyTab version comparison shows one version across the entire season — no history, no evidence of formula evolution.

The risk is highest when changes to xPts calculation happen in `pipeline/merge.py`, `pipeline/simulate.py`, `pipeline/xmins.py`, or `pipeline/bonus.py` — none of which touch `accuracy.py`. A developer making a CS probability adjustment in `merge.py` may not think to open `accuracy.py` to bump the tag.

**Why it happens:**
Manual version bumping has no automated enforcement gate. Code review is the only mechanism. Changes to files that don't import `FORMULA_VERSION` silently skip the bump.

**How to avoid:**
Add "Did you bump `FORMULA_VERSION` in `pipeline/accuracy.py`?" as a mandatory acceptance criterion in every phase plan that modifies any of: `merge.py`, `simulate.py`, `xmins.py`, `bonus.py`, `saves.py`. The tag pattern `v{milestone}-{letter}` (e.g. `v1.21-a`) is already defined — apply it. For VER-01, add a comment block above the `FORMULA_VERSION` constant listing the files that should trigger a bump.

**Warning signs:**
- `versions[]` in `accuracy_backtest.json` has only one entry despite multiple milestone deliveries
- AccuracyTab shows a single version row with no comparison history
- A PR modifies `merge.py` xPts logic but `accuracy.py` diff shows no change

**Phase to address:** VER-01 — define the bump protocol and add it to the phase checklist.

---

### Pitfall 7: Sample Size Incomparability in Version Comparison UI

**What goes wrong:**
The `versions[]` array in `accuracy_backtest.json` stores one record per `FORMULA_VERSION` with `hit_rate` (a scalar). Two entries side by side in a comparison UI can show `v1.12-a: 18.99%` and `v1.21-a: 0.0%`. The second entry was written by `_empty_backtest` at the start of the season when no GWs were finished. `hit_rate: 0.0` is not a regression — it is a cold-start artefact — but it looks catastrophic next to a mature version's 19% hit rate.

More broadly: a version recorded at GW3 (3 GWs of data, 30 observations per decile) is not comparable to one at GW38 (5-GW rolling window, 200 observations per decile). Presenting them with equal visual weight misleads.

**Why it happens:**
The current schema `{ formula_version, recorded_at, hit_rate, gate_flags }` has no `sample_gws` field. The UI, when built, has no way to distinguish a cold-start zero from a genuinely low-performing formula.

**How to avoid:**
Before building the VER-01 comparison UI: extend the version record schema to include `sample_gws: int` (count of GWs that contributed observations to the hit_rate calculation). The `_empty_backtest` path writes `sample_gws: 0`; the normal path writes `sample_gws: len(target_gws_desc)` (already tracked as `gws_covered`). The UI should: (a) filter entries with `sample_gws < 3` from the comparison table, or (b) label them clearly as "Pre-season (no data)".

**Warning signs:**
- Version comparison table shows `0.0%` in one row with no qualifier
- User asks "did the model get worse?" after a version bump at season start
- `versions[]` includes the initial pre-season `_empty_backtest` entry in the UI

**Phase to address:** VER-01 — extend schema before building UI.

---

### Pitfall 8: Storage Growth From Per-Run Version Appending

**What goes wrong:**
The D-03 dedup correctly prevents appending on every pipeline run — only one record per unique `FORMULA_VERSION`. This is the safe design. The pitfall is a future developer treating VER-01 as "full historical backtesting" and changing the append logic to add one record per pipeline run (e.g. to track accuracy evolution within a single formula version across the season). At 38 GWs × 1 record/run, the `versions[]` array is still small. But if `predictions_snapshot.json` is extended to store per-run snapshots per formula version (600 players × 5 historical GWs × N runs), the Blob storage cost grows proportionally.

**Why it happens:**
The current design is explicitly scoped to "one record per formula tag" (D-03). The temptation after shipping VER-01 is to add granularity: "track how the same formula performs across the season." This is a reasonable idea but out of scope for v1.21.

**How to avoid:**
Keep `versions[]` as-is: one lightweight record per unique formula tag (formula_version, recorded_at, hit_rate, gate_flags, sample_gws). Do NOT change the dedup logic to allow multiple records per tag. If within-version accuracy tracking is needed in a future milestone, the correct approach is a separate `accuracy_trend.json` keyed by `(formula_version, gw)` — not modifying the existing versions array.

**Warning signs:**
- `versions[]` grows more than ~5 entries per season (would indicate per-run appending)
- `accuracy_backtest.json` file size in Blob increases by more than 1KB per pipeline run
- D-03 dedup condition is modified to allow same-version re-appends

**Phase to address:** VER-01 — explicitly note the per-tag (not per-run) constraint in the implementation plan.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `FORMULA_VERSION` in `accuracy.py` with no CI enforcement | Zero tooling overhead | Version drift when formula changes in other files; no audit trail | Acceptable for personal tool — compensate with per-phase checklist item |
| Display raw `news` string with no staleness suppression | Zero parsing complexity | Zinc badge fatigue; users ignore all news badges | Never acceptable — `news_added` field already available to fix this |
| Show `Updated GW{N}` without `generated_at` timestamp in `ProseSummaryBlock` | Simpler copy | Users cannot tell if summary is from today or yesterday | Never in v1.21 — `generated_at` is already in the response payload |
| Omit `sample_gws` from version record | No schema change needed | Cold-start zeros look like real regressions in version comparison UI | Never if building a comparison UI |
| One `FORMULA_VERSION` record per unique tag (not per run) | Minimal Blob growth | Cannot track within-version accuracy drift across a season | Acceptable for v1.21 — out-of-scope concern |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FPL `news` field | Treating non-empty string as always current news | Cross-reference `news_added` timestamp; suppress zinc-tier (`chance === 100`) badges older than 14 days |
| FPL `chance_of_playing_next_round` | Assuming `null` always means "healthy" | `null` means FPL hasn't set an availability estimate — could be healthy OR pre-season/untracked. Cross-reference with `status` field: `status: 'a'` + `chance: null` = healthy |
| Anthropic API in prose-summary POST | Calling from `useEffect` or any reactive hook | `useMutation` + explicit user button only; never in `useEffect` |
| `passesGuardrail` in TypeScript + Python | Adding a new guardrail rule only in one implementation | Both `src/lib/prose-guardrail.ts` and `pipeline/prose_summary.py::_passes_guardrail` must stay byte-equivalent. If you add a staleness check or additional rule to one, mirror it in the other |
| `versions[]` dedup in `accuracy_backtest.json` | Changing dedup from set-membership to tail-only comparison | Set-membership (current D-03) catches interior matches; tail-only would allow the same version to reappear after a bump-and-revert cycle |
| `news_added` field in pipeline | Returning empty string `''` as default vs `None` | `pipeline/merge.py` already uses `element.get('news_added', '')` — the TypeScript type is `news_added?: string`. An empty string should be treated the same as `undefined` when computing staleness |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Prose summary POST on every Decision Summary tab mount | Anthropic spend scales with tab switches | POST is behind `useMutation` + button — never in `useEffect`; preserve this invariant | Day 1 if wired incorrectly |
| `readPlayerCorpus` in prose-summary POST reads 3-5MB Blob on every call | Slow POST response; Vercel function cold-start amplified | Vercel function reuse caches in-memory after first call in same instance; acceptable for single-user tool | If POST is called frequently from a serverless cold-start environment |
| `computeNewsSeverity` called on every row render for all 600+ players in GemTable | Negligible — pure function, no I/O | No issue at this scale | Not a concern; `formatRelativeTime` is the heavier call |
| `versions[]` array iteration in `compute_accuracy_backtest` | Linear scan on every pipeline run | Already O(n) set-membership; n < 20 entries per season — not a concern | Never |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Zinc news badge for players who played 90 min last GW | Trained badge blindness; all news dismissed | Add staleness suppression: zinc-severity + `news_added` > 14 days old → suppress badge |
| AI summary recommending an injured player with no staleness indicator | Trust erosion in AI summary feature | Display `generated_at` as relative time ("6 hours ago") in `ProseSummaryBlock` |
| Version comparison table showing `0.0%` cold-start entry | Looks like catastrophic regression | Filter `sample_gws < 3` entries or label as "Pre-season — no data" |
| Red news badge on top transfer target with no UI context | User confused whether engine accounts for injury | Add advisory banner in TransferPanel when top buy candidate has `chance < 100` |
| News badge appearing in GemTable for all 600 players | Noise in a data-dense table | News badges in GemTable expand-row only; in TransferPanel and captain surfaces as primary decision context |

---

## "Looks Done But Isn't" Checklist

- [ ] **SCRAPER-01 news badge staleness:** `computeNewsSeverity` or a new predicate suppresses zinc-severity badges when `news_added` is more than 14 days old. Verify by checking a player with `chance === 100` and `news_added` 3+ weeks ago renders no badge.
- [ ] **SCRAPER-01 TransferPanel wiring:** `NewsBanner` renders on buy-candidate rows in `OpportunityCostTable`. `news_added` is already passed at line 139 — confirm the badge renders in production with real squad data.
- [ ] **NLP-01 staleness display:** `ProseSummaryBlock` shows `generated_at` as a relative time string alongside `GW{N}`. Verify by checking the rendered output when `generated_at` is 10+ hours old.
- [ ] **NLP-01 refresh cooldown:** The `↻` button is disabled during `isPending`. Verify it also becomes disabled for 60 seconds after a successful POST (not just during the in-flight request).
- [ ] **VER-01 schema extension:** Every new version record includes `sample_gws: int` before the comparison UI is built. Verify `accuracy_backtest.json` versions array includes `sample_gws` in its entries.
- [ ] **VER-01 cold-start suppression:** The AccuracyTab version comparison table filters or labels entries where `sample_gws < 3`. Verify by checking a cold-start `accuracy_backtest.json` does not cause a `0.0%` row to render alongside a mature version.
- [ ] **VER-01 bump protocol:** The phase plan for any v1.21 task that modifies xPts formula files includes "bump `FORMULA_VERSION` in `pipeline/accuracy.py`" as an explicit acceptance criterion.
- [ ] **SCRAPER-01 `news_flag_enabled` gate:** `useNewsFlagEnabled()` returns `false` on cold-start (no `accuracy_backtest.json` loaded yet). Verify `NewsBanner` renders nothing when the gate is `false`.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Prose summary POST wired to `useEffect` (cost explosion) | MEDIUM | Kill switch: remove `ANTHROPIC_API_KEY` from Vercel env to disable all LLM routes; fix the `useEffect` trigger; redeploy; restore key; Anthropic Console cap is the backstop |
| Version tag drift (formula changed without bump) | LOW | Bump `FORMULA_VERSION` immediately; redeploy pipeline; next run creates new record; old record retains its (incorrect) attribution — acceptable data quality note for a personal tool |
| Guardrail always rejecting prose after news context added | LOW | Revert news context from POST payload; return to captains/transfer/risks-only scope; audit `collectAllowedNames` to include all prompt-referenced player names |
| Zinc badge fatigue (all players show news badges) | LOW | Add staleness predicate to `computeNewsSeverity`; one function change; no pipeline changes needed |
| VER-01 UI showing misleading cold-start `0.0%` row | LOW | Add `sample_gws < 3` filter to the AccuracyTab version table query; one UI component change |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Zinc badge fatigue from stale news | SCRAPER-01 (staleness rule) | Player with `chance === 100` and `news_added` > 14 days renders no badge |
| Doubtful player as unpenalised transfer target | SCRAPER-01 (TransferPanel integration) | Player with `chance < 75` is visually distinguished in OCS buy-candidate list |
| Prose POST cost explosion from reactive trigger | NLP-01 wiring | No POST entry in Vercel logs except on explicit `↻` button click |
| Stale prose with no temporal indicator | NLP-01 | `ProseSummaryBlock` shows relative `generated_at` timestamp |
| Hallucination from news names in prompt | NLP-01 (if prompt extended) | Guardrail rejection rate < 5% with real squad data |
| Version tag drift | VER-01 | Each phase plan modifying formula files includes explicit FORMULA_VERSION bump in acceptance criteria |
| Sample size incomparability in version comparison | VER-01 | `sample_gws` field present in version records; cold-start entries filtered or labelled in UI |
| Storage growth from per-run appending | VER-01 | `versions[]` grows by at most 1 entry per unique formula tag per season |

---

## Sources

- Direct codebase audit: `src/lib/newsSeverity.ts` — severity classification rules, zinc/amber/red thresholds
- Direct codebase audit: `src/components/news/NewsBanner.tsx` — `useNewsFlagEnabled` gate, rendering logic
- Direct codebase audit: `src/components/gem-table/GemTable.tsx` — `news_added` passed as `relTime` metadata but not used as suppression gate
- Direct codebase audit: `pipeline/accuracy.py` — `FORMULA_VERSION = 'v1.12-a'`, D-03 set-membership dedup, `versions[]` append logic, `_empty_backtest` path
- Direct codebase audit: `pipeline/prose_summary.py` — qualitative-only prompt, two-attempt guardrail, non-fatal try/except, `None` fallback
- Direct codebase audit: `src/app/api/prose-summary/route.ts` — GET/POST split, `readPlayerCorpus`, `collectAllowedNames`, `buildUserPrompt`, `passesGuardrail`
- Direct codebase audit: `src/lib/hooks/useProseSummary.ts` — 6h staleTime, 404 → null pattern
- Direct codebase audit: `src/lib/hooks/useProseRefresh.ts` — `useMutation` pattern, 422 → GUARDRAIL_FAILED sentinel
- Direct codebase audit: `src/components/squad/ProseSummaryBlock.tsx` — refresh button, `override` state, guardrail error handling
- Direct codebase audit: `src/lib/types.ts` — `news_added?: string`, `chance_of_playing_next_round?: number | null`, `news_flag_enabled?: boolean`
- Direct codebase audit: `pipeline/merge.py` lines 992-995 — `news`, `news_added`, `chance_of_playing_next_round` passthrough from FPL bootstrap
- Existing key decision (PROJECT.md): "NLP-02 on-demand trigger only, never useEffect — cost explosion risk: 50 rows × 900 tokens × 4 sessions × 180 days ≈ USD 16–32/season from one bug"
- Existing key decision (PROJECT.md): "INSIGHT_BATCH_ENABLED env var gate defaults false — cost stays predictable"
- FPL API behaviour: `news` field is not cleared between GWs; `news_added` timestamp is the only staleness signal available

---
*Pitfalls research for: FPL Analyst v1.21 — SCRAPER-01, NLP-01, VER-01*
*Researched: 2026-05-16*
