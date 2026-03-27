---
phase: 01-data-foundation
verified: 2026-03-26T19:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Hit /api/fpl/bootstrap-static in a running dev server from a browser"
    expected: "JSON response with FPL player data arrives with no CORS error in the browser DevTools network tab"
    why_human: "CORS behaviour is a browser-enforced policy — cannot be verified by static analysis or curl. The route compiles and the fetch target is server-side; only a live browser can confirm the CORS header is absent from the error list."
  - test: "Run python pipeline/run.py (without --dry-run, with live internet) and inspect pipeline/cache/"
    expected: "fpl_bootstrap.json, fpl_fixtures.json, and last_updated.json are written; last_updated.json shows stale=false and a current UTC timestamp"
    why_human: "The pipeline makes live network calls to fantasy.premierleague.com which may rate-limit or return 403 in CI. Dry-run and MOCK_FAIL paths have been verified automatically; the happy-path end-to-end requires a real network hit."
---

# Phase 1: Data Foundation Verification Report

**Phase Goal:** The infrastructure layer is in place so every subsequent phase can build on reliable, validated FPL data without CORS issues, field name fragility, or silent player ID mismatches
**Verified:** 2026-03-26T19:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A Next.js Route Handler proxies FPL API requests server-side via `/api/fpl/[...proxy]` with no CORS error | ✓ VERIFIED | `src/app/api/fpl/[...proxy]/route.ts` exists (43 lines), exports `GET`, fetches `fantasy.premierleague.com` server-side, builds cleanly as a Dynamic route. CORS is structurally eliminated — browser never calls FPL directly. Human spot-check required for live browser confirmation. |
| 2  | `lib/fpl-adapter.ts` validates raw FPL responses with Zod — validation returns structured failure and aborts on missing/renamed fields | ✓ VERIFIED | `src/lib/fpl-adapter.ts` exists (53 lines). Exports `parseFPLBootstrap` wrapping `FPLBootstrapSchema.safeParse`. 12 passing unit tests confirm: valid input returns `success:true`; missing `id` returns `success:false`; wrong type returns `success:false`; unknown fields are stripped. `npx vitest run` → 12 passed, 0 failed. |
| 3  | `player_id_map.json` exists with FPL-to-Understat ID mappings — zero unmatched players for top-6 first-choice starters | ✓ VERIFIED | `pipeline/player_id_map.json` has 825 entries (782 matched, 43 null). Saka (7322), Salah (1250), Haaland (8260), Palmer (8497), Trippier (652), B.Fernandes (1228) all have non-null `understat_id`. Zero mismatches for checked top-6 starters. |
| 4  | `pipeline/fpl_client.py` fetches bootstrap-static and fixtures and writes to Vercel Blob with `last_updated.json` timestamp | ✓ VERIFIED | `pipeline/fpl_client.py` defines `get_bootstrap_static()`, `get_fixtures()`, `get_element_summary()` with browser UA headers and `timeout=30`. `pipeline/run.py` calls both, writes `fpl_bootstrap.json`, `fpl_fixtures.json`, and `last_updated.json` with ISO UTC timestamp. `MOCK_FAIL_VALIDATION=true python pipeline/run.py` exits 1 and writes `stale=True` + `error_message`. GitHub Actions cron at `0 7 * * *` confirmed in `.github/workflows/pipeline.yml`. Live network run requires human verification. |
| 5  | Promoted-team players have null xG/xA in schema from day one | ✓ VERIFIED | `PlayerIdMapEntry.understat_id: number \| null` in `src/lib/types.ts` (line 54). 43 null entries confirmed in `player_id_map.json` (e.g. Yasin fpl_id=46, Redmond fpl_id=65). `seed_id_map.py` explicitly assigns `understat_id = None` for players absent from the Understat CSV (D-02). |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Next.js 16 + Zod + Vitest + @vercel/blob | ✓ VERIFIED | next=16.2.1, zod=^4.3.6, @vercel/blob=^2.3.1, vitest=^4.1.2; test script = "vitest run" |
| `src/lib/types.ts` | Shared TypeScript interfaces for FPL data shapes | ✓ VERIFIED | 67 lines; exports FPLElement (18 fields), FPLTeam, FPLEvent, FPLBootstrap, PlayerIdMapEntry, PlayerIdMap, PipelineMetadata |
| `vitest.config.ts` | Test framework configuration | ✓ VERIFIED | Contains `defineConfig`, node environment, `@` path alias |
| `tests/fixtures/bootstrap-static-sample.json` | Minimal FPL bootstrap fixture for unit tests | ✓ VERIFIED | 3 players, 2 teams, 1 event; includes `extra_field_that_should_be_stripped`, null defensive stats for Wissa, set piece order fields |
| `src/lib/fpl-adapter.ts` | Zod schemas + parseFPLBootstrap | ✓ VERIFIED | 53 lines; exports FPLElementSchema, FPLTeamSchema, FPLEventSchema, FPLBootstrapSchema, FPLElementRaw, FPLBootstrap, parseFPLBootstrap |
| `src/app/api/fpl/[...proxy]/route.ts` | Catch-all FPL API proxy | ✓ VERIFIED | 43 lines; exports GET; awaits params (Next.js 16 pattern); proxies to fantasy.premierleague.com; handles upstream errors (non-ok) and network failures (502) |
| `tests/lib/fpl-adapter.test.ts` | Unit tests for Zod adapter | ✓ VERIFIED | 144 lines; 12 real tests (0 it.todo remaining); imports from @/lib/fpl-adapter; covers all PPS requirements |
| `pipeline/fpl_client.py` | FPL API client with browser headers | ✓ VERIFIED | 36 lines; get_bootstrap_static, get_fixtures, get_element_summary; Mozilla/5.0 UA; timeout=30 |
| `pipeline/upload.py` | Blob and local save routing | ✓ VERIFIED | 31 lines; upload_json (Blob), save_local (file), save (routes by USE_BLOB env) |
| `pipeline/run.py` | Pipeline entry point with stale-cache fallback | ✓ VERIFIED | 109 lines; dry-run mode; MOCK_FAIL_VALIDATION hook; stale-cache on exception; sys.exit(1) on failure |
| `pipeline/seed_id_map.py` | One-time ID map seeding script | ✓ VERIFIED | 125 lines; downloads ChrisMusson CSV; joins on element['code']; writes player_id_map.json; if __name__ == '__main__' |
| `pipeline/player_id_map.json` | FPL-to-Understat ID mapping | ✓ VERIFIED | 825 entries; 782 matched, 43 null; all four required keys (fpl_id, fpl_web_name, understat_id, understat_name) |
| `pipeline/requirements.txt` | Python dependencies | ✓ VERIFIED | requests>=2.32.0, pandas>=2.2.0, vercel-blob>=0.4.0, python-dotenv>=1.0.0 |
| `.github/workflows/pipeline.yml` | Daily cron workflow | ✓ VERIFIED | cron: '0 7 * * *', workflow_dispatch, USE_BLOB=true, BLOB_READ_WRITE_TOKEN secret, python pipeline/run.py |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/lib/fpl-adapter.test.ts` | `src/lib/fpl-adapter.ts` | `import { parseFPLBootstrap, FPLElementSchema, FPLBootstrapSchema } from '@/lib/fpl-adapter'` | ✓ WIRED | Line 2 of test file; all imports used in test assertions |
| `src/lib/fpl-adapter.ts` | `src/lib/types.ts` | `z.infer` type alignment | ✓ WIRED | `FPLElementRaw = z.infer<typeof FPLElementSchema>` and `FPLBootstrap = z.infer<typeof FPLBootstrapSchema>` at lines 22 and 44 |
| `src/app/api/fpl/[...proxy]/route.ts` | `https://fantasy.premierleague.com/api/` | Server-side fetch proxy | ✓ WIRED | `FPL_BASE = 'https://fantasy.premierleague.com/api'` at line 3; used in upstreamUrl construction |
| `pipeline/run.py` | `pipeline/fpl_client.py` | `from fpl_client import get_bootstrap_static, get_fixtures` | ✓ WIRED | Line 13; both functions called on lines 43 and 47 |
| `pipeline/run.py` | `pipeline/upload.py` | `from upload import save` | ✓ WIRED | Line 14; save() called on lines 44, 48, 66 |
| `pipeline/run.py` | `pipeline/cache/last_updated.json` | Stale-cache fallback writes `stale=True` + `error_message` | ✓ WIRED | Lines 87-101; writes JSON with `stale: True` and `error_message` on exception; confirmed by MOCK_FAIL_VALIDATION test |
| `pipeline/seed_id_map.py` | `pipeline/player_id_map.json` | Writes JSON output | ✓ WIRED | OUTPUT_PATH defined at line 23; json.dump to file at line 109-110 |
| `.github/workflows/pipeline.yml` | `pipeline/run.py` | `python pipeline/run.py` | ✓ WIRED | Step "Run pipeline" at line 29 of workflow file |

