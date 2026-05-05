# Phase 73: Post-GW Review - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 73-Post-GW Review
**Areas discussed:** Data path, Captain delta, Benchmark comparison, GW history browsing

---

## Phase Selection

| Option | Selected |
|--------|----------|
| In-App Alert System (Phase 68) | |
| Event-Based Pipeline Refresh (Phase 69) | |
| Post-GW Review (Phase 70) | ✓ |
| Something else | |

**Note:** Phase 73 was not yet in ROADMAP.md. User selected Post-GW Review (defined as Phase 70 in ROADMAP) to implement next as Phase 73.

---

## Data path

### Q1: How should GW review data be sourced?

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand: client fetches FPL API | useGwReview hook calls entry/history + picks. No pipeline change. | |
| Pipeline: Python writes gw_review.json to Blob | Pipeline computes post-GW, persists to Blob. Needs Phase 69 for timeliness. | ✓ |
| Hybrid: on-demand now, pipeline later | Client-side first; pipeline deferred. | |

**User's choice:** Pipeline path.

### Q2: Phase 69 dependency handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship now — daily cron good enough | Review within ~24h. No Phase 69 blocker. | ✓ |
| Block on Phase 69 first | More timely but delays Phase 73. | |

**User's choice:** Ship now, daily cron is sufficient.

### Q3: Pipeline vs API route split (since pipeline doesn't know team ID)?

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline writes global data; API route fetches team-specific | Pipeline: average_score per GW. Route: merges with team picks on-demand. | ✓ |
| Everything on-demand via API route | No pipeline involvement. | |

**User's choice:** Hybrid split — pipeline for global, API route for team-specific.

---

## Captain delta

### Q1: How to define optimal captain?

| Option | Description | Selected |
|--------|-------------|----------|
| Highest scorer from starting XI | Optimal among position 1–11. Delta = 0 if correct choice. | ✓ |
| Highest scorer from all 15 squad players | Harsher metric, includes bench. | |

**User's choice:** Starting XI only.

### Q2: Data source for actual GW scores?

| Option | Description | Selected |
|--------|-------------|----------|
| FPL entry picks endpoint — server-side in API route | entry/{teamId}/event/{gw}/picks/ already proxied; returns total_points per player. | ✓ |
| Bootstrap elements array | Season totals only, not per-GW. 15 separate fetches required. | |

**User's choice:** FPL picks endpoint.

---

## Benchmark comparison

| Option | Description | Selected |
|--------|-------------|----------|
| FPL overall average (average_entry_score) — labelled accurately | From bootstrap events. Label "FPL average" not "top-10k". | ✓ |
| Skip benchmark entirely | Score, bench pts, captain delta, top scorer only. | |
| Classic overall standings top-N | Approximate top-manager average. Extra API call. | |

**User's choice:** Overall FPL average, labelled accurately as "FPL average".

---

## GW history browsing

### Q1: How much history?

| Option | Description | Selected |
|--------|-------------|----------|
| Latest settled GW only | Simple. Pipeline writes one file (overwritten). | |
| Full season history with GW selector | All GWs, browsable. Complex Blob management. | |
| Last 3 GWs — tab or toggle | Moderate history. 3 sliding-window files. | ✓ |

**User's choice:** Last 3 GWs.

### Q2: Navigation pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| GW number toggle buttons (GW33 \| GW34 \| GW35) | Consistent with 1/3/5 horizon toggle. | ✓ |
| Prev/Next arrow navigation | Single card with arrows. | |

**User's choice:** Pill toggle buttons.

---

## Claude's Discretion

- 5th sub-tab label and position in Squad SECTIONS
- `GwReview` TypeScript type shape
- TanStack Query hook name and staleTime
- Component name and file structure
- Visual layout of the review card

## Deferred Ideas

- Full season GW history (all GWs) — future phase after pattern established
- Per-team Blob persistence of team-specific review data — client on-demand sufficient for now
- Comparison vs mini-league rivals' GW scores — requires Phase 58 rivals integration
