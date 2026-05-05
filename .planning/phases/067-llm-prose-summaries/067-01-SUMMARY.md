---
phase: "067-llm-prose-summaries"
plan: "01"
subsystem: "llm-prose-guardrail"
tags: [llm, anthropic, claude, guardrail, prose-summary, fpl, types, tdd]
dependency_graph:
  requires: []
  provides:
    - "ProseSummary interface (src/lib/types.ts)"
    - "ProseRefreshPayload interface (src/lib/types.ts)"
    - "passesGuardrail function (src/lib/prose-guardrail.ts)"
    - "findHallucinatedNames function (src/lib/prose-guardrail.ts)"
    - "Wave 0 RED test contracts for Plans 02 and 03"
    - "@anthropic-ai/sdk@0.93.0 npm dependency"
    - "anthropic>=0.98.1 Python dependency"
  affects:
    - "Plans 02 and 03: frozen contract to implement against"
tech_stack:
  added:
    - "@anthropic-ai/sdk@0.93.0"
    - "anthropic>=0.98.1 (Python, requirements.txt)"
  patterns:
    - "Pure TS module with no React/fetch/SDK imports (prose-guardrail.ts)"
    - "Vitest node-env for pure function tests"
    - "Vitest jsdom for component tests"
    - "pytest with monkeypatch fixtures for Python SDK mocking"
key_files:
  created:
    - "src/lib/prose-guardrail.ts (36 lines)"
    - "src/lib/prose-guardrail.test.ts (38 lines)"
    - "pipeline/tests/test_prose_summary.py (116 lines)"
    - "src/app/api/prose-summary/route.test.ts (117 lines)"
    - "src/components/squad/ProseSummaryBlock.test.tsx (94 lines)"
  modified:
    - "src/lib/types.ts (16 lines appended — ProseSummary + ProseRefreshPayload)"
    - "pipeline/requirements.txt (1 line appended — anthropic>=0.98.1)"
    - "package.json (@anthropic-ai/sdk added to dependencies)"
    - "package-lock.json (lockfile updated by npm install)"
decisions:
  - "Guardrail algorithm: normalize = toLowerCase + collapse-whitespace + trim; substring match per corpus name against prose; allowed set is a normalized Set for O(1) lookup"
  - "passesGuardrail delegates entirely to findHallucinatedNames — single source of truth"
  - "Wave 0 test scaffolds are deliberately RED (production modules do not exist yet); they define the contract Plans 02/03 must satisfy"
  - "Python anthropic package declared in requirements.txt only — not installed locally; plan 02 wires into pipeline.yml"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-05-05"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 4
---

# Phase 67 Plan 01: Wave 0 Foundation — Types, Guardrail, Test Scaffolds Summary

**One-liner:** Frozen contract for LLM prose summaries: TS guardrail module (exact-match, case-insensitive), two new type interfaces, five Wave 0 RED test files, and Anthropic SDK declarations for Python and npm.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ProseSummary + ProseRefreshPayload types and TS guardrail | bb38d5f | src/lib/types.ts, src/lib/prose-guardrail.ts, src/lib/prose-guardrail.test.ts |
| 2 | Land all Wave 0 RED test scaffolds for Plans 02 and 03 | b7c2b6f | pipeline/tests/test_prose_summary.py, src/app/api/prose-summary/route.test.ts, src/components/squad/ProseSummaryBlock.test.tsx |
| 3 | Declare Anthropic SDK dependencies (Python + npm) | 592c1d6 | pipeline/requirements.txt, package.json, package-lock.json |

## Type Signatures Landed in `src/lib/types.ts`

```typescript
export interface ProseSummary {
  prose: string
  gw: number
  generated_at: string  // ISO 8601 UTC
}

export interface ProseRefreshPayload {
  gw: number
  captains: Array<{ name: string; team: string; xPts_1gw: number | null }>
  transfer: { sell: string; buy: string; delta: number } | null
  chip: { code: 'bboost' | '3xc' | 'freehit' | 'wildcard' | null; bestGw: number | null }
  risks: Array<{ name: string; label: string }>
}
```

## Guardrail Algorithm Spec (mirrored verbatim by Plan 02 Python)

```
normalize(s) = s.toLowerCase().replace(/\s+/g, ' ').trim()

findHallucinatedNames(prose, allowedNames, candidatePlayerNames):
  allowed = Set(allowedNames.map(normalize))
  proseLower = normalize(prose)
  hits = []
  for raw in candidatePlayerNames:
    n = normalize(raw)
    if n is empty: skip
    if proseLower.includes(n) AND n NOT in allowed: hits.push(n)
  return hits

passesGuardrail(prose, allowed, corpus):
  return findHallucinatedNames(prose, allowed, corpus).length === 0
```

**Key properties:**
- Case-insensitive (toLowerCase)
- Whitespace-tolerant (collapse multiple spaces to single)
- Substring match (not whole-word): "salah" matches "mo salah" in prose
- allowed set uses normalized keys for O(1) lookup
- Empty prose always passes (no hallucinations possible)
- Names absent from prose never trigger false positives

## Test Count Totals

| File | Count | Status |
|------|-------|--------|
| src/lib/prose-guardrail.test.ts | 7 | GREEN (self-contained pure module) |
| pipeline/tests/test_prose_summary.py | 4 | RED until Plan 02 creates prose_summary.py |
| src/app/api/prose-summary/route.test.ts | 5 | RED until Plan 03 creates route.ts |
| src/components/squad/ProseSummaryBlock.test.tsx | 5 | RED until Plan 02 creates ProseSummaryBlock.tsx |
| **Total** | **21** | **7 GREEN / 14 RED** |

## Dependency Versions Installed

| Dependency | Version | Source |
|------------|---------|--------|
| @anthropic-ai/sdk | 0.93.0 (^0.93.0) | npm install → package.json + lockfile |
| anthropic | >=0.98.1 | pipeline/requirements.txt (declared only) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The guardrail module is complete and pure. Test scaffolds are intentionally RED (not stubs) — they define contracts for Plans 02/03.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced in this plan. `src/lib/prose-guardrail.ts` is a pure computation module. `@anthropic-ai/sdk` added to package.json with integrity hashes written by npm install (T-067-01 mitigated).

## Self-Check: PASSED

All created files exist on disk. All task commits found in git log.

| Item | Status |
|------|--------|
| src/lib/prose-guardrail.ts | FOUND |
| src/lib/prose-guardrail.test.ts | FOUND |
| pipeline/tests/test_prose_summary.py | FOUND |
| src/app/api/prose-summary/route.test.ts | FOUND |
| src/components/squad/ProseSummaryBlock.test.tsx | FOUND |
| commit bb38d5f (Task 1) | FOUND |
| commit b7c2b6f (Task 2) | FOUND |
| commit 592c1d6 (Task 3) | FOUND |
