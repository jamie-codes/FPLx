---
phase: 01-data-foundation
plan: 03
subsystem: infra
tags: [python, fpl-api, vercel-blob, github-actions, player-id-map, pipeline]

# Dependency graph
requires: []
provides:
  - Python FPL API client (fpl_client.py) with browser User-Agent to avoid 403s
  - Upload module routing between Vercel Blob (production) and local cache (dev)
  - Pipeline runner (run.py) with stale-cache fallback on failure (D-06)
  - player_id_map.json: 825-entry FPL-to-Understat ID bridge (782 matched, 43 null)
  - GitHub Actions daily cron workflow (07:00 UTC)
affects: [02-ui-shell, 03-gem-engine, 04-defcon, 05-transfers, 06-polish]

# Tech tracking
tech-stack:
  added: [requests>=2.32.0, pandas>=2.2.0, vercel-blob>=0.4.0, python-dotenv>=1.0.0]
  patterns:
    - USE_BLOB env var switches between Vercel Blob (production) and local file cache (dev)
    - Stale-cache fallback: on failure, rewrite last_updated.json with stale=true + error_message, exit 1
    - FPL API requires browser-like User-Agent; default python-requests UA returns 403
    - player_id_map.json keyed by str(fpl_id); join via FPL elements[].code not elements[].id

key-files:
  created:
    - pipeline/fpl_client.py
    - pipeline/upload.py
    - pipeline/run.py
    - pipeline/requirements.txt
    - pipeline/cache/.gitkeep
    - pipeline/seed_id_map.py
    - pipeline/player_id_map.json
    - .github/workflows/pipeline.yml

key-decisions:
  - "CSV 'code' column joins to FPL elements[].code (large player identifier), NOT elements[].id (sequential 1-N index)"
  - "Stale-cache fallback (D-06): on any exception, rewrite last_updated.json with stale=true and error_message then sys.exit(1)"
  - "player_id_map.json static JSON committed to repo; no name-matching fallback (D-03)"
  - "43 promoted-team players have understat_id=null (D-02); they appear in all tables with dashes in xG/xA columns"

patterns-established:
  - "Pipeline test hook: MOCK_FAIL_VALIDATION=true raises RuntimeError before fetch to test stale-cache path"
  - "Run from project root: python pipeline/run.py; sys.path.insert adds pipeline/ dir automatically"

requirements-completed: [DAT-01, DAT-02, PPS-03]

# Metrics
duration: 25min
completed: 2026-03-27
---

# Phase 1 Plan 03: Python Pipeline Summary

**FPL API client, Blob/local upload router, stale-cache fallback runner, and 825-player FPL-to-Understat ID map with GitHub Actions daily cron**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-27T18:20:00Z
- **Completed:** 2026-03-27T18:45:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Python FPL client with browser User-Agent (prevents 403), three API functions (bootstrap-static, fixtures, element-summary)
- Upload module routes between Vercel Blob (USE_BLOB=true) and local pipeline/cache/ directory
- Pipeline runner with stale-cache fallback: on failure rewrites last_updated.json with stale=true + error_message then exits 1 per D-06
- 825-entry player_id_map.json seeded from ChrisMusson/FPL-ID-Map CSV; Saka, Salah, Haaland all have non-null understat_id
- GitHub Actions workflow triggers at 07:00 UTC daily and on workflow_dispatch

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Python pipeline modules and requirements** - `a13f194` (feat) — committed in prior partial run
2. **Task 2: Seed player_id_map.json and create GitHub Actions workflow** - `c054d4a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `pipeline/fpl_client.py` - FPL API client; browser UA headers; get_bootstrap_static, get_fixtures, get_element_summary
- `pipeline/upload.py` - upload_json (Blob), save_local (file), save (routes by USE_BLOB)
- `pipeline/run.py` - pipeline entry point; dry-run; MOCK_FAIL_VALIDATION test hook; stale-cache fallback on exception
- `pipeline/requirements.txt` - requests, pandas, vercel-blob, python-dotenv
- `pipeline/cache/.gitkeep` - placeholder for local cache directory
- `pipeline/seed_id_map.py` - one-time script; downloads ChrisMusson CSV; joins on FPL code field; writes player_id_map.json
- `pipeline/player_id_map.json` - 825 entries; 782 with understat_id, 43 null (promoted-team players per D-02)
- `.github/workflows/pipeline.yml` - daily cron 07:00 UTC, workflow_dispatch, USE_BLOB=true, BLOB_READ_WRITE_TOKEN secret

## Decisions Made

- CSV `code` column joins to FPL `elements[].code` (large integer player code), not `elements[].id` (sequential 1-825 index). The plan description had this wrong; the correct join produces 782 matches vs 0.
- Stale-cache fallback writes to local filesystem even when USE_BLOB=true (Blob may be unavailable during failure).
- MOCK_FAIL_VALIDATION env var allows testing stale-cache path without real network failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CSV-to-FPL join key from elements[].id to elements[].code**
- **Found during:** Task 2 (seed_id_map.py execution)
- **Issue:** Plan stated "CSV 'code' column equals FPL bootstrap-static elements[].id" — but elements[].id is a sequential 1-825 index; the CSV 'code' column holds large player identifiers (e.g. 154561) that match FPL elements[].code. Using id as join key produced 0 matches.
- **Fix:** Changed build_id_map to join on element['code'] (large identifier) instead of element['id']
- **Files modified:** pipeline/seed_id_map.py
- **Verification:** Re-ran script; 782/825 entries now have understat_id; Saka (7322), Salah (1250), Haaland (8260) all matched
- **Committed in:** c054d4a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential fix — wrong join key produced 0 Understat matches, making the ID map useless. No scope creep.

## Issues Encountered

None beyond the join key bug documented above.

## User Setup Required

For production use, add to GitHub repository secrets:
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token

For local development:
- No secrets needed; `USE_BLOB` defaults to false, data writes to `pipeline/cache/`
- Run `pip install -r pipeline/requirements.txt` to install dependencies

## Next Phase Readiness

- Pipeline can be run locally with `python pipeline/run.py` (after pip install)
- player_id_map.json ready for Phase 2 Understat joins
- last_updated.json written on each run; Phase 2 UI can display it for DAT-02
- GitHub Actions configured; activate by pushing to main and adding BLOB_READ_WRITE_TOKEN secret

---
*Phase: 01-data-foundation*
*Completed: 2026-03-27*