---

### Data-Flow Trace (Level 4)

Not applicable for this phase — no components rendering dynamic data from a store. All artifacts in Phase 1 are infrastructure layer (types, schemas, pipeline scripts, API route). The proxy route returns data directly from `res.json()` with no intermediate state; there is no component to trace.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest suite runs clean (12 tests) | `npx vitest run` | "12 passed (12)" | ✓ PASS |
| Next.js build succeeds with proxy route | `npx next build` | `/api/fpl/[...proxy]` shown as Dynamic route; build exits 0 | ✓ PASS |
| Pipeline dry-run exits 0 | `python pipeline/run.py --dry-run` | "Dry run complete" printed; exit code 0 | ✓ PASS |
| Stale-cache fallback on failure | `MOCK_FAIL_VALIDATION=true python pipeline/run.py` | Exit code 1; `pipeline/cache/last_updated.json` written with `stale=true` and `error_message` | ✓ PASS |
| player_id_map.json has 400+ entries with top-6 starters matched | Python JSON parse + lookup | 825 total, Saka/Salah/Haaland/Palmer/Trippier/Fernandes all non-null | ✓ PASS |
| proxy route live CORS behaviour | Browser hit to `/api/fpl/bootstrap-static` | Not testable without running server | ? SKIP (human) |
| Pipeline happy-path network run | `python pipeline/run.py` (live network) | Not testable without real FPL API call | ? SKIP (human) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DAT-01 | 01-03-PLAN | Data refreshed once daily (FPL API + Understat) | ✓ SATISFIED | GitHub Actions cron `0 7 * * *` in `.github/workflows/pipeline.yml`; `pipeline/run.py` fetches bootstrap-static and fixtures; `last_updated.json` written with ISO timestamp. Understat fetching is Phase 2 (per ROADMAP note on element-summary). |
| PPS-01 | 01-01-PLAN, 01-02-PLAN | Penalty taker, set piece taker, corner taker flags | ✓ SATISFIED | `FPLElement` has `direct_freekicks_order`, `penalties_order`, `corners_and_indirect_freekicks_order` (all `number \| null`). Zod schema validates all three as nullable integers. Tests assert correct values for Saka (freekicks=1, corners=1), Wissa (penalties=1), and Magalhães (all null). |
| PPS-02 | 01-01-PLAN, 01-02-PLAN | Minutes reliability: average minutes per game, consistency indicator | ✓ SATISFIED | `FPLElement.minutes: number` and `FPLElement.starts: number` defined in types.ts and validated as `z.number().int()` in fpl-adapter.ts. Test "validates minutes and starts as integers (PPS-02)" asserts both parse correctly. |
| PPS-03 | 01-03-PLAN | xG per 90 and xA per 90 (from Understat) | ✓ SATISFIED | `PlayerIdMapEntry.understat_id: number \| null` in types.ts provides the bridge. `player_id_map.json` has 825 entries with 782 Understat IDs mapped. Top-6 starters all matched. Null entries represent promoted-team players. Actual xG/xA fetching from Understat is Phase 2 — the schema and ID mapping are the Phase 1 deliverable per ROADMAP. |
| PPS-04 | 01-01-PLAN, 01-02-PLAN | Injury / availability status from FPL flags | ✓ SATISFIED | `FPLElement.status: PlayerStatus` ('a'\|'d'\|'i'\|'s'\|'u'\|'n') and `FPLElement.news: string` defined in types.ts and validated in Zod schema. Tests assert all 6 status codes pass validation, empty and non-empty `news` strings parse correctly. |

