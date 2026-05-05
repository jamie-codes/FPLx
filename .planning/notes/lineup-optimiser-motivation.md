---
title: Lineup Optimiser — Motivation & Design Decisions
date: 2026-05-05
context: Emerged from /gsd-explore session after Phase 67
---

## The Problem

Users default to gut feel and ceiling-chasing when picking their starting XI. A concrete example: benching Casemiro (who scored 12 pts) in favour of Mukiele (0 pts) because Mukiele "might get a haul as a defender." The user was backing upside over expected value — a classic FPL trap.

The system already has `xPts_1gw` and `start_prob` for every player. Showing the EV gap explicitly ("Casemiro: 4.8 xPts / Mukiele: 2.1 xPts") would make the right call obvious.

## Core Design Decisions

- **Output**: Recommended starting XI + bench order as a concrete team sheet, not a ranked list
- **Scoring**: Maximise total `xPts_1gw × start_prob` across the 11 starters
- **Formation**: Solve for highest-EV legal formation (min 1 GK, 3 DEF, 2 MID, 1 FWD) — don't enforce a preferred shape
- **Overrides**: User can swap benched ↔ starter player-by-player after seeing the recommendation
- **Bench order**: Rank remaining 4 by `xPts_1gw × start_prob` descending — best cover first

## What Makes This Useful

The insight isn't "here's a number" — it's "you're probably playing the wrong 11." The recommendation needs to show the EV gap clearly enough to override the instinct to back ceiling over floor.
