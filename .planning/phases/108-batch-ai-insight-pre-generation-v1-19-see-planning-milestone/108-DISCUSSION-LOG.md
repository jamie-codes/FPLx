# Phase 108: Batch AI Insight Pre-Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 108-Batch AI Insight Pre-Generation
**Areas discussed:** Player data shape, Batch module structure, Guardrail & retry in batch, Prompt caching in Python batch

---

## Player Data Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Simplified — MC fields only | Use web_name, element_type, haul_prob, blank_prob, p10_pts, p90_pts from merged_players.json. No rejection_reasons/fragility/lifecycle. | ✓ |
| Full parity — port rejection/fragility logic to Python | Compute rejection_reasons and fragility.tier from merged_players.json fields in Python. Adds 50–80 lines of porting work but matches on-demand context exactly. | |
| Empty rejection fields | Match on-demand XML structure but with empty/default rejection_reasons and fragility. | |

**User's choice:** Simplified — MC fields only

---

## System Prompt for Batch

| Option | Description | Selected |
|--------|-------------|----------|
| Same system prompt as on-demand | Identical text to buildSystemPrompt() in route.ts. Claude will naturally focus on haul/blank since that's all the context gives it. | ✓ |
| Batch-specific simplified prompt | Strip the "Reference form, fixture, rotation risk" instruction since those aren't in the XML. | |

**User's choice:** Same system prompt as on-demand

---

## Batch Module Structure

| Option | Description | Selected |
|--------|-------------|----------|
| pipeline/batch_insights.py | New dedicated module following the prose_summary.py pattern. Clean, testable in pipeline/tests/, isolated from run.py. | ✓ |
| Inline in run.py | Add the batch step as a block in run.py like the GW review section. | |

**User's choice:** pipeline/batch_insights.py (Recommended)

---

## Guardrail & Retry

| Option | Description | Selected |
|--------|-------------|----------|
| Skip player, continue batch | Same 2-attempt/strict-mode retry as on-demand. If both attempts fail, skip that player, log a warning, continue to next player. | ✓ |
| Skip all remaining on first failure | Abort the whole batch on any guardrail failure. | |

**User's choice:** Skip player, continue batch (Recommended)

---

## Prompt Caching in Python Batch

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — apply cache_control now | Wire cache_control: ephemeral even though ~80 tokens is below threshold. Consistent with Phase 107 TS route. | ✓ |
| Skip caching in batch | Don't add cache_control in Python. Simpler code, can add later. | |

**User's choice:** Yes — apply cache_control now (Recommended)

---

## Claude's Discretion

- Model selection: `claude-haiku-4-5-20251001` (same as on-demand route)
- `max_tokens`: 300 (same as on-demand)
- Whether to emit per-player cache logging analogous to `[player-insight] cache` log line
- Sequential vs concurrent API calls (sequential recommended for rate limit safety)

## Deferred Ideas

None — discussion stayed within phase scope.