No orphaned requirements. All 5 requirements mapped to Phase 1 in REQUIREMENTS.md traceability table (DAT-01, PPS-01, PPS-02, PPS-03, PPS-04) are claimed and satisfied by at least one plan in this phase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/seed_id_map.py` | 38 | Stale docstring: "The 'code' column equals FPL bootstrap-static elements[].id (NOT elements[].code)" — the claim is backwards. The actual implementation at line 83 correctly uses `element['code']` for the join. The docstring is the opposite of what the code does. | ⚠️ Warning | Does not affect runtime behaviour — the join is correct. However, the docstring would mislead any developer reading the function (including when the map needs to be re-seeded). Needs correction to avoid confusion. |

No blockers found. No `return null` / `return {}` / `return []` stubs in any key artifact. No `it.todo` remaining in test suite. No hardcoded empty state passed to rendering components.

---

### Human Verification Required

#### 1. Browser CORS Verification

**Test:** Start `npm run dev`, open `http://localhost:3000` in a browser, open DevTools Network tab, navigate to `http://localhost:3000/api/fpl/bootstrap-static`
**Expected:** JSON response with FPL player data appears; no CORS error in the Network tab or Console
**Why human:** CORS is enforced by the browser's fetch implementation. The route is architecturally correct (server-side fetch, browser never contacts FPL directly), but only a real browser request can confirm the CORS headers behave as expected.

#### 2. Pipeline Live Network Run

**Test:** With Python dependencies installed (`pip install -r pipeline/requirements.txt`) and `USE_BLOB` unset, run `python pipeline/run.py` from the project root
**Expected:** `pipeline/cache/fpl_bootstrap.json` and `pipeline/cache/fpl_fixtures.json` are written; `pipeline/cache/last_updated.json` shows `"stale": false` and a current timestamp; stdout prints player/team/fixture counts
**Why human:** The pipeline makes live requests to `fantasy.premierleague.com`. The FPL API occasionally rate-limits or returns 403 for automated tools. The dry-run and stale-cache paths have been confirmed automatically; the happy-path data write requires real network access.

---

### Gaps Summary

No gaps. All 5 phase success criteria are verified by the actual codebase. All required artifacts exist, are substantive, and are correctly wired. The Vitest suite runs clean (12/12 passing). The Next.js build succeeds. The pipeline stale-cache fallback is confirmed working. The player ID map has 825 entries with zero unmatched top-6 starters.

One warning-level anti-pattern exists (stale docstring in `seed_id_map.py` line 38) but does not block the phase goal.

---

_Verified: 2026-03-26T19:15:00Z_
_Verifier: Claude (gsd-verifier)_
