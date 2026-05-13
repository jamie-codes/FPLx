# Phase 105: NLP-02 Per-Player LLM Insight Route, Hook & UI - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 105 delivers the full NLP-02 feature: an on-demand AI insight button in GemTable row expand and TransferPanel (`PlayerMoveCell`) that calls a new POST Route Handler `/api/player-insight`, caches results per `(player_id, pipeline_run_date)` in localStorage + Vercel Blob, and enforces a two-attempt name-whitelist guardrail with deterministic fallback to structured `reasons[]` on failure.

Deliverables:
1. **`/api/player-insight` Route Handler** — Node.js only (never Edge), `maxDuration = 30`, non-streaming `messages.create` against `claude-haiku-4-5-20251001`, two-attempt guardrail retry loop, 2-tier cache write (localStorage via client, Vercel Blob `put` with `addRandomSuffix: false` in route), full error handling (401 / 429 / 5xx / missing-key / 422-guardrail).
2. **`usePlayerInsight` hook** — `useMutation` (not `useQuery`), `mutationKey: ['playerInsight', playerId, gw]`, localStorage cache check before firing, never auto-triggered from `useEffect`.
3. **`PlayerInsightSection` component** — labeled section ("AI ✨ Insight" heading in zinc-400 + 1–3 sentence prose), spinner-on-button loading state, inline error text on failure, reasons-list fallback on 422.
4. **GemTable integration** — `PlayerInsightSection` appended at the bottom of both mobile and desktop expand rows, below `ComparisonSearch`. Shows immediately if localStorage cache hit on row expand; otherwise shows "Get AI insight" button.
5. **`PlayerMoveCell` integration** — same `PlayerInsightSection` appended below existing buy-side badges (RotationRiskBadge, news banner, FragilityBadge), buy-candidate rows only.

**Out of scope:** `cache_control: ephemeral` prompt caching (system prompt ~80 tokens, well below 1024-token minimum — deferred), NLP-BATCH pipeline pre-generation (deferred until on-demand latency proves unacceptable), any Python pipeline changes, streaming responses (forbidden on this route).

</domain>

<decisions>
## Implementation Decisions

### Insight display in GemTable expand row
- **D-01:** Visual treatment = labeled section with "AI ✨ Insight" heading (icon + label in zinc-400 style, matching FragilityBadge tone) above 1–3 sentence prose block. Not inline-italic — gives the AI content a clear visual anchor.
- **D-02:** Cache-aware auto-show — on row expand, check localStorage for a cached insight for this `(player_id, pipeline_run_date)`. If found, render the labeled section immediately with no button click required. Button appears as "Refresh insight" below the prose for manual re-generation.
- **D-03:** No dismiss button. Insight stays visible for the expand duration. Collapsing the row clears UI state; re-expanding re-checks localStorage (instant re-render if still cached).
- **D-04:** Placement = bottom of expand row, below `ComparisonSearch` (appended last in both mobile `<tr>` and desktop `<tr>`).

### TransferPanel placement
- **D-05:** Button placement = inside `PlayerMoveCell`, appended below existing buy-side badges (RotationRiskBadge → news banner → FragilityBadge → `PlayerInsightSection`). Not at the OCS row level.
- **D-06:** Insight renders inline inside `PlayerMoveCell`, using the same `PlayerInsightSection` component as GemTable. No overlay or modal.
- **D-07:** Button only appears for rows with actual buy candidates. "Roll" rows have no `PlayerMoveCell` so the button is naturally absent — no explicit guard needed.

### Loading and error UX
- **D-08:** Loading state = spinner on button, button disabled. Label changes to "Generating…" (or an animated indicator). No skeleton/placeholder — no layout shift until content arrives.
- **D-09:** Hard errors (502, 503, 429, network failure) = small inline error text below the button in zinc-500 or red-400: "AI unavailable — try again". Button resets to idle for retry. No toast.
- **D-10:** Guardrail fallback (422 — both attempts failed name-whitelist) = the `PlayerInsightSection` renders with the header "AI insight unavailable — showing analysis:" followed by the structured `reasons[]` bullets. The user still gets useful content; the source is transparent.

