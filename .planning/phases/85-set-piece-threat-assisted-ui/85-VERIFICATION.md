---
phase: 85-set-piece-threat-assisted-ui
verified: 2026-05-09T16:22:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Mobile layout audit — 390–430px viewport"
    expected: "FK and Corner rows show tier badges without horizontal overflow or pushing existing fields out of view; Penalty row shows no badge; badge does not wrap causing card overflow"
    why_human: "SC-5 requires visual inspection of rendered UI at 390px and 430px device widths; cannot verify layout overflow programmatically without a browser rendering engine. SUMMARY.md records user approval 2026-05-09, but this is a visual checkpoint by definition."
---

# Phase 85: Set-Piece Threat Assisted UI — Verification Report

**Phase Goal:** Surface the delivery-quality tier (Elite / Good / Weak) of FK and corner takers in the Set Pieces panel, served from sp_quality.json merged by the /api/set-pieces route, so managers can instantly see which takers create genuinely dangerous deliveries.
**Verified:** 2026-05-09T16:22:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SetPieceTaker type exposes 5 new optional sp_quality fields with exact names and types from D-03 | VERIFIED | `src/lib/types.ts` lines 573-577: all 5 fields present with exact types (`corner_danger_score?: number \| null`, `fk_danger_score?: number \| null`, `delivery_quality_rank?: number \| null`, `sp_sample_n?: number \| null`, `sp_tier?: 'Elite' \| 'Good' \| 'Weak' \| null`). grep count = 1 each. |
| 2 | /api/set-pieces response includes corner_danger_score, fk_danger_score, delivery_quality_rank, sp_sample_n, sp_tier per taker when sp_quality.json is present | VERIFIED | `route.ts` lines 54-60: `mergeSpQualityIntoTaker` merges all 4 data fields; lines 111-112: sp_tier assigned on fk_taker and corner_taker via `classifyTier`. |
| 3 | Route computes sp_tier server-side via P25/P75 quartile logic across all non-null delivery_quality_rank values from fk_taker AND corner_taker across all teams | VERIFIED | `computeQuartileCutoffs` (lines 28-37) uses nearest-rank P25/P75; rank pool built at lines 99-105 from `fk_taker` and `corner_taker` only; `penalty_taker.delivery_quality_rank` grep count = 0 in rank pool. |
| 4 | When sp_quality.json is missing, route returns existing taker data unchanged with all sp_quality fields omitted (undefined) — no error response | VERIFIED | Lines 80-86: secondary read in separate try/catch; on failure, logs `console.error` once and qmap stays null; `if (qmap)` block skipped; payload returned unmodified. `grep -c console.error` = 1. |
| 5 | When fewer than 4 distinct ranked takers exist, all non-null takers default to sp_tier='Good' | VERIFIED | `computeQuartileCutoffs` line 30: `if (distinct.length < 4) return null`; `classifyTier` line 44: `if (cutoffs === null) return 'Good'`. |
| 6 | FK taker row and corner taker row each show a tier badge (Elite/Good/Weak/—); penalty taker row shows NO badge per D-01 | VERIFIED | `SetPieceTakerPanel.tsx` lines 98-100: `TakerRow label="Penalties"` omits `showQualityBadge`; FK and Corner rows include `showQualityBadge` prop. Vitest D-01 test (8/8 passing) confirms zero spans in penalty row and correct badge in FK/Corner rows. |
| 7 | Elite tier badge has green class string; Good has zinc; Weak has amber; '—' has the lighter zinc class — all matching D-05 exactly | VERIFIED | `SP_TIER_CLASSES` at lines 13-17 matches D-05 exactly. `SP_TIER_INSUFFICIENT_CLASS` line 20 matches D-05 dash class. Vitest D-05 colour test passes. |
| 8 | Hovering a non-'—' badge shows the tooltip wording from D-04 with sp_sample_n substituted | VERIFIED | `buildSpQualityTooltip` at line 25 returns exact D-04 wording with `n=${n} shots`. `DeliveryQualityBadge` passes result to `title` attribute on non-null tier. Vitest SC-2/D-04 test asserts exact `n=14 shots` string — passes. |
| 9 | When sp_tier is null or undefined, badge text is '—' and the title attribute is OMITTED entirely (no empty title) | VERIFIED | `DeliveryQualityBadge` lines 31-36: null tier branch renders span WITHOUT title attribute. Vitest SC-4/D-06 test asserts `hasAttribute('title') === false` — passes. |
| 10 | Mobile viewport 390–430px does not push existing fields out of the card or overflow horizontally | HUMAN NEEDED | SUMMARY.md records user approval 2026-05-09 ("Task 3: Mobile Layout Audit — Status: APPROVED by user 2026-05-09"). Cannot be verified programmatically — requires visual inspection in a browser at device viewport widths. |

