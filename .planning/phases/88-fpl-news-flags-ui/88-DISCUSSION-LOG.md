# Phase 88: FPL News Flags UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 88-FPL-News-Flags-UI
**Areas discussed:** GemTable indicator placement, Gate mechanism, Pipeline field gap

---

## GemTable Indicator Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip on Status badge | Add title= attribute showing news text — zero new columns, works on desktop hover. Row-expand echoes full text. | ✓ |
| Small icon in Player cell | ⚠ or coloured dot next to player name when news non-empty | |
| Row-expand only | News text only in expanded row detail panel | |

**User's choice:** Tooltip on Status badge (recommended)
**Notes:** Also confirmed row-expand should show full news text + news_added timestamp (yes, show both).

---

## Gate Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Add to accuracy.py (canonical pattern) | accuracy.py writes news_flag_enabled: true; canonical gate pattern matching other gates | ✓ |
| Skip the gate — always ON | No gate code, news renders whenever fields exist | |
| Local display config (no pipeline) | src/lib/displayConfig.ts constant — non-standard pattern | |

**User's choice:** Add to accuracy.py — canonical pattern
**Notes:** Gate ships ON by default since data is already in production.

---

## Pipeline Field Gap

| Option | Description | Selected |
|--------|-------------|----------|
| Add both fields to merge.py (~3 lines) | Pass through chance_of_playing_next_round and news_added — enables severity colour logic and timestamp | ✓ |
| Derive severity from status field only | Skip the two fields, use status code for severity, no timestamp | |

**User's choice:** Add both fields to merge.py
**Notes:** Both fields are already in FPL bootstrap response; the pass-through is trivial.

---

## Claude's Discretion

- Component directory: `src/components/news/` (new directory, mirrors `shared/` pattern)
- Mobile portrait: rely on row-expand for news detail (Status tooltip not accessible on touch)
- `news_added` format: use existing `formatRelativeTime()` utility
- `NewsBanner` also surfaces in SquadView for owned flagged players (D-08)

## Deferred Ideas

None — discussion stayed within phase scope.
