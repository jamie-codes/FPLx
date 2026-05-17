---
phase: 116
plan: 02
subsystem: pipeline
tags:
  - pipeline
  - prose
  - llm
  - prompt-engineering

dependency_graph:
  requires:
    - pipeline/prose_summary.py (pre-existing)
    - pipeline/gw_intel.py::_detect_dgw_bgw (pre-existing)
    - pipeline/run.py prose call site (pre-existing)
  provides:
    - generate_weekly_summary() accepts dgw_teams kwarg
    - _build_user_prompt() emits DGW prefix + availability attributes
    - run.py enriched prose payload with chance_of_playing_next_round, news, dgw_teams
  affects:
    - pipeline/tests/test_prose_summary.py (5 new tests)

tech_stack:
  added: []
  patterns:
    - TDD RED -> GREEN cycle (Python pytest)
    - Optional kwarg with None default for backward compat
    - XML attribute building with double-quote escaping (chr(34)/chr(39))

key_files:
  created: []
  modified:
    - pipeline/prose_summary.py
    - pipeline/run.py
    - pipeline/tests/test_prose_summary.py

decisions:
  - "_build_player_xml() extracted as a helper (not inlined) to keep _build_user_prompt readable and testable in isolation"
  - "dgw_teams=None default (D-05) ensures all 4 existing tests pass without modification — backward compat verified by test run"
  - "news.replace(chr(34), chr(39)) pattern avoids embedded double-quotes breaking XML attribute quoting (T-116-02-01 mitigation)"
  - "chance_of_playing_next_round cast via int() before < 100 check (T-116-02-03 mitigation for non-int inputs)"
  - "_detect_dgw_bgw import added inside existing try: block so a DGW detection failure is caught by existing except Exception handler"

metrics:
  duration: ~12 minutes
  completed: "2026-05-17"
  tasks_completed: 2
  files_changed: 3
---

# Phase 116 Plan 02: Prose Summary Prompt Enrichment Summary

Enriched the weekly prose summary prompt with DGW context and player availability flags so the generated narrative reflects fitness doubts and double-gameweek fixtures.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 (RED) | Add failing tests for dgw_teams kwarg and availability-aware prompt builder | 6203b7e | pipeline/tests/test_prose_summary.py |
| 1 (GREEN) | Extend prose_summary.py with dgw_teams kwarg and availability-aware prompt | 15fd791 | pipeline/prose_summary.py |
| 2 | Enrich run.py prose call site with chance_of_playing, news, and dgw_teams | ccb7d51 | pipeline/run.py |

## What Was Built

### `pipeline/prose_summary.py`

- Added `_build_player_xml(p: dict) -> str` helper that builds a player XML line with optional `chance_of_playing="{N}"` attribute (when `chance_of_playing_next_round < 100`) and optional `news="{escaped}"` attribute (when news is non-empty)
- Extended `_build_user_prompt()` signature to `(captains, gems, gameweek=None, dgw_teams=None)` — backward compat with all callers that omit the new params
- DGW prefix `"Note: Gameweek {N} is a double gameweek for: {teams}.\n\n"` prepended before `<input>` block when `dgw_teams` is non-empty
- Extended `generate_weekly_summary()` signature with `dgw_teams: Optional[list] = None` as last parameter (D-05)
- User prompt computed once before retry loop with `gameweek` and `dgw_teams` passed through
- `_passes_guardrail` is byte-identical — DGW team names are not player web_names and do not affect guardrail logic (D-08)

### `pipeline/run.py`

- Added `from gw_intel import _detect_dgw_bgw` import inside existing `try:` block (line 363)
- `cap_payload` and `gem_payload` dicts now include `chance_of_playing_next_round` and `news` fields
- After gem_payload is built: calls `_detect_dgw_bgw(merged, current_gw)`, builds `team_short_by_id` lookup, filters for `kind == 'dgw'` entries with non-empty short names
- `generate_weekly_summary()` call now passes `dgw_teams=dgw_team_names` kwarg

### `pipeline/tests/test_prose_summary.py`

5 new tests added:
- `test_build_user_prompt_includes_dgw_note` — DGW note present and before `<input>` block
- `test_build_user_prompt_omits_dgw_note_when_empty` — no "double gameweek" text when None or []
- `test_build_user_prompt_includes_chance_of_playing` — chance_of_playing attribute emitted only when < 100
- `test_build_user_prompt_includes_news_attribute` — news attribute emitted only when non-empty
- `test_generate_weekly_summary_accepts_dgw_teams_kwarg` — end-to-end kwarg plumbing via mock, verifies user prompt content

Total: 9/9 tests pass (4 pre-existing + 5 new).

## TDD Gate Compliance

- RED commit: `6203b7e test(116-02): add failing tests for dgw_teams kwarg and availability-aware prompt builder` — tests failed with `TypeError: _build_user_prompt() got an unexpected keyword argument 'gameweek'`
- GREEN commit: `15fd791 feat(116-02): extend prose_summary.py with dgw_teams kwarg...` — all 9 tests pass
- Task 2 run.py changes committed after GREEN as `ccb7d51 feat(116-02): enrich run.py prose call site...`

## Verification

```
cd pipeline && python -m pytest tests/test_prose_summary.py -x  → 9 passed
cd pipeline && python -c "import ast; ast.parse(open('run.py').read())"  → exit 0
cd pipeline && python -c "from prose_summary import generate_weekly_summary; import inspect; assert 'dgw_teams' in inspect.signature(generate_weekly_summary).parameters"  → exit 0
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers. T-116-02-01 (news XML injection) mitigated via double-quote escaping. T-116-02-03 (chance_of_playing integer check) mitigated via int() cast before comparison.

## Self-Check: PASSED

- `pipeline/prose_summary.py` — modified, contains dgw_teams, double gameweek for:, chance_of_playing, < 100 branch, news branch
- `pipeline/run.py` — modified, contains _detect_dgw_bgw import, chance_of_playing_next_round, dgw_teams=dgw_team_names
- `pipeline/tests/test_prose_summary.py` — modified, 5 new test functions
- Commits: 6203b7e, 15fd791, ccb7d51 — all exist in git log