**Score:** 9/10 truths verified (1 requires human confirmation, already recorded as approved in SUMMARY)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | Extended SetPieceTaker interface with 5 optional sp_quality fields | VERIFIED | Lines 562-578: all 5 fields present with exact types per D-03. SetPieceTeam and SetPieceChanges unchanged. |
| `src/app/api/set-pieces/route.ts` | Extended GET handler that merges sp_quality.json into taker payload and computes sp_tier | VERIFIED | 126-line implementation with readJsonArtifact helper, computeQuartileCutoffs, classifyTier, mergeSpQualityIntoTaker, and GET handler. |
| `src/components/set-pieces/SetPieceTakerPanel.tsx` | TakerRow with optional showQualityBadge prop; SP_TIER_CLASSES map; DeliveryQualityBadge inline span | VERIFIED | SP_TIER_CLASSES defined at line 13, SP_TIER_INSUFFICIENT_CLASS at line 20, DeliveryQualityBadge at line 28, showQualityBadge prop on TakerRow at line 51. |
| `src/components/set-pieces/SetPieceTakerPanel.test.tsx` | Vitest cases for SPQ-03 SC-2, SC-4, and badge presence/absence per row | VERIFIED | Lines 80-197: SPQ-03 describe block with 5 tests. All 8 tests in file pass (3 SHD-01 + 5 SPQ-03). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `route.ts` | `sp_quality.json` (local or Blob) | `readJsonArtifact('sp_quality.json', 'sp_quality.json')` in separate try/catch | WIRED | Line 82: explicit separate secondary read; graceful failure path confirmed. |
| `route.ts` | `src/lib/types.ts SetPieceTaker` | `taker.id !== null && taker.id !== undefined ? String(taker.id) : null` | WIRED | Line 51: exact join key pattern present. sp_tier fields merge onto fk_taker and corner_taker. |
| `TakerRow` inside `SetPieceTakerPanel.tsx` | `taker.sp_tier` and `taker.sp_sample_n` | `showQualityBadge` prop — passed only on FK and Corner TakerRow invocations | WIRED | Lines 98-100: FK and Corner rows pass `showQualityBadge`; penalty row does not. `DeliveryQualityBadge` consumes `taker.sp_tier` and `taker.sp_sample_n`. |
| `DeliveryQualityBadge` | `SP_TIER_CLASSES` | Key lookup by sp_tier value `SP_TIER_CLASSES[tier]` | WIRED | Line 40: `SP_TIER_CLASSES[tier]` lookup in span className. grep count for `SP_TIER_CLASSES[` = 1 (usage). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SetPieceTakerPanel.tsx` | `taker.sp_tier`, `taker.sp_sample_n` | `/api/set-pieces` via `useSetPieces` hook | Yes — route merges sp_quality.json into response; when file absent, graceful fallback | FLOWING |
| `route.ts` | `qmap` (sp quality data) | `sp_quality.json` via `readJsonArtifact` | Yes — reads file when present; null when absent (non-fatal) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 8 Vitest tests all pass | `npx vitest run src/components/set-pieces/SetPieceTakerPanel.test.tsx` | 8 passed (1 file) | PASS |
| sp_tier field on fk_taker and corner_taker (not penalty) | `grep -n "fk_taker.*sp_tier\|corner_taker.*sp_tier"` route.ts | Lines 111-112 confirmed; penalty_taker.delivery_quality_rank grep = 0 | PASS |
| Cache-Control header preserved | `grep -n s-maxage=3600 route.ts` | Line 122: exact header preserved | PASS |
| No title attribute on null-tier badge | Vitest SC-4 test `hasAttribute('title') === false` | Pass (part of 8/8) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPQ-03 | 85-01-PLAN.md, 85-02-PLAN.md | SetPieceTakerPanel shows delivery-quality tier badges; `/api/set-pieces` extended; tooltip wording; graceful fallback; mobile layout | SATISFIED | All 5 success criteria from ROADMAP verified (SC-1 through SC-4 programmatically; SC-5 human-approved per SUMMARY) |

**Orphaned requirements check:** SPQ-03 is the only requirement mapped to Phase 85 in REQUIREMENTS.md traceability table. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `route.ts` | 90 | `payload.teams.map(...)` called without guard when `payload.teams` could be undefined if JSON parsed as non-array | Warning (CR-01 from REVIEW) | Crash only if `set_piece_changes.json` parses successfully but lacks `teams` AND `sp_quality.json` is simultaneously available — abnormal pipeline corruption scenario. Does not block goal achievement under normal operation. |
| `route.ts` | 92-94 | `qmap!` non-null assertions inside `if (qmap)` block — redundant | Info (WR-02 from REVIEW) | Harmless at runtime; TypeScript already narrows qmap. |
| `SetPieceTakerPanel.tsx` | 25 | `buildSpQualityTooltip` substitutes `n=0` when `sp_sample_n` is null/undefined, producing misleading tooltip text | Info (IN-01 from REVIEW) | Only reachable if sp_sample_n is null while sp_tier is non-null — contradicts pipeline design; benign in practice. |

No stub patterns detected. No empty return values. No TODO/FIXME markers in phase-modified files.

### Human Verification Required

#### 1. Mobile Layout Audit (SPQ-03 SC-5)

**Test:** Navigate to the Set Pieces tab in a Chromium browser with device toolbar set to 390px width (iPhone 12 Pro), then 430px. Verify each team card renders: Penalties row (no badge), Direct FK row (tier badge), Corners row (tier badge). Confirm no horizontal overflow and no existing fields pushed out of view.
**Expected:** Tier badges render inline after player name; card does not overflow horizontally at 390px or 430px; Penalty row has no badge (D-01); non-"—" badges show D-04 tooltip on hover.
**Why human:** Visual layout verification requires browser rendering at mobile viewport widths. Cannot be confirmed by static code analysis.

**Note:** SUMMARY.md records this checkpoint as "APPROVED by user 2026-05-09" — this is documented human confirmation. The status is `human_needed` to surface this checkpoint formally, consistent with the decision tree (any human verification item forces `human_needed` even when documented as approved).

### Gaps Summary

No blocking gaps found. All automated must-haves verified. The only unresolved item is SC-5 (mobile layout audit), which is inherently a visual checkpoint and is recorded as user-approved in the SUMMARY.

The REVIEW identified CR-01 (missing guard on `payload.teams` before `.map()` in route.ts) as a robustness concern — it is not a goal-blocking defect because it requires simultaneous malformed primary JSON and valid secondary JSON, and the phase goal is achieved under normal pipeline operation. It is flagged as a WARNING for the developer's attention.

---

_Verified: 2026-05-09T16:22:00Z_
_Verifier: Claude (gsd-verifier)_
