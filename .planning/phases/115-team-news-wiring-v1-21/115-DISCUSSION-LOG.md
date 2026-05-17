# Phase 115: Team News Wiring (v1.21) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 115-team-news-wiring-v1-21
**Areas discussed:** Staleness gate architecture, CandidateRow news placement

---

## Staleness Gate Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Inside NewsBanner | Add guard after severity computed; news_added prop already in interface but unused | ✓ |
| Extend computeNewsSeverity | Add news_added + optional now parameters to the pure function | |
| New isStaleZincNews() helper | Separate helper called from NewsBanner and future consumers | |

**User's choice:** Inside NewsBanner (Recommended)
**Notes:** computeNewsSeverity stays a pure severity classifier with no date awareness.

---

## Staleness Gate — Date Injection

| Option | Description | Selected |
|--------|-------------|----------|
| Date.now() directly | Simpler; tests use jest.useFakeTimers() or jest.spyOn | ✓ |
| Injectable `now?: number` prop | Makes tests trivial; adds a prop production callers never use | |

**User's choice:** Date.now() directly (Recommended)

---

## CandidateRow News Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in name row | Appended to first flex div alongside rank/name/EO%/badges; matches OpportunityCostTable pattern | ✓ |
| Below stats line | Separate full-width line below xPts/p10-p90, just before fragility badge | |

**User's choice:** Inline in name row (Recommended)
**Notes:** flex-wrap already present on that div handles overflow gracefully.

---

## Claude's Discretion

- NEWS-03 scope: Determined from codebase inspection that OpportunityCostTable already passes all needed props to NewsBanner — no user decision needed, automatic once NEWS-01 lands.

## Deferred Ideas

None — discussion stayed within phase scope.
