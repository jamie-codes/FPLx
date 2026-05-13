# Phase 105: NLP-02 Per-Player LLM Insight Route, Hook & UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 105-nlp-02-per-player-llm-insight-route-hook-ui
**Areas discussed:** Insight display, TransferPanel placement, Loading & error UX, Insight text spec

---

## Insight display

| Option | Description | Selected |
|--------|-------------|----------|
| Labeled section | Small "AI Insight" heading (icon + label in zinc-400) above 1–3 sentence prose block | ✓ |
| Inline prose, no heading | Italic prose block appended directly below ComparisonSearch, no heading | |
| You decide | Claude picks the visual treatment | |

**User's choice:** Labeled section

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show immediately if cached | Check localStorage on row expand; show insight without button click if cached; button becomes "Refresh insight" | ✓ |
| Always show button first | Button always appears regardless of cache state; user must click even for cached insights | |

**User's choice:** Show immediately if cached

---

| Option | Description | Selected |
|--------|-------------|----------|
| No dismiss — insight stays visible | Insight persists for expand duration; collapsing clears UI state | ✓ |
| Yes — add a dismiss (×) button | Small × button hides section (UI only, cache preserved) | |

**User's choice:** No dismiss

---

| Option | Description | Selected |
|--------|-------------|----------|
| Below ComparisonSearch (bottom) | Appended last in expand row, after all existing analytical panels | ✓ |
| Above ComparisonSearch | Between FragilityBadge and ComparisonSearch | |

**User's choice:** Below ComparisonSearch

---

## TransferPanel placement

| Option | Description | Selected |
|--------|-------------|----------|
| In PlayerMoveCell | Appended below existing buy-side badges inside PlayerMoveCell | ✓ |
| At OCS row level | One button per OCS row, placed after all PlayerMoveCells | |

**User's choice:** In PlayerMoveCell

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in PlayerMoveCell | Insight section renders inside PlayerMoveCell; same labeled-section treatment | ✓ |
| Separate panel / modal | Insight opens in overlay or slide-in panel | |

**User's choice:** Inline in PlayerMoveCell

---

| Option | Description | Selected |
|--------|-------------|----------|
| Buy candidates only | Button absent for Roll rows naturally; no explicit guard needed | ✓ |
| Explicit guard in PlayerMoveCell | Add explicit `t.buy` check before rendering button | |

**User's choice:** Buy candidates only (naturally implied by render logic)

---

## Loading & error UX

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner on button, disabled | Button label changes to "Generating…"; disabled during mutation | ✓ |
| Skeleton placeholder | Insight section renders immediately with shimmer lines; button disappears | |

**User's choice:** Spinner on button, disabled

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error text below button | "AI unavailable — try again" in zinc-500/red-400 below button; button resets to idle | ✓ |
| Button resets silently | Button resets to idle with no feedback | |
| Toast notification | Error triggers a toast banner; button resets to idle | |

**User's choice:** Inline error text below button

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reasons list with note | "AI insight unavailable — showing analysis:" header + reasons[] bullets | ✓ |
| Silent fallback | reasons[] rendered as prose; user doesn't know it's a fallback | |

**User's choice:** Reasons list with note (transparent about fallback source)

---

## Insight text spec

| Option | Description | Selected |
|--------|-------------|----------|
| 2–3 sentences, transfer-decision focus | Form, fixture, rotation risk, MC outlook, one recommendation | ✓ |
| 3–4 sentences, player profile | Broader context: form trend, fixtures, differential/premium framing | |
| You decide | Claude sets system prompt length and focus | |

**User's choice:** 2–3 sentences, transfer-decision focus

---

| Option | Description | Selected |
|--------|-------------|----------|
| Core set: rejection reasons + fragility + MC | reasons[], fragility tier+reasons, lifecycle label, MC fields | ✓ |
| Extended: add form, xPts, value, news | Core set + form score, xPts_1gw, now_cost, news | |

**User's choice:** Core set only (lean prompt, grounded in signals already visible in UI)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full merged_players.json corpus | All web_names as corpus; allowed = [player.web_name] | ✓ |
| Minimal corpus (target player only) | No corpus load; only check target player name | |

**User's choice:** Full merged_players.json corpus (same approach as NLP-01)

---

## Claude's Discretion

- Exact CSS classes for "AI ✨ Insight" heading (zinc-400 / zinc-500 styling to match FragilityBadge tone)
- `USE_BLOB` local-dev fallback strategy in the new route
- Whether `xmlEscape` is extracted to a shared util or copied inline
- `gw` prop threading into `PlayerMoveCell` (currently not receiving GW number — Claude decides cleanest way to thread it down from `OpportunityCostTable`)
- Exact stale time / retry config for the `useMutation` hook

## Deferred Ideas

- `cache_control: ephemeral` prompt caching — deferred to v1.19+ (system prompt ~80 tokens, below 1024-token minimum)
- NLP-BATCH pipeline pre-generation — deferred to v1.19+ (await UAT latency feedback)
