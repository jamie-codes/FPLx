---
gsd_state_version: 1.0
milestone: v1.26
milestone_name: Off-Season Intelligence
status: planning
stopped_at: Phase 131 complete — ready to execute Phase 132
last_updated: "2026-05-22T12:00:00.000Z"
last_activity: 2026-05-22 — Phase 131 complete (SPEC-01, SPEC-02, SPEC-03)
progress:
  total_phases: 72
  completed_phases: 43
  total_plans: 132
  completed_plans: 205
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21 — v1.26 Off-Season Intelligence)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** Milestone v1.26 — Phase 132 (Deadline Day Banner)

## Current Position

Phase: 132 — Deadline Day Banner (next to plan)
Plan: TBD
Status: Phase 131 complete — ready to plan Phase 132
Last activity: 2026-05-22 — Phase 131 complete (SPEC-01/02/03, 2 plans, all tests green)

```
Phase progress: [x] [x] [ ] [ ] [ ] [ ]  2/6
                130 131 132 133 134 135
```

## Accumulated Context

### Carry-forwards from v1.25

| ID | Description | Source Phase | Status |
|----|-------------|-------------|--------|
| GREEDY-NULL | buildPreSeasonSquad() null rate on 100m full-pool build unmeasured | 126 | Monitor in v1.26 |
| GW1-8-FIXTURES | Next-season fixture data not yet published (expected June/July 2026) | 126 | Will resolve when FPL publishes next-season data |
| AUTH-502 | POST /api/auth/login throws 502; redirect:manual suspected issue in Next.js 16 | memory | In scope — Phase 130 |

### Key Decisions Made During Roadmap

| Decision | Rationale |
|----------|-----------|
| Auth fix is Phase 130 (P0, first) | Single file change; unblocks authenticated testing for all downstream phases |
| SPEC before PRST | Transfer speculation (Phase 131) is pipeline-additive; price reset (Phase 133) requires baseline captured ASAP but is sequenced after lower-complexity features |
| DL before PRST | Deadline Day banner (Phase 132) is pure client-side with no backend; price reset (Phase 133) needs new pipeline scripts |
| Push last (Phase 134-135) | Highest complexity; VAPID infra + service worker + pipeline notify.py; all other features must be stable first |
| notify.py isolated (never imports run.py) | Mirrors refresh_gate.py isolation pattern; prevents notify step from coupling to pipeline internals |

### Research Flags to Heed

| Flag | Risk | Phase |
|------|------|-------|
| Service worker scope: public/sw.js only | High — wrong scope means push events never fire | 134 |
| VAPID_PRIVATE_KEY must NOT have NEXT_PUBLIC_ prefix | High — would expose private key in client bundle | 134 |
| Price baseline capture timing: write-once before FPL resets cost_change_start | High — missed window loses cross-season delta | 133 |
| Notification rate limiting: max 3 per run, 24h cooldown | Medium — pipeline runs 4x daily | 134-135 |
| Deadline times are not static — read from bootstrap at runtime | Medium — BGWs/DGWs shift deadlines | 132, 135 |

### Deferred Items

None at milestone start.

## Session Continuity

Last session: 2026-05-22T12:00:00.000Z
Stopped at: Phase 131 executed — SPEC-01/02/03 complete

## Operator Next Steps

- Run `/gsd-discuss-phase 132` to discuss Phase 132: Deadline Day Banner (recommended)
- Or `/gsd-plan-phase 132` to plan directly
