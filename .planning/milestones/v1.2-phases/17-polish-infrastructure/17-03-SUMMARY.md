---
phase: 17-polish-infrastructure
plan: "03"
subsystem: transfer-engine, fixture-display
tags: [dgw, fixtures, captaincy, transfer-engine, ux]
dependency_graph:
  requires: []
  provides: [DGW-01, DGW-02]
  affects: [transfer-engine, FixtureBadges, CaptaincyPanel]
tech_stack:
  added: []
  patterns: [event_id grouping for DGW detection, IIFE pattern for inline derived state in JSX]
key_files:
  created: []
  modified:
    - src/lib/transfer-engine.ts
    - src/components/fixtures/FixtureBadges.tsx
    - src/components/captaincy/CaptaincyPanel.tsx
decisions:
  - "DGW tier slots between rotation-risk and gem_delta so structural concerns (can player play?) outrank DGW scheduling"
  - "Map.entries() preserves insertion order — no explicit sort needed for grouped fixture badges"
  - "IIFE in JSX for nextGwFixtures derivation keeps CaptaincyPanel change minimal and avoids helper extraction"
metrics:
  duration: "6 minutes"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_modified: 3
---

# Phase 17 Plan 03: DGW/BGW Awareness Summary

DGW-aware transfer ranking and fixture display: transfer engine inserts a DGW fixture-count tier, FixtureBadges labels double-gameweek groups, CaptaincyPanel shows all next-GW fixtures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DGW-aware tier in transfer engine sort | 50b2f8e | src/lib/transfer-engine.ts |
| 2 | DGW labels in FixtureBadges and CaptaincyPanel | d7d8a39 | src/components/fixtures/FixtureBadges.tsx, src/components/captaincy/CaptaincyPanel.tsx |

## What Was Built

**Transfer engine (DGW-01):** Added `nextGwFixtureCount` helper that counts how many fixtures a player has in their immediately upcoming gameweek. Inserted as Tier 3 in the sort (between rotation-risk Tier 2 and gem_delta Tier 4). DGW buy candidates (2 fixtures) rank above single-fixture buys; BGW candidates (0 fixtures) rank below.

**FixtureBadges (DGW-02):** Replaced the flat `fixtures.map()` with a `reduce` that groups by `event_id` into a `Map`. When a group contains 2+ fixtures, a violet `DGW` label is prepended before the badge row. Single-GW fixtures render identically to before.

**CaptaincyPanel (DGW-02):** Replaced the `fixtures[0]` single-fixture display with an IIFE that derives `nextGwFixtures` (all fixtures sharing the same `event_id` as `fixtures[0]`). DGW candidates show `DGW vs ARS / @ CHE`; single-fixture candidates show `vs ARS` (unchanged appearance); BGW candidates render nothing.

## Decisions Made

- DGW tier slots between rotation-risk and gem_delta so structural concerns (can the player actually play?) outrank scheduling advantages
- `Map.entries()` preserves insertion order from the FPL API — no additional sort needed for grouped fixture badges
- IIFE pattern in CaptaincyPanel JSX keeps the fixture-display change minimal and self-contained without requiring a separate helper component

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fixture data flows from live API.

## Self-Check: PASSED

Files exist:
- src/lib/transfer-engine.ts — FOUND
- src/components/fixtures/FixtureBadges.tsx — FOUND
- src/components/captaincy/CaptaincyPanel.tsx — FOUND

Commits exist:
- 50b2f8e — Task 1 (transfer engine DGW tier)
- d7d8a39 — Task 2 (FixtureBadges + CaptaincyPanel DGW labels)

Build: passed (npx next build — 12/12 static pages generated, TypeScript clean)