### Insight text specification
- **D-11:** Length and focus = 2–3 sentences, transfer-decision oriented. System prompt: "FPL analyst. Explain qualitatively whether this player is worth targeting this GW. Reference form, fixture, rotation risk, and haul/blank outlook. 2–3 sentences. Do not include statistics or numeric values. Refer to the player by the exact name in <player name=…>."
- **D-12:** XML context (core set only) — `computeRejection` reasons[], `computeFragility` tier + reasons, lifecycle label, MC fields (`haul_prob`, `blank_prob`, `p10_pts`, `p90_pts`). These are the exact signals the user sees in the UI, so the insight is directly grounded in visible data. Extended fields (form, xPts, value, news) excluded to keep the prompt lean.
- **D-13:** Guardrail corpus = full `merged_players.json` web_names (same approach as NLP-01 in `prose-summary/route.ts`). `allowed` set = `[player.web_name]` (just the one target player). Any other real player name in the prose triggers a retry with a stricter system prompt.

### Locked decisions (from ROADMAP / STATE — not re-discussed)
- Runtime: Node.js only, never Edge (`@anthropic-ai/sdk` SSE parsing fails on Edge per anthropics/anthropic-sdk-typescript#292)
- `maxDuration = 30` on the route handler
- Non-streaming `messages.create` only (no streaming)
- Model: `claude-haiku-4-5-20251001`
- `useMutation` not `useQuery` (no auto-refetch); `mutationKey: ['playerInsight', playerId, gw]`
- Trigger: on-demand button click only — never `useEffect`
- Blob cache key: `player_insights/gw{N}/element_{id}.json`, `addRandomSuffix: false`; cache invalidates when `pipeline_run_date` changes
- Two-attempt name-whitelist guardrail: attempt 1 = base system prompt, attempt 2 = strict mode listing only allowed names
- Fallback on 422: structured `reasons[]` rendered with disclaimer header (D-10)
- `ANTHROPIC_API_KEY` server-side only — never `NEXT_PUBLIC_*`; 503 if key absent
- Anthropic Console monthly spending cap must be configured before merge

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### NLP-01 analog (route + guardrail + hook pattern)
- `src/app/api/prose-summary/route.ts` — Exact analog for `/api/player-insight`: two-attempt retry loop, `passesGuardrail` call, `xmlEscape` helper, XML prompt structure, `USE_BLOB` pattern, `maxDuration`, Anthropic client instantiation, Zod request validation. MUST read before writing the new route.
- `src/lib/prose-guardrail.ts` — `passesGuardrail` and `findHallucinatedNames` exported functions. Reuse directly in `/api/player-insight` (same logic, different `allowed` set).
- `src/lib/hooks/useProseRefresh.ts` — `useMutation` pattern to mirror for `usePlayerInsight`. Shows error sentinel handling (`GUARDRAIL_FAILED`) and mutation shape.

### GemTable expand row integration points
- `src/components/gem-table/GemTable.tsx` lines ~299–395 — Both mobile and desktop expand `<tr>` blocks. `PlayerInsightSection` appended at the bottom of each (after `ComparisonSearch`). `computeRejection` and `computeFragility` are already computed at this scope — their outputs are available as context for the hook call.
- `src/components/gem-table/GemTable.tsx` — `RejectionPanelInline`, `RowExpandNewsSection`, `FragilityBadge`, `ComparisonSearch` are the existing expand-row components; `PlayerInsightSection` follows last.

### TransferPanel / OpportunityCostTable integration points
- `src/components/transfers/OpportunityCostTable.tsx` — `PlayerMoveCell` function (lines ~97–149). `PlayerInsightSection` appended after the FragilityBadge/sell-rejection-reasons block, inside `PlayerMoveCell`. The `t.buy` player object is available here for the hook call.

### Player data types and existing hooks
- `src/lib/types.ts` — `ScoredPlayer` / `MergedPlayer` shapes (MC fields: `haul_prob`, `blank_prob`, `p10_pts`, `p90_pts`; `web_name`, `id`, `element_type`, lifecycle fields). New `PlayerInsightResponse` type should be added here.
- `src/lib/explain.ts` — `computeRejection` return shape (specifically `reasons[]`) — needed for XML context building and guardrail fallback rendering.
- `src/lib/sensitivity.ts` — `computeFragility` return shape (tier + reasons[]) — needed for XML context building.

### Vercel Blob write (new pattern — only `list` exists today)
- All existing routes in `src/app/api/*/route.ts` use only `list` from `@vercel/blob`. The `put` call with `addRandomSuffix: false` is new. Confirm overwrite semantics in deployed runtime before relying on it (noted as Phase 105 spike in STATE.md).

### Locked infrastructure decisions
- `.planning/ROADMAP.md` Phase 105 notes — runtime constraints, model, mutation key, cache key shape, cost-explosion pitfall, spending cap requirement. MUST read.
- `.planning/REQUIREMENTS.md` NLP-02 entry — acceptance criteria (5 success criteria). MUST verify all 5 before marking phase complete.
- `.planning/STATE.md` Deferred Items — `PROMPT-CACHE` and `NLP-BATCH` explicitly deferred to v1.19+; do NOT implement in this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `passesGuardrail(prose, allowed, corpus)` in `src/lib/prose-guardrail.ts` — identical logic needed; just changes `allowed` from squad names to `[player.web_name]`
- `xmlEscape(s: string)` in `prose-summary/route.ts` — copy or extract to shared util for XML prompt building
- `useProseRefresh.ts` — exact `useMutation` shape to copy for `usePlayerInsight`; note the `GUARDRAIL_FAILED` error sentinel pattern
- `computeRejection` and `computeFragility` return values are already computed in the GemTable expand row scope — no additional computation needed, pass results directly to the hook/component
- `USE_BLOB` env-flag pattern in `prose-summary/route.ts` — should be replicated in the new route for local-dev fallback

### Established Patterns
- Blob reads: `list({ prefix: 'key', limit: 1 })` → `fetch(blobs[0].url)` (all existing routes)
- Blob writes: `put(key, body, { addRandomSuffix: false, access: 'public' })` — first usage in this codebase; verify semantics in deployed environment
- Route error handling: `Response.json({ error: '...' }, { status: N })` with specific codes (400 bad body, 503 no key, 422 guardrail, 502 LLM error)
- Zod request validation before any Anthropic call (`PostBodySchema.safeParse`)
- `maxDuration = 30` export at route module level (Hobby plan compatibility)

### Integration Points
- `GemTable.tsx` expand rows — new `PlayerInsightSection` added at bottom of both mobile `sm:hidden` and desktop `hidden sm:table-row` expand blocks (must appear in both)
- `OpportunityCostTable.tsx` → `PlayerMoveCell` function — new `PlayerInsightSection` after FragilityBadge line; `PlayerMoveCell` needs `gw` prop threaded down (currently not receiving GW number)
- `src/lib/hooks/` — new `usePlayerInsight.ts` hook file; follows `useProseRefresh.ts` naming and mutation shape
- New route: `src/app/api/player-insight/route.ts` — POST only; GET not needed

</code_context>

<specifics>
## Specific Ideas

- Button label: "Get AI insight" (idle) → "Generating…" (loading, disabled) → "Refresh insight" (when insight already shown from cache)
- "AI ✨ Insight" section heading: `text-xs text-zinc-400 dark:text-zinc-500` style, matching FragilityBadge label tone
- Guardrail fallback header text: "AI insight unavailable — showing analysis:" followed by the `reasons[]` bullets using the same style as `RejectionPanelInline` reason items
- Inline error text: `"AI unavailable — try again"` in `text-xs text-zinc-500` below the reset button
- XML context shape (for system prompt design):
  ```xml
  <player name="{web_name}" position="{element_type}" lifecycle="{lifecycle_label}">
    <mc haul_prob="{haul_prob}" blank_prob="{blank_prob}" p10_pts="{p10_pts}" p90_pts="{p90_pts}"/>
    <fragility tier="{tier}">
      <reason>{fragility reason 1}</reason>
    </fragility>
    <reasons>
      <reason>{rejection reason 1}</reason>
      <reason>{rejection reason 2}</reason>
    </reasons>
  </player>
  ```
- `mutationKey: ['playerInsight', player.id, gw]` (from ROADMAP) — ensures in-flight dedup per player per GW
- Blob path: `player_insights/gw{gw}/element_{player.id}.json` — `gw` is the current GW number from the page context

</specifics>

<deferred>
## Deferred Ideas

- **PROMPT-CACHE** (`cache_control: ephemeral` on system prompt) — explicitly deferred to v1.19+; system prompt is ~80 tokens, well below the 1024-token cache minimum. Do NOT implement in this phase.
- **NLP-BATCH** (pipeline pre-generation of top-20 player insights) — deferred to v1.19+ until on-demand latency proves unacceptable in UAT.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 105-nlp-02-per-player-llm-insight-route-hook-ui*
*Context gathered: 2026-05-13*
